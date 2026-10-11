import { PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { buildReservationTransaction } from "./memo";

const wallet = new PublicKey("9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin");
const payloadHash = "1b6cc7c444d3178cc617b2da8e14261d71743c4ff9f2ad52a1221fdbcc60170f";

describe("buildReservationTransaction", () => {
  const transaction = buildReservationTransaction(wallet, { id: "res_01", payload_hash: payloadHash });
  const [instruction] = transaction.instructions;

  it("holds exactly one Memo v2 instruction", () => {
    expect(transaction.instructions).toHaveLength(1);
    // The literal ID checks the exported constant, not the constant against itself.
    expect(instruction.programId.toBase58()).toBe("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
  });

  it("writes the SG1 memo text that the API expects", () => {
    expect(new TextDecoder().decode(instruction.data)).toBe(`SG1|res_01|${payloadHash}`);
  });

  it("makes the wallet the fee payer and the only signer", () => {
    expect(transaction.feePayer?.equals(wallet)).toBe(true);
    expect(instruction.keys).toEqual([{ pubkey: wallet, isSigner: true, isWritable: false }]);
  });
});
