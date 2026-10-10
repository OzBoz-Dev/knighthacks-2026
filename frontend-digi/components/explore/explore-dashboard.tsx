"use client";

import { Button, Group, Stack, Text, Title, Tooltip } from "@mantine/core";
import { IconArrowDown, IconArrowUp, IconInfoCircle } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import type { Offer } from "@/lib/api/types";
import type { DashboardData, OfferFilters as Filters } from "@/lib/explore/types";
import { buildMarketOverview, DEFAULT_FILTERS, getModelOffers, visibleModelOffers } from "@/lib/explore/selectors";
import { EmptyState } from "@/components/shared/async-state";
import { ExploreToolbar } from "./explore-toolbar";
import { MarketHeading } from "./market-hero";
import { OfferFilters } from "./offer-filters";
import { GpuOfferCard } from "./gpu-offer-card";
import { OfferDetailsDrawer } from "./offer-details-drawer";
import { MarketOverview } from "./market-overview";
import styles from "./explore.module.css";

const EMPTY_OFFERS: readonly Offer[] = [];

export function ExploreDashboard({ data }: { data: DashboardData | null }) {
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS });
  const [expanded, setExpanded] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const offers = data?.offers ?? EMPTY_OFFERS;
  const reliabilityUnit = data?.reliabilityUnit ?? "ratio";
  const models = useMemo(() => [...new Set(offers.map((o) => o.gpu_name))].sort(), [offers]);
  const regions = useMemo(() => [...new Set(offers.map((o) => o.region))].sort(), [offers]);
  const representatives = useMemo(() => getModelOffers(offers, filters, reliabilityUnit), [offers, filters, reliabilityUnit]);
  const overview = useMemo(() => buildMarketOverview(offers, data?.history ?? []), [offers, data?.history]);
  const visible = visibleModelOffers(representatives, expanded);
  const provenance = data?.provenance ?? { source: "unknown" as const, timestamp: null };
  const changeFilters = (patch: Partial<Filters>) => { setFilters((current) => ({ ...current, ...patch })); setExpanded(false); };
  const resetFilters = () => { setFilters({ ...DEFAULT_FILTERS }); setExpanded(false); };
  const jumpToCards = (patch: Partial<Filters>) => {
    setFilters({ ...DEFAULT_FILTERS, ...patch });
    setExpanded(false);
    document.getElementById("gpu-models-title")?.focus();
  };

  return (
    <Stack gap={28}>
      <MarketHeading provenance={provenance} sample={!!data} start={overview.start} end={overview.end} />
      <Stack gap="md">
        <ExploreToolbar search={filters.search} onSearch={(search) => changeFilters({ search })} overview={overview} sample={!!data} />
        <OfferFilters filters={filters} models={models} regions={regions} onChange={changeFilters} onReset={resetFilters} disabled={!data} />
      </Stack>
      <section aria-labelledby="gpu-models-title">
        <Group justify="space-between" align="baseline" mb="md" gap="sm">
          <Group gap="xs" align="center">
            <Title order={2} id="gpu-models-title" tabIndex={-1} fz={20} fw={600}>{filters.sort === "featured" ? "Featured hardware" : "Hardware"}</Title>
            <Tooltip label="Curated preview order. Each card shows the lowest-priced eligible offer for that model; it does not measure demand.">
              <IconInfoCircle size={15} color="var(--mantine-color-dimmed)" tabIndex={0} aria-label="About model selection" />
            </Tooltip>
          </Group>
          <Group gap="md">
            {data && <Text fz={13} c="dimmed" role="status" aria-live="polite">{visible.length} of {representatives.length} models</Text>}
            {representatives.length > 4 && (
              <Button size="sm" variant="subtle" rightSection={expanded ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />} aria-expanded={expanded} aria-controls="gpu-offer-grid" onClick={() => setExpanded((value) => !value)}>
                {expanded ? "Show fewer" : "View all models"}
              </Button>
            )}
          </Group>
        </Group>
        {visible.length ? (
          <div className={styles.offerGrid} id="gpu-offer-grid">
            {visible.map((offer) => <GpuOfferCard key={offer.id} offer={offer} reliabilityUnit={reliabilityUnit} onDetails={() => setSelectedOffer(offer)} />)}
          </div>
        ) : (
          <EmptyState
            title={data ? "No models match your filters" : "Inventory is not connected yet"}
            description={data ? "Try removing a filter or increasing your budget to see more models." : "Enable development fixtures to explore the interactive sample dashboard, or connect real inventory in a future integration."}
            action={data ? <Button variant="default" size="sm" onClick={resetFilters}>Reset filters</Button> : undefined}
          />
        )}
      </section>
      <MarketOverview overview={overview} sample={!!data} onRegion={(region, model) => jumpToCards({ region, model })} onModel={(model) => jumpToCards({ model })} />
      <OfferDetailsDrawer offer={selectedOffer} onClose={() => setSelectedOffer(null)} provenance={provenance} reliabilityUnit={reliabilityUnit} />
    </Stack>
  );
}
