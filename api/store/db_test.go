package store

import (
	"fmt"
	"path/filepath"
	"sync"
	"testing"
)

func TestOpenCreatesTableAndKeepsRows(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sub", "test.db")
	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	var mode string
	if err := db.QueryRow("PRAGMA journal_mode").Scan(&mode); err != nil || mode != "wal" {
		t.Fatalf("journal mode = %q, err = %v", mode, err)
	}
	_, err = db.Exec(`INSERT INTO reservations (id, request_id, snapshot_id, offer_id, wallet, gpu_name,
		price_per_hour, min_vram_gb, max_price_per_hour, priority, created_at, canonical_payload, payload_hash, status)
		VALUES ('res_1','r','s','o','w','g',1,1,1,'balanced','t','{}','h','pending')`)
	if err != nil {
		t.Fatal(err)
	}
	db.Close()

	db, err = Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var n int
	if err := db.QueryRow("SELECT COUNT(*) FROM reservations").Scan(&n); err != nil || n != 1 {
		t.Fatalf("rows after reopen = %d, err = %v", n, err)
	}
}

func TestConcurrentInserts(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var wg sync.WaitGroup
	errs := make(chan error, 50)
	for i := range 50 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := db.Exec(`INSERT INTO reservations (id, request_id, snapshot_id, offer_id, wallet, gpu_name,
				price_per_hour, min_vram_gb, max_price_per_hour, priority, created_at, canonical_payload, payload_hash, status)
				VALUES (?,'r','s','o','w','g',1,1,1,'balanced','t','{}','h','pending')`, fmt.Sprint("res_", i))
			errs <- err
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
}
