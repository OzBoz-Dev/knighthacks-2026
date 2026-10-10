"use client";

import { Badge, Box, Button, Group, Paper, Stack, Text, Tooltip } from "@mantine/core";
import { IconArrowRight, IconMapPin, IconShieldCheck } from "@tabler/icons-react";
import Image from "next/image";
import type { Offer } from "@/lib/api/types";
import { formatGb, formatPercent, formatUsd, type PercentUnit } from "@/lib/format";
import { FEATURED_MODELS } from "@/lib/explore/selectors";
import styles from "./explore.module.css";

export function GpuOfferCard({ offer, reliabilityUnit, onDetails }: { offer: Offer; reliabilityUnit: PercentUnit; onDetails: () => void }) {
  const featured = FEATURED_MODELS.some((model) => model === offer.gpu_name);
  return (
    <Paper p="sm" className={styles.offerCard} component="article">
      <Group gap={10} wrap="nowrap" align="flex-start">
        <Box className={styles.thumbnail}><Image src="/illustrations/gpu.svg" width={58} height={58} alt="" aria-hidden /></Box>
        <Stack gap={4} style={{ minWidth: 0 }}>
          <Text component="h3" className={styles.offerTitle}>{offer.gpu_name}</Text>
          <Text fz={10} c="dimmed">{formatGb(offer.gpu_ram_gb)} VRAM · {offer.num_gpus} GPU{offer.num_gpus > 1 ? "s" : ""}</Text>
          <Group gap={4}><IconShieldCheck size={11} color="var(--mantine-color-cyan-4)" aria-hidden /><Text fz={10} c="dimmed">Vast.ai</Text>{offer.verified && <Text fz={9} c="cyan.4">· Verified host</Text>}</Group>
          <Group gap={4} wrap="nowrap"><IconMapPin size={11} aria-hidden /><Text fz={10} c="dimmed">{offer.region}</Text></Group>
        </Stack>
      </Group>
      <Group justify="space-between" gap={4} align="center">
        <Box>
          <Text component="span" fz={22} fw={600} ff="monospace" style={{ letterSpacing: "-0.8px" }}>{formatUsd(offer.price_per_hour)}</Text>
          <Text component="span" fz={11} c="dimmed"> /hr</Text>
          {offer.num_gpus > 1 && <Text fz={9} c="dimmed">Whole {offer.num_gpus}-GPU offer</Text>}
        </Box>
        {offer.market_position_pct !== null && offer.market_position_pct <= -15 ? (
          <Badge color="teal" size="xs" tt="none">Good price</Badge>
        ) : featured ? (
          <Tooltip label="Curated preview selection, not measured demand"><Badge color="cyan" size="xs" tt="none">Popular</Badge></Tooltip>
        ) : null}
      </Group>
      <Group justify="space-between" gap={4} className={styles.offerFooter}>
        <Group gap={5}><Box w={5} h={5} bg="teal.4" style={{ borderRadius: "50%" }} /><Text fz={10} c="dimmed">{formatPercent(offer.reliability, reliabilityUnit)} reliability</Text></Group>
        <Button variant="subtle" size="compact-xs" px={0} fz={10} rightSection={<IconArrowRight size={12} />} onClick={onDetails} aria-label={`View details for ${offer.gpu_name}`}>View details</Button>
      </Group>
    </Paper>
  );
}
