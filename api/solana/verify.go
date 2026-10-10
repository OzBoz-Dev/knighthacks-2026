// Package solana verifies a reservation memo transaction on Solana devnet.
package solana

import (
	"context"
	"errors"
	"fmt"
	"strings"

	sol "github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/rpc"
)

// The check names, in the order that Verify returns them.
const (
	CheckExists        = "exists"
	CheckSigner        = "signer"
	CheckReservationID = "reservation_id"
	CheckMemoHash      = "memo_hash"
	CheckConfirmed     = "confirmed"
)

// TxGetter fetches one transaction. *rpc.Client satisfies it.
type TxGetter interface {
	GetTransaction(ctx context.Context, sig sol.Signature, opts *rpc.GetTransactionOpts) (*rpc.GetTransactionResult, error)
}

// Expected holds the values from the stored reservation that the memo must match.
type Expected struct {
	Prefix        string // the memo prefix, for example "SG1"
	ReservationID string
	Wallet        string // the reservation wallet, base58
	PayloadHash   string
}

// Check is the result of one verification check.
type Check struct {
	Name   string `json:"name"`
	Passed bool   `json:"passed"`
	Detail string `json:"detail"`
}

// Result holds one check per name, in the fixed order of the Check constants.
type Result struct {
	Checks []Check `json:"checks"`
	Slot   *uint64 `json:"slot,omitempty"`
}

// Verify fetches the transaction with confirmed commitment and checks it against want.
// It returns an error for an invalid signature or an RPC failure, and a failed check otherwise.
func Verify(ctx context.Context, client TxGetter, signature string, want Expected) (Result, error) {
	sig, err := sol.SignatureFromBase58(signature)
	if err != nil {
		return Result{}, fmt.Errorf("invalid transaction signature: %w", err)
	}
	maxVersion := uint64(0)
	out, err := client.GetTransaction(ctx, sig, &rpc.GetTransactionOpts{
		Encoding:                       sol.EncodingBase64,
		Commitment:                     rpc.CommitmentConfirmed,
		MaxSupportedTransactionVersion: &maxVersion,
	})
	if errors.Is(err, rpc.ErrNotFound) || (err == nil && out.Transaction == nil) {
		res := Result{}
		for _, name := range []string{CheckExists, CheckSigner, CheckReservationID, CheckMemoHash, CheckConfirmed} {
			res.Checks = append(res.Checks, Check{Name: name, Detail: "transaction not found"})
		}
		return res, nil
	}
	if err != nil {
		return Result{}, fmt.Errorf("get transaction: %w", err)
	}
	tx, err := out.Transaction.GetTransaction()
	if err != nil {
		return Result{}, fmt.Errorf("decode transaction: %w", err)
	}
	msg := tx.Message
	return Result{
		Checks: []Check{
			{Name: CheckExists, Passed: true, Detail: fmt.Sprintf("found in slot %d", out.Slot)},
			checkSigner(msg, want.Wallet),
			checkMemoField(CheckReservationID, msg, want.Prefix, 1, want.ReservationID),
			checkMemoField(CheckMemoHash, msg, want.Prefix, 2, want.PayloadHash),
			checkConfirmed(out.Meta),
		},
		Slot: &out.Slot,
	}, nil
}

// checkSigner passes when wallet is one of the first header.numRequiredSignatures account keys.
func checkSigner(msg sol.Message, wallet string) Check {
	c := Check{Name: CheckSigner}
	key, err := sol.PublicKeyFromBase58(wallet)
	if err != nil {
		c.Detail = "the reservation wallet is not a valid address"
		return c
	}
	n := min(int(msg.Header.NumRequiredSignatures), len(msg.AccountKeys))
	for _, k := range msg.AccountKeys[:n] {
		if k.Equals(key) {
			c.Passed, c.Detail = true, "the reservation wallet signed"
			return c
		}
	}
	c.Detail = "the reservation wallet did not sign"
	return c
}

// checkMemoField compares field i of the memo "<prefix>|<reservation_id>|<payload_hash>" with want.
func checkMemoField(name string, msg sol.Message, prefix string, i int, want string) Check {
	c := Check{Name: name}
	memo, ok := findMemo(msg, prefix)
	if !ok {
		c.Detail = fmt.Sprintf("no memo with the prefix %q", prefix)
		return c
	}
	parts := strings.Split(memo, "|")
	if len(parts) != 3 {
		c.Detail = fmt.Sprintf("memo %q does not have 3 fields", memo)
		return c
	}
	c.Passed = parts[i] == want
	if c.Passed {
		c.Detail = "memo has " + want
	} else {
		c.Detail = fmt.Sprintf("memo has %s, want %s", parts[i], want)
	}
	return c
}

// findMemo returns the data of the first SPL Memo instruction that starts with prefix.
// It accepts the v2 and the v1 Memo programs, because P3 can sign with either one.
func findMemo(msg sol.Message, prefix string) (string, bool) {
	for _, ix := range msg.Instructions {
		idx := int(ix.ProgramIDIndex)
		if idx >= len(msg.AccountKeys) {
			continue
		}
		if p := msg.AccountKeys[idx]; !p.Equals(sol.MemoProgramID) && !p.Equals(sol.MemoProgramIDV1) {
			continue
		}
		if memo := string(ix.Data); strings.HasPrefix(memo, prefix+"|") {
			return memo, true
		}
	}
	return "", false
}

// checkConfirmed passes when the transaction did not fail. The confirmed commitment
// of the request already excludes a transaction that is only processed.
func checkConfirmed(meta *rpc.TransactionMeta) Check {
	c := Check{Name: CheckConfirmed}
	switch {
	case meta == nil:
		c.Detail = "the transaction has no status"
	case meta.Err != nil:
		c.Detail = fmt.Sprintf("the transaction failed: %v", meta.Err)
	default:
		c.Passed, c.Detail = true, "confirmed without error"
	}
	return c
}
