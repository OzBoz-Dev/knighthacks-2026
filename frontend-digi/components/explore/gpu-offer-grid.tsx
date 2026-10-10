"use client";

import { Button, Collapse, SimpleGrid } from "@mantine/core";
import { useReducedMotion } from "@mantine/hooks";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { useRef } from "react";
import type { Offer } from "@/lib/api/types";
import type { PercentUnit } from "@/lib/format";
import { visibleModelOffers } from "@/lib/explore/selectors";
import { EmptyState } from "@/components/shared/async-state";
import { GpuOfferCard } from "./gpu-offer-card";
import styles from "./explore.module.css";

type Props = {
  offers: readonly Offer[];
  reliabilityUnit: PercentUnit;
  expanded: boolean;
  hasData: boolean;
  exclusion: { label: string; count: number } | null;
  onToggle: () => void;
  onDetails: (offer: Offer) => void;
  onReset: () => void;
};

const COLS = { base: 1, xs: 2, md: 4 };

export function GpuOfferGrid({ offers, reliabilityUnit, expanded, hasData, exclusion, onToggle, onDetails, onReset }: Props) {
  const expandRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();
  const firstFour = visibleModelOffers(offers, false);
  const extra = offers.slice(4);
  const card = (offer: Offer) => <GpuOfferCard key={offer.id} offer={offer} reliabilityUnit={reliabilityUnit} onDetails={() => onDetails(offer)} />;

  if (!firstFour.length) {
    return (
      <EmptyState
        title={hasData ? "No models match your filters" : "Inventory is not connected yet"}
        description={hasData ? (exclusion ? `${exclusion.label} removed ${exclusion.count} ${exclusion.count === 1 ? "offer" : "offers"}. Change that filter or reset all filters.` : "No offers are available right now.") : "Enable development fixtures to explore the interactive sample dashboard, or connect real inventory in a future integration."}
        action={hasData ? <Button variant="default" size="sm" onClick={onReset}>Reset filters</Button> : undefined}
      />
    );
  }

  return (
    <>
      <SimpleGrid mb={10} cols={COLS} spacing={10} verticalSpacing={10} id="gpu-offer-grid">
        {firstFour.map(card)}
      </SimpleGrid>
      {extra.length > 0 && (
        <>
          <Collapse id="more-gpu-models" expanded={expanded} keepMounted={false} transitionDuration={reducedMotion ? 0 : 160} onTransitionEnd={() => { if (!expanded) expandRef.current?.scrollIntoView({ block: "nearest" }); }}>
            <SimpleGrid mb={10} cols={COLS} spacing={10} verticalSpacing={10} mt={10}>
              {extra.map(card)}
            </SimpleGrid>
          </Collapse>
          <Button
            ref={expandRef}
            variant="default"
            fullWidth
            className={styles.expandBar}
            aria-controls="more-gpu-models"
            aria-expanded={expanded}
            rightSection={expanded ? <IconChevronUp size={14} aria-hidden /> : <IconChevronDown size={14} aria-hidden />}
            onClick={onToggle}
          >
            {expanded ? "Show fewer models" : `Show ${extra.length} more models`}
          </Button>
        </>
      )}
    </>
  );
}
