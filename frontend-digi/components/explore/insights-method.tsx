"use client";

import { Accordion, List, Text } from "@mantine/core";
import type { Provenance } from "@/lib/data/provenance";
import { UpdatedAt } from "@/components/shared/updated-at";

const GOLD_TABLES = [
  { name: "gold.gpu_market_summary", use: "the Lowest, Typical, and High cards" },
  { name: "gold.gpu_price_trends", use: "the median line and the 10th to 90th percentile band" },
  { name: "gold.offer_market_position", use: "the market position badge on each offer" },
];

export function InsightsMethod({ provenance }: { provenance: Provenance }) {
  const fromDatabricks = provenance.source === "databricks-live" || provenance.source === "databricks-export";
  return (
    <Accordion variant="contained" mt="md" chevronPosition="right">
      <Accordion.Item value="method">
        <Accordion.Control fz={13} fw={600}>How pricing insights are calculated</Accordion.Control>
        <Accordion.Panel>
          <Text fz={12} mb="xs">
            The solGPU API saves a snapshot of Vast.ai offers every 10 minutes. A Databricks pipeline turns those snapshots into the numbers on this page.
          </Text>
          <List type="ordered" fz={12} spacing={4} mb="sm">
            <List.Item><b>Bronze:</b> raw offers, kept exactly as collected.</List.Item>
            <List.Item><b>Silver:</b> typed and deduplicated offers with standard GPU and region names. Rows with a missing GPU name, a nonpositive price, or an impossible reliability are rejected.</List.Item>
            <List.Item><b>Gold:</b> price benchmarks and trend points that the app reads.</List.Item>
          </List>
          <Text fz={12} fw={600} mb={4}>Gold tables</Text>
          <List fz={12} spacing={4} mb="sm">
            {GOLD_TABLES.map(({ name, use }) => (
              <List.Item key={name}><Text component="code" ff="monospace" fz={11}>{name}</Text> feeds {use}.</List.Item>
            ))}
          </List>
          <Text fz={12} fw={600} mb={4}>What the numbers mean</Text>
          <List fz={12} spacing={4} mb="sm">
            <List.Item><b>Typical (median):</b> half of the listings for this GPU cost less, and half cost more.</List.Item>
            <List.Item><b>High (p90):</b> 90% of the listings cost this much or less.</List.Item>
            <List.Item><b>Market position:</b> how far an offer is above or below the median price for the same GPU model. At least 15% below is a good price.</List.Item>
          </List>
          {fromDatabricks
            ? <UpdatedAt value={provenance.timestamp} prefix="Latest Databricks update:" fz={11} />
            : <Text fz={11} c="dimmed">These insights are not from Databricks yet, so there is no Databricks update time.</Text>}
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
