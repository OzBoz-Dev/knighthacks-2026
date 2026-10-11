import { describe, expect, it } from "vitest";
import { sampleOffers } from "../data/dev-fixtures";
import { liveDashboard } from "./live";
import { buildMarketOverview } from "./selectors";

describe("liveDashboard", () => {
  it("takes the source and the capture time from the envelope, never the fetch time", () => {
    const data = liveDashboard({ source: "vast-saved", captured_at: "2026-10-10T20:00:00Z", snapshot_id: "s1", data: sampleOffers });
    expect(data.provenance).toEqual({ source: "vast-saved", timestamp: "2026-10-10T20:00:00Z" });
    expect(data.offers).toBe(sampleOffers);
    expect(data.reliabilityUnit).toBe("ratio");
  });

  it("never calculates the GPU index from live offers", () => {
    const data = liveDashboard({ source: "vast-live", captured_at: "2026-10-10T20:00:00Z", snapshot_id: "s1", data: sampleOffers });
    const overview = buildMarketOverview(data.offers, data.history);
    expect(overview.index).toBeNull();
    expect(overview.series).toEqual([]);
  });

  it("invents no price history and keeps the insights unavailable", () => {
    const data = liveDashboard({ source: "vast-live", captured_at: "2026-10-10T20:00:00Z", snapshot_id: "s1", data: [] });
    expect(data.history).toEqual([]);
    expect(data.insights.provenance.source).toBe("unavailable");
    expect(data.insights.summaries).toEqual([]);
  });
});
