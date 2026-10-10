package databricks

import (
	"context"
	"fmt"
	"sync"
	"time"
)

const cacheTTL = 5 * time.Minute

type cacheEntry struct {
	result  Result
	expires time.Time
}

// Cache keeps each successful result for five minutes. It never keeps an error.
type Cache struct {
	next Querier
	now  func() time.Time
	mu   sync.Mutex
	m    map[string]cacheEntry
}

// NewCache wraps next. Tests pass a fake clock as now.
func NewCache(next Querier, now func() time.Time) *Cache {
	return &Cache{next: next, now: now, m: map[string]cacheEntry{}}
}

// Query returns the cached result of the same statement and parameters, or asks next.
// shortcut: the map never drops expired keys, upgrade if the key count grows past a few hundred.
// shortcut: no single-flight, so two equal calls at once both reach next, upgrade if the warehouse load grows.
func (c *Cache) Query(ctx context.Context, statement string, params ...Param) (Result, error) {
	key := fmt.Sprintf("%q%q", statement, params)
	c.mu.Lock()
	e, ok := c.m[key]
	c.mu.Unlock()
	if ok && c.now().Before(e.expires) {
		return e.result, nil
	}
	res, err := c.next.Query(ctx, statement, params...)
	if err != nil {
		return Result{}, err
	}
	c.mu.Lock()
	c.m[key] = cacheEntry{res, c.now().Add(cacheTTL)}
	c.mu.Unlock()
	return res, nil
}
