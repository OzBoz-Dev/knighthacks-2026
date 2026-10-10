import { describe, expect, it } from "vitest";
import {
  MISSING,
  formatGb,
  formatPercent,
  formatSignedPercent,
  formatTimestamp,
  formatUsd,
  formatUsdPerHour,
  parseTimestamp,
} from "./format";

describe("number formatting", () => {
  it("distinguishes zero from missing values", () => {
    expect(formatUsdPerHour(0)).toBe("$0.00/hr");
    expect(formatUsdPerHour(null)).toBe(MISSING);
    expect(formatUsdPerHour(undefined)).toBe(MISSING);
    expect(formatUsdPerHour(Number.NaN)).toBe(MISSING);
    expect(formatGb(0)).toBe("0 GB");
    expect(formatGb(null)).toBe(MISSING);
  });

  it("formats currency with two to three decimals", () => {
    expect(formatUsd(2)).toBe("$2.00");
    expect(formatUsdPerHour(0.82)).toBe("$0.82/hr");
    expect(formatUsdPerHour(0.345)).toBe("$0.345/hr");
    expect(formatUsdPerHour(0.3456)).toBe("$0.346/hr");
  });

  it("formats VRAM", () => {
    expect(formatGb(24)).toBe("24 GB");
    expect(formatGb(11.72)).toBe("11.7 GB");
  });

  it("requires an explicit percentage unit", () => {
    expect(formatPercent(0.992, "ratio")).toBe("99.2%");
    expect(formatPercent(99.2, "percent")).toBe("99.2%");
    expect(formatPercent(0, "ratio")).toBe("0%");
    expect(formatPercent(null, "ratio")).toBe(MISSING);
  });

  it("formats signed percentages", () => {
    expect(formatSignedPercent(-18, "percent")).toBe("−18%");
    expect(formatSignedPercent(0.12, "ratio")).toBe("+12%");
    expect(formatSignedPercent(0, "percent")).toBe("0%");
    expect(formatSignedPercent(null, "percent")).toBe(MISSING);
  });
});

describe("timestamps", () => {
  it("formats in a fixed UTC timezone", () => {
    expect(formatTimestamp("2026-10-10T14:05:00Z")).toBe("Oct 10, 2026, 14:05 UTC");
    expect(formatTimestamp("2026-10-10T23:30:00-04:00")).toBe("Oct 11, 2026, 03:30 UTC");
  });

  it("returns null for missing or invalid timestamps", () => {
    expect(formatTimestamp(null)).toBeNull();
    expect(formatTimestamp("")).toBeNull();
    expect(formatTimestamp("not a date")).toBeNull();
    expect(parseTimestamp("not a date")).toBeNull();
  });
});
