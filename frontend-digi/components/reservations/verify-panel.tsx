"use client";

import { Button, Group, List, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconCheck, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { describeApiError } from "@/lib/api/client";
import { verifyReservation, type VerifyResult } from "@/lib/api/reservations";
import type { Reservation } from "@/lib/api/types";
import { createLatestRequest } from "@/lib/match/latest-request";
import { CHECK_LABELS, resultMatches, verificationOutcome } from "@/lib/reservations/verification";
import type { VerificationOutcome } from "@/lib/reservations/status";
import { checkPayloadHash } from "@/lib/solana/payload-hash";
import { ErrorState } from "@/components/shared/async-state";

type PanelState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "done"; result: VerifyResult; hashOk: boolean }
  | { status: "error"; message: string };

function CheckRow({ label, passed, detail }: { label: string; passed: boolean; detail: string }) {
  return (
    <List.Item
      icon={<ThemeIcon size={18} radius="xl" color={passed ? "green" : "red"} variant="light">{passed ? <IconCheck size={12} aria-hidden /> : <IconX size={12} aria-hidden />}</ThemeIcon>}
    >
      <Text fz={13} component="span" fw={600}>{passed ? "Pass" : "Fail"}: </Text>
      <Text fz={13} component="span">{label}</Text>
      {detail && <Text fz={12} c="dimmed">{detail}</Text>}
    </List.Item>
  );
}

export function VerifyPanel({ reservation, onOutcome }: { reservation: Reservation; onOutcome: (outcome: VerificationOutcome | undefined) => void }) {
  const [state, setState] = useState<PanelState>({ status: "idle" });
  const [latest] = useState(createLatestRequest);
  useEffect(() => () => latest.cancel(), [latest]);

  if (!reservation.signature) {
    return (
      <Text fz={12} c="dimmed" mt="sm">
        {reservation.status === "failed"
          ? "This reservation has no signature to check. Reserve the offer again from Match."
          : "Verify receipt is available after the reservation is signed and confirmed."}
      </Text>
    );
  }

  const run = async () => {
    const { signal, isCurrent } = latest.start();
    setState({ status: "checking" });
    try {
      const [result, hashOk] = await Promise.all([verifyReservation(reservation.id, { signal }), checkPayloadHash(reservation)]);
      if (!isCurrent()) return;
      if (!resultMatches(result, reservation)) throw new Error("The check result does not belong to this receipt. Load your reservations again.");
      setState({ status: "done", result, hashOk });
      onOutcome(verificationOutcome(result, hashOk));
    } catch (error) {
      if (!isCurrent()) return;
      setState({ status: "error", message: error instanceof Error && !("kind" in error) ? error.message : describeApiError(error) });
      onOutcome("unavailable");
    }
  };

  return (
    <Stack gap="xs" mt="sm">
      <Group gap="sm">
        <Button size="xs" variant="default" onClick={run} loading={state.status === "checking"}>
          {state.status === "done" ? "Verify again" : "Verify receipt"}
        </Button>
        {state.status === "done" && (
          <Text fz={12} role="status">
            {verificationOutcome(state.result, state.hashOk) === "passed" ? "Every check passed." : "At least one check failed."}
          </Text>
        )}
      </Group>
      {state.status === "error" && <ErrorState title="Couldn't check this receipt" message={`${state.message} This is not a failed check. Try again.`} onRetry={run} />}
      {state.status === "done" && (
        <List spacing={6} aria-label="Receipt checks" center={false}>
          {state.result.checks.map((check) => <CheckRow key={check.name} label={CHECK_LABELS[check.name]} passed={check.passed} detail={check.detail} />)}
          <CheckRow
            label="The stored payload hashes to its payload hash (checked in this browser)"
            passed={state.hashOk}
            detail={state.hashOk ? "" : "The stored payload does not match its hash."}
          />
        </List>
      )}
    </Stack>
  );
}
