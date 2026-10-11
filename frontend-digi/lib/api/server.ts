import { cacheLife, cacheTag } from "next/cache";
import { getMarketSummary, getMarketTrends, getOffers } from "./endpoints";

// Server-side cache for the public Explore reads (#198), with the Next 16 'use cache' directive and cacheLife.
// The lifetimes match the API caches: 60 seconds for offers, 5 minutes for market data.
// expire is the oldest that a cached result can get. revalidate starts a background refresh before that.
// stale is the 30 second minimum that Next uses for the client router.
// The base URL is an argument, so each API gets its own cache entries. The browser clients stay uncached.

export async function cachedOffers(baseUrl: string) {
  "use cache";
  cacheLife({ stale: 30, revalidate: 30, expire: 60 });
  cacheTag("explore-offers");
  return getOffers({ baseUrl });
}

export async function cachedMarketSummary(baseUrl: string, gpuName: string) {
  "use cache";
  cacheLife({ stale: 30, revalidate: 240, expire: 300 });
  cacheTag("explore-market");
  return getMarketSummary(gpuName, { baseUrl });
}

export async function cachedMarketTrends(baseUrl: string, gpuName: string) {
  "use cache";
  cacheLife({ stale: 30, revalidate: 240, expire: 300 });
  cacheTag("explore-market");
  return getMarketTrends(gpuName, null, { baseUrl });
}
