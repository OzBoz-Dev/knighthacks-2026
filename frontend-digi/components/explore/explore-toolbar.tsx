"use client";

import { ActionIcon, Badge, Box, Button, Group, Modal, Stack, Text, TextInput, ThemeIcon, Tooltip, UnstyledButton } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconArrowDownRight, IconArrowUpRight, IconChartLine, IconInfoCircle, IconSearch, IconWallet, IconX } from "@tabler/icons-react";
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

  return (
    <>
      <Box className={styles.toolbar}>
        <TextInput
          className={styles.search}
          size="md"
          aria-label="Search GPU models or regions"
          placeholder="Search GPU models or regions…"
          leftSection={<IconSearch size={16} aria-hidden />}
          rightSection={search ? <ActionIcon variant="subtle" size="sm" aria-label="Clear search" onClick={() => onSearch("")}><IconX size={14} /></ActionIcon> : null}
          value={search}
          onChange={(event) => onSearch(event.currentTarget.value)}
          disabled={!sample}
          mb={10}
        />
        <Group justify="space-between">
        <UnstyledButton onClick={indexModal.open} className={styles.indexTile} aria-label="Global GPU index methodology">
          <Group gap={10} wrap="nowrap">
            <ThemeIcon variant="light" size={25}><IconChartLine size={16} aria-hidden /></ThemeIcon>
            <Box>
              <Text fz={10} c="dimmed">Global GPU Index {sample && "· Sample"}</Text>
              <Text fz={12} fw={600} ff="monospace">{formatUsdPerHour(overview.index)}</Text>
            </Box>
            <Group gap={2} c={overview.change === null || overview.change === 0 ? "dimmed" : overview.change > 0 ? "red.4" : "teal.4"} wrap="nowrap">
              {overview.change !== null && overview.change !== 0 && <ChangeIcon size={13} aria-hidden />}
              <Text fz={10} fw={600}>{formatSignedPercent(overview.change, "percent")}</Text>
            </Group>
            <IconInfoCircle size={13} aria-hidden />
          </Group>
        </UnstyledButton>
        <Tooltip label="Preview only — wallet integration is pending">
          <Group justify="flex-end">
            <Button variant="default" onClick={walletModal.open} leftSection={<IconWallet size={17} aria-hidden />} size="sm" rightSection={<Badge size="xs" color="dark" variant="light" tt="none">Preview</Badge>}>
              Connect Phantom
            </Button>
          </Group>
        </Tooltip>
        </Group>
      </Box>
      <Modal opened={indexOpened} onClose={indexModal.close} title="About the Global GPU Index" centered>
        <Stack gap="sm">
          <Text size="sm">This preview index is the equal-weight average of model-median hourly quotes for a fixed basket of single-GPU models.</Text>
          <Text size="sm" c="dimmed">The price chart uses the same series. Its change compares the first and last points of an illustrative 24-hour sample window. Offer filters do not change the index.</Text>
          <Text size="sm" c="cyan.4">Synthetic development data, not a live market benchmark or Databricks output.</Text>
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
