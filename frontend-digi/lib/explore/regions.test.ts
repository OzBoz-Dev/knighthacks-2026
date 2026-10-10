import { describe, expect, it } from "vitest";
import { sampleOffers, sampleHistory } from "../data/dev-fixtures";
import { aggregateRegions, regionHistory } from "./regions";

describe("regional globe aggregation", () => {
  it("counts offers rather than GPUs and preserves whole-offer prices", () => {
    const west = aggregateRegions(sampleOffers).find((n) => n.region === "US West")!;
    expect(west.count).toBe(5);
    expect(west.median).toBe(1.51);
    expect(west.lowest).toBe(0.48);
    expect(west.coordinates).toEqual([-120, 40]);
  });
  it("uses the midpoint for even medians and interpolates percentiles", () => {
    const nodes = aggregateRegions([sampleOffers[0], { ...sampleOffers[0], id: "second", price_per_hour: 3.85 }]);
    expect(nodes[0].median).toBeCloseTo(2.85);
    expect(nodes[0].p10).toBeCloseTo(2.05);
    expect(nodes[0].p90).toBeCloseTo(3.65);
  });
  it("is deterministic under input reordering without mutating the snapshot", () => {
    expect(aggregateRegions([...sampleOffers].reverse())).toEqual(aggregateRegions(sampleOffers));
    expect(sampleOffers[0].id).toBe("sample-h100-west");
  });
  it("retains unknown regions without fabricated coordinates", () => {
    for (const region of ["Unknown", "Poland, PL", "__proto__"]) {
      expect(aggregateRegions([{ ...sampleOffers[0], region }])[0].coordinates).toBeNull();
    }
  });
  it("excludes invalid prices and handles empty inventory", () => {
    expect(aggregateRegions([])).toEqual([]);
    expect(aggregateRegions([0, -1, NaN, Infinity].map((price_per_hour) => ({ ...sampleOffers[0], price_per_hour })))).toEqual([]);
  });
  it("recomputes nodes for a GPU model with stable price colors", () => {
    const nodes = aggregateRegions(sampleOffers.filter((o) => o.gpu_name === "RTX 4090"));
    expect(nodes.map((n) => n.region)).toEqual(["US East", "Asia Pacific", "EU Central", "US West"]);
    expect(nodes[0].color).not.toBe(nodes.at(-1)!.color);
    expect(nodes[0].models).toEqual(["RTX 4090"]);
  });
  it("filters regional history and represents missing quotes as gaps", () => {
    const history = regionHistory(sampleHistory, "EU Central", "RTX 4090");
    expect(history).toHaveLength(25);
    expect(history.at(-1)?.median).toBe(0.92);
    expect(history.at(-1)?.band).toEqual([0.92, 0.92]);
    expect(regionHistory(sampleHistory, "Unknown", null)[0].median).toBeNull();
  });
});
