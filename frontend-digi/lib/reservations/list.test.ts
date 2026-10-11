import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { listView, pinSelected } from "./list";

const rows = JSON.parse(readFileSync(new URL("../../../fixtures/reservations.json", import.meta.url), "utf8")).list.response;
const A = "WalletA";
const B = "WalletB";

describe("pinSelected", () => {
  it("moves the selected receipt first and keeps the others in order", () => {
    const { rows: ordered, selectedId } = pinSelected(rows, rows[1].id);
    expect(selectedId).toBe(rows[1].id);
    expect(ordered.map((r: { id: string }) => r.id)).toEqual([rows[1].id, rows[0].id]);
    expect(ordered).toHaveLength(rows.length);
  });

  it("selects nothing for an unknown, empty, or missing id", () => {
    for (const id of ["res_unknown", "", null]) {
      expect(pinSelected(rows, id)).toEqual({ rows, selectedId: null });
    }
  });
});

describe("listView", () => {
  it("asks for a wallet when none is connected, even with old data", () => {
    expect(listView(null, { wallet: A, status: "ready", rows })).toEqual({ kind: "disconnected" });
  });

  it("never shows another wallet's rows or error after a switch", () => {
    expect(listView(B, { wallet: A, status: "ready", rows })).toEqual({ kind: "loading" });
    expect(listView(B, { wallet: A, status: "error", message: "x" })).toEqual({ kind: "loading" });
  });

  it("shows loading, error, empty, and ready for the connected wallet", () => {
    expect(listView(A, null)).toEqual({ kind: "loading" });
    expect(listView(A, { wallet: A, status: "loading" })).toEqual({ kind: "loading" });
    expect(listView(A, { wallet: A, status: "error", message: "Down" })).toEqual({ kind: "error", message: "Down" });
    expect(listView(A, { wallet: A, status: "ready", rows: [] })).toEqual({ kind: "empty" });
    expect(listView(A, { wallet: A, status: "ready", rows })).toEqual({ kind: "ready", rows });
  });
});
