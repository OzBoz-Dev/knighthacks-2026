import { readFileSync } from "node:fs";
import { PublicKey, TransactionExpiredBlockheightExceededError, type Transaction } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import type { Reservation } from "../api/types";
import { confirmOnApi, isUserRejection, reserve, signAndConfirm, type ReserveDeps, type ReserveState } from "./reserve";

const fixture = JSON.parse(readFileSync(new URL("../../../fixtures/reservations.json", import.meta.url), "utf8"));
const pending: Reservation = fixture.create.response;
const confirmed: Reservation = { ...pending, status: "confirmed", signature: "sig1", slot: 7 };
const wallet = new PublicKey(pending.wallet);

function setup(overrides: { send?: () => Promise<string>; confirmTx?: () => Promise<unknown>; create?: () => Promise<Reservation>; confirm?: () => Promise<unknown> } = {}) {
  const states: ReserveState[] = [];
  const sent: Transaction[] = [];
  const create = vi.fn(overrides.create ?? (async () => pending));
  const confirm = vi.fn(overrides.confirm ?? (async () => ({ reservation: confirmed, failed_checks: [] })));
  const deps: ReserveDeps = {
    wallet,
    connection: {
      getLatestBlockhash: vi.fn(async () => ({ blockhash: "11111111111111111111111111111111", lastValidBlockHeight: 50 })),
      confirmTransaction: vi.fn(overrides.confirmTx ?? (async () => ({ context: { slot: 7 }, value: { err: null } }))),
    } as never,
    sendTransaction: vi.fn(async (tx: Transaction) => { sent.push(tx); return (overrides.send ?? (async () => "sig1"))(); }),
    onState: (s) => states.push(s),
    api: { create, confirm } as never,
  };
  return { deps, states, sent, create, confirm, steps: () => states.map((s) => s.step) };
}

describe("reserve", () => {
  it("creates, signs the SG1 memo with a fresh blockhash, confirms, and ends verified", async () => {
    const t = setup();
    const body = { ...fixture.create.request };
    const final = await reserve(body, t.deps);
    expect(t.steps()).toEqual(["creating", "awaiting-signature", "confirming", "confirming", "verified"]);
    expect(final).toMatchObject({ step: "verified", signature: "sig1" });
    expect(t.create).toHaveBeenCalledWith(body);
    expect(t.confirm).toHaveBeenCalledWith(pending.id, "sig1");
    const [tx] = t.sent;
    expect(tx.recentBlockhash).toBe("11111111111111111111111111111111");
    expect(new TextDecoder().decode(tx.instructions[0].data)).toBe(`SG1|${pending.id}|${pending.payload_hash}`);
  });

  it("stops before the wallet when the API fails, and does not retry", async () => {
    const t = setup({ create: async () => { throw new ApiError("http", "The offer is not in that snapshot.", { status: 400 }); } });
    const final = await reserve(fixture.create.request, t.deps);
    expect(final).toEqual({ step: "error", message: "The offer is not in that snapshot. Nothing was signed." });
    expect(t.create).toHaveBeenCalledTimes(1);
    expect(t.deps.sendTransaction).not.toHaveBeenCalled();
  });
});

describe("signAndConfirm", () => {
  it("never signs a payload that does not match its hash", async () => {
    const t = setup();
    const final = await signAndConfirm({ ...pending, canonical_payload: pending.canonical_payload.replace("0.42", "0.43") }, t.deps);
    expect(final.step).toBe("error");
    expect(t.deps.sendTransaction).not.toHaveBeenCalled();
  });

  it("never signs a reservation for another wallet", async () => {
    const t = setup();
    expect((await signAndConfirm({ ...pending, wallet: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin" }, t.deps)).step).toBe("error");
    expect(t.deps.sendTransaction).not.toHaveBeenCalled();
  });

  it("reports a declined signature as rejected and keeps the reservation", async () => {
    const t = setup({ send: async () => { throw Object.assign(new Error("User rejected the request."), { error: { code: 4001 } }); } });
    expect(await signAndConfirm(pending, t.deps)).toEqual({ step: "rejected", reservation: pending });
    expect(t.confirm).not.toHaveBeenCalled();
  });

  it("asks to sign again when the blockhash expires, with no signature to check", async () => {
    const t = setup({ confirmTx: async () => { throw new TransactionExpiredBlockheightExceededError("sig1"); } });
    const final = await signAndConfirm(pending, t.deps);
    expect(final).toMatchObject({ step: "error", reservation: pending });
    expect("signature" in final && final.signature).toBeFalsy();
    expect(t.confirm).not.toHaveBeenCalled();
  });

  it("keeps the signature when the RPC confirm fails, so a retry checks the same transaction", async () => {
    const t = setup({ confirmTx: async () => { throw new Error("fetch failed https://rpc.example.com/?api-key=secret"); } });
    const final = await signAndConfirm(pending, t.deps);
    expect(final).toMatchObject({ step: "error", reservation: pending, signature: "sig1" });
    expect(JSON.stringify(final)).not.toMatch(/secret/);
  });
});

describe("confirmOnApi", () => {
  it("names the failed checks when the API fails the reservation", async () => {
    const failed = { ...pending, status: "failed", signature: "sig1" };
    const t = setup({ confirm: async () => ({ reservation: failed, failed_checks: ["memo_hash"] }) });
    const final = await confirmOnApi(pending, "sig1", t.deps);
    expect(final.step).toBe("verification-failed");
    expect("message" in final && final.message).toMatch(/Memo hash equals the stored payload hash/);
  });

  it("keeps the signature after an API error, so a retry sends the same signature", async () => {
    const t = setup({ confirm: async () => { throw new ApiError("http", "Solana devnet hasn't returned your transaction yet. Try again in a few seconds.", { status: 503 }); } });
    const final = await confirmOnApi(pending, "sig1", t.deps);
    expect(final).toMatchObject({ step: "error", signature: "sig1" });
    await confirmOnApi(pending, "sig1", t.deps);
    expect(t.confirm.mock.calls).toEqual([[pending.id, "sig1"], [pending.id, "sig1"]]);
  });
});

describe("isUserRejection", () => {
  it("knows the Phantom code and text, and not an RPC failure", () => {
    expect(isUserRejection({ message: "", error: { code: 4001 } })).toBe(true);
    expect(isUserRejection(new Error("User rejected the request."))).toBe(true);
    expect(isUserRejection(new Error("Blockhash not found"))).toBe(false);
    expect(isUserRejection(null)).toBe(false);
  });
});
