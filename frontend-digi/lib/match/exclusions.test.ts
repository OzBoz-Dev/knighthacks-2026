import { describe, expect, it } from "vitest";
import { exclusionRows, offersText } from "./exclusions";

describe("exclusionRows", () => {
  it("lists the nonzero reasons in the filter order and hides zero counts", () => {
    expect(exclusionRows({ gpu_model: 0, region: 2, vram: 0, reliability: 1, budget: 5 })).toEqual([
      { key: "region", label: "Region", count: 2 },
      { key: "reliability", label: "Reliability", count: 1 },
      { key: "budget", label: "Budget", count: 5 },
    ]);
    expect(exclusionRows({ gpu_model: 0, region: 0, vram: 0, reliability: 0, budget: 0 })).toEqual([]);
  });

  it("adds up with the eligible count to the checked count", () => {
    const response = { checked: 12, eligible: 4, excluded: { gpu_model: 1, region: 0, vram: 3, reliability: 2, budget: 2 } };
    const removed = exclusionRows(response.excluded).reduce((sum, row) => sum + row.count, 0);
    expect(removed + response.eligible).toBe(response.checked);
  });
});

describe("offersText", () => {
  it("uses the singular for one offer", () => {
    expect(offersText(1)).toBe("1 offer");
    expect(offersText(0)).toBe("0 offers");
    expect(offersText(48)).toBe("48 offers");
  });
});

describe("VRAM wording", () => {
  it("names the per-GPU rule that the API applies (#36)", () => {
    expect(exclusionRows({ gpu_model: 0, region: 0, vram: 2, reliability: 0, budget: 0 })).toEqual([{ key: "vram", label: "VRAM per GPU", count: 2 }]);
  });
});
