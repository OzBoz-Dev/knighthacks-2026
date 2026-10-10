import type { MatchResponse } from "../api/types";

export type ExclusionKey = keyof MatchResponse["excluded"];

// The prd.md section 5.2 filter order. The API counts each offer once, against the first filter it fails.
export const EXCLUSION_ORDER: { key: ExclusionKey; label: string }[] = [
  { key: "gpu_model", label: "GPU model" },
  { key: "region", label: "Region" },
  { key: "vram", label: "VRAM" },
  { key: "reliability", label: "Reliability" },
  { key: "budget", label: "Budget" },
];

export function exclusionRows(excluded: MatchResponse["excluded"]) {
  return EXCLUSION_ORDER.filter(({ key }) => excluded[key] > 0).map(({ key, label }) => ({ key, label, count: excluded[key] }));
}

export const offersText = (count: number) => `${count} ${count === 1 ? "offer" : "offers"}`;
