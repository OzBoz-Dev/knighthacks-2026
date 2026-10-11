import { connection } from "next/server";
import { Suspense } from "react";
import { ExploreDashboard } from "@/components/explore/explore-dashboard";
import { LoadingState } from "@/components/shared/async-state";
import { describeApiError } from "@/lib/api/client";
import { getOffers } from "@/lib/api/endpoints";
import { loadDevFixtures } from "@/lib/data/dev-mode";
import { liveDashboard } from "@/lib/explore/live";
import type { DashboardData } from "@/lib/explore/types";

export default function ExplorePage() {
  return (
    <Suspense fallback={<LoadingState label="Loading GPU offers…" rows={4} />}>
      <ExploreData />
    </Suspense>
  );
}

async function ExploreData() {
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
  return <ExploreDashboard data={data} error={error} />;
}

// A failed call never falls back to the samples.
async function loadInventory(): Promise<{ data: DashboardData | null; error?: string }> {
  try {
    return { data: liveDashboard(await getOffers()) };
  } catch (error) {
    return { data: null, error: describeApiError(error) };
  }
}
