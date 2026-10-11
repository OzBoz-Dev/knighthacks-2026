import { describe, expect, it } from "vitest";
import { explorerTxUrl, priorityLabel, shorten } from "./receipt";

const SIG = "5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW";

describe("explorerTxUrl", () => {
  it("links to the devnet transaction on the Solana Explorer", () => {
    expect(explorerTxUrl(SIG)).toBe(`https://explorer.solana.com/tx/${SIG}?cluster=devnet`);
  });

  it("encodes a value so it cannot change the path or the host", () => {
    const url = new URL(explorerTxUrl("x/../@evil.example?cluster=mainnet"));
    expect(url.host).toBe("explorer.solana.com");
    expect(url.searchParams.getAll("cluster")).toEqual(["devnet"]);
  });
});

describe("shorten", () => {
  it("keeps the start and the end of a long value", () => {
    expect(shorten("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM")).toBe("9WzD...AWWM");
  });

  it("leaves a short value unchanged", () => {
    expect(shorten("abcdefghij")).toBe("abcdefghij");
  });
});

describe("priorityLabel", () => {
  it("names the three priorities and keeps an unknown value as sent", () => {
    expect(priorityLabel("balanced")).toBe("Balanced");
    expect(priorityLabel("other")).toBe("other");
  });
});
