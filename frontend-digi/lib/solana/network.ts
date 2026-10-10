import { clusterApiUrl } from "@solana/web3.js";

export type SolanaConfig = {
  endpoint: string;
  cluster: "devnet";
  explorerCluster: "devnet";
};

// Reservations are signed intents on devnet only, so a mainnet RPC must never load.
export function getSolanaConfig(): SolanaConfig {
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC?.trim() || clusterApiUrl("devnet");
  if (endpoint.toLowerCase().includes("mainnet")) {
    throw new Error(
      `NEXT_PUBLIC_SOLANA_RPC points to mainnet (${endpoint}). digiGPU runs on devnet only. Set a devnet RPC URL or remove the variable.`,
    );
  }
  return { endpoint, cluster: "devnet", explorerCluster: "devnet" };
}
