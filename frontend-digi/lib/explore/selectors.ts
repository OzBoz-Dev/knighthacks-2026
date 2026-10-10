import type { Offer } from "../api/types";
import type { PercentUnit } from "../format";
import type { MarketOverviewData, MarketSnapshot, OfferFilters, TableSort, TableSortKey } from "./types";

export const FEATURED_MODELS = ["H100 SXM", "A100 PCIe", "RTX 4090", "L40S"] as const;

export const DEFAULT_FILTERS: OfferFilters = {
  search: "",
  model: null,
  region: null,
  minVram: null,
  maxPrice: null,
  minReliability: null,
  verifiedOnly: false,
  sort: "featured",
};

const byName = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const byPrice = (a: Offer, b: Offer) => a.price_per_hour - b.price_per_hour || byName(a.id, b.id);
const featuredRank = (name: string) => {
  const index = FEATURED_MODELS.findIndex((model) => model === name);
  return index < 0 ? FEATURED_MODELS.length : index;
};

export function filterOffers(offers: readonly Offer[], filters: OfferFilters, reliabilityUnit: PercentUnit): Offer[] {
  const search = filters.search.trim().toLowerCase();
  return offers.filter((offer) => {
    const reliability = offer.reliability * (reliabilityUnit === "ratio" ? 100 : 1);
    return (!search || `${offer.gpu_name} ${offer.region}`.toLowerCase().includes(search))
      && (!filters.model || offer.gpu_name === filters.model)
      && (!filters.region || offer.region === filters.region)
      && (filters.minVram === null || offer.total_vram_gb >= filters.minVram)
      && (filters.maxPrice === null || offer.price_per_hour <= filters.maxPrice)
      && (filters.minReliability === null || reliability >= filters.minReliability)
      && (!filters.verifiedOnly || offer.verified);
  });
}

export function getModelOffers(offers: readonly Offer[], filters: OfferFilters, reliabilityUnit: PercentUnit): Offer[] {
  const representatives = new Map<string, Offer>();
  for (const offer of filterOffers(offers, filters, reliabilityUnit)) {
    const current = representatives.get(offer.gpu_name);
    if (!current || byPrice(offer, current) < 0) representatives.set(offer.gpu_name, offer);
  }
  return [...representatives.values()].sort((a, b) => {
    if (filters.sort === "price") return byPrice(a, b);
    if (filters.sort === "reliability") return b.reliability - a.reliability || byPrice(a, b);
    if (filters.sort === "performance") {
      const aPerf = a.performance_per_dollar;
      const bPerf = b.performance_per_dollar;
      if (aPerf === null && bPerf !== null) return 1;
      if (bPerf === null && aPerf !== null) return -1;
      return (bPerf ?? 0) - (aPerf ?? 0) || byPrice(a, b);
    }
    return featuredRank(a.gpu_name) - featuredRank(b.gpu_name) || byPrice(a, b);
  });
}

const SORT_VALUE: Record<TableSortKey, (offer: Offer) => number | null> = {
  price: (offer) => offer.price_per_hour,
  reliability: (offer) => offer.reliability,
  performance: (offer) => offer.performance_per_dollar,
};

// Equal values always fall back to ascending offer ID, so the order is stable in both directions.
export function sortOffers(offers: readonly Offer[], { key, direction }: TableSort): Offer[] {
  const value = SORT_VALUE[key];
  const sign = direction === "asc" ? 1 : -1;
  return offers.toSorted((a, b) => {
    const av = value(a);
    const bv = value(b);
    if (av === null || bv === null) return (av === null ? 1 : 0) - (bv === null ? 1 : 0) || byName(a.id, b.id);
    return (av - bv) * sign || byName(a.id, b.id);
  });
}

// Price starts cheapest first; reliability and value start best first.
const FIRST_DIRECTION: Record<TableSortKey, TableSort["direction"]> = { price: "asc", reliability: "desc", performance: "desc" };

export function nextSort(current: TableSort, key: TableSortKey): TableSort {
  if (current.key !== key) return { key, direction: FIRST_DIRECTION[key] };
  return { key, direction: current.direction === "asc" ? "desc" : "asc" };
}

export function visibleModelOffers(offers: readonly Offer[], expanded: boolean): readonly Offer[] {
  return expanded ? offers : offers.slice(0, 4);
}

export function percentageChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || !Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function validSingleOffers(offers: readonly Offer[]): Offer[] {
  return offers.filter((o) => o.num_gpus === 1 && Number.isFinite(o.price_per_hour) && o.price_per_hour > 0);
}

export function buildMarketOverview(offers: readonly Offer[], history: readonly MarketSnapshot[], referenceModel = "RTX 4090"): MarketOverviewData {
  const singles = validSingleOffers(offers);
  const basket = [...new Set(singles.map((o) => o.gpu_name))].sort(byName);
  const orderedHistory = history.toSorted((a, b) => byName(a.timestamp, b.timestamp));
  const series = orderedHistory.map(({ timestamp, offers: snapshotOffers }) => {
    const quotes = validSingleOffers(snapshotOffers);
    const medians = basket.map((model) => median(quotes.filter((o) => o.gpu_name === model).map((o) => o.price_per_hour)));
    const price = !basket.length || medians.some((value) => value === null)
      ? null
      : medians.reduce<number>((sum, value) => sum + (value ?? 0), 0) / basket.length;
    return { timestamp, price };
  });
  const index = series.at(-1)?.price ?? null;
  const reference = singles.filter((o) => o.gpu_name === referenceModel);
  const regions = [...new Set(reference.map((o) => o.region))].map((region) => {
    const values = reference.filter((o) => o.region === region);
    return { region, price: median(values.map((o) => o.price_per_hour))!, listings: values.length };
  }).sort((a, b) => a.price - b.price || byName(a.region, b.region));
  const availability = [...new Set(offers.map((o) => o.gpu_name))].map((model) => ({
    model, listings: offers.filter((o) => o.gpu_name === model).length,
  })).sort((a, b) => b.listings - a.listings || byName(a.model, b.model));
  const previousOffers = orderedHistory.length >= 2 ? validSingleOffers(orderedHistory[0].offers) : [];
  const pairs = new Map(singles.map((o) => [JSON.stringify([o.gpu_name, o.region]), { model: o.gpu_name, region: o.region }]));
  const priceChanges = [...pairs.values()].map(({ model, region }) => {
    const matching = (o: Offer) => o.gpu_name === model && o.region === region;
    const current = median(singles.filter(matching).map((o) => o.price_per_hour))!;
    const previous = median(previousOffers.filter(matching).map((o) => o.price_per_hour));
    return { model, region, current, previous, change: percentageChange(current, previous) };
  }).sort((a, b) => (Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0)) || byName(a.model, b.model) || byName(a.region, b.region));
  return {
    index,
    change: percentageChange(index, series[0]?.price ?? null),
    series, regions, availability, priceChanges, referenceModel,
    start: orderedHistory[0]?.timestamp ?? null,
    end: orderedHistory.at(-1)?.timestamp ?? null,
  };
}
