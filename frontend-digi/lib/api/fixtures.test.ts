import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeMarketSummary, decodeOffer, decodeOffersEnvelope, decodeSummaryEnvelope, decodeTrendPoint, decodeTrendsEnvelope, list, record, text, timestamp } from "./decode";
import { decodeMatchResponse } from "./match";
import { decodeConfirmResult, decodeCreatedReservation, decodeReservationList, decodeVerifyResult } from "./reservations";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Each shared contract fixture goes through the frontend decoders, so a fixture and a type cannot drift apart.
const DIR = new URL("../../../fixtures/", import.meta.url);
const read = (name: string): any => JSON.parse(readFileSync(new URL(name, DIR), "utf8"));
const offers = read("offers.json");
const summary = read("market_summary.json");
const trends = read("market_trends.json");
const match = read("match.json");
const reservations = read("reservations.json");
const gold = read("databricks_market.json");

const decodeExport = (data: unknown) => {
  const e = record(data, "export");
  return {
    exported_at: timestamp(e.exported_at, "exported_at"),
    summaries: list(e.summaries, "summaries").map((s, i) => decodeMarketSummary(s, `summaries[${i}]`)),
    trends: list(e.trends, "trends").map((t, i) => {
      const row = record(t, `trends[${i}]`);
      return { gpu_name: text(row.gpu_name, `trends[${i}].gpu_name`), region: text(row.region, `trends[${i}].region`), ...decodeTrendPoint(t, `trends[${i}]`) };
    }),
  };
};

// [name, the object to check, the decoder]. A rename test changes one key of each object.
const CASES: [string, () => any, (value: any) => unknown][] = [
  ["offers.json data[0]", () => offers.data[0], (v) => decodeOffer(v)],
  ["market_summary.json data", () => summary.data, (v) => decodeMarketSummary(v)],
  ["market_trends.json data[0]", () => trends.data[0], (v) => decodeTrendPoint(v)],
  ["match.json response", () => match.response, decodeMatchResponse],
  ["reservations.json create.response", () => reservations.create.response, (v) => decodeCreatedReservation(v, reservations.create.request)],
  ["reservations.json list.response", () => reservations.list.response, (v) => decodeReservationList(v, reservations.list.request.wallet)],
  ["reservations.json confirm.response", () => reservations.confirm.response, (v) => decodeConfirmResult(v, reservations.confirm.response.id, reservations.confirm.request.signature)],
  ["reservations.json verify.response", () => reservations.verify.response, (v) => decodeVerifyResult(v, reservations.verify.response.reservation_id)],
  ["databricks_market.json", () => gold, decodeExport],
];

// Renames the first key of the object, or of the first item of a list.
function renameFirstKey(value: any): any {
  const copy = structuredClone(value);
  const target = Array.isArray(copy) ? copy[0] : copy;
  const [key] = Object.keys(target);
  target[`${key}_renamed`] = target[key];
  delete target[key];
  return copy;
}

describe("shared contract fixtures", () => {
  it("has a test case for each fixture file", () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();
    const covered = [...new Set(CASES.map(([name]) => name.split(" ")[0]))].sort();
    expect(covered).toEqual(files);
  });

  it.each(CASES)("decodes %s", (_name, value, decode) => {
    expect(() => decode(value())).not.toThrow();
  });

  it.each(CASES)("fails when one field of %s changes name", (_name, value, decode) => {
    expect(() => decode(renameFirstKey(value()))).toThrow();
  });

  it("keeps the dev-sample envelopes labelled as samples, so the API decoders refuse them", () => {
    for (const fixture of [offers, summary, trends]) expect(fixture.source).toBe("dev-sample");
    expect(() => decodeOffersEnvelope(offers)).toThrow(/source/);
    expect(() => decodeSummaryEnvelope(summary)).toThrow(/source/);
    expect(() => decodeTrendsEnvelope(trends)).toThrow(/source/);
  });

  it("decodes every offer, summary, and trend point of the sample envelopes", () => {
    expect(offers.data.map((o: unknown, i: number) => decodeOffer(o, `data[${i}]`))).toHaveLength(offers.data.length);
    expect(trends.data.map((p: unknown, i: number) => decodeTrendPoint(p, `data[${i}]`))).toHaveLength(trends.data.length);
  });

  it("keeps the export time and the source of the real gold export", () => {
    expect(gold.source).toBe("databricks-export");
    expect(decodeExport(gold).exported_at).toBe(gold.exported_at);
  });
});
