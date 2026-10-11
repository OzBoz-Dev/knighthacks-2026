"use client";

import { Alert, Anchor, Button, Group, Loader, Stack, Text } from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import type { MatchRequest, Offer, Reservation } from "@/lib/api/types";
import { explorerTxUrl } from "@/lib/reservations/receipt";
import { reservationStatus } from "@/lib/reservations/status";
import { hasFeeBalance } from "@/lib/solana/balance";
import type { ReserveState } from "@/lib/solana/reserve";
import { useReserve } from "@/lib/solana/use-reserve";
import { StatusBadge } from "@/components/reservations/status-badge";
import { useSolBalance } from "./balance-provider";

const BUSY: ReserveState["step"][] = ["creating", "awaiting-signature", "confirming"];

function statusView(state: ReserveState) {
  switch (state.step) {
    case "awaiting-signature": return reservationStatus({ status: "pending", flow: "awaiting-signature" });
    case "confirming": return reservationStatus({ status: "pending", flow: "confirming" });
    case "rejected": return reservationStatus({ status: "pending", flow: "rejected" });
    case "verified": return reservationStatus({ status: "confirmed" });
    case "verification-failed": return reservationStatus({ status: "failed" });
    default: return null;
  }
}

// A kept signature is checked again. A reservation with no signature is signed again. Otherwise the user starts over.
function errorAction(state: Extract<ReserveState, { step: "error" }>, onSignAgain: (r: Reservation) => void, onCheckAgain: (r: Reservation, s: string) => void, onRetry?: () => void) {
  const { reservation, signature } = state;
  if (reservation && signature) return <Button size="xs" variant="default" onClick={() => onCheckAgain(reservation, signature)}>Check again</Button>;
  if (reservation) return <Button size="xs" variant="default" onClick={() => onSignAgain(reservation)}>Sign again</Button>;
  return onRetry && <Button size="xs" variant="default" onClick={onRetry}>Try again</Button>;
}

// The live progress of one reserve flow, with the action that is safe for its state.
function ReserveProgress({ state, onSignAgain, onCheckAgain, onRetry }: {
  state: ReserveState;
  onSignAgain: (reservation: Reservation) => void;
  onCheckAgain: (reservation: Reservation, signature: string) => void;
  onRetry?: () => void;
}) {
  const view = statusView(state);
  const signature = "signature" in state ? state.signature : undefined;
  return (
    <Stack gap={6} role="status" aria-live="polite">
      {state.step === "creating" && <Group gap="xs"><Loader size="xs" /><Text fz={12}>Creating the reservation…</Text></Group>}
      {view && (
        <Group gap="xs" wrap="nowrap" align="flex-start">
          <StatusBadge view={view} />
          <Text fz={12} c="dimmed">{state.step === "verified" ? "Opening My Reservations…" : view.note}</Text>
        </Group>
      )}
      {state.step === "rejected" && <Group><Button size="xs" variant="default" onClick={() => onSignAgain(state.reservation)}>Sign again</Button></Group>}
      {state.step === "verification-failed" && <Text fz={12} role="alert">{state.message}</Text>}
      {state.step === "error" && (
        <Alert color="red" variant="light" title="The reservation didn't finish" role="alert">
          <Stack gap={6} align="flex-start">
            <Text fz={12}>{state.message}</Text>
            {errorAction(state, onSignAgain, onCheckAgain, onRetry)}
          </Stack>
        </Alert>
      )}
      {signature && (
        <Anchor href={explorerTxUrl(signature)} target="_blank" rel="noopener noreferrer" fz={12}>
          <Group gap={2} wrap="nowrap">View the transaction on Solana Explorer (devnet)<IconExternalLink size={12} aria-hidden /></Group>
        </Anchor>
      )}
    </Stack>
  );
}

// Reserve on a Match result: creates the reservation, has Phantom sign the memo, and confirms it on devnet.
export function ReserveButton({ requestId, snapshotId, request, offer }: { requestId: string; snapshotId: string; request: MatchRequest; offer: Offer }) {
  const { publicKey, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const { lamports, refresh } = useSolBalance();
  const flow = useReserve({ onSettled: refresh });
  const busy = BUSY.includes(flow.state.step);

  if (!publicKey) {
    return (
      <Button size="sm" variant="default" loading={connecting} onClick={() => setVisible(true)}>Connect Phantom to reserve</Button>
    );
  }

  const start = () => flow.reserve({
    request_id: requestId,
    snapshot_id: snapshotId,
    offer_id: offer.id,
    wallet: publicKey.toBase58(),
    min_vram_gb: request.min_vram_gb,
    max_price_per_hour: request.max_price_per_hour,
    priority: request.priority,
    region: request.region ?? null,
  });
  const funded = typeof lamports === "number" && hasFeeBalance(lamports);

  return (
    <Stack gap="xs">
      <Group gap="sm" align="center">
        <Button size="sm" onClick={start} loading={busy || lamports === undefined} disabled={!funded || flow.state.step === "verified"}>
          Reserve
        </Button>
        <Text fz={11} c="dimmed">
          {lamports === null || (typeof lamports === "number" && !funded)
            ? "You need at least 0.001 devnet SOL to reserve. Select Get devnet SOL above."
            : "A signed intent on Solana devnet. It isn't a booking or a payment."}
        </Text>
      </Group>
      {flow.state.step !== "idle" && <ReserveProgress state={flow.state} onSignAgain={flow.signAgain} onCheckAgain={flow.checkAgain} onRetry={start} />}
    </Stack>
  );
}

// Sign again on a pending receipt that has no signature, for example after a declined or expired transaction.
export function SignAgainButton({ reservation, onSettled }: { reservation: Reservation; onSettled: () => void }) {
  const { publicKey } = useWallet();
  const { lamports, refresh } = useSolBalance();
  const funded = typeof lamports === "number" && hasFeeBalance(lamports);
  // The list reloads only for a final status. A reload on a retryable error would drop the retry button.
  const flow = useReserve({ onSettled: (state) => { refresh(); if (state.step === "verified" || state.step === "verification-failed") onSettled(); } });
  if (publicKey?.toBase58() !== reservation.wallet) return null;
  return (
    <Stack gap="xs" mt="sm">
      {flow.state.step === "idle" && (
        <Group gap="sm">
          <Button size="xs" variant="default" onClick={() => flow.signAgain(reservation)} disabled={!funded}>Sign again</Button>
          <Text fz={12} c="dimmed">
            {funded ? "This reservation isn't signed yet. Sign it to get a verifiable receipt." : "You need at least 0.001 devnet SOL to sign. Open your wallet in the sidebar and select Get devnet SOL."}
          </Text>
        </Group>
      )}
      {flow.state.step !== "idle" && <ReserveProgress state={flow.state} onSignAgain={flow.signAgain} onCheckAgain={flow.checkAgain} />}
    </Stack>
  );
}
