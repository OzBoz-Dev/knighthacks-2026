package vast

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/OzBoz-Dev/knighthacks-2026/api/contract"
)

// Get makes a Snapshot a Source, so fixture mode needs no Vast.ai call.
func (s Snapshot) Get(context.Context) (Snapshot, error) { return s, nil }

// LoadFixture reads a #26 envelope of normalized offers from path.
// The result is saved, with the original capture time from the file.
func LoadFixture(path string) (Snapshot, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return Snapshot{}, fmt.Errorf("read vast fixture: %w", err)
	}
	var env contract.Envelope[[]contract.Offer]
	if err := json.Unmarshal(b, &env); err != nil {
		return Snapshot{}, fmt.Errorf("parse vast fixture: %w", err)
	}
	at, err := time.Parse(time.RFC3339, env.CapturedAt)
	if err != nil {
		return Snapshot{}, errors.New("vast fixture: captured_at is not RFC 3339")
	}
	if env.Data == nil {
		env.Data = []contract.Offer{}
	}
	return Snapshot{Offers: env.Data, CapturedAt: at.UTC(), Saved: true}, nil
}
