"use client";

import { ActionIcon, Badge, Box, Button, Group, Modal, Stack, Text, TextInput, Tooltip, UnstyledButton } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconArrowDownRight, IconArrowUpRight, IconInfoCircle, IconSearch, IconWallet, IconX } from "@tabler/icons-react";
import { formatSignedPercent, formatUsdPerHour } from "@/lib/format";
import type { MarketOverviewData } from "@/lib/explore/types";
import styles from "./explore.module.css";

export function ExploreToolbar({ search, onSearch, overview, sample }: {
  search: string;
  onSearch: (value: string) => void;
  overview: MarketOverviewData;
  sample: boolean;
}) {
  const [indexOpened, indexModal] = useDisclosure(false);
  const [walletOpened, walletModal] = useDisclosure(false);
  const ChangeIcon = (overview.change ?? 0) > 0 ? IconArrowUpRight : IconArrowDownRight;
  const changeColor = overview.change === null || overview.change === 0 ? "dimmed" : overview.change > 0 ? "red.4" : "green.4";

  return (
    <>
      <Box className={styles.toolbar}>
        <TextInput
          className={styles.search}
          size="md"
          aria-label="Search GPU models or regions"
          placeholder="Search models or regions"
          leftSection={<IconSearch size={16} aria-hidden />}
          rightSection={search ? <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Clear search" onClick={() => onSearch("")}><IconX size={14} /></ActionIcon> : null}
          value={search}
          onChange={(event) => onSearch(event.currentTarget.value)}
          disabled={!sample}
        />
        <Group className={styles.toolbarActions} gap="sm" wrap="nowrap">
          <UnstyledButton onClick={indexModal.open} className={styles.indexReadout} aria-label="Global GPU index methodology">
            <Box>
              <Text fz={11} c="dimmed" tt="uppercase" style={{ letterSpacing: "0.8px" }}>GPU index{sample && " · sample"}</Text>
              <Group gap={8} wrap="nowrap" align="baseline">
                <Text fz={15} fw={600} ff="monospace" className="tabular">{formatUsdPerHour(overview.index)}</Text>
                <Group gap={2} c={changeColor} wrap="nowrap">
                  {overview.change !== null && overview.change !== 0 && <ChangeIcon size={13} aria-hidden />}
                  <Text fz={12} fw={600} className="tabular">{formatSignedPercent(overview.change, "percent")}</Text>
                </Group>
              </Group>
            </Box>
            <IconInfoCircle size={14} color="var(--mantine-color-dimmed)" aria-hidden />
          </UnstyledButton>
          <Tooltip label="Preview only — wallet integration is pending">
            <Button variant="default" size="md" onClick={walletModal.open} leftSection={<IconWallet size={17} aria-hidden />} rightSection={<Badge size="sm" color="gray" variant="outline" tt="none">Preview</Badge>}>
              Connect Phantom
            </Button>
          </Tooltip>
        </Group>
      </Box>
      <Modal opened={indexOpened} onClose={indexModal.close} title="About the GPU index" centered>
        <Stack gap="sm">
          <Text size="sm">This preview index is the equal-weight average of model-median hourly quotes for a fixed basket of single-GPU models.</Text>
          <Text size="sm" c="dimmed">The price-history chart uses the same series. Its change compares the first and last points of an illustrative 24-hour sample window. Offer filters do not change the index.</Text>
          <Text size="sm" c="signal.3">Synthetic development data, not a live market benchmark or Databricks output.</Text>
        </Stack>
      </Modal>
      <Modal opened={walletOpened} onClose={walletModal.close} title="Phantom integration is coming next" centered>
        <Stack gap="md">
          <Text size="sm">This dashboard is an interactive preview. No wallet is connected and no transaction will be requested.</Text>
          <Text size="sm" c="dimmed">The eventual reservation flow will use Phantom on Solana devnet to sign reservation intents. These are not real GPU bookings or payments.</Text>
          <Button onClick={walletModal.close} variant="light">Back to exploring</Button>
        </Stack>
      </Modal>
    </>
  );
}
