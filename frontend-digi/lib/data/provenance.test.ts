import { describe, expect, it } from "vitest";
import type { ApiSource } from "../api/types";
import { describeProvenance, isLive, type DataSource } from "./provenance";

const T = "2026-10-10T14:05:00Z";

describe("describeProvenance", () => {
  // The exact labels of prd.md section 4 and the source table of section 8, one case per source.
  it.each([
    ["vast-live", "live", "Live Vast.ai inventory"],
    ["vast-saved", "saved", "Saved market snapshot from Oct 10, 2026, 14:05 UTC"],
    ["databricks-live", "live", "Databricks insights updated at Oct 10, 2026, 14:05 UTC"],
    ["databricks-export", "saved", "Exported Databricks insights from Oct 10, 2026, 14:05 UTC"],
    ["dev-sample", "sample", "Development sample data, not live"],
    ["unavailable", "unavailable", "Pricing insights temporarily unavailable"],
    ["unknown", "unknown", "Data source unknown"],
  ] as const)("labels %s", (source, kind, label) => {
    expect(describeProvenance({ source, timestamp: T })).toEqual({ kind, label });
  });

  it("labels missing timestamps as unknown instead of inventing one", () => {
    expect(describeProvenance({ source: "vast-saved", timestamp: null }).label).toBe(
      "Saved market snapshot (capture time unknown)",
    );
    expect(describeProvenance({ source: "databricks-live", timestamp: "garbage" }).label).toBe(
      "Databricks insights (update time unknown)",
    );
    expect(describeProvenance({ source: "databricks-export", timestamp: null }).label).toBe(
      "Exported Databricks insights (export time unknown)",
    );
  });

  it("labels development samples clearly", () => {
    const description = describeProvenance({ source: "dev-sample", timestamp: null });
    expect(description.kind).toBe("sample");
    expect(description.label).toMatch(/not live/i);
  });

  it("treats unrecognised sources as unknown", () => {
    const description = describeProvenance({
      source: "something-else" as DataSource,
      timestamp: T,
    });
    expect(description).toEqual({ kind: "unknown", label: "Data source unknown" });
  });
});

describe("API source names", () => {
  it("knows every source that the API sends", () => {
    // The Record type fails to compile when ApiSource gains a value that this list lacks.
    const api = Object.keys({ "vast-live": 1, "vast-saved": 1, "databricks-live": 1, "databricks-export": 1 } satisfies Record<ApiSource, 1>) as ApiSource[];
    for (const source of api) expect(describeProvenance({ source, timestamp: T }).kind).not.toBe("unknown");
  });
});

describe("isLive", () => {
  it("is true only for live sources", () => {
    const sources: DataSource[] = [
      "vast-live",
      "vast-saved",
      "databricks-live",
      "databricks-export",
      "dev-sample",
      "unavailable",
      "unknown",
    ];
    const live = sources.filter((source) => isLive({ source, timestamp: T }));
    expect(live).toEqual(["vast-live", "databricks-live"]);
  });
});
