"use client";

import dynamic from "next/dynamic";
import { Button, Group, Paper, Select, Stack, Text, Title, UnstyledButton } from "@mantine/core";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { IconArrowUpRight, IconRotateClockwise } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import type { Offer } from "@/lib/api/types";
import type { MarketSnapshot } from "@/lib/explore/types";
import type { Provenance } from "@/lib/data/provenance";
import { aggregateRegions, regionHistory } from "@/lib/explore/regions";
import { formatTimestamp, formatUsd, formatUsdPerHour } from "@/lib/format";
import { DataSourceLabel } from "@/components/shared/data-source-label";
import styles from "./region-market.module.css";

const Globe = dynamic(() => import("./region-globe"), { ssr: false, loading: () => <div className={styles.mapFallback}><Text role="status">Loading globe…</Text></div> });

export function RegionMarket({ offers, history, provenance, model, region, onModel, onRegion, onDetails }: {
  offers: readonly Offer[]; history: readonly MarketSnapshot[]; provenance: Provenance;
  model: string | null; region: string | null; onModel: (model: string | null) => void;
  onRegion: (region: string | null) => void; onDetails: (offer: Offer) => void;
}) {
  const [reset, setReset] = useState(0);
  const models = useMemo(() => [...new Set(offers.map((o) => o.gpu_name))].sort(), [offers]);
  const nodes = useMemo(() => aggregateRegions(offers.filter((o) => !model || o.gpu_name === model)), [offers, model]);
  const selected = nodes.find((node) => node.region === region);
  const trend = useMemo(() => region ? regionHistory(history, region, model) : [], [history, region, model]);
  const sample = provenance.source === "dev-sample";
  const unknown = nodes.filter((node) => !node.coordinates).length;
  const select = (next: string) => onRegion(next === region ? null : next);
  return <Paper component="section" className={styles.panel} aria-labelledby="regional-market-title">
    <div className={styles.header}>
      <Group justify="space-between" align="start" gap="md">
        <Stack gap={7}><Title order={1} id="regional-market-title" fz={{ base: 23, md: 28 }} fw={500}>Compute, across the globe.</Title><Text c="dimmed" fz={13}>Explore regional supply. Find your next GPU.</Text></Stack>
        <Button variant="default" size="xs" leftSection={<IconRotateClockwise size={14} />} onClick={() => { onRegion(null); setReset(reset + 1); }}>Reset view</Button>
      </Group>
      <Group mt="md" gap="xs"><DataSourceLabel provenance={provenance} compact /><Text fz={11} c="dimmed">{sample ? "Illustrative inventory · no live refresh" : provenance.timestamp ? `Captured ${formatTimestamp(provenance.timestamp)}` : "Inventory is not connected"}</Text></Group>
    </div>
    <div className={styles.layout}>
      <Globe nodes={nodes} selected={region} onSelect={select} reset={reset} />
      <Stack className={styles.side} gap="md">
        <Select label="GPU model" placeholder="All models" data={models} value={model} onChange={onModel} clearable searchable disabled={!offers.length} size="xs" />
        <div><Group justify="space-between" mb={8}><Text fw={600} fz={13}>Regions</Text><Text fz={10} c="dimmed">MEDIAN / HR</Text></Group>
          <div className={styles.regionList} role="group" aria-label="Select a market region">
            {nodes.map((node) => <UnstyledButton key={node.region} className={styles.regionRow} aria-pressed={region === node.region} onClick={() => select(node.region)} aria-label={`Filter offers to ${node.region}`}>
              <div><Text fz={12} fw={500}>{node.region || "Unknown region"}</Text><Text fz={10} c="dimmed">{node.count} {node.count === 1 ? "offer" : "offers"}{!node.coordinates ? " · not mapped" : ""}</Text></div><Text fz={12} ff="monospace">{formatUsd(node.median)}</Text>
            </UnstyledButton>)}
          </div>
          {!nodes.length && <Text fz={12} c="dimmed" py="lg">{offers.length ? "No regions match this model. Clear the GPU model filter." : "No inventory available. Regions appear when market data is connected."}</Text>}
        </div>
        <Text fz={11} c="dimmed">{model ? "Whole-offer quotes, including multi-GPU offers." : "All models combined. Select a GPU model for a closer price comparison."}</Text>
        {region && <Button variant="subtle" size="xs" onClick={() => onRegion(null)}>Clear region filter</Button>}
      </Stack>
    </div>
    {selected && <div className={styles.detail}>
      <div><Group justify="space-between"><Title order={2} fz={17} fw={500}>{selected.region}</Title><Text fz={11} c="dimmed" role="status">{selected.count} {selected.count === 1 ? "offer" : "offers"}</Text></Group>
        <div className={styles.stats}><div><Text fz={11} c="dimmed">Median / hr</Text><Text fz={23} ff="monospace">{formatUsd(selected.median)}</Text></div><div><Text fz={11} c="dimmed">Lowest / hr</Text><Text fz={23} ff="monospace">{formatUsd(selected.lowest)}</Text></div></div>
        <Text fz={11} c="dimmed" mb={10}>Current p10 to p90: {formatUsd(selected.p10)} to {formatUsd(selected.p90)}</Text>
        {sample && trend.some((point) => point.median !== null) ? <>
          <Text fz={11} c="dimmed" mb={8}>Sample history · median and p10 to p90 band · UTC</Text>
          <ResponsiveContainer width="100%" height={130}><ComposedChart data={trend} accessibilityLayer margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#3A3F44" strokeDasharray="2 4" /><XAxis dataKey="time" minTickGap={45} tick={{ fill: "#B4B8BC", fontSize: 10 }} /><YAxis width={42} tick={{ fill: "#B4B8BC", fontSize: 10 }} tickFormatter={formatUsd} domain={[0, "auto"]} />
            <Tooltip contentStyle={{ background: "#232629", border: "1px solid #3A3F44", fontSize: 12 }} formatter={(value) => Array.isArray(value) ? value.map((v) => formatUsd(Number(v))).join(" to ") : formatUsd(Number(value))} />
            <Area dataKey="band" name="p10 to p90" fill="#FF6352" fillOpacity={0.13} stroke="none" isAnimationActive={false} connectNulls={false} />
            <Line dataKey="median" name="Median" stroke="#FF6352" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
          </ComposedChart></ResponsiveContainer>
          <Text fz={10} c="dimmed">{formatTimestamp(trend[0]?.timestamp)} to {formatTimestamp(trend.at(-1)?.timestamp)}</Text>
        </> : <Text fz={12} c="dimmed">Pricing insights temporarily unavailable.</Text>}
      </div>
      <Stack gap={8}><Text fz={13} fw={600}>Cheapest offers</Text><Text fz={11} c="dimmed">{model ?? "All GPU models"} · whole-offer hourly quote</Text>{selected.offers.slice(0, 3).map((offer) => <UnstyledButton className={styles.offer} key={offer.id} onClick={() => onDetails(offer)} aria-label={`Open offer ${offer.id}`}><div><Text fz={12}>{offer.gpu_name}</Text><Text fz={10} c="dimmed">{offer.num_gpus} GPU · {offer.total_vram_gb} GB total</Text></div><Group gap={5}><Text fz={12} ff="monospace">{formatUsdPerHour(offer.price_per_hour)}</Text><IconArrowUpRight size={14} /></Group></UnstyledButton>)}<Text fz={11} c="dimmed">{sample ? "Sample calculations, not Databricks results." : "Calculated from the current inventory."}</Text></Stack>
    </div>}
    {region && !selected && <Text className={styles.empty} fz={12} role="status">No offers for {region} with this GPU model. Choose another region or clear the filter.</Text>}
    <Group className={styles.footer} justify="space-between" gap="xs"><Text fz={11} c="dimmed">Regional centroids, not host locations.{unknown > 0 ? ` ${unknown} unmapped regions remain in the list.` : ""}</Text><Text fz={11} c="dimmed">Size = offer count · pale to red = lower to higher median</Text></Group>
  </Paper>;
}
