import type { ApiEnvelope, Offer } from "../api/types";
import type { DashboardData } from "./types";

// The offers envelope gives the inventory and its source. The API has no price history or index yet,
// so history stays empty and the insights stay unavailable until the market endpoints load them.
export function liveDashboard(envelope: ApiEnvelope<Offer[]>): DashboardData {
  return {
    offers: envelope.data,
    history: [],
    provenance: { source: envelope.source, timestamp: envelope.captured_at },
    reliabilityUnit: "ratio",
    insights: { provenance: { source: "unavailable", timestamp: null }, summaries: [], trends: {} },
  };
}
