import { Stack, Text, Title } from "@mantine/core";
import type { Provenance } from "@/lib/data/provenance";
import { formatTimestamp } from "@/lib/format";
import { DataSourceLabel } from "@/components/shared/data-source-label";
import styles from "./explore.module.css";

export function MarketHeading({ provenance, sample, start, end }: {
  provenance: Provenance;
  sample: boolean;
  start: string | null;
  end: string | null;
}) {
  const range = start && end ? `${formatTimestamp(start)} – ${formatTimestamp(end)}` : null;
  return (
    <header className={styles.heading}>
      <Stack gap={8}>
        <Title order={1} fz={{ base: 26, lg: 32 }} lh={1.15} style={{ letterSpacing: "-0.6px" }}>Compute market</Title>
        <Text c="dimmed" fz={15} maw={620}>Compare GPU offers by memory, region, and hourly quote.</Text>
      </Stack>
      <Stack gap={6} align="flex-end" className={styles.headingMeta}>
        <DataSourceLabel provenance={provenance} compact />
        {sample ? (
          <Text fz={12} c="dimmed" ta="right">Illustrative sample window{range ? `: ${range}` : ""}</Text>
        ) : (
          <Text fz={12} c="dimmed">Market data is not connected</Text>
        )}
        {sample && <Text fz={12} c="dimmed">Interactive preview · No real bookings</Text>}
      </Stack>
    </header>
  );
}
