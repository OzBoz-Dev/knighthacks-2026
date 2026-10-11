// The origin is fixed, so a value from the API can never send the user to another site.
export function explorerTxUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${encodeURIComponent(signature)}?cluster=devnet`;
}

// Shows the start and the end, for example AbCd...WxYz. Copy actions always use the full value.
export function shorten(value: string, keep = 4): string {
  return value.length <= keep * 2 + 3 ? value : `${value.slice(0, keep)}...${value.slice(-keep)}`;
}

const PRIORITY: Record<string, string> = { cheapest: "Cheapest", balanced: "Balanced", performance: "Performance" };

export const priorityLabel = (priority: string) => PRIORITY[priority] ?? priority;
