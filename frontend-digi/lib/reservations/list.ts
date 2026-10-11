import type { Reservation } from "../api/types";

export type ListState =
  | { wallet: string; status: "loading" }
  | { wallet: string; status: "ready"; rows: Reservation[] }
  | { wallet: string; status: "error"; message: string };

export type ListView =
  | { kind: "disconnected" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "empty" }
  | { kind: "ready"; rows: Reservation[] };

// State that belongs to another wallet is never shown, so a wallet switch cannot show the old wallet's receipts.
export function listView(wallet: string | null, state: ListState | null): ListView {
  if (!wallet) return { kind: "disconnected" };
  if (!state || state.wallet !== wallet || state.status === "loading") return { kind: "loading" };
  if (state.status === "error") return { kind: "error", message: state.message };
  return state.rows.length ? { kind: "ready", rows: state.rows } : { kind: "empty" };
}
