"use client";

import { Box, Paper, Text } from "@mantine/core";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendPoint } from "@/lib/api/types";
import { formatTimestamp, formatUsd, formatUsdPerHour } from "@/lib/format";
import { trendChartData, type TrendChartPoint } from "@/lib/explore/selectors";

const HEIGHT = 180;

function TrendTooltip({ active, payload }: { active?: boolean; payload?: readonly { payload: TrendChartPoint }[] }) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  return (
    <Paper p="xs" withBorder fz={11}>
      <Text fz={11} fw={600}>{formatTimestamp(point.timestamp)}</Text>
      <Text fz={11} className="tabular">Median {formatUsdPerHour(point.median)}</Text>
      <Text fz={11} className="tabular">p10 {formatUsdPerHour(point.band?.[0])} · p90 {formatUsdPerHour(point.band?.[1])}</Text>
      <Text fz={11} className="tabular" c="dimmed">{point.listings ?? "Unknown"} listings</Text>
    </Paper>
  );
}

export function PriceTrendChart({ points, gpuName }: { points: readonly TrendPoint[]; gpuName: string | null }) {
  const data = trendChartData(points);
  return (
    <Box h={HEIGHT} mt="sm" role="img" aria-label={`Median hourly price over time for ${gpuName ?? "the selected GPU"}, with the 10th to 90th percentile range shaded`}>
      {data.length ? (
        <ResponsiveContainer width="100%" height={HEIGHT}>
          <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--dg-rule)" strokeDasharray="2 4" />
            <XAxis dataKey="timestamp" tickFormatter={(value: string) => value.slice(11, 16)} tick={{ fontSize: 10, fill: "var(--mantine-color-dimmed)" }} tickLine={false} minTickGap={35} />
            <YAxis tickFormatter={(value: number) => formatUsd(value)} tick={{ fontSize: 10, fill: "var(--mantine-color-dimmed)" }} tickLine={false} axisLine={false} width={44} domain={["auto", "auto"]} />
            <Tooltip content={<TrendTooltip />} />
            <Area dataKey="band" stroke="none" fill="var(--mantine-color-lava-5)" fillOpacity={0.15} connectNulls={false} isAnimationActive={false} name="p10 to p90" />
            <Line dataKey="median" stroke="var(--mantine-color-lava-5)" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} name="Median" />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <Text c="dimmed" fz={12} py="md">No price history for this GPU yet.</Text>
      )}
    </Box>
  );
}
