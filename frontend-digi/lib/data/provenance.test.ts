import { describe, expect, it } from "vitest";
import type { ApiSource } from "../api/types";
import { describeProvenance, isLive, type DataSource } from "./provenance";

const T = "2026-10-10T14:05:00Z";

describe("describeProvenance", () => {
  it("uses the PRD source labels", () => {
    expect(describeProvenance({ source: "vast-live", timestamp: T }).label).toBe(
      "Live Vast.ai inventory",
    );
    expect(describeProvenance({ source: "vast-saved", timestamp: T }).label).toBe(
      "Saved market snapshot from Oct 10, 2026, 14:05 UTC",
    );
    expect(describeProvenance({ source: "databricks-live", timestamp: T }).label).toBe(
      "Databricks insights updated at Oct 10, 2026, 14:05 UTC",
    );
  });

  it("preserves the supplied timestamp rather than substituting the current time", () => {
    const { label } = describeProvenance({ source: "databricks-export", timestamp: T });
    expect(label).toContain("Oct 10, 2026, 14:05 UTC");
  });

  it("labels missing timestamps as unknown instead of inventing one", () => {
    expect(describeProvenance({ source: "vast-saved", timestamp: null }).label).toBe(
      "Saved market snapshot (capture time unknown)",
    );
    expect(describeProvenance({ source: "databricks-live", timestamp: "garbage" }).label).toBe(
      "Databricks insights (update time unknown)",
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
