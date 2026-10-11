import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./client";
import { decodeHealth, getHealth, getMarketSummary, getMarketTrends, getOffers } from "./endpoints";

/* eslint-disable @typescript-eslint/no-explicit-any */
const BASE = "http://localhost:8000";
const gold = JSON.parse(readFileSync(new URL("../../../fixtures/databricks_market.json", import.meta.url), "utf8"));
const offers = JSON.parse(readFileSync(new URL("../../../fixtures/offers.json", import.meta.url), "utf8")).data;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const urlOf = (fetchImpl: ReturnType<typeof vi.fn>) => new URL((fetchImpl.mock.calls[0] as unknown as [string])[0]);
const unavailable = { error: { code: "upstream_unavailable", message: "Pricing insights are temporarily unavailable." } };
// The health bodies from api/health_test.go.
const HEALTHY = { status: "ok", components: { vast: "ok", databricks: "ok", sqlite: "ok" }, fixtures: { vast: false, databricks: false } };
const FIXTURE = { status: "ok", components: { vast: "fixture", databricks: "fixture", sqlite: "ok" }, fixtures: { vast: true, databricks: true } };
const DEGRADED = { status: "degraded", components: { vast: "unavailable", databricks: "fixture", sqlite: "ok" }, fixtures: { vast: false, databricks: true } };

const reads = [
  ["getHealth", () => getHealth, HEALTHY, "/api/health"],
  ["getOffers", () => getOffers, { source: "vast-live", captured_at: "2026-10-10T20:00:00Z", snapshot_id: "20261010T200000Z", data: offers }, "/api/offers"],
  ["getMarketSummary", () => (o: any) => getMarketSummary("RTX 4090", o), { source: "databricks-export", captured_at: gold.exported_at, snapshot_id: gold.snapshot_id, data: gold.summaries[0] }, "/api/market/summary"],
  ["getMarketTrends", () => (o: any) => getMarketTrends("RTX 4090", null, o), { source: "databricks-live", captured_at: "2026-10-10T20:00:00Z", snapshot_id: null, data: [] }, "/api/market/trends"],
] as const;

describe.each(reads)("%s", (_name, fn, body, path) => {
  it("returns the decoded body", async () => {
    const fetchImpl = vi.fn(async () => json(body));
    expect(await (fn() as any)({ baseUrl: BASE, fetchImpl })).toEqual(body);
    expect(urlOf(fetchImpl).pathname).toBe(path);
  });

  it("reports an HTTP error with the API code and does not retry", async () => {
    const fetchImpl = vi.fn(async () => json(unavailable, 503));
    const error = await (fn() as any)({ baseUrl: BASE, fetchImpl }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("upstream_unavailable");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("market queries", () => {
  it("sends the GPU name and leaves out an empty region", async () => {
    const fetchImpl = vi.fn(async () => json(reads[3][2]));
    await getMarketTrends("A100 PCIe", "", { baseUrl: BASE, fetchImpl });
    expect(urlOf(fetchImpl).searchParams.get("gpu_name")).toBe("A100 PCIe");
    expect(urlOf(fetchImpl).searchParams.has("region")).toBe(false);
    const regional = vi.fn(async () => json(reads[3][2]));
    await getMarketTrends("A100 PCIe", "US", { baseUrl: BASE, fetchImpl: regional });
    expect(urlOf(regional).searchParams.get("region")).toBe("US");
  });

  it("refuses a blank GPU name before any request", async () => {
    const fetchImpl = vi.fn();
    await expect(getMarketSummary(" ", { baseUrl: BASE, fetchImpl })).rejects.toThrow(/GPU/);
    await expect(getMarketTrends("", null, { baseUrl: BASE, fetchImpl })).rejects.toThrow(/GPU/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("decodeHealth", () => {
  it("decodes the healthy, fixture, and degraded bodies", () => {
    for (const body of [HEALTHY, FIXTURE, DEGRADED]) expect(decodeHealth(body)).toEqual(body);
  });

  it("rejects an unknown status, a failed sqlite, and missing fixtures", () => {
    expect(() => decodeHealth({ ...HEALTHY, status: "down" })).toThrow(/status/);
    expect(() => decodeHealth({ ...HEALTHY, components: { ...HEALTHY.components, vast: "live" } })).toThrow(/vast/);
    expect(() => decodeHealth({ ...HEALTHY, components: { ...HEALTHY.components, sqlite: "unavailable" } })).toThrow(/sqlite/);
    expect(() => decodeHealth({ status: "ok", components: HEALTHY.components })).toThrow(/fixtures/);
  });
});
