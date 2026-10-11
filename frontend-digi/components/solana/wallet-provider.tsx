"use client";

import { useMemo, type ReactNode } from "react";
import type { ConnectionConfig } from "@solana/web3.js";
import type { WalletError } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { getSolanaConfig } from "@/lib/solana/network";
import { SolBalanceProvider } from "./balance-provider";
import { WalletConnectModalProvider } from "./wallet-modal";

const connectionConfig: ConnectionConfig = {
  commitment: "confirmed",
  confirmTransactionInitialTimeout: 30000,
  // A 429 fails at once with a clear message. The default retry waits about 8 seconds and logs each retry as an error.
  disableRetryOnRateLimit: true,
};

// Log only. A wallet error must not disconnect the wallet.
function onError(error: WalletError) {
  console.warn("Wallet error:", error);
}

export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => getSolanaConfig().endpoint, []);
  // Wallet Standard finds Phantom without an adapter. Issue #60 decides about PhantomWalletAdapter.
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint} config={connectionConfig}>
      <WalletProvider wallets={wallets} autoConnect localStorageKey="digigpu-wallet" onError={onError}>
        <WalletConnectModalProvider>
          <SolBalanceProvider>{children}</SolBalanceProvider>
        </WalletConnectModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
