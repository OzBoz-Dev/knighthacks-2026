import { apiRequest, type RequestOptions } from "./client";
import { decodeOffersEnvelope, decodeSummaryEnvelope, decodeTrendsEnvelope, fail, flag, record } from "./decode";
import type { ApiEnvelope, ComponentStatus, HealthResponse, MarketSummary, Offer, TrendPoint } from "./types";

// The read endpoints of prd.md section 8. Match and the reservation calls are in match.ts and reservations.ts.
export type ReadOptions = Pick<RequestOptions, "signal" | "baseUrl" | "fetchImpl">;

const COMPONENT_STATUSES: readonly ComponentStatus[] = ["ok", "fixture", "unavailable"];

const componentStatus = (value: unknown, path: string): ComponentStatus =>
  COMPONENT_STATUSES.find((s) => s === value) ?? fail(path, "is not ok, fixture, or unavailable");

// A SQLite failure is a 503 error body, not a health body, so a decoded body always has sqlite "ok".
export function decodeHealth(data: unknown): HealthResponse {
  const h = record(data, "health");
  const c = record(h.components, "components");
  const f = record(h.fixtures, "fixtures");
  return {
    status: h.status === "ok" || h.status === "degraded" ? h.status : fail("status", "is not ok or degraded"),
    components: {
      vast: componentStatus(c.vast, "components.vast"),
      databricks: componentStatus(c.databricks, "components.databricks"),
      sqlite: c.sqlite === "ok" ? "ok" : fail("components.sqlite", "is not ok"),
    },
    fixtures: { vast: flag(f.vast, "fixtures.vast"), databricks: flag(f.databricks, "fixtures.databricks") },
  };
}

export function getHealth(options: ReadOptions = {}): Promise<HealthResponse> {
  return apiRequest("/api/health", { ...options, decode: decodeHealth });
}

export function getOffers(options: ReadOptions = {}): Promise<ApiEnvelope<Offer[]>> {
  return apiRequest("/api/offers", { ...options, decode: decodeOffersEnvelope });
}

const requireGpu = (gpuName: string) => (gpuName.trim() ? null : Promise.reject(new Error("A GPU name is required.")));

export function getMarketSummary(gpuName: string, options: ReadOptions = {}): Promise<ApiEnvelope<MarketSummary | null>> {
  return requireGpu(gpuName) ?? apiRequest("/api/market/summary", { ...options, query: { gpu_name: gpuName }, decode: decodeSummaryEnvelope });
}

// With no region the API returns the region = 'all' rows, never a mix of regions.
export function getMarketTrends(gpuName: string, region?: string | null, options: ReadOptions = {}): Promise<ApiEnvelope<TrendPoint[]>> {
  return requireGpu(gpuName) ?? apiRequest("/api/market/trends", { ...options, query: { gpu_name: gpuName, region: region || undefined }, decode: decodeTrendsEnvelope });
}
