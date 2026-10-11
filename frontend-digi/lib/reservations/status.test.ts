import { describe, expect, it } from "vitest";
import { reservationStatus } from "./status";

describe("reservationStatus", () => {
  it("gives one label for each of the five states", () => {
    expect(reservationStatus({ status: "pending" }).label).toBe("Pending signature");
    expect(reservationStatus({ status: "pending", flow: "confirming" }).label).toBe("Confirming");
    expect(reservationStatus({ status: "confirmed" }).label).toBe("Verified on Solana");
    expect(reservationStatus({ status: "pending", flow: "rejected" }).label).toBe("Signature rejected");
    expect(reservationStatus({ status: "failed" }).label).toBe("Verification failed");
  });

  it("shows an unknown value as Unknown status, never as verified", () => {
    const unknown = reservationStatus({ status: "verified" });
    expect(unknown.label).toBe("Unknown status");
    expect(unknown.tone).toBe("neutral");
  });

  it("does not call a stored failure a rejected signature", () => {
    expect(reservationStatus({ status: "failed" }).label).not.toBe("Signature rejected");
  });

  it("does not claim a wallet prompt is open for a pending row after a reload", () => {
    expect(reservationStatus({ status: "pending" }).note).toMatch(/no signed transaction/i);
  });

  it("lets a new failed check override a stored confirmation", () => {
    const status = reservationStatus({ status: "confirmed", verification: "failed" });
    expect(status.label).toBe("Verification failed");
    expect(status.note).toMatch(/latest check/i);
  });

  it("keeps the stored label when the check could not run", () => {
    const status = reservationStatus({ status: "confirmed", verification: "unavailable" });
    expect(status.label).toBe("Verified on Solana");
    expect(status.note).toMatch(/could not run/i);
  });

  it("never lets a passed check override a stored failure", () => {
    expect(reservationStatus({ status: "failed", verification: "passed" }).label).toBe("Verification failed");
  });
});
