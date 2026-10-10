import { describe, expect, it } from "vitest";
import { checkPayloadHash, hashPayload } from "./payload-hash";

// Expected hashes come from `printf '%s' "$PAYLOAD" | shasum -a 256`, not from the code under test.
const payload =
  '{"created_at":"2026-10-10T14:05:00Z","gpu_name":"RTX 4090","id":"res_01","max_price_per_hour":2,"min_vram_gb":24,"offer_id":"vast-123","price_per_hour":0.82,"priority":"balanced","region":null,"request_id":"req_01","snapshot_id":"snap_01","wallet":"9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin"}';
const payloadHash = "1b6cc7c444d3178cc617b2da8e14261d71743c4ff9f2ad52a1221fdbcc60170f";

describe("hashPayload", () => {
  it("returns the lowercase hex SHA-256 of the payload", async () => {
    expect(await hashPayload(payload)).toBe(payloadHash);
  });

  it("hashes the UTF-8 bytes", async () => {
    expect(await hashPayload("GPU é")).toBe(
      "d21a151eee53e5bc6910369c4fc54e973b15d31536487238c23dee19672b99b2",
    );
  });
});

describe("checkPayloadHash", () => {
  it("passes for the stored payload and its hash", async () => {
    expect(await checkPayloadHash({ canonical_payload: payload, payload_hash: payloadHash })).toBe(true);
  });

  it("fails when one character of the payload changes", async () => {
    const changed = payload.replace("0.82", "0.83");
    expect(await checkPayloadHash({ canonical_payload: changed, payload_hash: payloadHash })).toBe(false);
  });

  it("fails for an uppercase hash", async () => {
    expect(
      await checkPayloadHash({ canonical_payload: payload, payload_hash: payloadHash.toUpperCase() }),
    ).toBe(false);
  });
});
