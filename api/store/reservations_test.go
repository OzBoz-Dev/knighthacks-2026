package store

import (
	"database/sql"
	"errors"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/OzBoz-Dev/knighthacks-2026/api/contract"
)

func testDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func sample(id, wallet, createdAt string) contract.Reservation {
	region := "US"
	return contract.Reservation{ID: id, RequestID: "req", SnapshotID: "snap", OfferID: "o1", Wallet: wallet,
		GPUName: "RTX 4090", PricePerHour: 0.5, MinVRAMGB: 24, MaxPricePerHour: 1, Priority: "balanced",
		Region: &region, CreatedAt: createdAt, CanonicalPayload: "{}", PayloadHash: "h", Status: contract.StatusPending}
}

func TestCreateGet(t *testing.T) {
	db := testDB(t)
	want := sample("res_1", "w1", "2026-01-01T00:00:00Z")
	if err := Create(db, want); err != nil {
		t.Fatal(err)
	}
	got, err := Get(db, "res_1")
	if err != nil || !reflect.DeepEqual(got, want) {
		t.Fatalf("got %+v, err %v", got, err)
	}
	if _, err := Get(db, "missing"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("err = %v, want ErrNotFound", err)
	}
}

func TestListByWalletNewestFirst(t *testing.T) {
	db := testDB(t)
	for _, r := range []contract.Reservation{
		sample("res_a", "w1", "2026-01-01T00:00:00Z"),
		sample("res_b", "w1", "2026-01-02T00:00:00Z"),
		sample("res_c", "w1", "2026-01-02T00:00:00Z"),
		sample("res_d", "w2", "2026-01-03T00:00:00Z"),
	} {
		if err := Create(db, r); err != nil {
			t.Fatal(err)
		}
	}
	list, err := ListByWallet(db, "w1")
	if err != nil {
		t.Fatal(err)
	}
	var ids []string
	for _, r := range list {
		ids = append(ids, r.ID)
	}
	if !reflect.DeepEqual(ids, []string{"res_c", "res_b", "res_a"}) {
		t.Fatalf("ids = %v", ids)
	}
	if none, _ := ListByWallet(db, "nobody"); none == nil || len(none) != 0 {
		t.Fatalf("empty list = %v", none)
	}
}

func TestMarkConfirmedAndFailed(t *testing.T) {
	db := testDB(t)
	for _, id := range []string{"res_1", "res_2"} {
		if err := Create(db, sample(id, "w1", "2026-01-01T00:00:00Z")); err != nil {
			t.Fatal(err)
		}
	}
	if err := MarkConfirmed(db, "res_1", "sig", 42); err != nil {
		t.Fatal(err)
	}
	r, _ := Get(db, "res_1")
	if r.Status != contract.StatusConfirmed || r.Signature == nil || *r.Signature != "sig" || r.Slot == nil || *r.Slot != 42 {
		t.Fatalf("confirmed = %+v", r)
	}
	if err := MarkFailed(db, "res_2"); err != nil {
		t.Fatal(err)
	}
	if r, _ = Get(db, "res_2"); r.Status != contract.StatusFailed || r.Signature != nil {
		t.Fatalf("failed = %+v", r)
	}
	if err := MarkFailed(db, "missing"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("err = %v", err)
	}
}

func TestMarkKeepsConfirmedReceipt(t *testing.T) {
	db := testDB(t)
	if err := Create(db, sample("res_1", "w1", "2026-01-01T00:00:00Z")); err != nil {
		t.Fatal(err)
	}
	if err := MarkConfirmed(db, "res_1", "sig", 42); err != nil {
		t.Fatal(err)
	}
	if err := MarkFailed(db, "res_1"); !errors.Is(err, ErrNotPending) {
		t.Fatalf("MarkFailed err = %v", err)
	}
	if err := MarkConfirmed(db, "res_1", "other", 7); !errors.Is(err, ErrNotPending) {
		t.Fatalf("MarkConfirmed err = %v", err)
	}
	r, _ := Get(db, "res_1")
	if r.Status != contract.StatusConfirmed || *r.Signature != "sig" || *r.Slot != 42 {
		t.Fatalf("receipt changed: %+v", r)
	}
}
