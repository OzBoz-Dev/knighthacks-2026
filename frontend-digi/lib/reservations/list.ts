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

// The receipt named in ?id= goes first. The other receipts keep the API order, newest first.
// An id that is not in this wallet's list selects nothing, and the list shows as normal.
export function pinSelected(rows: Reservation[], id: string | null): { rows: Reservation[]; selectedId: string | null } {
  const selected = id ? rows.find((row) => row.id === id) : undefined;
  if (!selected) return { rows, selectedId: null };
  return { rows: [selected, ...rows.filter((row) => row !== selected)], selectedId: selected.id };
}

// State that belongs to another wallet is never shown, so a wallet switch cannot show the old wallet's receipts.
export function listView(wallet: string | null, state: ListState | null): ListView {
  if (!wallet) return { kind: "disconnected" };
  if (!state || state.wallet !== wallet || state.status === "loading") return { kind: "loading" };
  if (state.status === "error") return { kind: "error", message: state.message };
  return state.rows.length ? { kind: "ready", rows: state.rows } : { kind: "empty" };
}
