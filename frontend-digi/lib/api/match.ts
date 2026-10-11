import { apiRequest, type RequestOptions } from "./client";
import { count, fail, flag, list, nullableNumber, number, record, text } from "./decode";
import type { MatchRequest, MatchResponse, Offer, Recommendation } from "./types";

export const EXCLUSION_KEYS = ["gpu_model", "region", "vram", "reliability", "budget"] as const;

export function decodeOffer(value: unknown, path = "offer"): Offer {
  const o = record(value, path);
  return {
    id: text(o.id, `${path}.id`),
    gpu_name: text(o.gpu_name, `${path}.gpu_name`),
    num_gpus: count(o.num_gpus, `${path}.num_gpus`) || fail(`${path}.num_gpus`, "is zero"),
    gpu_ram_gb: number(o.gpu_ram_gb, `${path}.gpu_ram_gb`, 0),
    total_vram_gb: number(o.total_vram_gb, `${path}.total_vram_gb`, 0),
    region: text(o.region, `${path}.region`),
    price_per_hour: number(o.price_per_hour, `${path}.price_per_hour`, Number.MIN_VALUE),
    // #26 fixes reliability as a ratio from 0 to 1.
    reliability: number(o.reliability, `${path}.reliability`, 0, 1),
    dlperf: nullableNumber(o.dlperf, `${path}.dlperf`, 0),
    performance_per_dollar: nullableNumber(o.performance_per_dollar, `${path}.performance_per_dollar`, 0),
    verified: flag(o.verified, `${path}.verified`),
    market_position_pct: nullableNumber(o.market_position_pct, `${path}.market_position_pct`),
    price_percentile: nullableNumber(o.price_percentile, `${path}.price_percentile`),
  };
}

function decodeRecommendation(value: unknown, path: string): Recommendation {
  const r = record(value, path);
  const parts = record(r.score_breakdown, `${path}.score_breakdown`);
  return {
    rank: count(r.rank, `${path}.rank`),
    offer: decodeOffer(r.offer, `${path}.offer`),
    score: number(r.score, `${path}.score`, 0, 100),
    score_breakdown: {
      price: number(parts.price, `${path}.score_breakdown.price`, 0, 100),
      performance: number(parts.performance, `${path}.score_breakdown.performance`, 0, 100),
      reliability: number(parts.reliability, `${path}.score_breakdown.reliability`, 0, 100),
    },
    explanations: list(r.explanations, `${path}.explanations`).map((line, i) => text(line, `${path}.explanations[${i}]`)),
  };
}

// Inconsistent counts or ranks are rejected, never corrected, so the screen cannot show numbers the API did not mean.
export function decodeMatchResponse(data: unknown): MatchResponse {
  const r = record(data, "response");
  const excludedFields = record(r.excluded, "excluded");
  const excluded = Object.fromEntries(EXCLUSION_KEYS.map((key) => [key, count(excludedFields[key], `excluded.${key}`)])) as MatchResponse["excluded"];
  const checked = count(r.checked, "checked");
  const eligible = count(r.eligible, "eligible");
  const recommendations = list(r.recommendations, "recommendations")
    .map((item, i) => decodeRecommendation(item, `recommendations[${i}]`))
    .toSorted((a, b) => a.rank - b.rank);
  if (eligible + EXCLUSION_KEYS.reduce((sum, key) => sum + excluded[key], 0) !== checked) fail("counts", "do not add up to checked");
  if (recommendations.length > Math.min(5, eligible)) fail("recommendations", "has more entries than allowed");
  if (recommendations.some((rec, i) => rec.rank !== i + 1)) fail("recommendations", "ranks are not 1 to n");
  if (new Set(recommendations.map((rec) => rec.offer.id)).size !== recommendations.length) fail("recommendations", "repeat an offer");
  return { request_id: text(r.request_id, "request_id"), snapshot_id: text(r.snapshot_id, "snapshot_id"), checked, eligible, excluded, recommendations };
}

export type MatchOptions = { gpuNames: string[]; regions: string[] };

// shortcut: reads only gpu_name and region from GET /api/offers for the form choices, upgrade to the #188 offers decoder when it lands.
export function decodeMatchOptions(data: unknown): MatchOptions {
  const offers = list(record(data, "response").data, "data").map((item, i) => record(item, `data[${i}]`));
  const unique = (key: "gpu_name" | "region") => [...new Set(offers.map((o, i) => text(o[key], `data[${i}].${key}`)))].sort();
  return { gpuNames: unique("gpu_name"), regions: unique("region") };
}

export function getMatchOptions(options: Pick<RequestOptions, "signal" | "baseUrl" | "fetchImpl"> = {}): Promise<MatchOptions> {
  return apiRequest("/api/offers", { ...options, decode: decodeMatchOptions });
}

// A mutation: apiRequest never retries, so one submit sends one request.
export function postMatch(request: MatchRequest, options: Pick<RequestOptions, "signal" | "baseUrl" | "fetchImpl"> = {}): Promise<MatchResponse> {
  return apiRequest("/api/match", { ...options, method: "POST", body: request, decode: decodeMatchResponse });
}
