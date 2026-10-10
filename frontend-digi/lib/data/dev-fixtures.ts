import type { MarketSummary, Offer, TrendPoint } from "../api/types";
import type { MarketSnapshot } from "../explore/types";
import type { Provenance } from "./provenance";

export const SAMPLE_PROVENANCE = {
  source: "dev-sample",
  timestamp: null,
} as const satisfies Provenance<"dev-sample">;

export const SAMPLE_RELIABILITY_UNIT = "ratio" as const;

function sampleOffer(id: string, gpu_name: string, gpu_ram_gb: number, region: string, price_per_hour: number, reliability: number, dlperf: number | null, verified = true, num_gpus = 1): Offer {
  return {
    id: `sample-${id}`, gpu_name, gpu_ram_gb, region, price_per_hour, reliability, dlperf, verified, num_gpus,
    total_vram_gb: gpu_ram_gb * num_gpus,
    performance_per_dollar: dlperf === null ? null : dlperf / price_per_hour,
    market_position_pct: null,
    price_percentile: null,
  };
}

export const sampleOffers = [
  sampleOffer("h100-west", "H100 SXM", 80, "US West", 1.85, 0.998, 240),
  sampleOffer("a100-eu", "A100 PCIe", 40, "EU Central", 1.42, 0.995, 160),
  sampleOffer("4090-west", "RTX 4090", 24, "US West", 0.78, 0.991, 82.5),
  sampleOffer("l40-east", "L40S", 48, "US East", 1.23, 0.993, 130),
  sampleOffer("3090-east", "RTX 3090", 24, "US East", 0.32, 0.972, 43, false),
  sampleOffer("a6000-eu", "RTX A6000", 48, "EU Central", 0.65, 0.984, 65),
  sampleOffer("a40-west", "A40", 48, "US West", 0.48, 0.96, null, false),
  sampleOffer("v100-asia", "V100", 32, "Asia Pacific", 0.29, 0.968, 36),
  sampleOffer("4090-east", "RTX 4090", 24, "US East", 0.84, 0.987, 84),
  sampleOffer("4090-eu", "RTX 4090", 24, "EU Central", 0.92, 0.985, 84),
  sampleOffer("4090-asia", "RTX 4090", 24, "Asia Pacific", 0.88, 0.978, 83, false),
  sampleOffer("4090-dual", "RTX 4090", 24, "US West", 1.51, 0.989, 165, true, 2),
  sampleOffer("h100-east", "H100 SXM", 80, "US East", 2.15, 0.999, 245),
  sampleOffer("a100-west", "A100 PCIe", 40, "US West", 1.61, 0.982, 155),
  sampleOffer("l40-eu", "L40S", 48, "EU Central", 1.35, 0.992, 133),
] satisfies Offer[];

export const sampleHistory: MarketSnapshot[] = Array.from({ length: 25 }, (_, hour) => ({
  timestamp: new Date(Date.UTC(2026, 0, 1, hour)).toISOString(),
  offers: sampleOffers.map((offer, index) => {
    const direction = index % 3 === 0 ? 0.2 : index % 3 === 1 ? -0.08 : 0.12;
    const variation = Math.sin(hour * 1.7 + index) * 0.025 * (24 - hour) / 24;
    const factor = 1 + direction * (24 - hour) / 24 + variation;
    const price = Number((offer.price_per_hour * factor).toFixed(3));
    return { ...offer, price_per_hour: price, performance_per_dollar: offer.dlperf === null ? null : offer.dlperf / price };
  }),
}));

export const sampleMarketSummary = {
  gpu_name: "RTX 4090",
  listing_count: 4,
  lowest_price: 0.78,
  median_price: 0.86,
  p90_price: 0.908,
  median_reliability: 0.986,
  updated_at: "2026-01-02T00:00:00Z",
} as const satisfies MarketSummary;

export const sampleTrendPoints: TrendPoint[] = sampleHistory.map((snapshot) => {
  const prices = snapshot.offers.filter((o) => o.gpu_name === "RTX 4090" && o.num_gpus === 1).map((o) => o.price_per_hour).sort((a, b) => a - b);
  return {
    timestamp: snapshot.timestamp,
    minimum_price: prices[0],
    median_price: (prices[1] + prices[2]) / 2,
    p10_price: prices[0] + (prices[1] - prices[0]) * 0.3,
    p90_price: prices[2] + (prices[3] - prices[2]) * 0.7,
    listing_count: prices.length,
  };
});
