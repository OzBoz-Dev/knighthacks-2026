package solana

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gagliardetto/solana-go/rpc"
)

// The values that the recorded transactions in testdata hold.
const (
	goodSig   = "3C2a9AcSpgQkUPxsbQ7mxvdtzfLmvkb6efFACaxVyinEevv9g19CEMQbu79gWVFeu3PVHPYphaEPekaYcGumMpyM"
	failedSig = "2L5QXv1Aj3oUfy6eDFz5tsBjT1m97A21e5zk5z8vwxU1yCRULWRa66tAHmPj27TegCWPv6puw9Kq87fnKZcH9Mqt"
	v1Sig     = "25k4G9ANxqHEBuQjRt1MHdPXPg4o55Hu1e8LsymqFzy5jtZRDkUw6XQSqkYbE9KCyGabPPgydSDjn1Lmci5o4Viq"
	noopSig   = "2vQ3iid5Nma2r6koD8XjwHaCqU6kXq6c5AhBzz7tjr2ZPr5rU3syPWAtbFPFJGdw8yfwBdfCWKD6oBAfjsPthiM9"
	wallet    = "GNN5rHKgxkUE3zCdrZxgPmciLSiVRezCpQVyNW2W4Zk3"
	resID     = "3b1f8c2a-6d4e-4f7a-9c0b-2e5d8a1f4c6b"
	hash      = "8675af8fe6185424cf3f4b29027aa829bf4735064d18879d698fcaa91f6e8ecc"
)

var good = Expected{Prefix: "SG1", ReservationID: resID, Wallet: wallet, PayloadHash: hash}

// recorded starts a JSON-RPC server that returns the testdata file and checks the request.
func recorded(t *testing.T, file, sig string) *rpc.Client {
	t.Helper()
	body, err := os.ReadFile("testdata/" + file)
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Method string            `json:"method"`
			Params []json.RawMessage `json:"params"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Method != "getTransaction" || len(req.Params) != 2 {
			t.Errorf("unexpected request %+v: %v", req, err)
		} else {
			var opts map[string]any
			json.Unmarshal(req.Params[1], &opts)
			if string(req.Params[0]) != `"`+sig+`"` || opts["commitment"] != "confirmed" || opts["encoding"] != "base64" || opts["maxSupportedTransactionVersion"] != 0.0 {
				t.Errorf("unexpected params %s %v", req.Params[0], opts)
			}
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(body)
	}))
	t.Cleanup(srv.Close)
	return rpc.New(srv.URL)
}

func TestVerify(t *testing.T) {
	tests := []struct {
		name   string
		file   string
		sig    string
		want   Expected
		failed []string
	}{
		{"good transaction", "get_transaction_good.json", goodSig, good, nil},
		{"wrong signer", "get_transaction_good.json", goodSig, Expected{"SG1", resID, "11111111111111111111111111111111", hash}, []string{CheckSigner}},
		// The memo program key is in the transaction, but it did not sign.
		{"account key that did not sign", "get_transaction_good.json", goodSig, Expected{"SG1", resID, "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr", hash}, []string{CheckSigner}},
		{"wrong prefix", "get_transaction_good.json", goodSig, Expected{"DG1", resID, wallet, hash}, []string{CheckReservationID, CheckMemoHash}},
		{"memo v1 program", "get_transaction_memo_v1.json", v1Sig, good, nil},
		{"memo text sent to another program", "get_transaction_other_program.json", noopSig, good, []string{CheckReservationID, CheckMemoHash}},
		{"wrong memo id", "get_transaction_good.json", goodSig, Expected{"SG1", "other-id", wallet, hash}, []string{CheckReservationID}},
		{"wrong hash", "get_transaction_good.json", goodSig, Expected{"SG1", resID, wallet, "00" + hash[2:]}, []string{CheckMemoHash}},
		{"failed transaction", "get_transaction_failed.json", failedSig, good, []string{CheckConfirmed}},
		{"missing transaction", "get_transaction_not_found.json", goodSig, good, []string{CheckExists, CheckSigner, CheckReservationID, CheckMemoHash, CheckConfirmed}},
	}
	order := []string{CheckExists, CheckSigner, CheckReservationID, CheckMemoHash, CheckConfirmed}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res, err := Verify(context.Background(), recorded(t, tt.file, tt.sig), tt.sig, tt.want)
			if err != nil {
				t.Fatal(err)
			}
			if len(res.Checks) != len(order) {
				t.Fatalf("got %d checks, want %d", len(res.Checks), len(order))
			}
			failed := map[string]bool{}
			for _, name := range tt.failed {
				failed[name] = true
			}
			for i, c := range res.Checks {
				if c.Name != order[i] {
					t.Errorf("check %d is %q, want %q", i, c.Name, order[i])
				}
				if c.Passed == failed[c.Name] {
					t.Errorf("check %s passed=%v (%s)", c.Name, c.Passed, c.Detail)
				}
			}
			if (res.Slot == nil) != (tt.file == "get_transaction_not_found.json") {
				t.Errorf("slot = %v", res.Slot)
			}
		})
	}
}

func TestVerifyErrors(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "upstream down", http.StatusBadGateway)
	}))
	defer srv.Close()
	if _, err := Verify(context.Background(), rpc.New(srv.URL), goodSig, good); err == nil {
		t.Error("an RPC failure returned no error")
	}
	if _, err := Verify(context.Background(), rpc.New(srv.URL), "not-a-signature", good); err == nil {
		t.Error("an invalid signature returned no error")
	}
}
