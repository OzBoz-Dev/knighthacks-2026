package httpx

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWriteErrorShape(t *testing.T) {
	rec := httptest.NewRecorder()
	WriteError(rec, http.StatusBadRequest, CodeBadRequest, "gpu_name is required")

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("content type = %q", ct)
	}
	var body map[string]map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["error"]["code"] != "bad_request" || body["error"]["message"] != "gpu_name is required" || len(body) != 1 {
		t.Fatalf("body = %s", rec.Body)
	}
}

func TestNotFoundRoute(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/", NotFound)
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	for path, want := range map[string]int{"/api/nope": http.StatusNotFound, "/": http.StatusNotFound, "/api/health": http.StatusOK} {
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		var body ErrorBody
		json.Unmarshal(rec.Body.Bytes(), &body)
		if rec.Code != want || (want == http.StatusNotFound && body.Error.Code != CodeNotFound) {
			t.Errorf("%s: status %d body %s", path, rec.Code, rec.Body)
		}
	}
}
