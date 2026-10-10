"use client";

import { Alert, Button, Drawer, Group, Stack, Table, Text } from "@mantine/core";
import Link from "next/link";
import type { Offer } from "@/lib/api/types";
import type { Provenance } from "@/lib/data/provenance";
import { formatGb, formatPercent, formatSignedPercent, formatUsdPerHour, type PercentUnit } from "@/lib/format";
import { DataSourceLabel } from "@/components/shared/data-source-label";

export function OfferDetailsDrawer({ offer, onClose, provenance, reliabilityUnit }: {
  offer: Offer | null;
  onClose: () => void;
  provenance: Provenance;
  reliabilityUnit: PercentUnit;
}) {
  const rows = offer ? [
    ["Offer ID", offer.id], ["Provider", "Vast.ai"], ["GPU count", offer.num_gpus],
    ["VRAM per GPU", formatGb(offer.gpu_ram_gb)], ["Total VRAM", formatGb(offer.total_vram_gb)],
    ["Region", offer.region], ["Hourly quote (whole offer)", formatUsdPerHour(offer.price_per_hour)],
    ["Reliability", formatPercent(offer.reliability, reliabilityUnit)], ["Verified host", offer.verified ? "Yes" : "No"],
    ["Performance score", offer.dlperf ?? "Unavailable"],
    ["Performance per dollar", offer.performance_per_dollar?.toFixed(1) ?? "Unavailable"],
    ["Against typical price", formatSignedPercent(offer.market_position_pct, "percent")],
  ] : [];
  return (
    <Drawer opened={offer !== null} onClose={onClose} title={offer?.gpu_name ?? "Offer details"} position="right" size="md">
      {offer && <Stack gap="lg">
        <Group><DataSourceLabel provenance={provenance} compact /></Group>
        <Table verticalSpacing="sm"><Table.Tbody>{rows.map(([label, value]) => <Table.Tr key={label}><Table.Td><Text size="xs" c="dimmed">{label}</Text></Table.Td><Table.Td ta="right"><Text size="xs">{value}</Text></Table.Td></Table.Tr>)}</Table.Tbody></Table>
        <Alert color="cyan" title="Preview offer">This is a synthetic listing. GPU access, booking, wallet connection, and reservation signing are not available in this preview.</Alert>
        <Button component={Link} href="/match" variant="light">Find a match</Button>
      </Stack>}
    </Drawer>
  );
}
