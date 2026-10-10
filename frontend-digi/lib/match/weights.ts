import type { MatchRequest, Recommendation } from "../api/types";

export type ScorePart = keyof Recommendation["score_breakdown"];

// The weight table from prd.md section 5.2. The API ranks with the same table; the UI only shows it.
export const PRIORITY_WEIGHTS: Record<MatchRequest["priority"], Record<ScorePart, number>> = {
  cheapest: { price: 0.6, performance: 0.2, reliability: 0.2 },
  balanced: { price: 0.4, performance: 0.35, reliability: 0.25 },
  performance: { price: 0.2, performance: 0.6, reliability: 0.2 },
};

export const SCORE_PARTS: { key: ScorePart; label: string }[] = [
  { key: "price", label: "Price" },
  { key: "performance", label: "Performance" },
  { key: "reliability", label: "Reliability" },
];
