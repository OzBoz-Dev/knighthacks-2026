import type { MatchRequest, MatchResponse } from "../api/types";
import { formatGb, formatPercent, formatUsd } from "../format";
import { EXCLUSION_ORDER, offersText, type ExclusionKey } from "./exclusions";

// Each hint names only the value the user sent. The response has no threshold that would make an offer pass, so none is invented.
const HINT: Record<ExclusionKey, (request: MatchRequest) => string> = {
  gpu_model: () => "try allowing more GPU models",
  region: (r) => `try a region other than ${r.region ?? "the one you chose"}, or any region`,
  vram: (r) => `try lowering it below ${formatGb(r.min_vram_gb)}`,
  reliability: (r) => `try lowering it below ${formatPercent(r.min_reliability, "ratio")}`,
  budget: (r) => `try raising it above ${formatUsd(r.max_price_per_hour)}/hour`,
};

// The largest count wins. Equal counts take the earlier reason in EXCLUSION_ORDER.
export function suggestion(excluded: MatchResponse["excluded"], request: MatchRequest): string {
  let top: (typeof EXCLUSION_ORDER)[number] | null = null;
  for (const reason of EXCLUSION_ORDER) if (excluded[reason.key] > 0 && (!top || excluded[reason.key] > excluded[top.key])) top = reason;
  if (!top) return "No offers were available to check. Try again in a few minutes.";
  return `${top.label} excluded ${offersText(excluded[top.key])}; ${HINT[top.key](request)}.`;
}
