"use client";

import { Alert, Anchor, Button, Stack, Text } from "@mantine/core";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import { airdropErrorMessage, FAUCET_URL, hasFeeBalance, requestDevnetSol } from "@/lib/solana/balance";
import { useSolBalance } from "./balance-provider";

// Shows only when the connected wallet can't pay the devnet network fee, or when its balance can't be read.
export function FundingNotice() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const { lamports, refresh } = useSolBalance();
  const [state, setState] = useState<{ status: "idle" | "sending" } | { status: "error"; message: string }>({ status: "idle" });

  if (!publicKey || lamports === undefined) return null;
  if (lamports === null) {
    return (
      <Alert color="gray" title="Couldn't read your devnet balance">
        <Stack gap={6} align="flex-start">
          <Text fz={12}>Solana devnet didn&apos;t answer. Check your connection, then try again.</Text>
          <Button size="xs" variant="default" onClick={refresh}>Try again</Button>
        </Stack>
      </Alert>
    );
  }
  if (hasFeeBalance(lamports)) return null;

  const airdrop = async () => {
    setState({ status: "sending" });
    try {
      await requestDevnetSol(connection, publicKey);
      setState({ status: "idle" });
    } catch (error) {
      setState({ status: "error", message: airdropErrorMessage(error) });
    }
    refresh();
  };

  return (
    <Alert color="gray" title="You need at least 0.001 devnet SOL for the network fee">
      <Stack gap={6} align="flex-start">
        <Text fz={12}>Devnet SOL is free test currency. It has no real value.</Text>
        <Button size="xs" onClick={airdrop} loading={state.status === "sending"}>Get devnet SOL</Button>
        {state.status === "error" && (
          <Text fz={12} role="alert">
            {state.message}{" "}
            <Anchor href={FAUCET_URL} target="_blank" rel="noopener noreferrer" fz={12}>Open faucet.solana.com</Anchor>
          </Text>
        )}
      </Stack>
    </Alert>
  );
}
