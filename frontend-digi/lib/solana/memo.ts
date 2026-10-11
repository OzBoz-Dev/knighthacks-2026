// The browser has no global Buffer, so the import comes from the package that web3.js uses.
import { Buffer } from "buffer";
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import type { Reservation } from "../api/types";

// The Go verifier (api/reservation.MemoPrefix) uses the same prefix to find a solGPU memo. Issue #41 chose SG1.
export const MEMO_PREFIX = "SG1";
export const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export function buildReservationTransaction(
  wallet: PublicKey,
  reservation: Pick<Reservation, "id" | "payload_hash">,
): Transaction {
  return new Transaction({ feePayer: wallet }).add(
    new TransactionInstruction({
      programId: MEMO_PROGRAM_ID,
      keys: [{ pubkey: wallet, isSigner: true, isWritable: false }],
      data: Buffer.from(`${MEMO_PREFIX}|${reservation.id}|${reservation.payload_hash}`, "utf8"),
    }),
  );
}
