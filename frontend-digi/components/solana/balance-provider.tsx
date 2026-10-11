"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

// lamports is undefined while the balance loads and null when devnet did not answer.
export type SolBalance = { lamports: number | null | undefined; refresh: () => void };

const BalanceContext = createContext<SolBalance>({ lamports: undefined, refresh: () => {} });

// One balance for the whole app, so the wallet button and the Reserve gate show the same value after an airdrop.
export function SolBalanceProvider({ children }: { children: ReactNode }) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58() ?? null;
  const [state, setState] = useState<{ wallet: string; lamports: number | null }>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!publicKey) return;
    let live = true;
    const key = publicKey.toBase58();
    connection.getBalance(publicKey, "confirmed").then(
      (lamports) => { if (live) setState({ wallet: key, lamports }); },
      () => { if (live) setState({ wallet: key, lamports: null }); },
    );
    return () => { live = false; };
  }, [connection, publicKey, attempt]);

  const refresh = useCallback(() => setAttempt((n) => n + 1), []);
  // A value for another wallet is never shown, so a wallet switch shows the loading state first.
  const lamports = state && state.wallet === wallet ? state.lamports : undefined;
  const value = useMemo(() => ({ lamports, refresh }), [lamports, refresh]);
  return <BalanceContext.Provider value={value}>{children}</BalanceContext.Provider>;
}

export const useSolBalance = () => useContext(BalanceContext);
