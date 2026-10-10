import { Box, Group, Paper, Stack, Text, Title } from "@mantine/core";
import Image from "next/image";
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
    <Paper component="header" p="md" className={styles.hero}>
      <Stack gap={5} className={styles.heroCopy}>
        <Group gap="xs" wrap="wrap">
          <Title order={1} fz={{ base: 20, lg: 24 }} lh={1.15}>Compute market</Title>
          <DataSourceLabel provenance={provenance} compact />
        </Group>
        <Text c="dimmed" fz={12}>Compare GPU offers by memory, region, and hourly quote.</Text>
        {sample ? (
          <Text fz={11} c="dimmed" title={range ? `Sample window: ${range}` : undefined}>
            Illustrative 24-hour sample · No real bookings
          </Text>
        ) : (
          <Text fz={11} c="dimmed">Market data is not connected</Text>
        )}
      </Stack>
      <Image src="/illustrations/world-map.svg" width={700} height={300} loading="eager" alt="" aria-hidden className={styles.heroMap} />
      <Box className={styles.heroLegend} aria-label="Illustrative map, not live host coverage">
        <Text fz={11} fw={600}>Illustrative coverage</Text>
        <Text fz={10} c="dimmed">Not live host locations</Text>
      </Box>
    </Paper>
  );
}
