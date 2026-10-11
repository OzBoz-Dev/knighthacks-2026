package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gagliardetto/solana-go/rpc"

	"github.com/OzBoz-Dev/knighthacks-2026/api/collector"
	"github.com/OzBoz-Dev/knighthacks-2026/api/httpx"
	"github.com/OzBoz-Dev/knighthacks-2026/api/store"
	"github.com/OzBoz-Dev/knighthacks-2026/api/vast"
)

func main() {
	if err := loadDotEnv(".env"); err != nil {
		slog.Error("read .env", "err", err)
		os.Exit(1)
	}
	cfg, err := loadConfig(os.Getenv)
	if err != nil {
		slog.Error("config", "err", err)
		os.Exit(1)
	}

	db, err := store.Open(cfg.DBPath)
	if err != nil {
		slog.Error("open db", "err", err)
		os.Exit(1)
	}
	defer db.Close()

	mux := http.NewServeMux()
	mux.HandleFunc("/", httpx.NotFound)
	medians := registerMarket(mux, cfg)

	vastClient := vast.NewClient(cfg.VastAPIKey)
	offers := newRecentSnapshots(newOfferSource(cfg, vastClient, vastFixturePath))
	go offers.Get(context.Background()) // fills the vast health status at start
	mux.HandleFunc("GET /api/health", healthHandler(healthChecks{cfg.UseVastFixture, cfg.UseDatabricksFixture, offers.vastStatus, medians.status, pingSQLite(db)}))
	mux.Handle("POST /api/reservations", createReservation(db, offers))
	chain := rpc.New(cfg.SolanaRPCURL)
	mux.Handle("POST /api/reservations/{id}/confirm", confirmReservation(db, chain))
	mux.Handle("GET /api/reservations", listReservations(db))
	mux.Handle("GET /api/reservations/{id}/verify", verifyReservation(db, chain))
	mux.HandleFunc("GET /api/offers", offersHandler(offers, medians.get))
	mux.HandleFunc("POST /api/match", matchHandler(offers, medians.get))

	srv := &http.Server{Addr: ":" + cfg.Port, Handler: withLogging(withRecovery(withCORS(cfg.AllowedOrigins, mux))), ReadHeaderTimeout: 10 * time.Second}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if !cfg.UseVastFixture {
		ticker := time.NewTicker(10 * time.Minute)
		defer ticker.Stop()
		go collector.Run(ctx, vastClient, cfg.SnapshotDir, ticker.C)
	}

	go func() {
		slog.Info("api listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server stopped", "err", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("shutdown failed", "err", err)
	}
}
