import type { Connection, VersionedTransactionResponse } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";
import { fetchReservationTx } from "./verify";

const signature = "5h6xBEauJ3PK6SWCZ1PGjBvj8vDdWG3KpwATGy1ARAXFSDwt8GFXM7W5Ncn16wmqokgpiKRLuS83KUxyZyv2sUYv";

function stubConnection(getTransaction: () => Promise<VersionedTransactionResponse | null>) {
  const spy = vi.fn(getTransaction);
  return { spy, connection: { getTransaction: spy } as unknown as Pick<Connection, "getTransaction"> };
}

describe("fetchReservationTx", () => {
  it("returns the transaction when the RPC finds it", async () => {
    const tx = { slot: 1 } as VersionedTransactionResponse;
    const { spy, connection } = stubConnection(async () => tx);
    expect(await fetchReservationTx(connection, signature)).toEqual({ found: true, tx });
    expect(spy).toHaveBeenCalledWith(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
  });

  it("returns not found when the RPC returns null", async () => {
    const { connection } = stubConnection(async () => null);
    expect(await fetchReservationTx(connection, signature)).toEqual({ found: false });
  });

  it("returns an error result without the RPC URL when the RPC throws", async () => {
    const { connection } = stubConnection(async () => {
      throw new Error("failed to get transaction: https://rpc.example.com/?api-key=secret");
    });
    const result = await fetchReservationTx(connection, signature);
    expect(result).toEqual({ found: false, error: expect.any(String) });
    expect(JSON.stringify(result)).not.toMatch(/secret|rpc\.example/);
  });
});
