import { ExploreDashboard } from "@/components/explore/explore-dashboard";
import { loadDevFixtures } from "@/lib/data/dev-mode";

export default async function ExplorePage() {
  const fixtures = await loadDevFixtures();
  return <ExploreDashboard data={fixtures ? {
    offers: fixtures.sampleOffers,
    history: fixtures.sampleHistory,
    provenance: fixtures.SAMPLE_PROVENANCE,
    reliabilityUnit: fixtures.SAMPLE_RELIABILITY_UNIT,
    insights: {
      provenance: fixtures.SAMPLE_PROVENANCE,
      summaries: [fixtures.sampleMarketSummary],
      trends: { [fixtures.sampleMarketSummary.gpu_name]: fixtures.sampleTrendPoints },
    },
  } : null} />;
}
