package vast

import (
	"context"
	"errors"
	"log/slog"
	"maps"
	"sync"
	"time"

	"github.com/OzBoz-Dev/knighthacks-2026/api/contract"
)

// Snapshot is a set of normalized offers. Saved is true when the offers are not fresh.
// CapturedAt is always the original capture time.
type Snapshot struct {
	Offers     []contract.Offer
	CapturedAt time.Time
	Saved      bool
}

// Source gives the current offers. Cache and Snapshot (fixture mode) both implement it.
type Source interface {
	Get(ctx context.Context) (Snapshot, error)
}

// Fetcher is the part of Client that the cache uses.
type Fetcher interface {
	Fetch(ctx context.Context) (Result, error)
}

// Cache keeps the last good result for the TTL. A failed refresh serves that result as saved.
type Cache struct {
	fetcher Fetcher
	ttl     time.Duration
	now     func() time.Time

	// The mutex also holds back a second refresh, so two requests make one Vast.ai call.
	mu        sync.Mutex
	last      Snapshot
	have      bool
	drops     map[string]int
	fetchedAt time.Time
}

var errNoData = errors.New("no vast data")

func NewCache(f Fetcher, ttl time.Duration, now func() time.Time) *Cache {
	return &Cache{fetcher: f, ttl: ttl, now: now}
}

func (c *Cache) Get(ctx context.Context) (Snapshot, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	// A failed refresh also waits one TTL, so a down Vast.ai gets one call per TTL, not one per request.
	if c.now().Sub(c.fetchedAt) < c.ttl {
		if !c.have {
			return Snapshot{}, errNoData
		}
		return c.last, nil
	}
	res, err := c.fetcher.Fetch(ctx)
	if err != nil {
		slog.Warn("vast refresh failed", "err", err)
		if ctx.Err() == nil { // a request that the client cancelled says nothing about Vast.ai
			c.fetchedAt = c.now()
		}
		if !c.have {
			return Snapshot{}, errNoData
		}
		c.last.Saved = true
		return c.last, nil
	}
	offers, drops := Normalize(res.Offers)
	c.drops = drops
	if len(drops) > 0 {
		slog.Warn("vast offers dropped", "drops", drops)
	}
	c.last = Snapshot{Offers: offers, CapturedAt: res.CapturedAt}
	c.have, c.fetchedAt = true, c.now()
	return c.last, nil
}

// Drops returns the drop counts of the last good refresh, for the health endpoint.
func (c *Cache) Drops() map[string]int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return maps.Clone(c.drops)
}
