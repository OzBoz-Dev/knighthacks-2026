import { describe, expect, it } from "vitest";
import type { ApiEnvelope, MarketSummary, TrendPoint } from "../api/types";
import { defaultInsightsModel, insightsModel, liveInsights } from "./insights";
import { selectInsights } from "./selectors";

const summaryRow: MarketSummary = { gpu_name: "A100 PCIe", listing_count: 16, lowest_price: 0.27, median_price: 0.66, p90_price: 1, median_reliability: 0.99, updated_at: "2026-10-10T23:49:28Z" };
const point: TrendPoint = { timestamp: "2026-10-10T23:37:28Z", minimum_price: 0.3, median_price: 0.6, p10_price: 0.4, p90_price: 0.9, listing_count: 12 };
const summary = (data: MarketSummary | null = summaryRow): ApiEnvelope<MarketSummary | null> => ({ source: "databricks-live", captured_at: "2026-10-10T23:49:28Z", snapshot_id: null, data });
const trends: ApiEnvelope<TrendPoint[]> = { source: "databricks-export", captured_at: "2026-10-10T23:40:00Z", snapshot_id: "s1", data: [point] };

describe("insightsModel", () => {
  it("keeps a requested model that the inventory has", () => {
    expect(insightsModel("RTX 3090", ["RTX 3090", "RTX 4090"])).toBe("RTX 3090");
    expect(insightsModel(["RTX 3090", "x"], ["RTX 3090"])).toBe("RTX 3090");
  });

  it("falls back to a featured model, then the first name, for an unknown or missing request", () => {
    expect(insightsModel("H100 SXM", ["RTX 3090", "RTX 4090"])).toBe("RTX 4090");
    expect(insightsModel(undefined, ["V100", "A40"])).toBe("A40");
    expect(defaultInsightsModel([])).toBeNull();
  });
});

describe("liveInsights", () => {
  it("keeps the summary and the trend sources and times apart", () => {
    const insights = liveInsights("A100 PCIE", { ok: true, value: summary() }, { ok: true, value: trends });
    expect(insights.provenance).toEqual({ source: "databricks-live", timestamp: "2026-10-10T23:49:28Z" });
    expect(insights.trendProvenance).toEqual({ source: "databricks-export", timestamp: "2026-10-10T23:40:00Z" });
  });

  it("finds the API answer for a raw name that the API maps to a canonical name", () => {
    const insights = liveInsights("A100 PCIE", { ok: true, value: summary() }, { ok: true, value: trends });
    const selected = selectInsights(insights, "A100 PCIE");
    expect(selected.summary?.median_price).toBe(0.66);
    expect(selected.trend).toEqual([point]);
  });

  it("keeps the trends when only the summary call fails, and the reverse", () => {
    const noSummary = liveInsights("RTX 4090", { ok: false }, { ok: true, value: trends });
    expect(noSummary.summaries).toEqual([]);
    expect(noSummary.provenance.source).toBe("databricks-export");
    expect(selectInsights(noSummary, "RTX 4090").trend).toEqual([point]);
    const noTrends = liveInsights("RTX 4090", { ok: true, value: summary() }, { ok: false });
    expect(selectInsights(noTrends, "RTX 4090").trend).toEqual([]);
    expect(noTrends.trendProvenance).toBeUndefined();
  });

  it("gives no numbers for a null summary, and is unavailable when both calls fail", () => {
    expect(liveInsights("V100", { ok: true, value: summary(null) }, { ok: true, value: { ...trends, data: [] } }).summaries).toEqual([]);
    const down = liveInsights("V100", { ok: false }, { ok: false });
    expect(selectInsights(down, "V100").unavailable).toBe(true);
  });
});
