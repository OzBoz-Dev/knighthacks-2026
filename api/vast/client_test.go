package vast

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

var fixedNow = time.Date(2026, 10, 10, 20, 10, 0, 0, time.UTC)

func testClient(url string) *Client {
	c := NewClient("secret-key")
	c.BaseURL = url
	c.Now = func() time.Time { return fixedNow }
	return c
}

func TestFetchSuccess(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer secret-key" || r.Method != http.MethodPost || r.URL.Path != "/api/v0/bundles/" {
			t.Errorf("bad request: %s %s %q", r.Method, r.URL.Path, r.Header.Get("Authorization"))
		}
		body, _ := io.ReadAll(r.Body)
		if !strings.Contains(string(body), `"limit":2000`) {
			t.Errorf("body = %s, want a limit of 2000", body)
		}
		w.Write([]byte(`{"offers":[{"id":1},{"id":2}]}`))
	}))
	defer srv.Close()
	got, err := testClient(srv.URL).Fetch(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Offers) != 2 || string(got.Offers[0]) != `{"id":1}` || !got.CapturedAt.Equal(fixedNow) {
		t.Fatalf("result = %+v", got)
	}
}

func TestFetchServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "boom", http.StatusInternalServerError)
	}))
	defer srv.Close()
	_, err := testClient(srv.URL).Fetch(context.Background())
	if err == nil || !strings.Contains(err.Error(), "500") || strings.Contains(err.Error(), "secret-key") {
		t.Fatalf("err = %v", err)
	}
}

func TestFetchTimeout(t *testing.T) {
	release := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-release
	}))
	defer srv.Close()
	defer close(release) // runs first, so srv.Close does not wait for the handler
	// The caller context ends first, so the test does not wait 10 seconds.
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	_, err := testClient(srv.URL).Fetch(ctx)
	if err == nil || !strings.Contains(err.Error(), "timed out") || strings.Contains(err.Error(), "secret-key") {
		t.Fatalf("err = %v", err)
	}
}
