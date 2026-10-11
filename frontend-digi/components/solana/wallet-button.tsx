"use client";

import { ActionIcon, Badge, Button, CopyButton, Group, Popover, Stack, Text, Tooltip } from "@mantine/core";
import { IconCheck, IconCopy, IconWallet } from "@tabler/icons-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { shorten } from "@/lib/reservations/receipt";
import { formatSol } from "@/lib/solana/balance";
import { useSolBalance } from "./balance-provider";
import { FundingNotice } from "./funding-notice";

const balanceText = (lamports: number | null | undefined) =>
  lamports === undefined ? "Loading balance…" : lamports === null ? "Balance unavailable" : formatSol(lamports);

// Load it with LazyWalletButton. The wallet state exists only in the browser, so a server render would not match.
export function WalletButton({ fullWidth = false }: { fullWidth?: boolean }) {
  const { publicKey, connecting, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const { lamports } = useSolBalance();

  if (!publicKey) {
    return (
      <Button variant="default" size="sm" fullWidth={fullWidth} loading={connecting} onClick={() => setVisible(true)} leftSection={<IconWallet size={17} aria-hidden />}>
        Connect Phantom
      </Button>
    );
  }

  const address = publicKey.toBase58();
  return (
    <Popover width={280} position="bottom-start" shadow="md" withinPortal>
      <Popover.Target>
        <Button variant="default" size="sm" h="auto" py={6} fullWidth={fullWidth} justify="flex-start" leftSection={<IconWallet size={17} aria-hidden />} aria-label={`Wallet ${address}, ${balanceText(lamports)} on Solana devnet`}>
          <Stack gap={0} align="flex-start">
            <Text component="span" ff="monospace" fz={13}>{shorten(address)}</Text>
            <Text component="span" fz={11} c="dimmed" className="tabular">{balanceText(lamports)} · Devnet</Text>
          </Stack>
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <Group justify="space-between">
            <Text fz={12} c="dimmed">Connected wallet</Text>
            <Badge size="sm" color="gray" variant="outline" tt="none">Solana devnet</Badge>
          </Group>
          <Group gap={4} wrap="nowrap">
            <Text ff="monospace" fz={13} title={address}>{shorten(address, 6)}</Text>
            <CopyButton value={address} timeout={1500}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? "Copied" : "Copy the full wallet address"} withArrow>
                  <ActionIcon variant="subtle" color="gray" size="sm" onClick={copy} aria-label={copied ? "Wallet address copied" : "Copy the full wallet address"}>
                    {copied ? <IconCheck size={14} aria-hidden /> : <IconCopy size={14} aria-hidden />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </Group>
          <Text fz={15} ff="monospace" className="tabular">{balanceText(lamports)}</Text>
          <FundingNotice />
          <Button variant="default" size="xs" onClick={() => disconnect().catch(() => {})}>Disconnect</Button>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
