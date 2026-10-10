import { describe, expect, it } from "vitest";
import type { MatchRequest } from "../api/types";
import { suggestion } from "./suggestion";

const request: MatchRequest = { min_vram_gb: 24, max_price_per_hour: 1.2, min_reliability: 0.95, priority: "balanced", gpu_names: ["RTX 4090"], region: "US" };
const none = { gpu_model: 0, region: 0, vram: 0, reliability: 0, budget: 0 };

describe("suggestion", () => {
  it("gives one suggestion for each exclusion reason", () => {
    expect(suggestion({ ...none, budget: 48 }, request)).toBe("Budget excluded 48 offers; try raising it above $1.20/hour.");
    expect(suggestion({ ...none, vram: 3 }, request)).toBe("VRAM excluded 3 offers; try lowering it below 24 GB.");
    expect(suggestion({ ...none, reliability: 1 }, request)).toBe("Reliability excluded 1 offer; try lowering it below 95%.");
    expect(suggestion({ ...none, region: 5 }, request)).toBe("Region excluded 5 offers; try a region other than US, or any region.");
    expect(suggestion({ ...none, gpu_model: 9 }, request)).toBe("GPU model excluded 9 offers; try allowing more GPU models.");
  });

  it("picks the largest reason", () => {
    expect(suggestion({ ...none, vram: 2, budget: 7, reliability: 3 }, request)).toMatch(/^Budget excluded 7/);
  });

  it("breaks a tie with the fixed filter order", () => {
    expect(suggestion({ ...none, budget: 4, vram: 4 }, request)).toMatch(/^VRAM excluded 4/);
    expect(suggestion({ ...none, gpu_model: 4, budget: 4 }, request)).toMatch(/^GPU model excluded 4/);
  });

  it("says no offers were checked when nothing was excluded", () => {
    expect(suggestion(none, request)).toBe("No offers were available to check. Try again in a few minutes.");
  });
});
