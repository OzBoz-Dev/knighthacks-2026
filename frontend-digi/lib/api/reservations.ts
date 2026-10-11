import { apiRequest, type RequestOptions } from "./client";
import { count, fail, flag, list, number, record, text } from "./decode";
import type {
  ConfirmReservationRequest,
  ConfirmReservationResponse,
  CreateReservationRequest,
  ReceiptCheckName,
  Reservation,
  VerifyReservationResponse,
} from "./types";

type Options = Pick<RequestOptions, "signal" | "baseUrl" | "fetchImpl">;

const STATUSES = ["pending", "confirmed", "failed"] as const;

// The check names and order of api/solana/verify.go.
export const VERIFY_CHECKS: readonly ReceiptCheckName[] = ["exists", "signer", "reservation_id", "memo_hash", "confirmed"];

const nullableText = (value: unknown, path: string) => (value === null ? null : text(value, path));
const slot = (value: unknown, path: string) => (value === null ? null : count(value, path));

export function decodeReservation(value: unknown, path = "reservation"): Reservation {
  const r = record(value, path);
  const status = STATUSES.find((s) => s === r.status) ?? fail(`${path}.status`, "is not pending, confirmed, or failed");
  const createdAt = text(r.created_at, `${path}.created_at`);
  if (Number.isNaN(Date.parse(createdAt))) fail(`${path}.created_at`, "is not a time");
  // The payload is hashed byte for byte, so it is kept exactly as sent, never trimmed or parsed.
  const payload = typeof r.canonical_payload === "string" && r.canonical_payload ? r.canonical_payload : fail(`${path}.canonical_payload`, "is not a nonempty string");
  const hash = typeof r.payload_hash === "string" && /^[0-9a-f]{64}$/.test(r.payload_hash) ? r.payload_hash : fail(`${path}.payload_hash`, "is not a lowercase SHA-256 hex string");
  const reservation: Reservation = {
    id: text(r.id, `${path}.id`),
    request_id: text(r.request_id, `${path}.request_id`),
    snapshot_id: text(r.snapshot_id, `${path}.snapshot_id`),
    offer_id: text(r.offer_id, `${path}.offer_id`),
    wallet: text(r.wallet, `${path}.wallet`),
    gpu_name: text(r.gpu_name, `${path}.gpu_name`),
    price_per_hour: number(r.price_per_hour, `${path}.price_per_hour`, Number.MIN_VALUE),
    min_vram_gb: number(r.min_vram_gb, `${path}.min_vram_gb`, 0),
    max_price_per_hour: number(r.max_price_per_hour, `${path}.max_price_per_hour`, Number.MIN_VALUE),
    priority: text(r.priority, `${path}.priority`),
    region: nullableText(r.region, `${path}.region`),
    created_at: createdAt,
    canonical_payload: payload,
    payload_hash: hash,
    status,
    signature: nullableText(r.signature, `${path}.signature`),
    slot: slot(r.slot, `${path}.slot`),
  };
  if (status === "confirmed" && (reservation.signature === null || reservation.slot === null)) fail(path, "is confirmed without a signature and a slot");
  return reservation;
}

// A record for another wallet is rejected, so the list can never show someone else's receipt as yours.
export function decodeReservationList(data: unknown, wallet: string): Reservation[] {
  const rows = list(data, "reservations").map((item, i) => decodeReservation(item, `reservations[${i}]`));
  rows.forEach((row, i) => { if (row.wallet !== wallet) fail(`reservations[${i}].wallet`, "is not the requested wallet"); });
  if (new Set(rows.map((row) => row.id)).size !== rows.length) fail("reservations", "repeat a reservation id");
  return rows;
}

export function decodeVerifyResult(data: unknown, reservationId: string): VerifyReservationResponse {
  const r = record(data, "verify");
  const rows = list(r.checks, "checks").map((item, i) => {
    const c = record(item, `checks[${i}]`);
    const name = VERIFY_CHECKS.find((n) => n === c.name) ?? fail(`checks[${i}].name`, "is not a known check");
    return { name, passed: flag(c.passed, `checks[${i}].passed`), detail: typeof c.detail === "string" ? c.detail : fail(`checks[${i}].detail`, "is not a string") };
  });
  // Every check must appear exactly once. A missing check is never read as a pass.
  const checks = VERIFY_CHECKS.map((name) => {
    const matches = rows.filter((row) => row.name === name);
    return matches.length === 1 ? matches[0] : fail(`checks.${name}`, matches.length ? "repeats" : "is missing");
  });
  const result = { reservation_id: text(r.reservation_id, "reservation_id"), signature: text(r.signature, "signature"), slot: slot(r.slot, "slot"), checks };
  if (result.reservation_id !== reservationId) fail("reservation_id", "is not the requested reservation");
  if (checks.every((c) => c.passed) && result.slot === null) fail("slot", "is missing for a transaction that passes every check");
  return result;
}

// The API makes a new pending reservation from the offer in the snapshot. Its price and GPU never come from the request.
export function decodeCreatedReservation(data: unknown, request: CreateReservationRequest): Reservation {
  const r = decodeReservation(data);
  if (r.status !== "pending" || r.signature !== null || r.slot !== null) fail("reservation", "is not a new pending reservation");
  for (const key of ["request_id", "snapshot_id", "offer_id", "wallet"] as const) {
    if (r[key] !== request[key]) fail(`reservation.${key}`, "is not the requested value");
  }
  return r;
}

// HTTP 200 can carry a failed reservation. failed_checks names the reasons, so the caller must read status.
export function decodeConfirmResponse(data: unknown, id: string, signature: string): ConfirmReservationResponse {
  const r = decodeReservation(data);
  const failed = list(record(data, "reservation").failed_checks, "failed_checks").map((name, i) =>
    VERIFY_CHECKS.find((c) => c === name) ?? fail(`failed_checks[${i}]`, "is not a known check"));
  if (r.id !== id) fail("reservation.id", "is not the requested reservation");
  if (r.signature !== signature) fail("reservation.signature", "is not the submitted signature");
  if (r.status === "pending") fail("reservation.status", "is still pending after a confirm");
  if ((r.status === "confirmed") !== (failed.length === 0)) fail("failed_checks", `do not agree with status ${r.status}`);
  return { ...r, failed_checks: failed };
}

// A mutation: apiRequest never retries. A second call makes a second reservation.
export function createReservation(request: CreateReservationRequest, options: Options = {}): Promise<Reservation> {
  return apiRequest("/api/reservations", { ...options, method: "POST", body: request, decode: (data: unknown) => decodeCreatedReservation(data, request) });
}

// A repeat with the same signature is safe: the API returns the stored result.
export function confirmReservation(id: string, signature: string, options: Options = {}): Promise<ConfirmReservationResponse> {
  if (!id.trim() || !signature.trim()) return Promise.reject(new Error("A reservation id and a signature are required."));
  const body: ConfirmReservationRequest = { signature };
  return apiRequest(`/api/reservations/${encodeURIComponent(id)}/confirm`, { ...options, method: "POST", body, decode: (data: unknown) => decodeConfirmResponse(data, id, signature) });
}

export function getReservations(wallet: string, options: Options = {}): Promise<Reservation[]> {
  if (!wallet.trim()) return Promise.reject(new Error("A wallet address is required."));
  return apiRequest("/api/reservations", { ...options, query: { wallet }, decode: (data: unknown) => decodeReservationList(data, wallet) });
}

// A read: the API runs the devnet checks again and does not change the reservation.
export function verifyReservation(id: string, options: Options = {}): Promise<VerifyReservationResponse> {
  if (!id.trim()) return Promise.reject(new Error("A reservation id is required."));
  return apiRequest(`/api/reservations/${encodeURIComponent(id)}/verify`, { ...options, decode: (data: unknown) => decodeVerifyResult(data, id) });
}
