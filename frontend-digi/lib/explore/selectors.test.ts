import { describe, expect, it } from "vitest";
import { sampleOffers, sampleHistory } from "../data/dev-fixtures";
import { buildMarketOverview, DEFAULT_FILTERS, filterOffers, getModelOffers, largestExclusion, nextSort, percentageChange, sortOffers, TABLE_PAGE_SIZE, tableRowWindow, visibleModelOffers } from "./selectors";

describe("largestExclusion", () => {
  it("returns null when no filter is active", () => {
    expect(largestExclusion(sampleOffers, DEFAULT_FILTERS, "ratio")).toBeNull();
  });

  it("counts the offers that one filter removes", () => {
    const removed = sampleOffers.filter((o) => o.price_per_hour > 0.5).length;
    expect(largestExclusion(sampleOffers, { ...DEFAULT_FILTERS, maxPrice: 0.5 }, "ratio")).toEqual({ label: "Max price", count: removed });
  });

  it("names the filter that removes the most offers when two are active", () => {
    const filters = { ...DEFAULT_FILTERS, maxPrice: 0.1, verifiedOnly: true };
    expect(filterOffers(sampleOffers, filters, "ratio")).toEqual([]);
    expect(largestExclusion(sampleOffers, filters, "ratio")).toEqual({ label: "Max price", count: sampleOffers.length });
  });

  it("picks the earlier filter in the fixed order when counts are equal", () => {
    const base = sampleOffers[0];
    const offers = [{ ...base, id: "x", region: "US West", verified: false }];
    expect(largestExclusion(offers, { ...DEFAULT_FILTERS, region: "EU Central", verifiedOnly: true }, "ratio")).toEqual({ label: "Region", count: 1 });
  });
});

describe("tableRowWindow", () => {
  it("shows up to the limit and counts the remaining rows", () => {
    expect(tableRowWindow(0, TABLE_PAGE_SIZE)).toEqual({ shown: 0, remaining: 0 });
    expect(tableRowWindow(49, TABLE_PAGE_SIZE)).toEqual({ shown: 49, remaining: 0 });
    expect(tableRowWindow(50, TABLE_PAGE_SIZE)).toEqual({ shown: 50, remaining: 0 });
    expect(tableRowWindow(51, TABLE_PAGE_SIZE)).toEqual({ shown: 50, remaining: 1 });
    expect(tableRowWindow(101, TABLE_PAGE_SIZE)).toEqual({ shown: 50, remaining: 51 });
    expect(tableRowWindow(101, TABLE_PAGE_SIZE * 2)).toEqual({ shown: 100, remaining: 1 });
    expect(tableRowWindow(101, TABLE_PAGE_SIZE * 3)).toEqual({ shown: 101, remaining: 0 });
  });
});

describe("sortOffers", () => {
  const base = sampleOffers[0];
  const offers = [
    { ...base, id: "c", price_per_hour: 2, reliability: 0.95, performance_per_dollar: 50 },
    { ...base, id: "a", price_per_hour: 1, reliability: 0.99, performance_per_dollar: null },
    { ...base, id: "b", price_per_hour: 2, reliability: 0.95, performance_per_dollar: 80 },
    { ...base, id: "d", price_per_hour: 3, reliability: 0.9, performance_per_dollar: 80 },
  ];
  const ids = (key: "price" | "reliability" | "performance", direction: "asc" | "desc") => sortOffers(offers, { key, direction }).map((o) => o.id);

  it("sorts by price in both directions and breaks ties by offer id", () => {
    expect(ids("price", "asc")).toEqual(["a", "b", "c", "d"]);
    expect(ids("price", "desc")).toEqual(["d", "b", "c", "a"]);
  });

  it("sorts by reliability in both directions", () => {
    expect(ids("reliability", "desc")).toEqual(["a", "b", "c", "d"]);
    expect(ids("reliability", "asc")).toEqual(["d", "b", "c", "a"]);
  });

  it("sorts by performance per dollar and keeps a missing value last in both directions", () => {
    expect(ids("performance", "desc")).toEqual(["b", "d", "c", "a"]);
    expect(ids("performance", "asc")).toEqual(["c", "b", "d", "a"]);
  });

  it("starts a new column in its natural direction and toggles the same column", () => {
    expect(nextSort({ key: "price", direction: "asc" }, "price")).toEqual({ key: "price", direction: "desc" });
    expect(nextSort({ key: "price", direction: "desc" }, "price")).toEqual({ key: "price", direction: "asc" });
    expect(nextSort({ key: "price", direction: "asc" }, "reliability")).toEqual({ key: "reliability", direction: "desc" });
    expect(nextSort({ key: "reliability", direction: "asc" }, "performance")).toEqual({ key: "performance", direction: "desc" });
  });

  it("does not mutate the input and gives the same order every time", () => {
    const before = offers.map((o) => o.id);
    expect(ids("price", "asc")).toEqual(ids("price", "asc"));
    expect(offers.map((o) => o.id)).toEqual(before);
  });
});

describe("offer selection", () => {
  it("uses four curated distinct models first and expands to at least eight", () => {
    const models = getModelOffers(sampleOffers, DEFAULT_FILTERS, "ratio");
    expect(models.slice(0, 4).map((offer) => offer.gpu_name)).toEqual(["H100 SXM", "A100 PCIe", "RTX 4090", "L40S"]);
    expect(new Set(models.map((offer) => offer.gpu_name)).size).toBe(models.length);
    expect(models.length).toBeGreaterThanOrEqual(8);
    expect(visibleModelOffers(models, false)).toHaveLength(4);
    expect(visibleModelOffers(models, true)).toHaveLength(models.length);
  });

  it("keeps small result sets intact without hidden or duplicated models", () => {
    for (const count of [0, 1, 3, 4]) {
      const offers = getModelOffers(sampleOffers.slice(0, count), DEFAULT_FILTERS, "ratio");
      expect(visibleModelOffers(offers, false)).toHaveLength(count);
      expect(visibleModelOffers(offers, true)).toEqual(offers);
    }
  });

  it("searches model or region case-insensitively and trims whitespace", () => {
    expect(filterOffers(sampleOffers, { ...DEFAULT_FILTERS, search: "  rTx 4090 " }, "ratio").every((o) => o.gpu_name === "RTX 4090")).toBe(true);
    const regions = filterOffers(sampleOffers, { ...DEFAULT_FILTERS, search: "eu central" }, "ratio");
    expect(regions.length).toBeGreaterThan(0);
    expect(regions.every((o) => o.region === "EU Central")).toBe(true);
  });

  it("applies combined numeric, model, region, reliability and verified filters", () => {
    const result = filterOffers(sampleOffers, { ...DEFAULT_FILTERS, model: "RTX 4090", region: "US West", minVram: 24, maxPrice: 1, minReliability: 99, verifiedOnly: true }, "ratio");
    expect(result).toHaveLength(1);
    expect(result[0].gpu_name).toBe("RTX 4090");
    expect(filterOffers(sampleOffers, { ...DEFAULT_FILTERS, minVram: 1000 }, "ratio")).toEqual([]);
    expect(filterOffers(sampleOffers, { ...DEFAULT_FILTERS, maxPrice: 0 }, "ratio")).toEqual([]);
    expect(filterOffers(sampleOffers, DEFAULT_FILTERS, "ratio")).toHaveLength(sampleOffers.length);
  });

  it("keeps every filtered offer for the table, not one per model", () => {
    const filters = { ...DEFAULT_FILTERS, model: "RTX 4090" };
    expect(getModelOffers(sampleOffers, filters, "ratio")).toHaveLength(1);
    expect(filterOffers(sampleOffers, filters, "ratio")).toHaveLength(sampleOffers.filter((o) => o.gpu_name === "RTX 4090").length);
  });

  it("chooses a representative after filtering with a deterministic price/id tie-break", () => {
    const base = sampleOffers[0];
    const offers = [{ ...base, id: "b", price_per_hour: 2 }, { ...base, id: "a", price_per_hour: 2 }, { ...base, id: "c", price_per_hour: 3 }];
    expect(getModelOffers(offers, DEFAULT_FILTERS, "ratio")[0].id).toBe("a");
    const region = getModelOffers(sampleOffers, { ...DEFAULT_FILTERS, model: "RTX 4090", region: "Asia Pacific" }, "ratio");
    expect(region).toHaveLength(1);
    expect(region[0].region).toBe("Asia Pacific");
  });

  it("honors explicit sorts and puts missing performance last without mutating the input", () => {
    const before = JSON.stringify(sampleOffers);
    const cheapest = getModelOffers(sampleOffers, { ...DEFAULT_FILTERS, sort: "price" }, "ratio");
    expect(cheapest[0].price_per_hour).toBe(Math.min(...cheapest.map((o) => o.price_per_hour)));
    const reliable = getModelOffers(sampleOffers, { ...DEFAULT_FILTERS, sort: "reliability" }, "ratio");
    expect(reliable[0].reliability).toBe(Math.max(...reliable.map((o) => o.reliability)));
    const performance = getModelOffers(sampleOffers, { ...DEFAULT_FILTERS, sort: "performance" }, "ratio");
    expect(performance.at(-1)?.performance_per_dollar).toBeNull();
    expect(JSON.stringify(sampleOffers)).toBe(before);
  });
});

describe("market preview metrics", () => {
  it("handles rising, falling, flat and unavailable price references", () => {
    expect(percentageChange(12, 10)).toBe(20);
    expect(percentageChange(8, 10)).toBe(-20);
    expect(percentageChange(10, 10)).toBe(0);
    expect(percentageChange(10, 0)).toBeNull();
    expect(percentageChange(null, 10)).toBeNull();
    expect(percentageChange(10, null)).toBeNull();
  });

  it("keeps the index aligned with its chart and uses an explicit 24-hour sample window", () => {
    const overview = buildMarketOverview(sampleOffers, sampleHistory);
    expect(overview.index).toBe(overview.series.at(-1)?.price);
    expect(overview.change).toBe(percentageChange(overview.index, overview.series[0].price));
    expect(new Date(overview.end!).getTime() - new Date(overview.start!).getTime()).toBe(86400000);
  });

  it("compares regional prices for the same model and single-GPU configuration", () => {
    const overview = buildMarketOverview(sampleOffers, sampleHistory);
    expect(overview.referenceModel).toBe("RTX 4090");
    expect(overview.regions).toHaveLength(4);
    for (const row of overview.regions) {
      const offers = sampleOffers.filter((o) => o.gpu_name === "RTX 4090" && o.region === row.region && o.num_gpus === 1);
      expect(row.listings).toBe(offers.length);
    }
  });

  it("counts listings rather than summing GPU counts", () => {
    const offers = [{ ...sampleOffers[0], num_gpus: 8 }];
    expect(buildMarketOverview(offers, []).availability[0].listings).toBe(1);
  });

  it("does not silently change the basket when a history model is absent", () => {
    const sparseHistory = [{ timestamp: sampleHistory[0].timestamp, offers: [sampleOffers[0]] }];
    expect(buildMarketOverview(sampleOffers, sparseHistory).series[0].price).toBeNull();
  });

  it("represents empty and missing histories honestly", () => {
    const empty = buildMarketOverview([], []);
    expect(empty.index).toBeNull();
    expect(empty.regions).toEqual([]);
    expect(empty.priceChanges).toEqual([]);
    expect(empty.series).toEqual([]);
  });
});
