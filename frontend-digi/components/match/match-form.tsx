"use client";

import { Button, Group, Input, MultiSelect, NumberInput, Paper, SegmentedControl, Select, SimpleGrid, Text } from "@mantine/core";
import type { FormEvent, ReactNode } from "react";
import type { MatchOptions } from "@/lib/api/match";
import type { MatchFormErrors, MatchFormValues, Priority } from "@/lib/match/form";

export type OptionsState = { status: "loading" } | { status: "ready"; value: MatchOptions } | { status: "error" };

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "cheapest", label: "Cheapest" },
  { value: "balanced", label: "Balanced" },
  { value: "performance", label: "Performance" },
];

export const FIELD_IDS = { minVram: "match-min-vram", maxPrice: "match-max-price", minReliability: "match-min-reliability" } as const;

export function MatchForm({ values, errors, options, busy = false, actions, onChange, onSubmit, onRetryOptions }: {
  values: MatchFormValues;
  errors: MatchFormErrors;
  options: OptionsState;
  busy?: boolean;
  actions?: ReactNode;
  onChange: (patch: Partial<MatchFormValues>) => void;
  onSubmit: () => void;
  onRetryOptions: () => void;
}) {
  const choices = options.status === "ready" ? options.value : { gpuNames: [], regions: [] };
  const choiceHint = options.status === "loading"
    ? "Loading the models and regions in the current offers…"
    : options.status === "error" ? "Couldn't load models and regions. You can still match on the other fields." : undefined;
  const submit = (event: FormEvent) => { event.preventDefault(); onSubmit(); };

  return (
    <Paper component="form" onSubmit={submit} noValidate p="lg" withBorder aria-label="Match requirements">
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" verticalSpacing="md">
        <NumberInput id={FIELD_IDS.minVram} label="Minimum total VRAM (GB)" description="Across all GPUs in the offer" min={0} allowNegative={false} value={values.minVram} onChange={(minVram) => onChange({ minVram })} error={errors.minVram} required />
        <NumberInput id={FIELD_IDS.maxPrice} label="Maximum hourly budget (USD)" description="For the whole offer" min={0} decimalScale={3} allowNegative={false} prefix="$" value={values.maxPrice} onChange={(maxPrice) => onChange({ maxPrice })} error={errors.maxPrice} required />
        <NumberInput id={FIELD_IDS.minReliability} label="Minimum reliability (%)" description="Default 95%" min={0} max={100} decimalScale={1} allowNegative={false} suffix="%" value={values.minReliability} onChange={(minReliability) => onChange({ minReliability })} error={errors.minReliability} required />
        <MultiSelect label="GPU models (optional)" description={choiceHint ?? "Leave empty to allow any model"} placeholder={values.gpuNames.length ? undefined : "Any model"} data={[...new Set([...choices.gpuNames, ...values.gpuNames])]} value={values.gpuNames} onChange={(gpuNames) => onChange({ gpuNames })} disabled={options.status !== "ready"} searchable clearable />
        <Select label="Region (optional)" description={choiceHint ?? "Leave empty to allow any region"} placeholder="Any region" data={[...new Set([...choices.regions, ...(values.region ? [values.region] : [])])]} value={values.region} onChange={(region) => onChange({ region })} disabled={options.status !== "ready"} searchable clearable />
        <Input.Wrapper label="Priority" id="match-priority" labelElement="div" description="How results are ranked">
          <SegmentedControl fullWidth mt={4} data={PRIORITIES} value={values.priority} onChange={(priority) => onChange({ priority: priority as Priority })} aria-labelledby="match-priority-label" />
        </Input.Wrapper>
      </SimpleGrid>
      <Group justify="space-between" mt="lg" gap="sm">
        <Group gap="sm">
          {options.status === "error" && <Button variant="subtle" size="xs" onClick={onRetryOptions}>Retry loading models and regions</Button>}
          {actions}
        </Group>
        <Button type="submit" loading={busy}>Find matches</Button>
      </Group>
      <Text fz={11} c="dimmed" mt="sm">Reliability goes to the API as a ratio, for example 95% is 0.95.</Text>
    </Paper>
  );
}
