import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeOffersEnvelope, decodeSummaryEnvelope, decodeTrendsEnvelope, timestamp } from "./decode";

/* eslint-disable @typescript-eslint/no-explicit-any */
const read = (name: string) => JSON.parse(readFileSync(new URL(`../../../fixtures/${name}`, import.meta.url), "utf8"));
const offersFixture = read("offers.json");
// The real gold export (#136). Its rows are Databricks results with their own times.
const gold = read("databricks_market.json");
const rtx = gold.summaries.find((s: any) => s.gpu_name === "RTX 4090");
const POINT_KEYS = ["timestamp", "minimum_price", "median_price", "p10_price", "p90_price", "listing_count"];
const rtxTrend = gold.trends
  .filter((t: any) => t.gpu_name === "RTX 4090" && t.region === "all")
  .map((t: any) => Object.fromEntries(POINT_KEYS.map((k) => [k, t[k]])));

// Test envelopes in the API shape. The offers fixture is dev-sample data, so these tests set a real source on purpose.
const offers = (patch: Record<string, unknown> = {}): any => ({ source: "vast-saved", captured_at: "2026-10-10T20:00:00Z", snapshot_id: "20261010T200000Z", data: structuredClone(offersFixture.data), ...patch });
const summary = (patch: Record<string, unknown> = {}): any => ({ source: "databricks-export", captured_at: gold.exported_at, snapshot_id: gold.snapshot_id, data: structuredClone(rtx), ...patch });
const trends = (patch: Record<string, unknown> = {}): any => ({ source: "databricks-live", captured_at: rtxTrend.at(-1).timestamp, snapshot_id: null, data: structuredClone(rtxTrend), ...patch });

describe("decodeOffersEnvelope", () => {
  it("decodes the offers with the envelope metadata", () => {
    const env = decodeOffersEnvelope(offers());
    expect(env.source).toBe("vast-saved");
    expect(env.captured_at).toBe("2026-10-10T20:00:00Z");
    expect(env.data).toHaveLength(offersFixture.data.length);
    expect(decodeOffersEnvelope(offers({ data: [] })).data).toEqual([]);
  });

  it("rejects dev-sample, a Databricks source, and an unknown source", () => {
    for (const source of ["dev-sample", "databricks-live", "vast-snapshot", undefined]) {
      expect(() => decodeOffersEnvelope(offers({ source }))).toThrow(/source/);
    }
  });

  it("rejects missing metadata and a missing or wrong data field", () => {
    const noTime = offers();
    delete noTime.captured_at;
    expect(() => decodeOffersEnvelope(noTime)).toThrow(/captured_at/);
    const noSnapshot = offers();
    delete noSnapshot.snapshot_id;
    expect(() => decodeOffersEnvelope(noSnapshot)).toThrow(/snapshot_id/);
    const noData = offers();
    delete noData.data;
    expect(() => decodeOffersEnvelope(noData)).toThrow(/data/);
    expect(() => decodeOffersEnvelope(offers({ data: {} }))).toThrow(/data/);
  });

  it("accepts the values that the Go normalizer can write", () => {
    const env = offers();
    Object.assign(env.data[0], { region: "", dlperf: -1, performance_per_dollar: -2, market_position_pct: null });
    const offer = decodeOffersEnvelope(env).data[0];
    expect(offer.region).toBe("");
    expect(offer.dlperf).toBe(-1);
  });

  it("rejects an offer with a missing field, a zero price, or a percent reliability", () => {
    const missing = offers();
    delete missing.data[1].gpu_ram_gb;
    expect(() => decodeOffersEnvelope(missing)).toThrow(/data\[1\]\.gpu_ram_gb/);
    const free = offers();
    free.data[0].price_per_hour = 0;
    expect(() => decodeOffersEnvelope(free)).toThrow(/price_per_hour/);
    const percent = offers();
    percent.data[0].reliability = 98;
    expect(() => decodeOffersEnvelope(percent)).toThrow(/reliability/);
  });
});

describe("decodeSummaryEnvelope", () => {
  it("decodes a real export summary and keeps both times", () => {
    const env = decodeSummaryEnvelope(summary());
    expect(env.captured_at).toBe(gold.exported_at);
    expect(env.data?.updated_at).toBe(rtx.updated_at);
    expect(env.data?.listing_count).toBe(rtx.listing_count);
  });

  it("accepts null data and a null snapshot id", () => {
    const env = decodeSummaryEnvelope(summary({ data: null, snapshot_id: null, source: "databricks-live" }));
    expect(env.data).toBeNull();
    expect(env.snapshot_id).toBeNull();
  });

  it("rejects an inventory source and a summary with a missing field", () => {
    expect(() => decodeSummaryEnvelope(summary({ source: "vast-live" }))).toThrow(/source/);
    const missing = summary();
    delete missing.data.median_price;
    expect(() => decodeSummaryEnvelope(missing)).toThrow(/median_price/);
  });
});

describe("decodeTrendsEnvelope", () => {
  it("decodes real trend points in their order", () => {
    const env = decodeTrendsEnvelope(trends());
    expect(env.data.length).toBe(rtxTrend.length);
    expect(env.data[0].timestamp).toBe(rtxTrend[0].timestamp);
    expect(decodeTrendsEnvelope(trends({ data: [] })).data).toEqual([]);
  });

  it("rejects a point with a bad time or a missing field", () => {
    const badTime = trends();
    badTime.data[0].timestamp = "2026-10-10 20:00:00";
    expect(() => decodeTrendsEnvelope(badTime)).toThrow(/timestamp/);
    const missing = trends();
    delete missing.data[0].p10_price;
    expect(() => decodeTrendsEnvelope(missing)).toThrow(/p10_price/);
  });
});

describe("timestamp", () => {
  it("accepts RFC 3339 times with a zone and rejects others", () => {
    expect(timestamp("2026-10-10T20:00:00Z", "t")).toBe("2026-10-10T20:00:00Z");
    expect(timestamp("2026-10-10T20:00:00.123+02:00", "t")).toBe("2026-10-10T20:00:00.123+02:00");
    for (const bad of ["2026-10-10T20:00:00", "2026-13-40T99:00:00Z", "yesterday", ""]) expect(() => timestamp(bad, "t")).toThrow(/t /);
  });
});
