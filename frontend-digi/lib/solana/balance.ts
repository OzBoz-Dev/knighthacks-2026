import { LAMPORTS_PER_SOL, type Connection, type PublicKey } from "@solana/web3.js";

// The memo transaction pays only the network fee. 0.001 SOL covers it many times over.
export const MIN_FEE_LAMPORTS = 0.001 * LAMPORTS_PER_SOL;
export const FAUCET_URL = "https://faucet.solana.com";

export const hasFeeBalance = (lamports: number) => lamports >= MIN_FEE_LAMPORTS;

export const formatSol = (lamports: number) =>
  `${(lamports / LAMPORTS_PER_SOL).toLocaleString("en-US", { maximumFractionDigits: 4 })} SOL`;

// Asks the devnet faucet for 1 SOL and waits until the airdrop is confirmed.
export async function requestDevnetSol(
  connection: Pick<Connection, "requestAirdrop" | "getLatestBlockhash" | "confirmTransaction">,
  wallet: PublicKey,
): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const signature = await connection.requestAirdrop(wallet, LAMPORTS_PER_SOL);
  const { value } = await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  if (value.err) throw new Error("The airdrop transaction failed.");
  return signature;
}

// The RPC error text is not shown, because it can hold the RPC URL and its API key.
export function airdropErrorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return /429|rate|limit|too many/i.test(text)
    ? "The devnet faucet limits how often you can ask for SOL. Get SOL from the Solana faucet, then come back."
    : "Devnet didn't send SOL. Get SOL from the Solana faucet, then come back.";
}
