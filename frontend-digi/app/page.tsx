import { connection } from "next/server";
import { Suspense } from "react";
import { ExploreDashboard } from "@/components/explore/explore-dashboard";
import { LiveInsights } from "@/components/explore/live-insights";
import { LoadingState } from "@/components/shared/async-state";
import { describeApiError, getApiBaseUrl } from "@/lib/api/client";
import { cachedOffers } from "@/lib/api/server";
import { loadDevFixtures } from "@/lib/data/dev-mode";
import { insightsModel } from "@/lib/explore/insights";
import { liveDashboard } from "@/lib/explore/live";
import type { DashboardData } from "@/lib/explore/types";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function ExplorePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<LoadingState label="Loading GPU offers…" rows={4} />}>
      <ExploreData searchParams={searchParams} />
    </Suspense>
  );
}

async function ExploreData({ searchParams }: { searchParams: SearchParams }) {
  const fixtures = await loadDevFixtures();
  if (fixtures) {
    return <ExploreDashboard data={{
      offers: fixtures.sampleOffers,
      history: fixtures.sampleHistory,
      provenance: fixtures.SAMPLE_PROVENANCE,
      reliabilityUnit: fixtures.SAMPLE_RELIABILITY_UNIT,
      insights: {
        provenance: fixtures.SAMPLE_PROVENANCE,
        summaries: [fixtures.sampleMarketSummary],
        trends: { [fixtures.sampleMarketSummary.gpu_name]: fixtures.sampleTrendPoints },
      },
    }} />;
  }
  // The inventory is read for each request, never at build time, so the build does not need the API.
  await connection();
  const { data, error } = await loadInventory();
  const models = [...new Set(data?.offers.map((o) => o.gpu_name))].sort();
  const gpu = insightsModel((await searchParams).gpu, models);
  // The insights stream in their own boundary after the offers render. Their failure never removes the offers.
  const insights = data && gpu ? (
    <Suspense fallback={<LoadingState label="Loading pricing insights…" rows={2} />}>
      <LiveInsights gpu={gpu} models={models} />
    </Suspense>
  ) : undefined;
  return <ExploreDashboard data={data} error={error} insights={insights} />;
}

// A failed call never falls back to the samples.
async function loadInventory(): Promise<{ data: DashboardData | null; error?: string }> {
  try {
    return { data: liveDashboard(await cachedOffers(getApiBaseUrl())) };
  } catch (error) {
    return { data: null, error: describeApiError(error) };
  }
}
