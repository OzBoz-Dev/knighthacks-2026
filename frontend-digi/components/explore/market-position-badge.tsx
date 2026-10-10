"use client";

import { Badge } from "@mantine/core";
import { IconArrowDownRight, IconArrowUpRight, IconMinus } from "@tabler/icons-react";
import { formatPercent } from "@/lib/format";
import { marketPosition, type MarketPosition } from "@/lib/explore/market-position";

const STYLE: Record<MarketPosition, { color: string; Icon: typeof IconMinus }> = {
  "Good price": { color: "green", Icon: IconArrowDownRight },
  "Near typical": { color: "gray", Icon: IconMinus },
  "Above typical": { color: "yellow", Icon: IconArrowUpRight },
};

export function MarketPositionBadge({ pct, gpuName }: { pct: number | null; gpuName: string }) {
  const position = marketPosition(pct);
  if (position === null || pct === null) return null;
  const { color, Icon } = STYLE[position];
  const detail = pct === 0 ? "at the typical price" : `${formatPercent(Math.abs(pct), "percent")} ${pct < 0 ? "below" : "above"} typical`;
  return (
    <Badge
      color={color}
      size="xs"
      variant="outline"
      tt="none"
      fw={500}
      leftSection={<Icon size={11} aria-hidden />}
      title={`${position}: ${detail} for ${gpuName}`}
    >
      {position} · {detail}
    </Badge>
  );
}
