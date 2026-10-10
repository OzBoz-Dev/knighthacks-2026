export type MarketPosition = "Good price" | "Near typical" | "Above typical";

// market_position_pct is the percent above (+) or below (-) the Databricks median for the same GPU model.
export function marketPosition(pct: number | null): MarketPosition | null {
  if (pct === null || !Number.isFinite(pct)) return null;
  if (pct <= -15) return "Good price";
  return pct > 15 ? "Above typical" : "Near typical";
}
