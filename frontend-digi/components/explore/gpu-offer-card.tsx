"use client";

import { Badge, Box, Button, Group, Text } from "@mantine/core";
import { IconArrowRight } from "@tabler/icons-react";
import type { Offer } from "@/lib/api/types";
import { formatGb, formatPercent, formatUsd, type PercentUnit } from "@/lib/format";
import styles from "./explore.module.css";

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.specRow}>
      <Text component="dt" fz={13} c="dimmed">{label}</Text>
      <Text component="dd" fz={13} ta="right" className="tabular">{value}</Text>
    </div>
  );
}

export function GpuOfferCard({ offer, reliabilityUnit, onDetails }: { offer: Offer; reliabilityUnit: PercentUnit; onDetails: () => void }) {
  const multi = offer.num_gpus > 1;
  const goodPrice = offer.market_position_pct !== null && offer.market_position_pct <= -15;
  return (
    <article className={styles.offerCard}>
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
        <Box style={{ minWidth: 0 }}>
          <Text fz={12} c="dimmed" mb={4}>Vast.ai</Text>
          <Text component="h3" className={styles.offerTitle}>{offer.gpu_name}</Text>
        </Box>
        <Box ta="right" style={{ flexShrink: 0 }}>
          <Text fz={18} fw={600} ff="monospace" className="tabular" lh={1.1}>{formatGb(offer.gpu_ram_gb)}</Text>
          <Text fz={12} c="dimmed">per GPU</Text>
        </Box>
      </Group>
      <div className={styles.quote}>
        <Group gap={6} align="baseline" wrap="nowrap">
          <Text component="span" fz={30} fw={600} ff="monospace" className="tabular" lh={1} style={{ letterSpacing: "-1px" }}>{formatUsd(offer.price_per_hour)}</Text>
          <Text component="span" fz={14} c="dimmed">/ hour</Text>
        </Group>
        <Group gap={8} mt={6}>
          {multi && <Text fz={12} c="dimmed">Whole {offer.num_gpus}-GPU offer</Text>}
          {goodPrice && <Badge color="green" variant="outline" size="sm" tt="none">Good price</Badge>}
        </Group>
      </div>
      <dl className={styles.specList}>
        <Spec label="GPUs" value={multi ? `${offer.num_gpus} × ${offer.gpu_name}` : "1"} />
        {multi && <Spec label="Total VRAM" value={formatGb(offer.total_vram_gb)} />}
        <Spec label="Region" value={offer.region} />
        <Spec label="Reliability" value={formatPercent(offer.reliability, reliabilityUnit)} />
        <Spec label="Host" value={offer.verified ? "Verified" : "Unverified"} />
      </dl>
      <Button variant="subtle" size="sm" px={0} rightSection={<IconArrowRight size={14} />} onClick={onDetails} aria-label={`Inspect ${offer.gpu_name} offer`} className={styles.inspect}>
        Inspect offer
      </Button>
    </article>
  );
}
