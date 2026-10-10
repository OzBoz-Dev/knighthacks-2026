"use client";

import { Button, Group, Table, Text, Title, UnstyledButton, VisuallyHidden } from "@mantine/core";
import { IconArrowDown, IconArrowUp, IconSelector } from "@tabler/icons-react";
import type { Offer } from "@/lib/api/types";
import { formatGb, formatPercent, formatUsdPerHour, MISSING, type PercentUnit } from "@/lib/format";
import { nextSort } from "@/lib/explore/selectors";
import type { TableSort, TableSortKey } from "@/lib/explore/types";
import styles from "./explore.module.css";

const COLUMNS: { label: string; numeric: boolean; sort?: TableSortKey }[] = [
  { label: "GPU", numeric: false },
  { label: "GPU count", numeric: true },
  { label: "VRAM per GPU", numeric: true },
  { label: "Region", numeric: false },
  { label: "Hourly price", numeric: true, sort: "price" },
  { label: "Reliability", numeric: true, sort: "reliability" },
  { label: "Performance score", numeric: true },
  { label: "Perf per $", numeric: true, sort: "performance" },
  { label: "Verified host", numeric: false },
];

function SortHeader({ label, sortKey, sort, onSort }: { label: string; sortKey: TableSortKey; sort: TableSort; onSort: (sort: TableSort) => void }) {
  const active = sort.key === sortKey;
  const Icon = !active ? IconSelector : sort.direction === "asc" ? IconArrowUp : IconArrowDown;
  return (
    <UnstyledButton className={styles.sortHeader} onClick={() => onSort(nextSort(sort, sortKey))}>
      <Group gap={3} wrap="nowrap" justify="flex-end">
        <span>{label}</span>
        <Icon size={12} aria-hidden />
      </Group>
    </UnstyledButton>
  );
}

export function OfferTable({ offers, reliabilityUnit, sort, onSort, onDetails }: {
  offers: readonly Offer[];
  reliabilityUnit: PercentUnit;
  sort: TableSort;
  onSort: (sort: TableSort) => void;
  onDetails: (offer: Offer) => void;
}) {
  if (!offers.length) return null;
  return (
    <section aria-labelledby="offer-table-title">
      <Group justify="space-between" align="baseline" mb={8} gap="xs">
        <Title order={2} id="offer-table-title" fz={15} fw={600}>All offers</Title>
        <Text fz={11} c="dimmed">{offers.length} offers match your filters</Text>
      </Group>
      <Table.ScrollContainer minWidth={900} className={styles.tableFrame}>
        <Table highlightOnHover verticalSpacing={6} horizontalSpacing="sm" fz={12}>
          <VisuallyHidden component="caption">
            Vast.ai GPU offers that match your filters. Prices are hourly quotes for the whole offer. Use Details to open an offer record.
          </VisuallyHidden>
          <Table.Thead>
            <Table.Tr>
              {COLUMNS.map(({ label, numeric, sort: key }) => (
                <Table.Th
                  key={label}
                  scope="col"
                  ta={numeric ? "right" : "left"}
                  fz={11}
                  aria-sort={key ? (sort.key === key ? (sort.direction === "asc" ? "ascending" : "descending") : "none") : undefined}
                >
                  {key ? <SortHeader label={label} sortKey={key} sort={sort} onSort={onSort} /> : label}
                </Table.Th>
              ))}
              <Table.Th scope="col" fz={11}><VisuallyHidden>Actions</VisuallyHidden></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {offers.map((offer) => (
              <Table.Tr key={offer.id} className={styles.offerRow} onClick={() => onDetails(offer)}>
                <Table.Th scope="row" fw={600}>{offer.gpu_name}</Table.Th>
                <Table.Td ta="right" className="tabular">{offer.num_gpus}</Table.Td>
                <Table.Td ta="right" className="tabular">{formatGb(offer.gpu_ram_gb)}</Table.Td>
                <Table.Td>{offer.region}</Table.Td>
                <Table.Td ta="right" ff="monospace" className="tabular">{formatUsdPerHour(offer.price_per_hour)}</Table.Td>
                <Table.Td ta="right" className="tabular">{formatPercent(offer.reliability, reliabilityUnit)}</Table.Td>
                <Table.Td ta="right" className="tabular">{offer.dlperf === null ? MISSING : offer.dlperf.toFixed(1)}</Table.Td>
                <Table.Td ta="right" className="tabular">{offer.performance_per_dollar === null ? MISSING : offer.performance_per_dollar.toFixed(1)}</Table.Td>
                <Table.Td>{offer.verified ? "Verified" : "Unverified"}</Table.Td>
                <Table.Td ta="right">
                  <Button
                    variant="subtle"
                    size="compact-xs"
                    className={styles.rowAction}
                    onClick={(event) => { event.stopPropagation(); onDetails(offer); }}
                    aria-label={`Details for ${offer.gpu_name} offer ${offer.id}`}
                  >
                    Details
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </section>
  );
}
