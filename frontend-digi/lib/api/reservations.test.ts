import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./client";
import {
  confirmReservation,
  createReservation,
  decodeConfirmResponse,
  decodeCreatedReservation,
  decodeReservationList,
  decodeVerifyResult,
  getReservations,
  verifyReservation,
} from "./reservations";

/* eslint-disable @typescript-eslint/no-explicit-any */
const fixture = JSON.parse(readFileSync(new URL("../../../fixtures/reservations.json", import.meta.url), "utf8"));
const WALLET: string = fixture.list.request.wallet;
const CONFIRMED_ID = "res_1a2b3c4d5e6f7a8b";
const list = () => structuredClone(fixture.list.response) as any[];
const verify = () => structuredClone(fixture.verify.response) as any;
const BASE = "http://localhost:8000";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("decodeReservationList", () => {
  it("decodes the fixture list and keeps the payload bytes exact", () => {
    const rows = decodeReservationList(fixture.list.response, WALLET);
    expect(rows.map((r) => r.status)).toEqual(["pending", "confirmed"]);
    expect(rows[0].canonical_payload).toBe(fixture.list.response[0].canonical_payload);
    expect(rows[1].slot).toBe(318452907);
  });

  it("rejects a missing status or payload_hash", () => {
    const noStatus = list();
    delete noStatus[0].status;
    expect(() => decodeReservationList(noStatus, WALLET)).toThrow(/status/);
    const noHash = list();
    delete noHash[1].payload_hash;
    expect(() => decodeReservationList(noHash, WALLET)).toThrow(/payload_hash/);
  });

  it("rejects an unknown status, a bad hash, and a confirmed row without a signature", () => {
    const unknown = list();
    unknown[0].status = "verified";
    expect(() => decodeReservationList(unknown, WALLET)).toThrow(/status/);
    const upper = list();
    upper[0].payload_hash = upper[0].payload_hash.toUpperCase();
    expect(() => decodeReservationList(upper, WALLET)).toThrow(/payload_hash/);
    const unsigned = list();
    unsigned[1].signature = null;
    expect(() => decodeReservationList(unsigned, WALLET)).toThrow(/confirmed/);
  });

  it("accepts a failed row without a signature", () => {
    const legacy = list();
    Object.assign(legacy[0], { status: "failed", signature: null, slot: null });
    expect(decodeReservationList(legacy, WALLET)[0].status).toBe("failed");
  });

  it("rejects a row for another wallet and a repeated id", () => {
    expect(() => decodeReservationList(fixture.list.response, "OtherWallet111111111111111111111111111111111")).toThrow(/wallet/);
    const repeat = list();
    repeat[1].id = repeat[0].id;
    expect(() => decodeReservationList(repeat, WALLET)).toThrow(/repeat/);
  });
});

describe("decodeVerifyResult", () => {
  it("decodes the fixture checks in the fixed order", () => {
    const result = decodeVerifyResult(fixture.verify.response, CONFIRMED_ID);
    expect(result.checks.map((c) => c.name)).toEqual(["exists", "signer", "reservation_id", "memo_hash", "confirmed"]);
    expect(result.checks.every((c) => c.passed)).toBe(true);
  });

  it("keeps a failed check as a valid result with its reason", () => {
    const body = verify();
    Object.assign(body.checks[3], { passed: false, detail: "memo has abc, want def" });
    const result = decodeVerifyResult(body, CONFIRMED_ID);
    expect(result.checks[3]).toEqual({ name: "memo_hash", passed: false, detail: "memo has abc, want def" });
  });

  it("rejects missing, repeated, and unknown checks", () => {
    const missing = verify();
    missing.checks.pop();
    expect(() => decodeVerifyResult(missing, CONFIRMED_ID)).toThrow(/confirmed is missing/);
    const repeated = verify();
    repeated.checks.push(repeated.checks[0]);
    expect(() => decodeVerifyResult(repeated, CONFIRMED_ID)).toThrow(/repeats/);
    const unknown = verify();
    unknown.checks[0].name = "amount";
    expect(() => decodeVerifyResult(unknown, CONFIRMED_ID)).toThrow(/known check/);
  });

  it("rejects a result for another reservation or an all-pass result without a slot", () => {
    expect(() => decodeVerifyResult(fixture.verify.response, "res_other")).toThrow(/reservation_id/);
    expect(() => decodeVerifyResult({ ...verify(), slot: null }, CONFIRMED_ID)).toThrow(/slot/);
  });
});

describe("createReservation", () => {
  const request = fixture.create.request;

  it("posts the request once and returns the new pending reservation", async () => {
    const fetchImpl = vi.fn(async () => json(fixture.create.response, 201));
    const created = await createReservation(request, { baseUrl: BASE, fetchImpl });
    expect(created.status).toBe("pending");
    expect(created.canonical_payload).toBe(fixture.create.response.canonical_payload);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/reservations`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual(request);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects a response for another offer or one that is not pending", () => {
    expect(() => decodeCreatedReservation({ ...fixture.create.response, offer_id: "999" }, request)).toThrow(/offer_id/);
    expect(() => decodeCreatedReservation(fixture.confirm.response, request)).toThrow(/pending/);
  });

  it("reports a bad request with its code and does not retry", async () => {
    const fetchImpl = vi.fn(async () => json({ error: { code: "bad_request", message: "The offer is not in that snapshot." } }, 400));
    const error = await createReservation(request, { baseUrl: BASE, fetchImpl }).catch((e: unknown) => e);
    expect((error as ApiError).code).toBe("bad_request");
    expect((error as ApiError).message).toBe("The offer is not in that snapshot.");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("confirmReservation", () => {
  const SIG: string = fixture.confirm.request.signature;
  // The implemented response adds failed_checks to the reservation (prd.md section 8).
  const confirmed = () => ({ ...structuredClone(fixture.confirm.response), failed_checks: [] });

  it("posts the signature once and returns the confirmed reservation", async () => {
    const fetchImpl = vi.fn(async () => json(confirmed()));
    const result = await confirmReservation(CONFIRMED_ID, SIG, { baseUrl: BASE, fetchImpl });
    expect(result.status).toBe("confirmed");
    expect(result.failed_checks).toEqual([]);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/reservations/${CONFIRMED_ID}/confirm`);
    expect(JSON.parse(String(init.body))).toEqual({ signature: SIG });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("keeps a failed reservation with HTTP 200 as a failed result with its reasons", () => {
    const failed = { ...confirmed(), status: "failed", slot: null, failed_checks: ["memo_hash"] };
    const result = decodeConfirmResponse(failed, CONFIRMED_ID, SIG);
    expect(result.status).toBe("failed");
    expect(result.failed_checks).toEqual(["memo_hash"]);
  });

  it("rejects a status and failed_checks that disagree, an unknown check, or another signature", () => {
    expect(() => decodeConfirmResponse({ ...confirmed(), failed_checks: ["signer"] }, CONFIRMED_ID, SIG)).toThrow(/failed_checks/);
    expect(() => decodeConfirmResponse({ ...confirmed(), status: "failed", slot: null }, CONFIRMED_ID, SIG)).toThrow(/failed_checks/);
    expect(() => decodeConfirmResponse({ ...confirmed(), status: "failed", slot: null, failed_checks: ["amount"] }, CONFIRMED_ID, SIG)).toThrow(/known check/);
    expect(() => decodeConfirmResponse(fixture.confirm.response, CONFIRMED_ID, SIG)).toThrow(/failed_checks/);
    expect(() => decodeConfirmResponse(confirmed(), CONFIRMED_ID, "other")).toThrow(/signature/);
    expect(() => decodeConfirmResponse(confirmed(), "res_other", SIG)).toThrow(/reservation\.id/);
  });

  it("reports a 503 for a transaction devnet has not returned yet, without a retry", async () => {
    const fetchImpl = vi.fn(async () => json({ error: { code: "upstream_unavailable", message: "Solana devnet hasn't returned your transaction yet. Try again in a few seconds." } }, 503));
    const error = await confirmReservation(CONFIRMED_ID, SIG, { baseUrl: BASE, fetchImpl }).catch((e: unknown) => e);
    expect((error as ApiError).status).toBe(503);
    expect((error as ApiError).code).toBe("upstream_unavailable");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("refuses a blank id or signature before any request", async () => {
    const fetchImpl = vi.fn();
    await expect(confirmReservation("", SIG, { baseUrl: BASE, fetchImpl })).rejects.toThrow(/required/);
    await expect(confirmReservation(CONFIRMED_ID, " ", { baseUrl: BASE, fetchImpl })).rejects.toThrow(/required/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("getReservations and verifyReservation", () => {
  it("lists the reservations of the wallet with the wallet in the query", async () => {
    const fetchImpl = vi.fn(async () => json(fixture.list.response));
    const rows = await getReservations(WALLET, { baseUrl: BASE, fetchImpl });
    expect(rows).toHaveLength(2);
    const [url] = fetchImpl.mock.calls[0] as unknown as [string];
    expect(new URL(url).searchParams.get("wallet")).toBe(WALLET);
  });

  it("encodes the reservation id in the verify path", async () => {
    const fetchImpl = vi.fn(async () => json(fixture.verify.response));
    await verifyReservation(CONFIRMED_ID, { baseUrl: BASE, fetchImpl });
    const [url] = fetchImpl.mock.calls[0] as unknown as [string];
    expect(url).toBe(`${BASE}/api/reservations/${CONFIRMED_ID}/verify`);
    const odd = vi.fn(async () => json({ ...verify(), reservation_id: "a/b?c" }));
    await verifyReservation("a/b?c", { baseUrl: BASE, fetchImpl: odd });
    expect((odd.mock.calls[0] as unknown as [string])[0]).toBe(`${BASE}/api/reservations/a%2Fb%3Fc/verify`);
  });

  it("reports HTTP errors without a retry", async () => {
    const fetchImpl = vi.fn(async () => json({ error: { code: "upstream_unavailable", message: "x" } }, 503));
    const error = await verifyReservation(CONFIRMED_ID, { baseUrl: BASE, fetchImpl }).catch((e: unknown) => e);
    expect((error as ApiError).status).toBe(503);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("refuses a blank wallet or id before any request", async () => {
    const fetchImpl = vi.fn();
    await expect(getReservations(" ", { baseUrl: BASE, fetchImpl })).rejects.toThrow(/wallet/);
    await expect(verifyReservation("", { baseUrl: BASE, fetchImpl })).rejects.toThrow(/id/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
