import type { Offer } from "../api/types";
import type { MarketSnapshot } from "./types";

// Representative regional centroids, never provider or host coordinates.
const CENTROIDS: Record<string, [number, number]> = {
  "US West": [-120, 40], "US East": [-77, 38], "US Central": [-98, 39],
  "EU Central": [14, 51], "EU West": [2, 48], "EU North": [15, 60],
  "Asia Pacific": [120, 20], "Asia East": [125, 35], "Asia Southeast": [105, 10],
  "South America": [-60, -15], "Oceania": [135, -25],
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
