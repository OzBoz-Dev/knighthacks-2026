import type { Offer } from "../api/types";
import type { MarketSnapshot } from "./types";

// Representative regional centroids, never provider or host coordinates.
// The API sends ISO 3166-1 alpha-2 country codes; the dev fixtures use the named regions.
const CENTROIDS: Record<string, [number, number]> = {
  "US West": [-120, 40], "US East": [-77, 38], "US Central": [-98, 39],
  "EU Central": [14, 51], "EU West": [2, 48], "EU North": [15, 60],
  "Asia Pacific": [120, 20], "Asia East": [125, 35], "Asia Southeast": [105, 10],
  "South America": [-60, -15], "Oceania": [135, -25],
  AE: [54, 24], AR: [-64, -34], AT: [14, 47.5], AU: [134, -25],
  BE: [4.5, 50.5], BG: [25, 43], BR: [-52, -10], CA: [-106, 56],
  CH: [8, 47], CL: [-71, -33], CN: [104, 35], CO: [-73, 4],
  CZ: [15.5, 49.8], DE: [10, 51], DK: [10, 56], EC: [-78, -1.5],
  EE: [25, 59], ES: [-3.5, 40], FI: [26, 64], FR: [2, 46.5],
  GB: [-2, 54], GR: [22, 39], HK: [114, 22.3], HR: [16, 45],
  HU: [19.5, 47], ID: [113, -2], IE: [-8, 53], IL: [35, 31],
  IN: [79, 22], IS: [-19, 65], IT: [12.5, 42.5], JP: [138, 36],
  KR: [127.5, 36.5], LV: [25, 57], MX: [-102, 23], MY: [102, 4],
  NL: [5.3, 52.2], NO: [9, 61], NZ: [174, -41], PH: [122, 12],
  PL: [19, 52], PT: [-8, 39.5], QA: [51.2, 25.3], RO: [25, 46],
  RU: [90, 60], SE: [16, 62], SG: [103.8, 1.35], SI: [14.8, 46],
  SK: [19.5, 48.7], TH: [101, 15], TR: [35, 39], TW: [121, 23.7],
  UA: [31, 49], US: [-98, 39], VN: [106, 14], ZA: [24, -29],
};

export type RegionNode = {
  region: string;
  coordinates: [number, number] | null;
  count: number;
  median: number;
  lowest: number;
  p10: number;
  p90: number;
  models: string[];
  offers: Offer[];
  radius: number;
  color: string;
};

const byText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

export function quantile(sorted: readonly number[], fraction: number): number {
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  return sorted[lower] + (sorted[Math.ceil(position)] - sorted[lower]) * (position - lower);
}

export function aggregateRegions(offers: readonly Offer[]): RegionNode[] {
  const groups = new Map<string, Offer[]>();
  for (const offer of offers) {
    if (!Number.isFinite(offer.price_per_hour) || offer.price_per_hour <= 0) continue;
    groups.set(offer.region, [...(groups.get(offer.region) ?? []), offer]);
  }
  const nodes = [...groups].map(([region, values]) => {
    const ordered = values.toSorted((a, b) => a.price_per_hour - b.price_per_hour || byText(a.id, b.id));
    const prices = ordered.map((offer) => offer.price_per_hour);
    const median = quantile(prices, 0.5);
    const models = [...new Set(values.map((offer) => offer.gpu_name))].sort((a, b) =>
      values.filter((offer) => offer.gpu_name === b).length - values.filter((offer) => offer.gpu_name === a).length || byText(a, b));
    return {
      region, coordinates: Object.hasOwn(CENTROIDS, region) ? CENTROIDS[region] : null,
      count: values.length, median, lowest: prices[0], p10: quantile(prices, 0.1), p90: quantile(prices, 0.9),
      models, offers: ordered, radius: Math.min(19, 5 + Math.sqrt(values.length) * 3), color: "#FF3621",
    };
  }).sort((a, b) => a.median - b.median || byText(a.region, b.region));
  const low = nodes[0]?.median ?? 0;
  const high = nodes.at(-1)?.median ?? 0;
  return nodes.map((node) => {
    const t = high === low ? 0.5 : (node.median - low) / (high - low);
    return { ...node, color: `rgb(255, ${Math.round(154 - t * 100)}, ${Math.round(137 - t * 104)})` };
  });
}

export function regionHistory(history: readonly MarketSnapshot[], region: string, model: string | null) {
  return history.toSorted((a, b) => byText(a.timestamp, b.timestamp)).map((snapshot) => {
    const prices = snapshot.offers.filter((o) => o.region === region && (!model || o.gpu_name === model)
      && Number.isFinite(o.price_per_hour) && o.price_per_hour > 0).map((o) => o.price_per_hour).sort((a, b) => a - b);
    return { timestamp: snapshot.timestamp, time: snapshot.timestamp.slice(11, 16),
      median: prices.length ? quantile(prices, 0.5) : null,
      band: prices.length ? [quantile(prices, 0.1), quantile(prices, 0.9)] : null };
  });
}
