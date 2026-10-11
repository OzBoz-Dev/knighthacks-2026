"use client";

import { Badge, Box, Group, List, Paper, Stack, Text, Title } from "@mantine/core";
import type { CSSProperties } from "react";
import type { MatchRequest, MatchResponse, Recommendation } from "@/lib/api/types";
import { formatGb, formatPercent, formatUsdPerHour } from "@/lib/format";
import { DataSourceLabel } from "@/components/shared/data-source-label";
import { EmptyState } from "@/components/shared/async-state";
import { FadeIn } from "@/components/shared/fade-in";
import { MarketPositionBadge } from "@/components/explore/market-position-badge";
import { suggestion } from "@/lib/match/suggestion";
import { ScoreBreakdown } from "./score-breakdown";
import { ExclusionSummary } from "./exclusion-summary";
import { FundingNotice } from "@/components/solana/funding-notice";
import { ReserveButton } from "@/components/solana/reserve-button";

// shortcut: MatchResponse has no source or capture time, so the label says unknown, upgrade when #26 adds them to the match response.
const MATCH_PROVENANCE = { source: "unknown", timestamp: null } as const;

function ResultCard({ rec, request, requestId, snapshotId, style }: { rec: Recommendation; request: MatchRequest; requestId: string; snapshotId: string; style?: CSSProperties }) {
  const { offer } = rec;
  return (
    <Paper component="li" withBorder p="md" radius="sm" aria-labelledby={`match-result-${offer.id}`} style={style}>
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
      <ScoreBreakdown breakdown={rec.score_breakdown} priority={request.priority} missingPerformance={offer.dlperf === null} />
      <Box mt="sm" pt="sm" style={{ borderTop: "1px solid var(--dg-rule)" }}>
        <ReserveButton requestId={requestId} snapshotId={snapshotId} request={request} offer={offer} />
      </Box>
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
        <Text fz={12} c="dimmed">
          Top {response.recommendations.length} of {response.eligible} suitable {response.eligible === 1 ? "offer" : "offers"}
        </Text>
      </Group>
      <ExclusionSummary response={response} />
      <Text fz={11} c="dimmed" mt={6} mb="sm">The match API does not send the data source or capture time yet. Snapshot {response.snapshot_id}.</Text>
      {/* One notice for every result, so the five Reserve buttons do not repeat it. */}
      {response.recommendations.length > 0 && <Box mb="sm"><FundingNotice /></Box>}
      {response.recommendations.length ? (
        <Stack component="ol" gap="sm" p={0} m={0} style={{ listStyle: "none" }}>
          {response.recommendations.map((rec, index) => (
            <FadeIn key={rec.offer.id} transition="fade-up" delay={index * 70}>
              {(cardStyle) => <ResultCard rec={rec} request={request} requestId={response.request_id} snapshotId={response.snapshot_id} style={cardStyle} />}
            </FadeIn>
          ))}
        </Stack>
      ) : (
        <EmptyState title="No offers meet your requirements" description={suggestion(response.excluded, request)} />
      )}
    </section>
  );
}
