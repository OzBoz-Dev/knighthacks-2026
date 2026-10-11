"use client";

import { Group, Select, Text, Title } from "@mantine/core";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { MarketInsights as Insights } from "@/lib/explore/types";
import { selectInsights } from "@/lib/explore/selectors";
import { DataSourceLabel } from "@/components/shared/data-source-label";
import { LoadingState } from "@/components/shared/async-state";
import { MarketSummaryCards } from "./market-summary-cards";
import { PriceTrendChart } from "./price-trend-chart";
import { InsightsMethod } from "./insights-method";
import styles from "./explore.module.css";

// With selected, the server loaded the insights for that model, and a new choice loads the next one through the URL.
// Without it, the development samples hold every model, and the choice stays local.
export function MarketInsights({ insights, models, selected }: { insights: Insights; models: string[]; selected?: string }) {
  const [localModel, setLocalModel] = useState<string | null>(insights.summaries[0]?.gpu_name ?? models[0] ?? null);
  const [pendingModel, setPendingModel] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const model = selected ?? localModel;
  const { unavailable, summary, trend, provenance } = selectInsights(insights, model);
  const trendSource = insights.trendProvenance;
  const differentTrendSource = trendSource && (trendSource.source !== provenance.source || trendSource.timestamp !== provenance.timestamp);

  const choose = (value: string | null) => {
    if (!value) return;
    if (selected === undefined) return setLocalModel(value);
    const params = new URLSearchParams(window.location.search);
    params.set("gpu", value);
    setPendingModel(value);
    startTransition(() => router.replace(`?${params}`, { scroll: false }));
  };

  return (
    <section aria-labelledby="market-insights-title" className={styles.insights} aria-busy={pending}>
      <Group justify="space-between" align="center" mb={10} gap="xs">
        <Group gap="xs" align="center">
          <Title order={2} id="market-insights-title" fz={15} fw={600}>Pricing insights</Title>
          {!unavailable && !pending && <DataSourceLabel provenance={provenance} compact />}
        </Group>
        <Select
          size="xs"
          w={180}
          className={styles.filter}
          data={models}
          value={pending ? pendingModel : model}
          onChange={choose}
          aria-label="GPU model for pricing insights"
          allowDeselect={false}
        />
      </Group>
      {/* While the next model loads, the old numbers are hidden, so they never show under the new name. */}
      {pending ? <LoadingState label={`Loading pricing insights for ${pendingModel}…`} rows={2} /> : unavailable ? (
        <Text c="dimmed" fz={12} pt="xs" role="status">Pricing insights temporarily unavailable. Offers and filters still work.</Text>
      ) : (
        <>
          <MarketSummaryCards summary={summary} />
          <Group gap="xs" mt="md" align="center">
            <Text fz={12} fw={600}>Median price over time</Text>
            {differentTrendSource && <DataSourceLabel provenance={trendSource} compact />}
          </Group>
          <Text fz={10} c="dimmed">Shaded band: 10th to 90th percentile · UTC</Text>
          <PriceTrendChart points={trend} gpuName={model} />
        </>
      )}
      <InsightsMethod provenance={provenance} />
    </section>
  );
}
