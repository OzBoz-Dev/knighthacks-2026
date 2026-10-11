import { formatTimestamp } from "../format";

export type InventorySource = "vast-live" | "vast-saved" | "dev-sample" | "unknown";
export type InsightsSource =
  | "databricks-live"
  | "databricks-export"
  | "dev-sample"
  | "unavailable"
  | "unknown";
// dev-sample, unavailable, and unknown are frontend states. The API sends only ApiSource values.
export type DataSource = InventorySource | InsightsSource;

export type Provenance<S extends DataSource = DataSource> = {
  source: S;
  timestamp: string | null;
};

export type ProvenanceKind = "live" | "saved" | "sample" | "unavailable" | "unknown";

export type ProvenanceDescription = {
  kind: ProvenanceKind;
  label: string;
};

const KIND: Record<DataSource, ProvenanceKind> = {
  "vast-live": "live",
  "databricks-live": "live",
  "vast-saved": "saved",
  "databricks-export": "saved",
  "dev-sample": "sample",
  unavailable: "unavailable",
  unknown: "unknown",
};

export function isLive(provenance: Provenance): boolean {
  return KIND[provenance.source] === "live";
}

export function describeProvenance({ source, timestamp }: Provenance): ProvenanceDescription {
  const time = formatTimestamp(timestamp);
  const kind = KIND[source] ?? "unknown";
  switch (source) {
    case "vast-live":
      return { kind, label: "Live Vast.ai inventory" };
    case "vast-saved":
      return {
        kind,
        label: time ? `Saved market snapshot from ${time}` : "Saved market snapshot (capture time unknown)",
      };
    case "databricks-live":
      return {
        kind,
        label: time ? `Databricks insights updated at ${time}` : "Databricks insights (update time unknown)",
      };
    case "databricks-export":
      return {
        kind,
        label: time
          ? `Exported Databricks insights from ${time}`
          : "Exported Databricks insights (export time unknown)",
      };
    case "dev-sample":
      return { kind, label: "Development sample data, not live" };
    case "unavailable":
      return { kind, label: "Pricing insights temporarily unavailable" };
    default:
      return { kind: "unknown", label: "Data source unknown" };
  }
}
