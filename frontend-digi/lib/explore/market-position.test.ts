import { describe, expect, it } from "vitest";
import { marketPosition } from "./market-position";

describe("marketPosition", () => {
  it("maps market_position_pct to the PRD badges at each boundary", () => {
    expect(marketPosition(-15)).toBe("Good price");
    expect(marketPosition(-14.9)).toBe("Near typical");
    expect(marketPosition(0)).toBe("Near typical");
    expect(marketPosition(15)).toBe("Near typical");
    expect(marketPosition(15.1)).toBe("Above typical");
    expect(marketPosition(-40)).toBe("Good price");
  });

  it("gives no badge without a value", () => {
    expect(marketPosition(null)).toBeNull();
    expect(marketPosition(Number.NaN)).toBeNull();
  });
});
