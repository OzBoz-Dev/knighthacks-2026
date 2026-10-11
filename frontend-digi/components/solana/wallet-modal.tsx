"use client";

import { Avatar, Button, Modal, Stack, Text } from "@mantine/core";
import { WalletReadyState, type WalletName } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletModalContext } from "@solana/wallet-adapter-react-ui";
import { useMemo, useState, type ReactNode } from "react";

function ConnectModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const { wallets, wallet, select, connect } = useWallet();
  const ready = wallets.filter((w) => w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable);

  const choose = (name: WalletName) => {
    onClose();
    // select() connects through autoConnect. A wallet that is already selected needs connect(), for example after a declined request.
    if (wallet?.adapter.name === name) connect().catch(() => {});
    else select(name);
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Connect a wallet" centered>
      <Stack gap="sm">
        {ready.length ? (
          ready.map((w) => (
            <Button
              key={w.adapter.name}
              variant="default"
              size="md"
              justify="flex-start"
              leftSection={<Avatar src={w.adapter.icon} size={22} radius="sm" alt="" />}
              onClick={() => choose(w.adapter.name)}
            >
              {w.adapter.name}
            </Button>
          ))
        ) : (
          <>
            <Text size="sm">Phantom isn&apos;t installed in this browser. Install it, then reload this page.</Text>
            <Button component="a" href="https://phantom.com/download" target="_blank" rel="noopener noreferrer">Get Phantom</Button>
          </>
        )}
        <Text size="xs" c="dimmed">
          solGPU runs on Solana devnet. In Phantom, open Settings → Developer Settings, turn on Testnet Mode, and pick Solana Devnet. A reservation costs only the devnet network fee. It isn&apos;t a booking or a payment.
        </Text>
      </Stack>
    </Modal>
  );
}

// Replaces the wallet-adapter modal with a Mantine one, so useWalletModal() opens a dialog that matches the theme.
export function WalletConnectModalProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const value = useMemo(() => ({ visible, setVisible }), [visible]);
  return (
    <WalletModalContext.Provider value={value}>
      {children}
      <ConnectModal opened={visible} onClose={() => setVisible(false)} />
    </WalletModalContext.Provider>
  );
}
