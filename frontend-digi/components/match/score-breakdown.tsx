"use client";

import { Group, Progress, Stack, Text } from "@mantine/core";
import type { MatchRequest, Recommendation } from "@/lib/api/types";
import { PRIORITY_WEIGHTS, SCORE_PARTS } from "@/lib/match/weights";

const PRIORITY_LABEL: Record<MatchRequest["priority"], string> = { cheapest: "Cheapest", balanced: "Balanced", performance: "Performance" };

export function ScoreBreakdown({ breakdown, priority, missingPerformance }: {
  breakdown: Recommendation["score_breakdown"];
  priority: MatchRequest["priority"];
  missingPerformance: boolean;
}) {
  const weights = PRIORITY_WEIGHTS[priority];
  return (
    <Stack gap={6} mt="sm" aria-label="Score breakdown">
      <Text fz={11} c="dimmed">
        Each part is scored 0 to 100 against the other suitable offers. {PRIORITY_LABEL[priority]} priority weights them as shown.
      </Text>
      {SCORE_PARTS.map(({ key, label }) => {
        const value = breakdown[key];
        return (
          <div key={key}>
            <Group justify="space-between" gap="xs">
              <Text fz={12}>{label} <Text component="span" fz={11} c="dimmed">· weight {Math.round(weights[key] * 100)}%</Text></Text>
              <Text fz={12} className="tabular">{value.toFixed(0)} / 100{key === "performance" && missingPerformance ? " · no performance data" : ""}</Text>
            </Group>
            <Progress value={value} size={6} color="lava.5" aria-label={`${label} score ${value.toFixed(0)} out of 100, weight ${Math.round(weights[key] * 100)}%`} />
          </div>
        );
      })}
    </Stack>
  );
}
