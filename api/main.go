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

	"github.com/OzBoz-Dev/knighthacks-2026/api/collector"
	"github.com/OzBoz-Dev/knighthacks-2026/api/contract"
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
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	medians := registerMarket(mux, cfg)

	mux.Handle("POST /api/reservations", createReservation(db, noOffers{}))

	vastClient := vast.NewClient(cfg.VastAPIKey)
	offers, err := newOfferSource(cfg, vastClient, vastFixturePath)
	if err != nil {
		slog.Error("vast fixture", "err", err)
		os.Exit(1)
	}
	mux.HandleFunc("GET /api/offers", offersHandler(offers, medians.get))
	mux.HandleFunc("POST /api/match", matchHandler(offers))

	srv := &http.Server{Addr: ":" + cfg.Port, Handler: withLogging(withRecovery(withCORS(cfg.AllowedOrigin, mux))), ReadHeaderTimeout: 10 * time.Second}

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

// noOffers is a placeholder until the offers lane supplies the snapshot lookup.
type noOffers struct{}

func (noOffers) Offer(string, string) (contract.Offer, bool) { return contract.Offer{}, false }
