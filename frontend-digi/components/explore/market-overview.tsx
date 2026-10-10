"use client";

import { AreaChart } from "@mantine/charts";
import { Box, Group, Progress, Text, Title, Tooltip, UnstyledButton } from "@mantine/core";
import { IconArrowDownRight, IconArrowUpRight, IconInfoCircle, IconMinus } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { formatSignedPercent, formatUsd, formatUsdPerHour } from "@/lib/format";
import type { MarketOverviewData } from "@/lib/explore/types";
import styles from "./explore.module.css";

function Panel({ title, subtitle, aside, className, children }: { title: string; subtitle: string; aside?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={`${styles.panel} ${className ?? ""}`}>
      <Group justify="space-between" align="flex-start" wrap="nowrap" mb="md">
        <Box>
          <Title order={3} fz={15} fw={600}>{title}</Title>
          <Text c="dimmed" fz={13} mt={2}>{subtitle}</Text>
        </Box>
        {aside}
      </Group>
      {children}
    </section>
  );
}

function Unavailable() {
  return <Text c="dimmed" fz={13} py="lg">Market data is not connected yet.</Text>;
}

export function MarketOverview({ overview, sample, onRegion, onModel }: {
  overview: MarketOverviewData;
  sample: boolean;
  onRegion: (region: string, model: string) => void;
  onModel: (model: string) => void;
}) {
  const maxRegionPrice = Math.max(0, ...overview.regions.map((row) => row.price));
  const hasSeries = overview.series.some((point) => point.price !== null);
  return (
    <section aria-labelledby="market-overview-title">
      <Group justify="space-between" align="baseline" mb="md" gap="xs">
        <Title order={2} id="market-overview-title" fz={20} fw={600}>Market context</Title>
        <Text c="dimmed" fz={13}>{sample ? "Whole sample market · Filters apply to offers only" : "Whole market · Filters apply to offers only"}</Text>
      </Group>
      <div className={styles.analyticsTop}>
        <Panel
          title="Price history"
          subtitle={sample ? "GPU index · illustrative 24-hour sample · UTC" : "GPU index · fixed single-GPU basket"}
          aside={hasSeries ? (
            <Group gap={6} wrap="nowrap">
              <Text fz={20} fw={500} ff="monospace" className="tabular">{formatUsdPerHour(overview.index)}</Text>
              <Tooltip label="Equal-weight mean of model-median single-GPU hourly quotes for a fixed model basket.">
                <IconInfoCircle size={15} color="var(--mantine-color-dimmed)" aria-label="Index methodology" tabIndex={0} />
              </Tooltip>
            </Group>
          ) : undefined}
        >
          {hasSeries ? (
            <AreaChart
              h={260}
              data={overview.series.map((point) => ({ ...point, time: point.timestamp.slice(11, 16) }))}
              dataKey="time"
              series={[{ name: "price", label: sample ? "Sample index" : "Index", color: "lava.5" }]}
              curveType="linear"
              withDots={false}
              withGradient={false}
              fillOpacity={0.08}
              strokeWidth={2}
              connectNulls={false}
              gridAxis="y"
              strokeDasharray="2 4"
              tickLine="none"
              valueFormatter={formatUsd}
              yAxisProps={{ width: 52, tickCount: 5, domain: [0, "auto"] }}
              xAxisProps={{ minTickGap: 32, tickMargin: 10 }}
              areaProps={{ isAnimationActive: false }}
              areaChartProps={{ accessibilityLayer: true }}
              style={{ fontSize: 12 }}
            />
          ) : <Unavailable />}
        </Panel>
        <Panel title="Regional quotes" subtitle={`${overview.referenceModel} · 1 GPU · median per hour`}>
          {overview.regions.length ? (
            <div>
              {overview.regions.map((row) => (
                <UnstyledButton key={row.region} className={styles.regionRow} onClick={() => onRegion(row.region, overview.referenceModel)} aria-label={`Show ${overview.referenceModel} offers in ${row.region}`}>
                  <Group justify="space-between" wrap="nowrap" mb={6}>
                    <Text fz={14}>{row.region}</Text>
                    <Text fz={14} ff="monospace" className="tabular">{formatUsd(row.price)}</Text>
                  </Group>
                  <Progress size={4} radius={0} color="lava.5" value={maxRegionPrice > 0 ? row.price / maxRegionPrice * 100 : 0} aria-hidden />
                </UnstyledButton>
              ))}
              <Text c="dimmed" fz={12} mt="sm">Select a region to view its offers.</Text>
            </div>
          ) : <Unavailable />}
        </Panel>
      </div>
      <div className={styles.analyticsBottom}>
        <Panel title="Available models" subtitle="Listing count, not physical GPUs">
          {overview.availability.length ? (
            <ol className={styles.ruledList}>
              {overview.availability.slice(0, 5).map((row) => (
                <li key={row.model}>
                  <UnstyledButton className={styles.listRow} onClick={() => onModel(row.model)} aria-label={`Show ${row.model} offers`}>
                    <Text fz={14}>{row.model}</Text>
                    <Text fz={14} ff="monospace" c="dimmed" className="tabular">{row.listings}</Text>
                  </UnstyledButton>
                </li>
              ))}
            </ol>
          ) : <Unavailable />}
        </Panel>
        <Panel title="Quote changes" subtitle={sample ? "Illustrative 24-hour sample · same model, region, 1 GPU" : "No price history connected"}>
          {overview.priceChanges.length ? (
            <ol className={styles.ruledList}>
              {overview.priceChanges.slice(0, 5).map((row) => {
                const flat = row.change === null || row.change === 0;
                const Icon = flat ? IconMinus : row.change! > 0 ? IconArrowUpRight : IconArrowDownRight;
                const color = flat ? "dimmed" : row.change! > 0 ? "var(--dg-up)" : "green.4";
                return (
                  <li key={`${row.model}-${row.region}`} className={styles.listRow}>
                    <Text fz={14}>{row.model} <Text component="span" fz={13} c="dimmed">· {row.region}</Text></Text>
                    <Group gap={3} wrap="nowrap" c={color}>
                      <Icon size={14} aria-hidden />
                      <Text fz={14} ff="monospace" className="tabular">{formatSignedPercent(row.change, "percent")}</Text>
                    </Group>
                  </li>
                );
              })}
            </ol>
          ) : <Unavailable />}
        </Panel>
      </div>
      <Text component="p" fz={12} c="dimmed" mt="md">
        {sample ? "All values are synthetic, not live Vast.ai or Databricks results." : "Connect market data to populate these sections."}
      </Text>
    </section>
  );
}
