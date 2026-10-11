import { PublicKey } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";
import { airdropErrorMessage, formatSol, hasFeeBalance, requestDevnetSol } from "./balance";

const wallet = new PublicKey("9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin");

describe("hasFeeBalance and formatSol", () => {
  it("needs at least 0.001 SOL", () => {
    expect(hasFeeBalance(999_999)).toBe(false);
    expect(hasFeeBalance(1_000_000)).toBe(true);
  });

  it("shows SOL with up to four decimals and keeps zero", () => {
    expect(formatSol(0)).toBe("0 SOL");
    expect(formatSol(1_234_567_890)).toBe("1.2346 SOL");
  });
});

describe("requestDevnetSol", () => {
  const stub = (err: unknown = null) => ({
    getLatestBlockhash: vi.fn(async () => ({ blockhash: "hash", lastValidBlockHeight: 10 })),
    requestAirdrop: vi.fn(async () => "sig"),
    confirmTransaction: vi.fn(async () => ({ context: { slot: 1 }, value: { err } })),
  });

  it("asks for 1 SOL and confirms the airdrop with the blockhash", async () => {
    const connection = stub();
    expect(await requestDevnetSol(connection as never, wallet)).toBe("sig");
    expect(connection.requestAirdrop).toHaveBeenCalledWith(wallet, 1_000_000_000);
    expect(connection.confirmTransaction).toHaveBeenCalledWith({ signature: "sig", blockhash: "hash", lastValidBlockHeight: 10 }, "confirmed");
  });

  it("fails when the airdrop transaction has an error", async () => {
    await expect(requestDevnetSol(stub({ InstructionError: [0, "x"] }) as never, wallet)).rejects.toThrow(/failed/);
  });
});

describe("airdropErrorMessage", () => {
  it("names the faucet limit for a 429 and never shows the RPC text", () => {
    const message = airdropErrorMessage(new Error("429 Too Many Requests: https://rpc.example.com/?api-key=secret"));
    expect(message).toMatch(/limits/);
    expect(message).not.toMatch(/secret|rpc\.example/);
    expect(airdropErrorMessage(new Error("Internal error"))).toMatch(/didn't send SOL/);
  });
});
