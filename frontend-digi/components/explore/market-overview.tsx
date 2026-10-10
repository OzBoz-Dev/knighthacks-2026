"use client";

import { AreaChart } from "@mantine/charts";
import { Badge, Box, Group, Paper, Progress, Stack, Table, Text, Title, Tooltip, UnstyledButton } from "@mantine/core";
import { IconArrowDownRight, IconArrowUpRight, IconInfoCircle, IconMinus } from "@tabler/icons-react";
import { formatSignedPercent, formatTimestamp, formatUsd, formatUsdPerHour } from "@/lib/format";
import type { MarketOverviewData } from "@/lib/explore/types";
import styles from "./explore.module.css";

function PanelHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return <Box mb="md"><Title order={3} fz={12} fw={600}>{title}</Title><Text c="dimmed" fz={10} mt={4}>{subtitle}</Text></Box>;
}

function Unavailable() {
  return <Text c="dimmed" size="xs" py="xl">Market data is not connected yet.</Text>;
}

export function MarketOverview({ overview, sample, onRegion, onModel }: {
  overview: MarketOverviewData;
  sample: boolean;
  onRegion: (region: string, model: string) => void;
  onModel: (model: string) => void;
}) {
  const maxRegionPrice = Math.max(0, ...overview.regions.map((row) => row.price));
  const periodLabel = sample ? "Illustrative 24-hour period · UTC" : "No historical data";
  const periodDetails = overview.start && overview.end ? `${formatTimestamp(overview.start)} — ${formatTimestamp(overview.end)}` : "No market history available";
  return (
    <section aria-labelledby="market-overview-title">
      <Group justify="space-between" mb="sm" gap="xs">
        <Group gap="xs"><Title order={2} id="market-overview-title" fz={15}>Market overview</Title>{sample && <Badge size="xs" color="gray" tt="none">Sample market</Badge>}</Group>
        <Text c="dimmed" fz={10}>Whole preview market · Filters apply to cards only</Text>
      </Group>
      <div className={styles.overviewGrid}>
        <Paper p="sm" className={styles.overviewCard}>
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <PanelHeading title="Average GPU price" subtitle={sample ? "Sample 24h · Fixed single-GPU basket" : "Fixed single-GPU basket"} />
            <Tooltip label="Equal-weight mean of model-median single-GPU hourly quotes. Same series as the global index."><IconInfoCircle size={13} color="var(--mantine-color-dimmed)" aria-label="Index methodology" tabIndex={0} /></Tooltip>
          </Group>
          {overview.series.some((point) => point.price !== null) ? <>
            <Text fz={19} fw={600} ff="monospace" mb="sm">{formatUsdPerHour(overview.index)}</Text>
            <AreaChart
              h={142}
              data={overview.series.map((point) => ({ ...point, time: `${point.timestamp.slice(11, 16)}` }))}
              dataKey="time"
              series={[{ name: "price", label: "Sample index", color: "cyan.4" }]}
              curveType="linear"
              withDots={false}
              withGradient
              fillOpacity={0.12}
              strokeWidth={2}
              connectNulls={false}
              gridAxis="y"
              tickLine="none"
              valueFormatter={formatUsd}
              yAxisProps={{ width: 40, tickCount: 4, domain: [0, "auto"] }}
              xAxisProps={{ minTickGap: 25, tickMargin: 8 }}
              areaProps={{ isAnimationActive: false }}
              areaChartProps={{ accessibilityLayer: true }}
              style={{ fontSize: 9 }}
            />
          </> : <Unavailable />}
        </Paper>
        <Paper p="sm" className={styles.overviewCard}>
          <PanelHeading title="Price by region" subtitle={`${overview.referenceModel} · 1 GPU · Median / hr`} />
          {overview.regions.length ? <Stack gap={1}>
            {overview.regions.map((row) => (
              <Tooltip key={row.region} label={`Filter cards to ${overview.referenceModel} in ${row.region}`}>
                <UnstyledButton className={styles.metricRow} onClick={() => onRegion(row.region, overview.referenceModel)}>
                  <Text fz={10}>{row.region}</Text>
                  <Progress size={5} radius="xl" value={maxRegionPrice > 0 ? row.price / maxRegionPrice * 100 : 0} aria-label={`${row.region} relative hourly price`} />
                  <Text fz={10} ff="monospace" ta="right" c="dimmed">{formatUsd(row.price)}/hr</Text>
                </UnstyledButton>
              </Tooltip>
            ))}
            <Text c="dimmed" fz={9} mt="sm">Select a region to explore its offers.</Text>
          </Stack> : <Unavailable />}
        </Paper>
        <Paper p="sm" className={styles.overviewCard}>
          <PanelHeading title="Top models by availability" subtitle="Available listings, not physical GPUs" />
          {overview.availability.length ? <Table verticalSpacing={6} horizontalSpacing={0} withRowBorders={false}>
            <Table.Thead><Table.Tr><Table.Th fz={10} fw={400} c="dimmed">Model</Table.Th><Table.Th fz={10} fw={400} c="dimmed" ta="right">Listings</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>{overview.availability.slice(0, 5).map((row) => <Table.Tr key={row.model}>
              <Table.Td><UnstyledButton onClick={() => onModel(row.model)} className={styles.availabilityRow} style={{ width: "100%", borderRadius: 4 }}><Text fz={11}>{row.model}</Text></UnstyledButton></Table.Td>
              <Table.Td ta="right"><Text fz={11} ff="monospace" c="dimmed">{row.listings}</Text></Table.Td>
            </Table.Tr>)}</Table.Tbody>
          </Table> : <Unavailable />}
        </Paper>
        <Paper p="sm" className={styles.overviewCard}>
          <PanelHeading title="Recent price changes" subtitle={sample ? "Sample 24h · Same model / region / GPU count" : "No price history connected"} />
          {overview.priceChanges.length ? <Stack gap={13}>
            {overview.priceChanges.slice(0, 4).map((row) => {
              const Icon = row.change === null || row.change === 0 ? IconMinus : row.change > 0 ? IconArrowUpRight : IconArrowDownRight;
              const color = row.change === null || row.change === 0 ? "dimmed" : row.change > 0 ? "red.4" : "teal.4";
              return <Group key={`${row.model}-${row.region}`} justify="space-between" gap={6} wrap="nowrap">
                <Box style={{ minWidth: 0 }}><Text fz={11}>{row.model}</Text><Text fz={9} c="dimmed">{row.region}</Text></Box>
                <Group gap={3} wrap="nowrap" c={color}><Icon size={12} aria-hidden /><Text fz={11} ff="monospace">{formatSignedPercent(row.change, "percent")}</Text></Group>
              </Group>;
            })}
          </Stack> : <Unavailable />}
        </Paper>
      </div>
      <Tooltip label={periodDetails}><Text component="p" fz={9} c="dimmed" mt="sm" tabIndex={0}>{periodLabel}. {sample ? "All values are synthetic, not live Vast.ai or Databricks results." : "Connect market data to populate these panels."}</Text></Tooltip>
    </section>
  );
}
