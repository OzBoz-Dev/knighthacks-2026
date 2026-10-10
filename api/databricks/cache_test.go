package databricks

import (
	"context"
	"errors"
	"testing"
	"time"
)

type fakeQuerier struct {
	calls int
	err   error
}

func (f *fakeQuerier) Query(_ context.Context, _ string, _ ...Param) (Result, error) {
	f.calls++
	return Result{Rows: [][]string{{"x"}}}, f.err
}

func TestCache(t *testing.T) {
	ctx := context.Background()
	now := time.Date(2026, 10, 10, 12, 0, 0, 0, time.UTC)
	q := &fakeQuerier{}
	c := NewCache(q, func() time.Time { return now })
	p := Param{"gpu_name", "RTX 4090"}

	c.Query(ctx, "SELECT 1", p)
	now = now.Add(4 * time.Minute)
	c.Query(ctx, "SELECT 1", p)
	if q.calls != 1 {
		t.Fatalf("calls within 5 minutes = %d, want 1", q.calls)
	}
	c.Query(ctx, "SELECT 1", Param{"gpu_name", "A100"})
	if q.calls != 2 {
		t.Fatalf("other parameter must miss, calls = %d", q.calls)
	}
	now = now.Add(2 * time.Minute)
	c.Query(ctx, "SELECT 1", p)
	if q.calls != 3 {
		t.Fatalf("entry must expire after 5 minutes, calls = %d", q.calls)
	}

	q.err = errors.New("down")
	if _, err := c.Query(ctx, "SELECT 2"); err == nil {
		t.Fatal("want error")
	}
	q.err = nil
	c.Query(ctx, "SELECT 2")
	if q.calls != 5 {
		t.Fatalf("error must not be cached, calls = %d", q.calls)
	}
}
