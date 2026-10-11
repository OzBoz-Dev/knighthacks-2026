"use client";

import { Box, Button, Card, Group, Text } from "@mantine/core";
import { IconArrowRight } from "@tabler/icons-react";
import Image from "next/image";
import type { CSSProperties } from "react";
import type { Offer } from "@/lib/api/types";
import { formatGb, formatPercent, formatUsd, type PercentUnit } from "@/lib/format";
import { MarketPositionBadge } from "./market-position-badge";
import styles from "./explore.module.css";

export function GpuOfferCard({ offer, reliabilityUnit, onDetails, style }: { offer: Offer; reliabilityUnit: PercentUnit; onDetails: () => void; style?: CSSProperties }) {
  const multi = offer.num_gpus > 1;
  return (
    <Card component="article" withBorder radius="sm" padding={11} bg="var(--dg-surface)" className={styles.offerCard} style={style}>
      <Group gap={8} wrap="nowrap" align="flex-start">
        <Box className={styles.thumbnail}>
          <Image src="/illustrations/gpu.svg" width={42} height={42} alt="" aria-hidden />
        </Box>
        <Box style={{ minWidth: 0 }}>
          <Text component="h3" className={styles.offerTitle}>{offer.gpu_name}</Text>
          <Text fz={11} c="dimmed">{formatGb(offer.gpu_ram_gb)} / GPU · {offer.num_gpus} GPU{multi ? "s" : ""}</Text>
          <Text fz={11} c="dimmed">Vast.ai · {offer.region}</Text>
        </Box>
      </Group>
      <Group justify="space-between" align="baseline" gap={5} wrap="nowrap" mt="auto">
        <Box>
          <Text component="span" fz={23} fw={500} ff="monospace" className="tabular" lh={1}>{formatUsd(offer.price_per_hour)}</Text>
          <Text component="span" fz={11} c="dimmed">/hr</Text>
          {multi && <Text fz={11} c="dimmed">Whole offer · {formatGb(offer.total_vram_gb)} total VRAM</Text>}
        </Box>
      </Group>
      <MarketPositionBadge pct={offer.market_position_pct} gpuName={offer.gpu_name} />
      <Group justify="space-between" gap={5} wrap="nowrap" pt={7} style={{ borderTop: "1px solid var(--dg-rule)" }}>
        <Text fz={11} c="dimmed" style={{ minWidth: 0 }}>
          {formatPercent(offer.reliability, reliabilityUnit)} reliable · {offer.verified ? "Verified" : "Unverified"}
        </Text>
        <Button variant="subtle" size="compact-xs" px={0} rightSection={<IconArrowRight size={12} />} onClick={onDetails} aria-label={`Inspect ${offer.gpu_name} offer`} className={styles.inspect}>
          Details
        </Button>
      </Group>
    </Card>
  );
}
