"use client";

import { ActionIcon, Anchor, CopyButton, Group, Paper, Text, Title, Tooltip } from "@mantine/core";
import { IconCheck, IconCopy, IconExternalLink } from "@tabler/icons-react";
import type { ReactNode } from "react";
import type { Reservation } from "@/lib/api/types";
import { formatGb, formatTimestamp, formatUsdPerHour } from "@/lib/format";
import { explorerTxUrl, priorityLabel, shorten } from "@/lib/reservations/receipt";
import { reservationStatus } from "@/lib/reservations/status";
import { StatusBadge } from "./status-badge";
import styles from "./reservations.module.css";

function Copyable({ value, label }: { value: string; label: string }) {
  return (
    <Group gap={4} wrap="nowrap" justify="flex-end">
      <Text component="span" ff="monospace" fz={12} title={value}>{shorten(value)}</Text>
      <CopyButton value={value} timeout={1500}>
        {({ copied, copy }) => (
          <Tooltip label={copied ? "Copied" : `Copy the full ${label}`} withArrow>
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={copy} aria-label={copied ? `${label} copied` : `Copy the full ${label}`}>
              {copied ? <IconCheck size={14} aria-hidden /> : <IconCopy size={14} aria-hidden />}
            </ActionIcon>
          </Tooltip>
        )}
      </CopyButton>
    </Group>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <Text component="dt" fz={12} c="dimmed">{label}</Text>
      <Text component="dd" fz={13} ta="right" className="tabular" m={0}>{children}</Text>
    </div>
  );
}

export function ReservationCard({ reservation, footer }: { reservation: Reservation; footer?: ReactNode }) {
  const status = reservationStatus({ status: reservation.status });
  const titleId = `reservation-${reservation.id}-title`;
  return (
    <Paper component="li" withBorder p="md" radius="sm" aria-labelledby={titleId} className={styles.card}>
      <Group justify="space-between" align="flex-start" gap="sm">
        <div>
          <Title order={3} fz={17} id={titleId}>{reservation.gpu_name}</Title>
          <Text fz={12} c="dimmed">Offer {reservation.offer_id} · Reservation {reservation.id}</Text>
        </div>
        <StatusBadge view={status} />
      </Group>
      <Text fz={12} c="dimmed" mt={4}>{status.note}</Text>
      <dl className={styles.details}>
        <Row label="Quoted hourly price">{formatUsdPerHour(reservation.price_per_hour)}</Row>
        <Row label="Requested VRAM">{formatGb(reservation.min_vram_gb)}</Row>
        <Row label="Maximum budget">{formatUsdPerHour(reservation.max_price_per_hour)}</Row>
        <Row label="Priority">{priorityLabel(reservation.priority)}</Row>
        <Row label="Region">{reservation.region ?? "Any region"}</Row>
        <Row label="Wallet"><Copyable value={reservation.wallet} label="wallet address" /></Row>
        <Row label="Created"><time dateTime={reservation.created_at}>{formatTimestamp(reservation.created_at) ?? "Time unknown"}</time></Row>
        <Row label="Signature">
          {reservation.signature ? (
            <Group gap={6} wrap="nowrap" justify="flex-end">
              <Copyable value={reservation.signature} label="signature" />
              <Anchor href={explorerTxUrl(reservation.signature)} target="_blank" rel="noopener noreferrer" fz={12}>
                <Group gap={2} wrap="nowrap">Solana Explorer (devnet)<IconExternalLink size={12} aria-hidden /></Group>
              </Anchor>
            </Group>
          ) : "Not signed yet"}
        </Row>
        {reservation.slot !== null && <Row label="Slot">{reservation.slot}</Row>}
      </dl>
      <Text fz={11} c="dimmed" mt="xs">
        {reservation.signature
          ? "A signed reservation intent on Solana devnet. It is not a booking or a payment."
          : "A reservation intent that is not signed yet. It is not a booking or a payment."}
      </Text>
      {footer}
    </Paper>
  );
}
