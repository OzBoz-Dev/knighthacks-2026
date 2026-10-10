import { afterEach, describe, expect, it, vi } from "vitest";
import { getSolanaConfig } from "./network";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getSolanaConfig", () => {
  it("falls back to the public devnet endpoint", () => {
    vi.stubEnv("NEXT_PUBLIC_SOLANA_RPC", "");
    expect(getSolanaConfig()).toEqual({
      endpoint: "https://api.devnet.solana.com",
      cluster: "devnet",
      explorerCluster: "devnet",
    });
  });

  it("uses a custom devnet URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SOLANA_RPC", "http://127.0.0.1:8899");
    expect(getSolanaConfig().endpoint).toBe("http://127.0.0.1:8899");
  });

  it("refuses a mainnet URL in any case", () => {
    vi.stubEnv("NEXT_PUBLIC_SOLANA_RPC", "https://api.Mainnet-Beta.solana.com");
    expect(() => getSolanaConfig()).toThrow(/devnet only/);
  });
});
