package databricks

import (
	"context"
	"strings"
	"testing"
)

type rowsQuerier struct {
	rows      [][]string
	statement string
	params    []Param
}

func (r *rowsQuerier) Query(_ context.Context, s string, p ...Param) (Result, error) {
	r.statement, r.params = s, p
	return Result{Rows: r.rows}, nil
}

func TestSummary(t *testing.T) {
	q := &rowsQuerier{rows: [][]string{{"RTX 4090", "212", "0.29", "0.48", "0.71", "0.981", "2026-10-10T20:00:00.000Z"}}}
	s, err := Summary(context.Background(), q, "RTX 4090")
	if err != nil {
		t.Fatal(err)
	}
	if s.GPUName != "RTX 4090" || s.ListingCount != 212 || s.MedianPrice != 0.48 || s.UpdatedAt != "2026-10-10T20:00:00Z" {
		t.Fatalf("summary = %+v", s)
	}
	if strings.Contains(q.statement, "RTX") || len(q.params) != 1 || q.params[0].Name != "gpu_name" {
		t.Fatalf("statement %q params %v", q.statement, q.params)
	}

	q.rows = nil
	if s, err := Summary(context.Background(), q, "none"); s != nil || err != nil {
		t.Fatalf("no row must give nil, got %v %v", s, err)
	}
	q.rows = [][]string{{"RTX 4090", "x", "0.29", "0.48", "0.71", "0.981", "2026-10-10 20:00:00"}}
	if _, err := Summary(context.Background(), q, "RTX 4090"); err == nil {
		t.Fatal("want error for a bad number")
	}
}

func TestMedians(t *testing.T) {
	q := &rowsQuerier{rows: [][]string{{"RTX 4090", "0.48"}, {"A100 PCIE", "1.2"}}}
	m, err := Medians(context.Background(), q)
	if err != nil || len(m) != 2 || m["RTX 4090"] != 0.48 || m["A100 PCIE"] != 1.2 || len(q.params) != 0 {
		t.Fatalf("medians %v err %v params %v", m, err, q.params)
	}
	for _, rows := range [][][]string{{{"RTX 4090"}}, {{"RTX 4090", "x"}}} {
		q.rows = rows
		if _, err := Medians(context.Background(), q); err == nil {
			t.Fatalf("want error for rows %v", rows)
		}
	}
}

func TestTrends(t *testing.T) {
	q := &rowsQuerier{rows: [][]string{
		{"2026-10-10 16:40:00", "0.3", "0.49", "0.33", "0.7", "204"},
		{"2026-10-10 16:50:00", "0.31", "0.5", "0.34", "0.71", "210"},
	}}
	pts, err := Trends(context.Background(), q, "RTX 4090", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(pts) != 2 || pts[1].P10Price != 0.34 || pts[1].Timestamp != "2026-10-10T16:50:00Z" || pts[0].ListingCount != 204 {
		t.Fatalf("points = %+v", pts)
	}
	if len(q.params) != 2 || q.params[1] != (Param{"region", "ALL"}) {
		t.Fatalf("params = %v", q.params)
	}
	q.rows = [][]string{{"2026-10-10 16:40:00", "0.3"}}
	if _, err := Trends(context.Background(), q, "g", ""); err == nil {
		t.Fatal("want error for a short row")
	}
}

func TestLatestTime(t *testing.T) {
	q := &rowsQuerier{rows: [][]string{{"2026-10-10 15:00:00"}}}
	if got, err := SummaryUpdatedAt(context.Background(), q); err != nil || got != "2026-10-10T15:00:00Z" {
		t.Fatalf("got %q %v", got, err)
	}
	q.rows = [][]string{{""}}
	if _, err := TrendsUpdatedAt(context.Background(), q); err == nil {
		t.Fatal("want error for NULL")
	}
	q.rows = nil
	if _, err := TrendsUpdatedAt(context.Background(), q); err == nil {
		t.Fatal("want error for no row")
	}
}
