import type { ApiEnvelope, MarketSummary, TrendPoint } from "../api/types";
import type { InsightsSource, Provenance } from "../data/provenance";
import { FEATURED_MODELS } from "./selectors";
import type { MarketInsights } from "./types";

export type Settled<T> = { ok: true; value: T } | { ok: false };

// The market decoders accept only Databricks sources. Any other value shows as unknown, never as live.
const provenanceOf = ({ source, captured_at }: ApiEnvelope<unknown>): Provenance<InsightsSource> => ({
  source: source === "databricks-live" || source === "databricks-export" ? source : "unknown",
  timestamp: captured_at,
});

// The model whose insights load first: a featured model when the inventory has one, else the first by name.
export function defaultInsightsModel(models: readonly string[]): string | null {
  return FEATURED_MODELS.find((m) => models.includes(m)) ?? models.toSorted()[0] ?? null;
}

// A requested model that is not in the inventory is never sent to the API.
export function insightsModel(requested: string | string[] | undefined, models: readonly string[]): string | null {
  const name = Array.isArray(requested) ? requested[0] : requested;
  return name && models.includes(name) ? name : defaultInsightsModel(models);
}

// Builds the insights for one requested model from the two market calls.
// Each call can fail alone. Both failing makes the section unavailable, and the offers stay.
export function liveInsights(gpu: string, summary: Settled<ApiEnvelope<MarketSummary | null>>, trends: Settled<ApiEnvelope<TrendPoint[]>>): MarketInsights {
  if (!summary.ok && !trends.ok) return { provenance: { source: "unavailable", timestamp: null }, summaries: [], trends: {} };
  const trendProvenance = trends.ok ? provenanceOf(trends.value) : undefined;
  return {
    provenance: summary.ok ? provenanceOf(summary.value) : trendProvenance!,
    trendProvenance,
    // The API maps a raw Vast.ai name to its canonical gold name, so the row is keyed by the requested name.
    summaries: summary.ok && summary.value.data ? [{ ...summary.value.data, gpu_name: gpu }] : [],
    trends: trends.ok ? { [gpu]: trends.value.data } : {},
  };
}
