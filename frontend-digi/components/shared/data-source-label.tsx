import { Badge } from "@mantine/core";
import { describeProvenance, type Provenance, type ProvenanceKind } from "@/lib/data/provenance";

const COLOR: Record<ProvenanceKind, string> = {
  live: "teal",
  saved: "cyan",
  sample: "gray",
  unavailable: "gray",
  unknown: "gray",
};

export function DataSourceLabel({ provenance, compact = false }: { provenance: Provenance; compact?: boolean }) {
  const { kind, label } = describeProvenance(provenance);
  return (
    <Badge
      color={COLOR[kind]}
      size={compact ? "sm" : "lg"}
      tt="none"
      fw={500}
      data-provenance={kind}
      styles={{ root: { height: "auto", whiteSpace: "normal", paddingBlock: 4 }, label: { whiteSpace: "normal" } }}
    >
      {label}
    </Badge>
  );
}
