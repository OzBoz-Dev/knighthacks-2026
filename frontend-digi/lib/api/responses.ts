// The API wire formats from prd.md section 8. responses.test.ts keeps this file equal to the PRD block.
// They live outside types.ts, because api/contract/contract_test.go expects only the seven domain types there.
import type { MatchRequest, Reservation } from "./types";

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
