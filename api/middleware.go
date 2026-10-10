package main

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/OzBoz-Dev/knighthacks-2026/api/httpx"
)

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

// withLogging writes one log line per request.
func withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		slog.Info("request", "method", r.Method, "path", r.URL.Path, "status", rec.status, "duration", time.Since(start))
	})
}

// withRecovery turns a panic in a handler into a 500 error body, so the server keeps running.
func withRecovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				if v == http.ErrAbortHandler {
					panic(v)
				}
				slog.Error("panic", "method", r.Method, "path", r.URL.Path, "panic", v)
				httpx.WriteError(w, http.StatusInternalServerError, httpx.CodeInternal, "The server had an internal error.")
			}
		}()
		next.ServeHTTP(w, r)
	})
}
