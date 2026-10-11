import { TransactionExpiredBlockheightExceededError, type Connection, type PublicKey, type Transaction } from "@solana/web3.js";
import { describeApiError } from "../api/client";
import { confirmReservation, createReservation, type CreateReservationBody } from "../api/reservations";
import type { Reservation } from "../api/types";
import { CHECK_LABELS } from "../reservations/verification";
import { buildReservationTransaction } from "./memo";
import { checkPayloadHash } from "./payload-hash";

// The PRD 5.3 statuses: Pending signature, Confirming, Verified on Solana, Signature rejected, Verification failed.
// "error" is an RPC, wallet, or API failure that is not a verdict on the reservation.
export type ReserveState =
  | { step: "idle" }
  | { step: "creating" }
  | { step: "awaiting-signature"; reservation: Reservation }
  | { step: "confirming"; reservation: Reservation; signature: string }
  | { step: "verified"; reservation: Reservation; signature: string }
  | { step: "rejected"; reservation: Reservation }
  | { step: "verification-failed"; reservation: Reservation; signature: string; message: string }
  | { step: "error"; message: string; reservation?: Reservation; signature?: string };

export type ReserveDeps = {
  wallet: PublicKey;
  connection: Pick<Connection, "getLatestBlockhash" | "confirmTransaction">;
  sendTransaction: (transaction: Transaction) => Promise<string>;
  onState: (state: ReserveState) => void;
  api?: { create: typeof createReservation; confirm: typeof confirmReservation };
};

const DEVNET_DOWN = "Couldn't reach Solana devnet. Check your connection, then sign again. Nothing was sent.";

// Phantom rejects with code 4001 and the text "User rejected the request."
export function isUserRejection(error: unknown): boolean {
  const e = error as { message?: unknown; error?: { code?: unknown; message?: unknown } } | null;
  return e?.error?.code === 4001 || /reject|declin|denied|cancel/i.test(`${e?.message ?? ""} ${e?.error?.message ?? ""}`);
}

const report = (deps: ReserveDeps, state: ReserveState) => {
  deps.onState(state);
  return state;
};

// Step 1. A mutation: it runs once per user action and is never retried here.
export async function reserve(body: CreateReservationBody, deps: ReserveDeps): Promise<ReserveState> {
  report(deps, { step: "creating" });
  let reservation: Reservation;
  try {
    reservation = await (deps.api?.create ?? createReservation)(body);
  } catch (error) {
    return report(deps, { step: "error", message: `${describeApiError(error)} Nothing was signed.` });
  }
  return signAndConfirm(reservation, deps);
}

// Steps 2 to 4 for a pending reservation. "Sign again" calls this with a fresh blockhash and the same reservation.
export async function signAndConfirm(reservation: Reservation, deps: ReserveDeps): Promise<ReserveState> {
  if (reservation.wallet !== deps.wallet.toBase58()) {
    return report(deps, { step: "error", reservation, message: "This reservation belongs to another wallet. Connect that wallet to sign it." });
  }
  // The memo carries the hash, so a payload that does not hash to it must never be signed.
  if (!(await checkPayloadHash(reservation))) {
    return report(deps, { step: "error", message: "The reservation from the API doesn't match its hash, so nothing was signed. Reserve the offer again." });
  }
  report(deps, { step: "awaiting-signature", reservation });
  let latest: Awaited<ReturnType<ReserveDeps["connection"]["getLatestBlockhash"]>>;
  try {
    latest = await deps.connection.getLatestBlockhash("confirmed");
  } catch {
    return report(deps, { step: "error", reservation, message: DEVNET_DOWN });
  }
  const transaction = buildReservationTransaction(deps.wallet, reservation);
  transaction.recentBlockhash = latest.blockhash;
  transaction.lastValidBlockHeight = latest.lastValidBlockHeight;
  let signature: string;
  try {
    signature = await deps.sendTransaction(transaction);
  } catch (error) {
    if (isUserRejection(error)) return report(deps, { step: "rejected", reservation });
    return report(deps, { step: "error", reservation, message: "Phantom couldn't send the transaction. Check that Phantom is on Solana Devnet and has devnet SOL, then sign again." });
  }
  report(deps, { step: "confirming", reservation, signature });
  try {
    await deps.connection.confirmTransaction({ signature, ...latest }, "confirmed");
  } catch (error) {
    if (error instanceof TransactionExpiredBlockheightExceededError) {
      return report(deps, { step: "error", reservation, message: "The transaction expired before devnet confirmed it. Sign again to send a new one." });
    }
    // The transaction may still land, so the retry checks the same signature instead of signing again.
    return report(deps, { step: "error", reservation, signature, message: "Solana devnet hasn't confirmed your transaction yet. Check again in a few seconds." });
  }
  return confirmOnApi(reservation, signature, deps);
}

// Step 5. "Check again" calls this with the same signature, because the API keeps one signature per reservation.
export async function confirmOnApi(reservation: Reservation, signature: string, deps: ReserveDeps): Promise<ReserveState> {
  report(deps, { step: "confirming", reservation, signature });
  try {
    const result = await (deps.api?.confirm ?? confirmReservation)(reservation.id, signature);
    if (result.reservation.status === "confirmed") return report(deps, { step: "verified", reservation: result.reservation, signature });
    const failed = result.failed_checks.map((name) => CHECK_LABELS[name]).join("; ");
    return report(deps, { step: "verification-failed", reservation: result.reservation, signature, message: `The solGPU API couldn't verify this transaction. Failed: ${failed}. Reserve the offer again.` });
  } catch (error) {
    return report(deps, { step: "error", reservation, signature, message: `${describeApiError(error)} Your transaction is kept, so you can check again.` });
  }
}
