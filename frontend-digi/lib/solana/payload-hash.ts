import type { Reservation } from "../api/types";

export async function hashPayload(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Hash the exact API string. Parse or encode it again and the bytes can differ.
export async function checkPayloadHash(
  reservation: Pick<Reservation, "canonical_payload" | "payload_hash">,
): Promise<boolean> {
  return (await hashPayload(reservation.canonical_payload)) === reservation.payload_hash;
}
