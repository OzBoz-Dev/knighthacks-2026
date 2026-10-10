import { describe, expect, it } from "vitest";
import { sampleOffers, sampleHistory } from "../data/dev-fixtures";
import { buildMarketOverview, DEFAULT_FILTERS, filterOffers, getModelOffers, percentageChange, visibleModelOffers } from "./selectors";

describe("offer selection", () => {
  it("uses four curated distinct models first and expands to at least eight", () => {
    const models = getModelOffers(sampleOffers, DEFAULT_FILTERS, "ratio");
    expect(models.slice(0, 4).map((offer) => offer.gpu_name)).toEqual(["H100 SXM", "A100 PCIe", "RTX 4090", "L40S"]);
    expect(new Set(models.map((offer) => offer.gpu_name)).size).toBe(models.length);
    expect(models.length).toBeGreaterThanOrEqual(8);
    expect(visibleModelOffers(models, false)).toHaveLength(4);
    expect(visibleModelOffers(models, true)).toHaveLength(models.length);
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
