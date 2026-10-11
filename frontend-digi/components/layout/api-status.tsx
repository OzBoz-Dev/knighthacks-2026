"use client";

import { Button, Group, Stack, Text } from "@mantine/core";
import { IconAlertTriangle, IconCircleCheck, IconCircleDashed, IconDatabase } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { getHealth } from "@/lib/api/endpoints";
import { healthView, type HealthState, type HealthTone } from "@/lib/health";
import { createLatestRequest } from "@/lib/match/latest-request";

// Each tone has its own icon and its own text, so the status does not depend on color.
const TONE: Record<HealthTone, { Icon: typeof IconCircleCheck; color: string }> = {
  ok: { Icon: IconCircleCheck, color: "green.4" },
  saved: { Icon: IconDatabase, color: "yellow.4" },
  down: { Icon: IconAlertTriangle, color: "red.4" },
  unknown: { Icon: IconCircleDashed, color: "dimmed" },
};

function ToneIcon({ tone }: { tone: HealthTone }) {
  const { Icon, color } = TONE[tone];
  return <Text component="span" c={color} lh={0} aria-hidden><Icon size={13} /></Text>;
}

// The check runs once on load and on Retry. It never blocks the navigation.
export function ApiStatus() {
  const [state, setState] = useState<HealthState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [latest] = useState(createLatestRequest);

  useEffect(() => {
    const { signal, isCurrent } = latest.start();
    getHealth({ signal })
      .then((health) => { if (isCurrent()) setState({ status: "ready", health }); })
      .catch((error: unknown) => { if (isCurrent()) setState({ status: "error", error }); });
    return () => latest.cancel();
  }, [attempt, latest]);

  const view = healthView(state);
  return (
    <section aria-labelledby="api-status-title">
      <Group gap={6} wrap="nowrap">
        <ToneIcon tone={view.tone} />
        <Text id="api-status-title" fz={12} fw={600}>API status</Text>
      </Group>
      <Text fz={12} c="dimmed" mt={2} role="status">{view.summary}</Text>
      {view.rows.length > 0 && (
        <Stack component="dl" gap={2} mt={6} mb={0}>
          {view.rows.map((row) => (
            <Group key={row.label} justify="space-between" gap={6} wrap="nowrap">
              <Text component="dt" fz={11} c="dimmed">{row.label}</Text>
              <Group component="dd" gap={4} wrap="nowrap" m={0}>
                <ToneIcon tone={row.tone} />
                <Text fz={11}>{row.value}</Text>
              </Group>
            </Group>
          ))}
        </Stack>
      )}
      {view.retry && state.status === "error" && (
        <Button size="compact-xs" variant="subtle" mt={4} px={0} onClick={() => { setState({ status: "loading" }); setAttempt((n) => n + 1); }}>
          Check again
        </Button>
      )}
    </section>
  );
}
