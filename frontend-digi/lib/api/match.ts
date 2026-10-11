import { apiRequest, type RequestOptions } from "./client";
import { count, decodeOffer, fail, list, number, record, text } from "./decode";
import type { MatchRequest, MatchResponse, Recommendation } from "./types";

export const EXCLUSION_KEYS = ["gpu_model", "region", "vram", "reliability", "budget"] as const;

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
