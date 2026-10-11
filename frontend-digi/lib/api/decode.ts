import type { ApiEnvelope, ApiSource, MarketSummary, Offer, TrendPoint } from "./types";

// Small checks for unknown JSON. Each one returns the value or throws an error that names the field.
export type Fields = Record<string, unknown>;

export const fail = (path: string, problem: string): never => {
  throw new Error(`${path} ${problem}`);
};

export const record = (value: unknown, path: string): Fields =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Fields) : fail(path, "is not an object");

export const list = (value: unknown, path: string): unknown[] => (Array.isArray(value) ? value : fail(path, "is not a list"));

export const text = (value: unknown, path: string): string =>
  typeof value === "string" && value.trim() ? value : fail(path, "is not a nonempty string");

export const flag = (value: unknown, path: string): boolean => (typeof value === "boolean" ? value : fail(path, "is not a boolean"));

export const number = (value: unknown, path: string, min = -Infinity, max = Infinity): number =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : fail(path, `is not a number from ${min} to ${max}`);

export const nullableNumber = (value: unknown, path: string, min?: number): number | null => (value === null ? null : number(value, path, min));

export const count = (value: unknown, path: string): number => (Number.isInteger(number(value, path, 0)) ? (value as number) : fail(path, "is not a whole number"));

// An RFC 3339 time with a zone, as the API writes it. A time with no zone would read as local time.
export const timestamp = (value: unknown, path: string): string => {
  const s = text(value, path);
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : fail(path, "is not an RFC 3339 time");
};

// The rules follow api/vast/normalize.go. Region is "" when Vast.ai sends no location, and dlperf has no bound.
export function decodeOffer(value: unknown, path = "offer"): Offer {
  const o = record(value, path);
  return {
    id: text(o.id, `${path}.id`),
    gpu_name: text(o.gpu_name, `${path}.gpu_name`),
    num_gpus: count(o.num_gpus, `${path}.num_gpus`) || fail(`${path}.num_gpus`, "is zero"),
    gpu_ram_gb: number(o.gpu_ram_gb, `${path}.gpu_ram_gb`, 0),
    total_vram_gb: number(o.total_vram_gb, `${path}.total_vram_gb`, 0),
    region: typeof o.region === "string" ? o.region : fail(`${path}.region`, "is not a string"),
    price_per_hour: number(o.price_per_hour, `${path}.price_per_hour`, Number.MIN_VALUE),
    reliability: number(o.reliability, `${path}.reliability`, 0, 1),
    dlperf: nullableNumber(o.dlperf, `${path}.dlperf`),
    performance_per_dollar: nullableNumber(o.performance_per_dollar, `${path}.performance_per_dollar`),
    verified: flag(o.verified, `${path}.verified`),
    market_position_pct: nullableNumber(o.market_position_pct, `${path}.market_position_pct`),
    price_percentile: nullableNumber(o.price_percentile, `${path}.price_percentile`),
  };
}

export function decodeMarketSummary(value: unknown, path = "summary"): MarketSummary {
  const s = record(value, path);
  return {
    gpu_name: text(s.gpu_name, `${path}.gpu_name`),
    listing_count: count(s.listing_count, `${path}.listing_count`),
    lowest_price: number(s.lowest_price, `${path}.lowest_price`, 0),
    median_price: number(s.median_price, `${path}.median_price`, 0),
    p90_price: number(s.p90_price, `${path}.p90_price`, 0),
    median_reliability: number(s.median_reliability, `${path}.median_reliability`, 0, 1),
    updated_at: timestamp(s.updated_at, `${path}.updated_at`),
  };
}

export function decodeTrendPoint(value: unknown, path = "point"): TrendPoint {
  const p = record(value, path);
  return {
    timestamp: timestamp(p.timestamp, `${path}.timestamp`),
    minimum_price: number(p.minimum_price, `${path}.minimum_price`, 0),
    median_price: number(p.median_price, `${path}.median_price`, 0),
    p10_price: number(p.p10_price, `${path}.p10_price`, 0),
    p90_price: number(p.p90_price, `${path}.p90_price`, 0),
    listing_count: count(p.listing_count, `${path}.listing_count`),
  };
}

const INVENTORY_SOURCES = ["vast-live", "vast-saved"] as const;
const MARKET_SOURCES = ["databricks-live", "databricks-export"] as const;

// Each endpoint family has its own sources, so a Databricks source on the offers is an error.
// dev-sample and the other frontend states are never valid in an API response.
function envelope<T>(data: unknown, sources: readonly ApiSource[], decodeData: (value: unknown) => T): ApiEnvelope<T> {
  const e = record(data, "response");
  const source = sources.find((s) => s === e.source) ?? fail("source", `is not one of ${sources.join(", ")}`);
  if (!("snapshot_id" in e)) fail("snapshot_id", "is missing");
  if (!("data" in e)) fail("data", "is missing");
  return {
    source,
    captured_at: timestamp(e.captured_at, "captured_at"),
    snapshot_id: e.snapshot_id === null ? null : text(e.snapshot_id, "snapshot_id"),
    data: decodeData(e.data),
  };
}

export const decodeOffersEnvelope = (data: unknown): ApiEnvelope<Offer[]> =>
  envelope(data, INVENTORY_SOURCES, (value) => list(value, "data").map((item, i) => decodeOffer(item, `data[${i}]`)));

// data is null when gold has no summary for the GPU. That is a valid answer, not an error.
export const decodeSummaryEnvelope = (data: unknown): ApiEnvelope<MarketSummary | null> =>
  envelope(data, MARKET_SOURCES, (value) => (value === null ? null : decodeMarketSummary(value, "data")));

export const decodeTrendsEnvelope = (data: unknown): ApiEnvelope<TrendPoint[]> =>
  envelope(data, MARKET_SOURCES, (value) => list(value, "data").map((item, i) => decodeTrendPoint(item, `data[${i}]`)));
