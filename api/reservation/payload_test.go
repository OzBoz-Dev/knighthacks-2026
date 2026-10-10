package reservation

import (
	"testing"

	"github.com/OzBoz-Dev/knighthacks-2026/api/contract"
)

func sample() contract.Reservation {
	region := "US"
	return contract.Reservation{ID: "res_0123456789abcdef", RequestID: "req_1", SnapshotID: "snap_1", OfferID: "offer_1",
		Wallet: "11111111111111111111111111111111", GPUName: "RTX 4090", PricePerHour: 0.5, MinVRAMGB: 24,
		MaxPricePerHour: 1, Priority: "balanced", Region: &region, CreatedAt: "2026-01-01T00:00:00Z"}
}

const (
	wantPayload = `{"created_at":"2026-01-01T00:00:00Z","gpu_name":"RTX 4090","id":"res_0123456789abcdef","max_price_per_hour":1,"min_vram_gb":24,"offer_id":"offer_1","price_per_hour":0.5,"priority":"balanced","region":"US","request_id":"req_1","snapshot_id":"snap_1","wallet":"11111111111111111111111111111111"}`
	wantHash    = "8740a30d79feab7bce22c1a276a80a52a2d03efbfc3ebbf364a8ab8e25d1ace2"
)

func TestPayloadKnownVector(t *testing.T) {
	p, h, err := Payload(sample())
	if err != nil {
		t.Fatal(err)
	}
	if p != wantPayload {
		t.Fatalf("payload = %s", p)
	}
	if h != wantHash {
		t.Fatalf("hash = %s", h)
	}
}

func TestPayloadStable(t *testing.T) {
	p1, h1, _ := Payload(sample())
	p2, h2, _ := Payload(sample())
	if p1 != p2 || h1 != h2 {
		t.Fatal("two builds differ")
	}
}

func TestPayloadChangedFieldChangesHash(t *testing.T) {
	_, h1, _ := Payload(sample())
	r := sample()
	r.PricePerHour = 0.51
	_, h2, _ := Payload(r)
	if h1 == h2 {
		t.Fatal("hash did not change")
	}
	r = sample()
	r.Region = nil
	if p, h3, _ := Payload(r); h3 == h1 || p == wantPayload {
		t.Fatal("nil region did not change the payload")
	}
}

func TestMemo(t *testing.T) {
	if got := Memo("res_1", "abc"); got != "CX1|res_1|abc" {
		t.Fatalf("memo = %s", got)
	}
}
