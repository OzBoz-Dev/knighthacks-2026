// Package httpx holds the JSON response helpers that every handler uses.
package httpx

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

// Error codes from the #26 error shape.
const (
	CodeBadRequest          = "bad_request"
	CodeNotFound            = "not_found"
	CodeUpstreamUnavailable = "upstream_unavailable"
	CodeInternal            = "internal"
)

// ErrorBody is the JSON body of every non-2xx response.
type ErrorBody struct {
	Error ErrorDetail `json:"error"`
}

type ErrorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// WriteJSON writes v as JSON with the status.
func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("write json", "err", err)
	}
}

// WriteError writes the #26 error shape. The message must be safe to show to a user.
func WriteError(w http.ResponseWriter, status int, code, message string) {
	WriteJSON(w, status, ErrorBody{ErrorDetail{Code: code, Message: message}})
}

// NotFound answers a path that no route has, with the #26 error shape.
// A wrong method on a known path also gets it, because the catch-all route matches every method.
func NotFound(w http.ResponseWriter, _ *http.Request) {
	WriteError(w, http.StatusNotFound, CodeNotFound, "No API endpoint has that path.")
}
