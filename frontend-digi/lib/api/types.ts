export type Offer = {
  id: string;
  gpu_name: string;
  num_gpus: number;
  gpu_ram_gb: number;
  total_vram_gb: number;
  region: string;
  price_per_hour: number;
  reliability: number;
  dlperf: number | null;
  performance_per_dollar: number | null;
  verified: boolean;
  market_position_pct: number | null;
  price_percentile: number | null;
};

export type MarketSummary = {
  gpu_name: string;
  listing_count: number;
  lowest_price: number;
  median_price: number;
  p90_price: number;
  median_reliability: number;
  updated_at: string;
};

export type TrendPoint = {
  timestamp: string;
  minimum_price: number;
  median_price: number;
  p10_price: number;
  p90_price: number;
  listing_count: number;
};

export type MatchRequest = {
  min_vram_gb: number;
  max_price_per_hour: number;
  min_reliability: number;
  priority: "cheapest" | "balanced" | "performance";
  gpu_names?: string[];
  region?: string;
};

export type Recommendation = {
  rank: number;
  offer: Offer;
  score: number;
  score_breakdown: {
    price: number;
    performance: number;
    reliability: number;
  };
  explanations: string[];
};

export type MatchResponse = {
  request_id: string;
  snapshot_id: string;
  checked: number;
  eligible: number;
  excluded: Record<"gpu_model" | "region" | "vram" | "reliability" | "budget", number>;
  recommendations: Recommendation[];
};

export type Reservation = {
  id: string;
  request_id: string;
  snapshot_id: string;
  offer_id: string;
  wallet: string;
  gpu_name: string;
  price_per_hour: number;
  min_vram_gb: number;
  max_price_per_hour: number;
  priority: string;
  region: string | null;
  created_at: string;
  canonical_payload: string;
  payload_hash: string;
  status: "pending" | "confirmed" | "failed";
  signature: string | null;
  slot: number | null;
};

// API response contract, prd.md section 8. The read endpoints use ApiEnvelope.
export type ApiSource =
  | "vast-live"
  | "vast-saved"
  | "databricks-live"
  | "databricks-export";

export type ApiEnvelope<T> = {
  source: ApiSource;
  captured_at: string;
  snapshot_id: string | null;
  data: T;
};

export type ApiErrorCode =
  | "bad_request"
  | "not_found"
  | "upstream_unavailable"
  | "internal";

export type ApiErrorResponse = {
  error: { code: ApiErrorCode; message: string };
};

export type ComponentStatus = "ok" | "fixture" | "unavailable";

export type HealthResponse = {
  status: "ok" | "degraded";
  components: {
    vast: ComponentStatus;
    databricks: ComponentStatus;
    sqlite: "ok";
  };
  fixtures: { vast: boolean; databricks: boolean };
};

export type CreateReservationRequest = {
  request_id: string;
  snapshot_id: string;
  offer_id: string;
  wallet: string;
  min_vram_gb: number;
  max_price_per_hour: number;
  priority: MatchRequest["priority"];
  region?: string | null;
};

export type ConfirmReservationRequest = { signature: string };

export type ReceiptCheckName =
  | "exists"
  | "signer"
  | "reservation_id"
  | "memo_hash"
  | "confirmed";

export type ConfirmReservationResponse = Reservation & {
  failed_checks: ReceiptCheckName[];
};

export type ReceiptCheck = {
  name: ReceiptCheckName;
  passed: boolean;
  detail: string;
};

export type VerifyReservationResponse = {
  reservation_id: string;
  signature: string;
  slot: number | null;
  checks: ReceiptCheck[];
};
