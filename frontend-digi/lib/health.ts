import { ApiError } from "./api/client";
import type { ComponentStatus, HealthResponse } from "./api/types";

export type HealthState = { status: "loading" } | { status: "ready"; health: HealthResponse } | { status: "error"; error: unknown };

export type HealthTone = "ok" | "saved" | "down" | "unknown";
export type HealthRow = { label: string; value: string; tone: HealthTone };
export type HealthView = { summary: string; tone: HealthTone; rows: HealthRow[]; retry: boolean };

// fixture means the API serves saved data, so it is never called live.
const COMPONENT: Record<ComponentStatus, { value: string; tone: HealthTone }> = {
  ok: { value: "Live", tone: "ok" },
  fixture: { value: "Saved data", tone: "saved" },
  unavailable: { value: "Unavailable", tone: "down" },
};

export function healthView(state: HealthState): HealthView {
  if (state.status === "loading") return { summary: "Checking the API…", tone: "unknown", rows: [], retry: false };
  if (state.status === "error") {
    const e = state.error;
    // GET /api/health answers 503 upstream_unavailable only when SQLite is down (api/health.go).
    if (e instanceof ApiError && e.kind === "http" && e.code) {
      const sqliteDown = e.status === 503 && e.code === "upstream_unavailable";
      return { summary: e.message, tone: "down", rows: sqliteDown ? [{ label: "SQLite", value: "Unavailable", tone: "down" }] : [], retry: true };
    }
    if (e instanceof ApiError && e.kind === "config") return { summary: "API URL not configured", tone: "down", rows: [], retry: false };
    return { summary: e instanceof ApiError && e.kind !== "network" ? "API status unavailable" : "API not reachable", tone: "down", rows: [], retry: true };
  }
  const { health } = state;
  const modes = [health.fixtures.vast && "Vast.ai", health.fixtures.databricks && "Databricks"].filter(Boolean).join(", ");
  return {
    summary: health.status === "ok" ? "API running" : "API degraded",
    tone: health.status === "ok" ? "ok" : "down",
    rows: [
      { label: "Vast.ai", ...COMPONENT[health.components.vast] },
      { label: "Databricks", ...COMPONENT[health.components.databricks] },
      { label: "SQLite", value: "OK", tone: "ok" },
      { label: "Fixture modes", value: modes ? `On: ${modes}` : "Off", tone: modes ? "saved" : "ok" },
    ],
    retry: true,
  };
}
