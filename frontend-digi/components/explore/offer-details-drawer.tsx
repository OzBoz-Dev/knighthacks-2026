"use client";

import { Alert, Box, Button, Drawer, Group, Stack, Text } from "@mantine/core";
import Link from "next/link";
import type { Offer } from "@/lib/api/types";
import type { Provenance } from "@/lib/data/provenance";
import { formatGb, formatPercent, formatSignedPercent, formatUsdPerHour, type PercentUnit } from "@/lib/format";
import { DataSourceLabel } from "@/components/shared/data-source-label";
import styles from "./explore.module.css";

type Row = [label: string, value: string];

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <section>
      <Text fz={11} c="dimmed" tt="uppercase" fw={600} mb={6} style={{ letterSpacing: "0.8px" }}>{title}</Text>
      <dl className={styles.recordList}>
        {rows.map(([label, value]) => (
          <div key={label} className={styles.recordRow}>
            <Text component="dt" fz={13} c="dimmed">{label}</Text>
            <Text component="dd" fz={13} ta="right" className="tabular">{value}</Text>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function OfferDetailsDrawer({ offer, onClose, provenance, reliabilityUnit }: {
  offer: Offer | null;
  onClose: () => void;
  provenance: Provenance;
  reliabilityUnit: PercentUnit;
}) {
  return (
    <Drawer opened={offer !== null} onClose={onClose} title="Offer record" position="right" size="md">
      {offer && <Stack gap="lg">
        <Box className={styles.recordHeader}>
          <Text fz={12} c="dimmed">Offer ID</Text>
          <Text ff="monospace" fz={13} style={{ wordBreak: "break-all", userSelect: "all" }}>{offer.id}</Text>
          <Group justify="space-between" align="baseline" mt="md" wrap="wrap" gap="xs">
            <Text fz={22} fw={600}>{offer.gpu_name}</Text>
            <Text fz={20} fw={600} ff="monospace" className="tabular">{formatUsdPerHour(offer.price_per_hour)}</Text>
          </Group>
          <Text fz={12} c="dimmed">Hourly quote for the whole offer</Text>
        </Box>
        <Section title="Hardware" rows={[
          ["Provider", "Vast.ai"],
          ["GPU count", String(offer.num_gpus)],
          ["VRAM per GPU", formatGb(offer.gpu_ram_gb)],
          ["Total VRAM", formatGb(offer.total_vram_gb)],
          ["Performance score", offer.dlperf === null ? "Unavailable" : String(offer.dlperf)],
          ["Performance per dollar", offer.performance_per_dollar === null ? "Unavailable" : offer.performance_per_dollar.toFixed(1)],
        ]} />
        <Section title="Host" rows={[
          ["Region", offer.region],
          ["Reliability", formatPercent(offer.reliability, reliabilityUnit)],
          ["Verified host", offer.verified ? "Yes" : "No"],
        ]} />
        <Section title="Market position" rows={[
          ["Against typical price", formatSignedPercent(offer.market_position_pct, "percent")],
        ]} />
        <Group><DataSourceLabel provenance={provenance} compact /></Group>
        <Alert color="gray" title="Preview offer">This is a synthetic listing. GPU access, booking, wallet connection, and reservation signing are not available in this preview.</Alert>
        <Button component={Link} href="/match" variant="default">Find a match</Button>
      </Stack>}
    </Drawer>
  );
}
