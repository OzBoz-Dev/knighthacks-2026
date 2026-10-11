"use client";

import { ActionIcon, Box, Group, Modal, Stack, Text, TextInput, UnstyledButton } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconArrowDownRight, IconArrowUpRight, IconInfoCircle, IconSearch, IconX } from "@tabler/icons-react";
import { formatSignedPercent, formatUsdPerHour } from "@/lib/format";
import type { MarketOverviewData } from "@/lib/explore/types";
import { LazyWalletButton } from "@/components/solana/lazy-wallet-button";
import styles from "./explore.module.css";

export function ExploreToolbar({ search, onSearch, overview, sample }: {
  search: string;
  onSearch: (value: string) => void;
  overview: MarketOverviewData;
  sample: boolean;
}) {
  const [indexOpened, indexModal] = useDisclosure(false);
  const ChangeIcon = (overview.change ?? 0) > 0 ? IconArrowUpRight : IconArrowDownRight;
  const changeColor = overview.change === null || overview.change === 0 ? "dimmed" : overview.change > 0 ? "var(--dg-up)" : "green.4";

  return (
    <>
      <Box className={styles.toolbar}>
        <TextInput
          className={styles.search}
          size="sm"
          aria-label="Search GPU models or regions"
          placeholder="Search models or regions"
          leftSection={<IconSearch size={16} aria-hidden />}
          rightSection={search ? <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Clear search" onClick={() => onSearch("")}><IconX size={14} /></ActionIcon> : null}
          value={search}
          onChange={(event) => onSearch(event.currentTarget.value)}
          disabled={!sample}
          mb={10}
        />
        <Group className={styles.toolbarActions} gap={8} wrap="nowrap" justify="space-between">
          <UnstyledButton onClick={indexModal.open} className={styles.indexReadout} aria-label="Global GPU index methodology">
            <Box>
              <Text fz={11} c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: "0.8px" }}>GPU index{sample && " · sample"}</Text>
              <Group gap={8} wrap="nowrap" align="baseline">
                <Text fz={15} fw={500} ff="monospace" className="tabular">{formatUsdPerHour(overview.index)}</Text>
                <Group gap={2} c={changeColor} wrap="nowrap">
                  {overview.change !== null && overview.change !== 0 && <ChangeIcon size={13} aria-hidden />}
                  <Text fz={12} fw={600} className="tabular">{formatSignedPercent(overview.change, "percent")}</Text>
                </Group>
              </Group>
            </Box>
            <IconInfoCircle size={14} color="var(--mantine-color-dimmed)" aria-hidden />
          </UnstyledButton>
          <LazyWalletButton />
        </Group>
      </Box>
      <Modal opened={indexOpened} onClose={indexModal.close} title="About the GPU index" centered>
        <Stack gap="sm">
          <Text size="sm">This preview index is the equal-weight average of model-median hourly quotes for a fixed basket of single-GPU models.</Text>
          <Text size="sm" c="dimmed">The price-history chart uses the same series. Its change compares the first and last points of an illustrative 24-hour sample window. Offer filters do not change the index.</Text>
          <Text size="sm" c="lava.3">Synthetic development data, not a live market benchmark or Databricks output.</Text>
        </Stack>
      </Modal>
    </>
  );
}
