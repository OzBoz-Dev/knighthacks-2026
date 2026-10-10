"use client";

import { AreaChart } from "@mantine/charts";
import { Box, Group, Progress, Text, Title, Tooltip, UnstyledButton } from "@mantine/core";
import { IconArrowDownRight, IconArrowUpRight, IconInfoCircle, IconMinus } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { formatSignedPercent, formatUsd, formatUsdPerHour } from "@/lib/format";
import type { MarketOverviewData } from "@/lib/explore/types";
import styles from "./explore.module.css";

function Panel({ title, subtitle, aside, children }: { title: string; subtitle: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className={styles.panel} aria-label={title}>
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap={4} mb={8}>
        <Box style={{ minWidth: 0 }}>
          <Title order={3} fz={13} fw={600}>{title}</Title>
          <Text c="dimmed" fz={10} lh={1.3} mt={2}>{subtitle}</Text>
        </Box>
        {aside}
      </Group>
      {children}
    </section>
  );
}

function Unavailable() {
  return <Text c="dimmed" fz={12} py="md">Market data is not connected yet.</Text>;
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
      <Group justify="space-between" align="baseline" mb={8} gap="xs">
        <Title order={2} id="market-overview-title" fz={15} fw={600}>Market overview</Title>
        <Text c="dimmed" fz={11}>{sample ? "Whole sample market · Filters apply to offers only" : "Market data not connected"}</Text>
      </Group>
      <div className={styles.overviewGrid}>
        <Panel
          title="Price history"
          subtitle={sample ? "Illustrative 24h · UTC" : "Fixed single-GPU basket"}
          aside={hasSeries ? <Tooltip label="Equal-weight mean of model-median single-GPU hourly quotes for a fixed model basket.">
            <IconInfoCircle size={13} color="var(--mantine-color-dimmed)" aria-label="Index methodology" tabIndex={0} />
          </Tooltip> : undefined}
        >
          {hasSeries ? (
            <>
              <Text fz={14} fw={500} ff="monospace" className="tabular">{formatUsdPerHour(overview.index)}</Text>
              <AreaChart
                h={138}
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
                yAxisProps={{ width: 36, tickCount: 3, domain: [0, "auto"] }}
                xAxisProps={{ minTickGap: 35, tickMargin: 5 }}
                areaProps={{ isAnimationActive: false }}
                areaChartProps={{ accessibilityLayer: true }}
                style={{ fontSize: 10 }}
              />
            </>
          ) : <Unavailable />}
        </Panel>
        <Panel title="Price by region" subtitle={`${overview.referenceModel} · 1 GPU · median /hr`}>
          {overview.regions.length ? (
            <div>
              {overview.regions.map((row) => (
                <UnstyledButton key={row.region} className={styles.metricRow} onClick={() => onRegion(row.region, overview.referenceModel)} aria-label={`Show ${overview.referenceModel} offers in ${row.region}`}>
                  <Text fz={11} truncate>{row.region}</Text>
                  <Progress size={4} radius={0} color="lava.5" value={maxRegionPrice > 0 ? row.price / maxRegionPrice * 100 : 0} aria-hidden />
                  <Text fz={11} ff="monospace" className="tabular" ta="right">{formatUsd(row.price)}</Text>
                </UnstyledButton>
              ))}
              <Text c="dimmed" fz={10} mt="xs">Select a region to filter offers</Text>
            </div>
          ) : <Unavailable />}
        </Panel>
        <Panel title="Top models by availability" subtitle="Available listings, not physical GPUs">
          {overview.availability.length ? (
            <ol className={styles.ruledList}>
              {overview.availability.slice(0, 4).map((row) => (
                <li key={row.model}>
                  <UnstyledButton className={styles.listRow} onClick={() => onModel(row.model)} aria-label={`Show ${row.model} offers`}>
                    <Text fz={11} truncate>{row.model}</Text>
                    <Text fz={11} ff="monospace" c="dimmed" className="tabular">{row.listings}</Text>
                  </UnstyledButton>
                </li>
              ))}
            </ol>
          ) : <Unavailable />}
        </Panel>
        <Panel title="Recent quote changes" subtitle={sample ? "Illustrative 24h · same model and region" : "No price history connected"}>
          {overview.priceChanges.length ? (
            <ol className={styles.ruledList}>
              {overview.priceChanges.slice(0, 4).map((row) => {
                const flat = row.change === null || row.change === 0;
                const Icon = flat ? IconMinus : row.change! > 0 ? IconArrowUpRight : IconArrowDownRight;
                const color = flat ? "dimmed" : row.change! > 0 ? "var(--dg-up)" : "green.4";
                return (
                  <li key={`${row.model}-${row.region}`} className={styles.listRow}>
                    <Text fz={11} truncate title={`${row.model} · ${row.region}`}>{row.model} <Text component="span" fz={10} c="dimmed">· {row.region}</Text></Text>
                    <Group gap={2} wrap="nowrap" c={color}>
                      <Icon size={12} aria-hidden />
                      <Text fz={11} ff="monospace" className="tabular">{formatSignedPercent(row.change, "percent")}</Text>
                    </Group>
                  </li>
                );
              })}
            </ol>
          ) : <Unavailable />}
        </Panel>
      </div>
      <Text component="p" fz={10} c="dimmed" mt={5}>
        {sample ? "Illustrative data, not live Vast.ai or Databricks results." : "Connect market data to populate these sections."}
      </Text>
    </section>
  );
}
