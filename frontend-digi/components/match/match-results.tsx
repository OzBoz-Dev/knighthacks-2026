"use client";

import { Badge, Group, List, Paper, Stack, Text, Title } from "@mantine/core";
import type { MatchRequest, MatchResponse, Recommendation } from "@/lib/api/types";
import { formatGb, formatPercent, formatUsdPerHour } from "@/lib/format";
import { DataSourceLabel } from "@/components/shared/data-source-label";
import { EmptyState } from "@/components/shared/async-state";
import { MarketPositionBadge } from "@/components/explore/market-position-badge";
import { ScoreBreakdown } from "./score-breakdown";

// shortcut: MatchResponse has no source or capture time, so the label says unknown, upgrade when #26 adds them to the match response.
const MATCH_PROVENANCE = { source: "unknown", timestamp: null } as const;

function ResultCard({ rec, priority }: { rec: Recommendation; priority: MatchRequest["priority"] }) {
  const { offer } = rec;
  return (
    <Paper component="li" withBorder p="md" radius="sm" aria-labelledby={`match-result-${offer.id}`}>
      <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
        <Group gap="sm" align="flex-start" wrap="nowrap">
          <Badge size="lg" variant="outline" color="gray" radius="sm" aria-label={`Rank ${rec.rank}`}>#{rec.rank}</Badge>
          <div>
            <Title order={3} fz={16} id={`match-result-${offer.id}`}>{offer.gpu_name}</Title>
            <Text fz={12} c="dimmed">
              {offer.region} · {offer.num_gpus} GPU{offer.num_gpus > 1 ? "s" : ""} · {formatGb(offer.gpu_ram_gb)} per GPU · {formatGb(offer.total_vram_gb)} total
            </Text>
            <Text fz={12} c="dimmed">Offer {offer.id} · {formatPercent(offer.reliability, "ratio")} reliability · {offer.verified ? "Verified host" : "Unverified host"}</Text>
          </div>
        </Group>
        <Stack gap={2} align="flex-end">
          <Text fz={20} fw={500} ff="monospace" className="tabular">{formatUsdPerHour(offer.price_per_hour)}</Text>
          <Text fz={12} className="tabular">Score {rec.score.toFixed(1)} / 100</Text>
          <MarketPositionBadge pct={offer.market_position_pct} gpuName={offer.gpu_name} />
        </Stack>
      </Group>
      <List fz={13} mt="sm" spacing={2}>
        {rec.explanations.map((line) => <List.Item key={line}>{line}</List.Item>)}
      </List>
      <ScoreBreakdown breakdown={rec.score_breakdown} priority={priority} missingPerformance={offer.dlperf === null} />
    </Paper>
  );
}

export function MatchResults({ response, request }: { response: MatchResponse; request: MatchRequest }) {
  return (
    <section aria-labelledby="match-results-title">
      <Group justify="space-between" align="center" mb="sm" gap="xs">
        <Group gap="xs">
          <Title order={2} id="match-results-title" fz={18}>Top matches</Title>
          <DataSourceLabel provenance={MATCH_PROVENANCE} compact />
        </Group>
        <Text fz={12} c="dimmed" role="status" aria-live="polite">
          {response.recommendations.length} ranked {response.recommendations.length === 1 ? "offer" : "offers"}
        </Text>
      </Group>
      <Text fz={11} c="dimmed" mb="sm">The match API does not send the data source or capture time yet. Snapshot {response.snapshot_id}.</Text>
      {response.recommendations.length ? (
        <Stack component="ol" gap="sm" p={0} m={0} style={{ listStyle: "none" }}>
          {response.recommendations.map((rec) => <ResultCard key={rec.offer.id} rec={rec} priority={request.priority} />)}
        </Stack>
      ) : (
        <EmptyState title="No offers meet your requirements" description="Change a requirement and find matches again." />
      )}
    </section>
  );
}
