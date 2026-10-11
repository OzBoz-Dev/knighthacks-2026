"use client";

import { ActionIcon, NumberInput, Popover, Select, Stack, Switch, Text } from "@mantine/core";
import { IconAdjustmentsHorizontal, IconRefresh } from "@tabler/icons-react";
import type { OfferFilters as Filters, OfferSort } from "@/lib/explore/types";
import styles from "./explore.module.css";

const numeric = (value: string | number) => typeof value === "number" && Number.isFinite(value) ? value : null;
const sortOptions: { value: OfferSort; label: string }[] = [
  { value: "featured", label: "Featured first" },
  { value: "price", label: "Lowest price" },
  { value: "reliability", label: "Highest reliability" },
  { value: "performance", label: "Performance / $" },
];

export function OfferFilters({ filters, models, regions, onChange, onReset, disabled }: {
  filters: Filters;
  models: string[];
  regions: string[];
  onChange: (patch: Partial<Filters>) => void;
  onReset: () => void;
  disabled: boolean;
}) {
  const active = !!(filters.search || filters.model || filters.region || filters.minVram !== null || filters.maxPrice !== null || filters.minReliability !== null || filters.verifiedOnly || filters.sort !== "featured");
  const advanced = filters.minReliability !== null || filters.verifiedOnly;
  return (
    <div className={styles.filterBar} aria-label="Filter and sort GPU offers">
      <Select className={styles.filter} size="xs" data={models} aria-label="GPU model" placeholder="GPU model" clearable value={filters.model} onChange={(model) => onChange({ model })} disabled={disabled} />
      <NumberInput className={styles.filter} size="xs" aria-label="Minimum VRAM per GPU in GB" placeholder="Min VRAM per GPU" min={0} hideControls prefix="≥ " suffix=" GB" value={filters.minVram ?? ""} onChange={(value) => onChange({ minVram: numeric(value) })} disabled={disabled} />
      <Select className={styles.filter} size="xs" data={regions} aria-label="Region" placeholder="Region" clearable value={filters.region} onChange={(region) => onChange({ region })} disabled={disabled} />
      <NumberInput className={styles.filter} size="xs" aria-label="Maximum hourly price in dollars" placeholder="Max $/hr" min={0} decimalScale={3} hideControls prefix="≤ $" suffix="/hr" value={filters.maxPrice ?? ""} onChange={(value) => onChange({ maxPrice: numeric(value) })} disabled={disabled} />
      <Text fz={11} c="dimmed" className={styles.provider} title="Only Vast.ai listings are supported">Vast.ai</Text>
      <Popover width={240} position="bottom-start">
        <Popover.Target>
          <ActionIcon size={30} variant={advanced ? "light" : "default"} disabled={disabled} aria-label={advanced ? "More filters, active" : "More filters"} title="Reliability and verified-host filters">
            <IconAdjustmentsHorizontal size={16} aria-hidden />
          </ActionIcon>
        </Popover.Target>
        <Popover.Dropdown>
          <Stack gap="md">
            <NumberInput label="Minimum reliability (%)" size="sm" min={0} max={100} decimalScale={1} value={filters.minReliability ?? ""} onChange={(value) => onChange({ minReliability: numeric(value) })} />
            <Switch label="Verified hosts only" size="sm" checked={filters.verifiedOnly} onChange={(event) => onChange({ verifiedOnly: event.currentTarget.checked })} />
          </Stack>
        </Popover.Dropdown>
      </Popover>
      <ActionIcon size={30} variant="subtle" onClick={onReset} disabled={!active || disabled} aria-label="Reset filters and sorting" title="Reset filters and sorting">
        <IconRefresh size={16} aria-hidden />
      </ActionIcon>
      <Select className={styles.sort} size="xs" data={sortOptions} aria-label="Sort GPU models" placeholder="Sort" value={filters.sort} onChange={(value) => { if (sortOptions.some((o) => o.value === value)) onChange({ sort: value as OfferSort }); }} disabled={disabled} allowDeselect={false} />
    </div>
  );
}
