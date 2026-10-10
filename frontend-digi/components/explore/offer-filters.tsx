"use client";

import { Button, Group, NumberInput, Popover, Select, Stack, Switch, Text } from "@mantine/core";
import { IconAdjustmentsHorizontal } from "@tabler/icons-react";
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
  return (
    <div className={styles.filterBar}>
      <div className={styles.filterRow}>
        <Select className={styles.filter} size="sm" label="GPU model" data={models} placeholder="Any" clearable value={filters.model} onChange={(model) => onChange({ model })} disabled={disabled} />
        <NumberInput className={styles.filter} size="sm" label="Min total VRAM (GB)" placeholder="Any" min={0} hideControls value={filters.minVram ?? ""} onChange={(value) => onChange({ minVram: numeric(value) })} disabled={disabled} />
        <Select className={styles.filter} size="sm" label="Region" data={regions} placeholder="Any" clearable value={filters.region} onChange={(region) => onChange({ region })} disabled={disabled} />
        <NumberInput className={styles.filter} size="sm" label="Max price / hr" placeholder="Any" min={0} decimalScale={3} hideControls prefix="$" value={filters.maxPrice ?? ""} onChange={(value) => onChange({ maxPrice: numeric(value) })} disabled={disabled} />
        <Popover width={240} position="bottom-start">
          <Popover.Target>
            <Button size="sm" variant="default" leftSection={<IconAdjustmentsHorizontal size={15} />} disabled={disabled} className={styles.filterButton}>More filters</Button>
          </Popover.Target>
          <Popover.Dropdown>
            <Stack gap="md">
              <NumberInput label="Minimum reliability (%)" size="sm" min={0} max={100} decimalScale={1} value={filters.minReliability ?? ""} onChange={(value) => onChange({ minReliability: numeric(value) })} />
              <Switch label="Verified hosts only" size="sm" checked={filters.verifiedOnly} onChange={(event) => onChange({ verifiedOnly: event.currentTarget.checked })} />
            </Stack>
          </Popover.Dropdown>
        </Popover>
        {active && <Button size="sm" variant="subtle" onClick={onReset} className={styles.filterButton}>Reset</Button>}
      </div>
      <Group gap="md" wrap="nowrap" align="flex-end">
        <Text fz={13} c="dimmed" pb={8}>Provider: Vast.ai</Text>
        <Select w={180} size="sm" label="Sort" data={sortOptions} value={filters.sort} onChange={(value) => { if (sortOptions.some((o) => o.value === value)) onChange({ sort: value as OfferSort }); }} disabled={disabled} allowDeselect={false} />
      </Group>
    </div>
  );
}
