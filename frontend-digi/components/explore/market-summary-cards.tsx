import { Text } from "@mantine/core";
import type { MarketSummary } from "@/lib/api/types";
import { formatUsdPerHour } from "@/lib/format";
import styles from "./explore.module.css";

export function MarketSummaryCards({ summary }: { summary: MarketSummary | null }) {
  if (!summary) return <Text c="dimmed" fz={12} py="md" role="status">Pricing insights temporarily unavailable</Text>;
  const cards = [
    { label: "Lowest", value: formatUsdPerHour(summary.lowest_price), note: "Cheapest listing" },
    { label: "Typical", value: formatUsdPerHour(summary.median_price), note: "Median price" },
    { label: "High", value: formatUsdPerHour(summary.p90_price), note: "90th percentile" },
    { label: "Listings", value: String(summary.listing_count), note: "Offers in the snapshot" },
  ];
  return (
    <dl className={styles.summaryGrid}>
      {cards.map(({ label, value, note }) => (
        <div key={label} className={styles.summaryCard}>
          <Text component="dt" fz={11} c="dimmed" tt="uppercase" fw={600} style={{ letterSpacing: "0.8px" }}>{label}</Text>
          <Text component="dd" fz={20} fw={500} ff="monospace" className="tabular" m={0}>{value}</Text>
          <Text fz={10} c="dimmed">{note}</Text>
        </div>
      ))}
    </dl>
  );
}
