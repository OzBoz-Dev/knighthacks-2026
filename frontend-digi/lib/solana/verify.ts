import type { Connection, VersionedTransactionResponse } from "@solana/web3.js";

export type FetchReservationTxResult =
  | { found: true; tx: VersionedTransactionResponse }
  | { found: false; error?: string };

export async function fetchReservationTx(
  connection: Pick<Connection, "getTransaction">,
  signature: string,
): Promise<FetchReservationTxResult> {
  try {
    const tx = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    return tx ? { found: true, tx } : { found: false };
  } catch {
    // The RPC error text is not shown, because it can hold the RPC URL and its API key.
    return { found: false, error: "Couldn't reach Solana devnet. Check your connection and try again." };
  }
}
