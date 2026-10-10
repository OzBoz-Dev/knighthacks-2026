import { describe, expect, it } from "vitest";
import { PRIORITY_WEIGHTS } from "./weights";

describe("PRIORITY_WEIGHTS", () => {
  it("matches the prd section 5.2 table", () => {
    expect(PRIORITY_WEIGHTS.cheapest).toEqual({ price: 0.6, performance: 0.2, reliability: 0.2 });
    expect(PRIORITY_WEIGHTS.balanced).toEqual({ price: 0.4, performance: 0.35, reliability: 0.25 });
    expect(PRIORITY_WEIGHTS.performance).toEqual({ price: 0.2, performance: 0.6, reliability: 0.2 });
  });

  it("gives weights that sum to 100% for each priority", () => {
    for (const weights of Object.values(PRIORITY_WEIGHTS)) {
      expect(Object.values(weights).reduce((sum, w) => sum + w, 0)).toBeCloseTo(1, 10);
    }
  });

  it("reproduces the fixture score from its breakdown", () => {
    const w = PRIORITY_WEIGHTS.balanced;
    expect(w.price * 100 + w.performance * 0 + w.reliability * 100).toBeCloseTo(65, 10);
  });
});
