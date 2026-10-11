import type { MatchRequest } from "../api/types";

export type Priority = MatchRequest["priority"];

// Mantine NumberInput gives a number, or a string while the field is empty or partly typed.
export type MatchFormValues = {
  minVram: number | string;
  maxPrice: number | string;
  minReliability: number | string;
  gpuNames: string[];
  region: string | null;
  priority: Priority;
};

export type MatchFormField = "minVram" | "maxPrice" | "minReliability";
export type MatchFormErrors = Partial<Record<MatchFormField, string>>;

export const INITIAL_MATCH_VALUES: MatchFormValues = {
  minVram: "",
  maxPrice: "",
  minReliability: 95,
  gpuNames: [],
  region: null,
  priority: "balanced",
};

// The prd.md section 4 demo at 1:50. It clears the optional filters so the demo always checks every offer.
export const DEMO_PRESET: MatchFormValues = {
  minVram: 24,
  maxPrice: 2,
  minReliability: 95,
  gpuNames: [],
  region: null,
  priority: "balanced",
};

const finite = (value: number | string) => (typeof value === "number" && Number.isFinite(value) ? value : null);

// True when the form still builds exactly the request that produced the results on screen.
export function formMatchesRequest(values: MatchFormValues, request: MatchRequest): boolean {
  const current = buildMatchRequest(values).request;
  return current !== null && JSON.stringify(current) === JSON.stringify(request);
}

export function buildMatchRequest(values: MatchFormValues): { request: MatchRequest; errors: null } | { request: null; errors: MatchFormErrors } {
  const minVram = finite(values.minVram);
  const maxPrice = finite(values.maxPrice);
  const reliability = finite(values.minReliability);
  const errors: MatchFormErrors = {};
  if (minVram === null) errors.minVram = "Enter the minimum VRAM per GPU in GB.";
  else if (minVram < 0) errors.minVram = "VRAM can't be negative.";
  if (maxPrice === null) errors.maxPrice = "Enter your maximum hourly budget.";
  else if (maxPrice <= 0) errors.maxPrice = "The budget must be more than $0/hour.";
  if (reliability === null) errors.minReliability = "Enter a minimum reliability from 0 to 100%.";
  else if (reliability < 0 || reliability > 100) errors.minReliability = "Reliability must be from 0 to 100%.";
  if (Object.keys(errors).length) return { request: null, errors };
  const gpuNames = [...new Set(values.gpuNames)];
  return {
    errors: null,
    request: {
      min_vram_gb: minVram!,
      max_price_per_hour: maxPrice!,
      // The API takes reliability as a ratio from 0 to 1. The form shows a percentage.
      min_reliability: Number((reliability! / 100).toFixed(4)),
      priority: values.priority,
      ...(gpuNames.length ? { gpu_names: gpuNames } : {}),
      ...(values.region ? { region: values.region } : {}),
    },
  };
}
