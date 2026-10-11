// Package vast reads rentable on-demand offers from the Vast.ai API.
package vast

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"
)

const (
	// DefaultBaseURL is the Vast.ai console API root.
	DefaultBaseURL = "https://console.vast.ai"
	requestTimeout = 10 * time.Second
	// Vast.ai returns 64 offers without a limit. The server caps the limit below 2000.
	query = `{"rentable":{"eq":true},"type":"on-demand","limit":2000}`
)

// Result holds the raw offers and the time the client received them.
type Result struct {
	Offers     []json.RawMessage
	CapturedAt time.Time
}

// Client calls the Vast.ai bundles endpoint. Tests set BaseURL and Now.
type Client struct {
	BaseURL string
	Key     string
	HTTP    *http.Client
	Now     func() time.Time
}

func NewClient(key string) *Client {
	return &Client{BaseURL: DefaultBaseURL, Key: key, HTTP: http.DefaultClient, Now: time.Now}
}

// Fetch requests the offers with a 10 second timeout.
// Errors never hold the key. A non-200 status error names the status.
func (c *Client) Fetch(ctx context.Context) (Result, error) {
	ctx, cancel := context.WithTimeout(ctx, requestTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/api/v0/bundles/", bytes.NewReader([]byte(query)))
	if err != nil {
		return Result{}, errors.New("vast: build request")
	}
	req.Header.Set("Authorization", "Bearer "+c.Key)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.HTTP.Do(req)
	if err != nil {
		// The text of err holds the URL only, but a fixed text is safer than a wrapped one.
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return Result{}, errors.New("vast: request timed out")
		}
		return Result{}, errors.New("vast: request failed")
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return Result{}, fmt.Errorf("vast: status %d", resp.StatusCode)
	}
	var body struct {
		Offers []json.RawMessage `json:"offers"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return Result{}, errors.New("vast: invalid response body")
	}
	return Result{Offers: body.Offers, CapturedAt: c.Now().UTC()}, nil
}
