import type { Offer } from "../api/types";
import type { Provenance } from "../data/provenance";
import type { PercentUnit } from "../format";

export type OfferSort = "featured" | "price" | "reliability" | "performance";

export type OfferFilters = {
  search: string;
  model: string | null;
  region: string | null;
  minVram: number | null;
  maxPrice: number | null;
  minReliability: number | null;
  verifiedOnly: boolean;
  sort: OfferSort;
};

export type TableSortKey = "price" | "reliability" | "performance";
export type TableSort = { key: TableSortKey; direction: "asc" | "desc" };

export type MarketSnapshot = {
  timestamp: string;
  offers: readonly Offer[];
};

export type DashboardData = {
  offers: readonly Offer[];
  history: readonly MarketSnapshot[];
  provenance: Provenance;
  reliabilityUnit: PercentUnit;
};

export type IndexPoint = { timestamp: string; price: number | null };
export type RegionPrice = { region: string; price: number; listings: number };
export type Availability = { model: string; listings: number };
export type PriceChange = { model: string; region: string; current: number; previous: number | null; change: number | null };

export type MarketOverviewData = {
  index: number | null;
  change: number | null;
  series: IndexPoint[];
  regions: RegionPrice[];
  availability: Availability[];
  priceChanges: PriceChange[];
  referenceModel: string;
  start: string | null;
  end: string | null;
};
