package main

import (
	"bytes"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRecoveryReturns500AndKeepsServing(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /boom", func(http.ResponseWriter, *http.Request) { panic("boom") })
	mux.HandleFunc("GET /ok", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })
	srv := httptest.NewServer(withRecovery(mux))
	defer srv.Close()

	res, err := http.Get(srv.URL + "/boom")
	if err != nil {
		t.Fatal(err)
	}
	var buf bytes.Buffer
	buf.ReadFrom(res.Body)
	res.Body.Close()
	if res.StatusCode != http.StatusInternalServerError || !strings.Contains(buf.String(), `"code":"internal"`) {
		t.Fatalf("got %d %s", res.StatusCode, buf.String())
	}

	res, err = http.Get(srv.URL + "/ok")
	if err != nil || res.StatusCode != http.StatusNoContent {
		t.Fatalf("server stopped after a panic: %v %v", err, res)
	}
}

func TestLoggingWritesOneLine(t *testing.T) {
	var buf bytes.Buffer
	prev := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&buf, nil)))
	defer slog.SetDefault(prev)

	h := withLogging(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) }))
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/api/x", nil))

	line := buf.String()
	if strings.Count(line, "\n") != 1 || !strings.Contains(line, "method=GET") || !strings.Contains(line, "path=/api/x") || !strings.Contains(line, "status=418") || !strings.Contains(line, "duration=") {
		t.Fatalf("log = %q", line)
	}
}
