"use client";

import { Group, Select, Text, Title } from "@mantine/core";
import { useState } from "react";
import type { MarketInsights as Insights } from "@/lib/explore/types";
import { selectInsights } from "@/lib/explore/selectors";
import { DataSourceLabel } from "@/components/shared/data-source-label";
import { MarketSummaryCards } from "./market-summary-cards";
import { PriceTrendChart } from "./price-trend-chart";
import { InsightsMethod } from "./insights-method";
import styles from "./explore.module.css";

export function MarketInsights({ insights, models }: { insights: Insights; models: string[] }) {
  const [model, setModel] = useState<string | null>(insights.summaries[0]?.gpu_name ?? models[0] ?? null);
  const { unavailable, summary, trend, provenance } = selectInsights(insights, model);
  if (unavailable) {
    return (
      <section aria-labelledby="market-insights-title" className={styles.insights}>
        <Title order={2} id="market-insights-title" fz={15} fw={600}>Pricing insights</Title>
        <Text c="dimmed" fz={12} pt="xs" role="status">Pricing insights temporarily unavailable. Offers and filters still work.</Text>
        <InsightsMethod provenance={provenance} />
      </section>
    );
  }
  return (
    <section aria-labelledby="market-insights-title" className={styles.insights}>
      <Group justify="space-between" align="center" mb={10} gap="xs">
        <Group gap="xs" align="center">
          <Title order={2} id="market-insights-title" fz={15} fw={600}>Pricing insights</Title>
          <DataSourceLabel provenance={provenance} compact />
        </Group>
        <Select
          size="xs"
          w={180}
          className={styles.filter}
          data={models}
          value={model}
          onChange={(value) => { if (value) setModel(value); }}
          aria-label="GPU model for pricing insights"
          allowDeselect={false}
        />
      </Group>
      <MarketSummaryCards summary={summary} />
      <Text fz={12} fw={600} mt="md">Median price over time</Text>
      <Text fz={10} c="dimmed">Shaded band: 10th to 90th percentile · UTC</Text>
      <PriceTrendChart points={trend} gpuName={model} />
      <InsightsMethod provenance={provenance} />
    </section>
  );
}
