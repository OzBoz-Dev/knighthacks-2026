"use client";

import { Group, Stack, Text, Title, Tooltip } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import type { Offer } from "@/lib/api/types";
import type { DashboardData, OfferFilters as Filters, TableSort } from "@/lib/explore/types";
import { buildMarketOverview, DEFAULT_FILTERS, filterOffers, getModelOffers, sortOffers, TABLE_PAGE_SIZE, visibleModelOffers } from "@/lib/explore/selectors";
import { ExploreToolbar } from "./explore-toolbar";
import { MarketHeading } from "./market-hero";
import { OfferFilters } from "./offer-filters";
import { GpuOfferGrid } from "./gpu-offer-grid";
import { OfferDetailsDrawer } from "./offer-details-drawer";
import { MarketOverview } from "./market-overview";
import { OfferTable } from "./offer-table";
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
  const [tableSort, setTableSort] = useState<TableSort>({ key: "price", direction: "asc" });
  const tableOffers = useMemo(() => sortOffers(filterOffers(offers, filters, reliabilityUnit), tableSort), [offers, filters, reliabilityUnit, tableSort]);
  const representatives = useMemo(() => getModelOffers(offers, filters, reliabilityUnit), [offers, filters, reliabilityUnit]);
  const overview = useMemo(() => buildMarketOverview(offers, data?.history ?? []), [offers, data?.history]);
  const visibleCount = visibleModelOffers(representatives, expanded).length;
  const provenance = data?.provenance ?? { source: "unknown" as const, timestamp: null };
  const [rowLimit, setRowLimit] = useState(TABLE_PAGE_SIZE);
  const collapse = () => { setExpanded(false); setRowLimit(TABLE_PAGE_SIZE); };
  const changeFilters = (patch: Partial<Filters>) => { setFilters((current) => ({ ...current, ...patch })); collapse(); };
  const resetFilters = () => { setFilters({ ...DEFAULT_FILTERS }); collapse(); };
  const changeTableSort = (sort: TableSort) => { setTableSort(sort); setRowLimit(TABLE_PAGE_SIZE); };
  const jumpToCards = (patch: Partial<Filters>) => {
    setFilters({ ...DEFAULT_FILTERS, ...patch });
    collapse();
    document.getElementById("gpu-models-title")?.focus();
  };

  return (
    <Stack gap={12} className={styles.dashboard}>
      <ExploreToolbar search={filters.search} onSearch={(search) => changeFilters({ search })} overview={overview} sample={!!data} />
      <MarketHeading provenance={provenance} sample={!!data} start={overview.start} end={overview.end} />
      <OfferFilters filters={filters} models={models} regions={regions} onChange={changeFilters} onReset={resetFilters} disabled={!data} />
      <section aria-labelledby="gpu-models-title">
        <Group justify="space-between" mb={8} gap="xs">
          <Group gap="xs" align="center">
            <Title order={2} id="gpu-models-title" tabIndex={-1} fz={15} fw={600}>{filters.sort === "featured" ? "Featured hardware" : "GPU models"}</Title>
            <Tooltip label="Curated preview order. Each card shows the lowest-priced eligible offer for that model; it does not measure demand.">
              <IconInfoCircle size={14} color="var(--mantine-color-dimmed)" tabIndex={0} aria-label="About model selection" />
            </Tooltip>
          </Group>
          {data && <Text fz={11} c="dimmed" role="status" aria-live="polite">{visibleCount} of {representatives.length} models</Text>}
        </Group>
        <GpuOfferGrid
          offers={representatives}
          reliabilityUnit={reliabilityUnit}
          expanded={expanded}
          hasData={!!data}
          onToggle={() => setExpanded((value) => !value)}
          onDetails={setSelectedOffer}
          onReset={resetFilters}
        />
      </section>
      <OfferTable offers={tableOffers} reliabilityUnit={reliabilityUnit} sort={tableSort} onSort={changeTableSort} limit={rowLimit} onShowMore={() => setRowLimit((limit) => limit + TABLE_PAGE_SIZE)} onDetails={setSelectedOffer} />
      <MarketOverview overview={overview} sample={!!data} onRegion={(region, model) => jumpToCards({ region, model })} onModel={(model) => jumpToCards({ model })} />
      <OfferDetailsDrawer offer={selectedOffer} onClose={() => setSelectedOffer(null)} provenance={provenance} reliabilityUnit={reliabilityUnit} />
    </Stack>
  );
}
