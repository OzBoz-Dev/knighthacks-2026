"use client";

import { Badge, Button, Group, NumberInput, Popover, Select, Stack, Switch, Text } from "@mantine/core";
import { IconAdjustmentsHorizontal, IconArrowsSort, IconChevronDown } from "@tabler/icons-react";
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
    <Group gap="sm" justify="space-between" align="center">
      <div className={styles.filterRow}>
        <Select className={styles.filter} size="xs" data={models} aria-label="GPU model" placeholder="GPU model" clearable value={filters.model} onChange={(model) => onChange({ model })} disabled={disabled} rightSection={<IconChevronDown size={12} />} />
        <NumberInput className={styles.filter} size="xs" aria-label="Minimum total VRAM in GB" placeholder="Min VRAM (GB)" min={0} hideControls value={filters.minVram ?? ""} onChange={(value) => onChange({ minVram: numeric(value) })} disabled={disabled} />
        <Select className={styles.filter} size="xs" data={regions} aria-label="Region" placeholder="Region" clearable value={filters.region} onChange={(region) => onChange({ region })} disabled={disabled} rightSection={<IconChevronDown size={12} />} />
        <NumberInput className={styles.filter} size="xs" aria-label="Maximum hourly price in dollars" placeholder="Max price / hr" min={0} decimalScale={3} hideControls prefix="$" value={filters.maxPrice ?? ""} onChange={(value) => onChange({ maxPrice: numeric(value) })} disabled={disabled} />
        <Popover width={230} position="bottom-start" withArrow>
          <Popover.Target><Button size="xs" color="gray" variant="default" leftSection={<IconAdjustmentsHorizontal size={13} />} disabled={disabled}>More filters</Button></Popover.Target>
          <Popover.Dropdown>
            <Stack gap="md">
              <NumberInput label="Minimum reliability (%)" size="xs" min={0} max={100} decimalScale={1} value={filters.minReliability ?? ""} onChange={(value) => onChange({ minReliability: numeric(value) })} />
              <Switch label="Verified hosts only" size="xs" checked={filters.verifiedOnly} onChange={(event) => onChange({ verifiedOnly: event.currentTarget.checked })} />
            </Stack>
          </Popover.Dropdown>
        </Popover>
        <Badge color="gray" variant="outline" tt="none" fw={400} size="lg">Provider: Vast.ai</Badge>
        {active && <Button size="compact-xs" variant="subtle" onClick={onReset}>Reset</Button>}
      </div>
      <Group gap={6} wrap="nowrap">
        <Text fz={11} c="dimmed">Sort</Text>
        <Select w={163} size="xs" data={sortOptions} aria-label="Sort GPU models" value={filters.sort} onChange={(value) => { if (sortOptions.some((o) => o.value === value)) onChange({ sort: value as OfferSort }); }} leftSection={<IconArrowsSort size={13} />} disabled={disabled} />
      </Group>
    </Group>
  );
}
