"use client";

import { MantineProvider } from "@mantine/core";
import type { ReactNode } from "react";
import { SolanaWalletProvider } from "@/components/solana/wallet-provider";
import { cssVariablesResolver, theme } from "@/theme";

// The wallet provider renders no DOM and connects only in effects after hydration, so it can render on the server.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <MantineProvider
      theme={theme}
      cssVariablesResolver={cssVariablesResolver}
      forceColorScheme="dark"
    >
      <SolanaWalletProvider>{children}</SolanaWalletProvider>
    </MantineProvider>
  );
}
