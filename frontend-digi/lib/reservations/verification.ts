import type { VerifyCheckName, VerifyResult } from "../api/reservations";
import type { VerificationOutcome } from "./status";

export const CHECK_LABELS: Record<VerifyCheckName, string> = {
  exists: "Transaction exists on Solana devnet",
  signer: "The reservation wallet signed",
  reservation_id: "Memo has the reservation ID",
  memo_hash: "Memo hash equals the stored payload hash",
  confirmed: "Transaction is confirmed",
};

// The API compares the memo hash with the stored payload_hash. The browser hashes the exact payload bytes,
// so both together show that the memo hash is the SHA-256 of the stored payload.
export function verificationOutcome(result: VerifyResult, payloadHashMatches: boolean): VerificationOutcome {
  return result.checks.every((check) => check.passed) && payloadHashMatches ? "passed" : "failed";
}

// A result for another signature belongs to an older version of the receipt and is never shown.
export const resultMatches = (result: VerifyResult, reservation: { id: string; signature: string | null }) =>
  result.reservation_id === reservation.id && result.signature === reservation.signature;
