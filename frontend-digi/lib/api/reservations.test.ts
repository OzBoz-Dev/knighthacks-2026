import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./client";
import { decodeReservationList, decodeVerifyResult, getReservations, verifyReservation } from "./reservations";

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
