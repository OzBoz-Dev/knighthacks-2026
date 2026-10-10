export const MISSING = "—";

type Num = number | null | undefined;

const isNum = (value: Num): value is number => typeof value === "number" && Number.isFinite(value);

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
});

const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

const timestamp = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatUsd(value: Num): string {
  return isNum(value) ? usd.format(value) : MISSING;
}

export function formatUsdPerHour(value: Num): string {
  return isNum(value) ? `${usd.format(value)}/hr` : MISSING;
}

export function formatGb(value: Num): string {
  return isNum(value) ? `${decimal.format(value)} GB` : MISSING;
}

export type PercentUnit = "ratio" | "percent";

const toPercent = (value: number, unit: PercentUnit) => (unit === "ratio" ? value * 100 : value);

export function formatPercent(value: Num, unit: PercentUnit): string {
  return isNum(value) ? `${decimal.format(toPercent(value, unit))}%` : MISSING;
}

export function formatSignedPercent(value: Num, unit: PercentUnit): string {
  if (!isNum(value)) return MISSING;
  const pct = toPercent(value, unit);
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  return `${sign}${decimal.format(Math.abs(pct))}%`;
}

export function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatTimestamp(value: string | null | undefined): string | null {
  const date = parseTimestamp(value);
  return date ? `${timestamp.format(date)} UTC` : null;
}
