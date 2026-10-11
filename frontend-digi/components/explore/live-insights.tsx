import { getApiBaseUrl } from "@/lib/api/client";
import { cachedMarketSummary, cachedMarketTrends } from "@/lib/api/server";
import { liveInsights, type Settled } from "@/lib/explore/insights";
import { MarketInsights } from "./market-insights";

const settle = <T,>(result: PromiseSettledResult<T>): Settled<T> => (result.status === "fulfilled" ? { ok: true, value: result.value } : { ok: false });

// A server component inside its own Suspense boundary, so a slow warehouse never holds back the offers.
export async function LiveInsights({ gpu, models }: { gpu: string; models: string[] }) {
  const baseUrl = getApiBaseUrl();
  const [summary, trends] = await Promise.allSettled([cachedMarketSummary(baseUrl, gpu), cachedMarketTrends(baseUrl, gpu)]);
  return <MarketInsights insights={liveInsights(gpu, settle(summary), settle(trends))} models={models} selected={gpu} />;
}
