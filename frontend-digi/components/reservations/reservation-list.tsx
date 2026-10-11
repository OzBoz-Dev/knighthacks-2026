"use client";

import { Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { describeApiError } from "@/lib/api/client";
import { getReservations } from "@/lib/api/reservations";
import type { Reservation } from "@/lib/api/types";
import { formatUsdPerHour } from "@/lib/format";
import { createLatestRequest } from "@/lib/match/latest-request";
import { listView, type ListState } from "@/lib/reservations/list";
import { reservationStatus } from "@/lib/reservations/status";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/async-state";
import { UpdatedAt } from "@/components/shared/updated-at";
import { StatusBadge } from "./status-badge";

function ReservationRow({ reservation }: { reservation: Reservation }) {
  return (
    <Paper component="li" withBorder p="md" radius="sm">
      <Group justify="space-between" gap="sm">
        <div>
          <Title order={3} fz={16}>{reservation.gpu_name}</Title>
          <Text fz={12} c="dimmed">Offer {reservation.offer_id} · {formatUsdPerHour(reservation.price_per_hour)}</Text>
          <UpdatedAt value={reservation.created_at} prefix="Created" fz={12} />
        </div>
        <StatusBadge view={reservationStatus({ status: reservation.status })} />
      </Group>
    </Paper>
  );
}

export function ReservationList() {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58() ?? null;
  const [state, setState] = useState<ListState | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [latest] = useState(createLatestRequest);

  useEffect(() => {
    if (!wallet) return;
    const { signal, isCurrent } = latest.start();
    getReservations(wallet, { signal })
      .then((rows) => { if (isCurrent()) setState({ wallet, status: "ready", rows }); })
      .catch((error: unknown) => { if (isCurrent()) setState({ wallet, status: "error", message: describeApiError(error) }); });
    return () => latest.cancel();
  }, [wallet, attempt, latest]);

  const view = listView(wallet, state);
  const retry = () => { if (wallet) setState({ wallet, status: "loading" }); setAttempt((n) => n + 1); };

  switch (view.kind) {
    case "disconnected":
      return (
        <EmptyState
          title="Connect Phantom to see your reservations."
          description="Your receipts are listed by wallet address. A reservation is a signed intent on Solana devnet, not a booking or a payment."
        />
      );
    case "loading":
      return <LoadingState label="Loading your reservations…" rows={2} />;
    case "error":
      return <ErrorState title="Couldn't load your reservations" message={`${view.message} Your wallet is still connected.`} onRetry={retry} />;
    case "empty":
      return (
        <EmptyState
          title="No reservations yet"
          description="Find a GPU offer that fits your requirements, then reserve it to keep a signed receipt here."
          action={<Button component={Link} href="/match" variant="default">Find a match</Button>}
        />
      );
    case "ready":
      return (
        <section aria-labelledby="reservations-title">
          <Text id="reservations-title" fz={13} c="dimmed" mb="sm" role="status">
            {view.rows.length} {view.rows.length === 1 ? "reservation" : "reservations"} for this wallet, newest first
          </Text>
          <Stack component="ol" gap="sm" p={0} m={0} style={{ listStyle: "none" }}>
            {view.rows.map((reservation) => <ReservationRow key={reservation.id} reservation={reservation} />)}
          </Stack>
        </section>
      );
  }
}
