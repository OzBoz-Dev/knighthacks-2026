import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeVerifyResult } from "../api/reservations";
import { checkPayloadHash } from "../solana/payload-hash";
import { CHECK_LABELS, resultMatches, verificationOutcome } from "./verification";

const fixture = JSON.parse(readFileSync(new URL("../../../fixtures/reservations.json", import.meta.url), "utf8"));
const confirmed = fixture.list.response[1];
const result = decodeVerifyResult(fixture.verify.response, confirmed.id);

describe("verificationOutcome", () => {
  it("passes only when every API check and the browser hash check pass", async () => {
    expect(await checkPayloadHash(confirmed)).toBe(true);
    expect(verificationOutcome(result, true)).toBe("passed");
    expect(verificationOutcome(result, false)).toBe("failed");
  });

  it("fails when one API check fails", () => {
    const failed = { ...result, checks: result.checks.map((c) => (c.name === "signer" ? { ...c, passed: false } : c)) };
    expect(verificationOutcome(failed, true)).toBe("failed");
  });

  it("fails the browser hash check after one payload character changes", async () => {
    const changed = { ...confirmed, canonical_payload: confirmed.canonical_payload.replace("0.42", "0.41") };
    expect(await checkPayloadHash(changed)).toBe(false);
  });
});

describe("resultMatches", () => {
  it("accepts a result only for the same reservation and signature", () => {
    expect(resultMatches(result, confirmed)).toBe(true);
    expect(resultMatches(result, { ...confirmed, signature: "other" })).toBe(false);
    expect(resultMatches(result, { ...confirmed, id: "res_other" })).toBe(false);
  });
});

describe("CHECK_LABELS", () => {
  it("names the five checks", () => {
    expect(Object.keys(CHECK_LABELS)).toEqual(["exists", "signer", "reservation_id", "memo_hash", "confirmed"]);
  });
});
