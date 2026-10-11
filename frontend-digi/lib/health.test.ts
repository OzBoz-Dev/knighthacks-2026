import { describe, expect, it } from "vitest";
import { ApiError } from "./api/client";
import type { HealthResponse } from "./api/types";
import { healthView } from "./health";

const health = (patch: Partial<HealthResponse> = {}): HealthResponse => ({
  status: "ok",
  components: { vast: "ok", databricks: "ok", sqlite: "ok" },
  fixtures: { vast: false, databricks: false },
  ...patch,
});
const rows = (h: HealthResponse) => Object.fromEntries(healthView({ status: "ready", health: h }).rows.map((r) => [r.label, r.value]));

describe("healthView", () => {
  it("shows one row each for Vast.ai, Databricks, SQLite, and the fixture modes", () => {
    expect(rows(health())).toEqual({ "Vast.ai": "Live", Databricks: "Live", SQLite: "OK", "Fixture modes": "Off" });
  });

  it("shows a fixture mode as saved data, never as live", () => {
    const view = healthView({ status: "ready", health: health({ components: { vast: "fixture", databricks: "fixture", sqlite: "ok" }, fixtures: { vast: true, databricks: true } }) });
    expect(view.rows.map((r) => r.value)).toEqual(["Saved data", "Saved data", "OK", "On: Vast.ai, Databricks"]);
    expect(view.rows.filter((r) => r.value === "Live")).toEqual([]);
  });

  it("names a degraded service", () => {
    const view = healthView({ status: "ready", health: health({ status: "degraded", components: { vast: "unavailable", databricks: "fixture", sqlite: "ok" }, fixtures: { vast: false, databricks: true } }) });
    expect(view.summary).toBe("API degraded");
    expect(view.rows[0]).toEqual({ label: "Vast.ai", value: "Unavailable", tone: "down" });
  });

  it("shows API not reachable for a network failure, with a retry", () => {
    const view = healthView({ status: "error", error: new ApiError("network", "Could not reach the solGPU API.") });
    expect(view).toMatchObject({ summary: "API not reachable", rows: [], retry: true });
  });

  it("shows the API message for a SQLite failure", () => {
    const error = new ApiError("http", "The reservation database is unavailable.", { status: 503, code: "upstream_unavailable" });
    const view = healthView({ status: "error", error });
    expect(view.summary).toBe("The reservation database is unavailable.");
    expect(view.rows).toEqual([{ label: "SQLite", value: "Unavailable", tone: "down" }]);
  });

  it("does not blame SQLite for another API error", () => {
    const error = new ApiError("http", "The server had an internal error.", { status: 500, code: "internal" });
    expect(healthView({ status: "error", error })).toMatchObject({ summary: "The server had an internal error.", rows: [] });
  });

  it("never invents service rows for an unreadable answer or a missing URL", () => {
    expect(healthView({ status: "error", error: new ApiError("invalid_response", "x") })).toMatchObject({ summary: "API status unavailable", rows: [] });
    expect(healthView({ status: "error", error: new ApiError("config", "x") })).toMatchObject({ summary: "API URL not configured", rows: [], retry: false });
    expect(healthView({ status: "loading" }).rows).toEqual([]);
  });
});
