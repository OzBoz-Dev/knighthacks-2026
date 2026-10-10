"use client";

import { Badge, Button, Divider, Group, Stack, Text, Title, Tooltip } from "@mantine/core";
import { IconArrowDown, IconArrowUp, IconFlask, IconInfoCircle } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import type { Offer } from "@/lib/api/types";
import type { DashboardData, OfferFilters as Filters } from "@/lib/explore/types";
import { buildMarketOverview, DEFAULT_FILTERS, getModelOffers, visibleModelOffers } from "@/lib/explore/selectors";
import { EmptyState } from "@/components/shared/async-state";
import { DataSourceLabel } from "@/components/shared/data-source-label";
import { ExploreToolbar } from "./explore-toolbar";
import { MarketHero } from "./market-hero";
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
    <Stack gap="md">
      <ExploreToolbar search={filters.search} onSearch={(search) => changeFilters({ search })} overview={overview} sample={!!data} />
      {data ? <div className={styles.sampleNotice} role="note"><IconFlask size={13} aria-hidden /><DataSourceLabel provenance={provenance} compact /><Text fz={10} c="dimmed">Interactive preview · No real bookings</Text></div> : <Text size="xs" c="dimmed">Market data is not connected. The dashboard is ready for integration.</Text>}
      <MarketHero />
      <OfferFilters filters={filters} models={models} regions={regions} onChange={changeFilters} onReset={resetFilters} disabled={!data} />
      <section aria-labelledby="gpu-models-title">
        <Group justify="space-between" mb="sm" gap="sm">
          <Group gap="xs">
            <Title order={2} id="gpu-models-title" tabIndex={-1} fz={15}>{filters.sort === "featured" ? "Popular models" : "GPU models"}</Title>
            <Tooltip label="Curated preview models. Each card shows the lowest-priced eligible offer for that model; popularity is not measured demand."><IconInfoCircle size={13} color="var(--mantine-color-dimmed)" tabIndex={0} aria-label="About model selection" /></Tooltip>
            {data && <Badge color="gray" variant="light" size="xs" tt="none">Curated</Badge>}
          </Group>
          <Group gap="sm">
            {data && <Text fz={10} c="dimmed" role="status" aria-live="polite">{visible.length} of {representatives.length} models</Text>}
            {representatives.length > 4 && <Button size="compact-xs" variant="subtle" rightSection={expanded ? <IconArrowUp size={13} /> : <IconArrowDown size={13} />} aria-expanded={expanded} aria-controls="gpu-offer-grid" onClick={() => setExpanded((value) => !value)}>{expanded ? "Show fewer" : "Explore all models"}</Button>}
          </Group>
        </Group>
        {visible.length ? <div className={styles.offerGrid} id="gpu-offer-grid">
          {visible.map((offer) => <GpuOfferCard key={offer.id} offer={offer} reliabilityUnit={reliabilityUnit} onDetails={() => setSelectedOffer(offer)} />)}
        </div> : <EmptyState
          title={data ? "No models match your filters" : "Inventory is not connected yet"}
          description={data ? "Try removing a filter or increasing your budget to explore more models." : "Enable development fixtures to explore the interactive sample dashboard, or connect real inventory in a future integration."}
          action={data ? <Button variant="light" size="xs" onClick={resetFilters}>Reset filters</Button> : undefined}
        />}
      </section>
      <Divider color="dark.5" />
      <MarketOverview overview={overview} sample={!!data} onRegion={(region, model) => jumpToCards({ region, model })} onModel={(model) => jumpToCards({ model })} />
      <OfferDetailsDrawer offer={selectedOffer} onClose={() => setSelectedOffer(null)} provenance={provenance} reliabilityUnit={reliabilityUnit} />
    </Stack>
  );
}
