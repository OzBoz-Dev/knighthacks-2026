import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./client";
import { decodeMatchResponse, getMatchOptions, matchOptionsFrom, postMatch } from "./match";
import type { MatchRequest, Offer } from "./types";

const fixture = JSON.parse(readFileSync(new URL("../../../fixtures/match.json", import.meta.url), "utf8")) as { request: MatchRequest; response: Record<string, unknown> };
const clone = () => structuredClone(fixture.response) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const BASE = "http://localhost:8000";

describe("decodeMatchResponse", () => {
  it("decodes the shared contract fixture", () => {
    const decoded = decodeMatchResponse(fixture.response);
    expect(decoded.checked).toBe(4);
    expect(decoded.recommendations.map((r) => r.rank)).toEqual([1, 2]);
    expect(decoded.recommendations[0].offer.market_position_pct).toBe(-12.5);
    expect(decoded.recommendations[0].explanations).toHaveLength(3);
  });

  it("accepts an empty result with exclusions", () => {
    const body = { ...clone(), eligible: 0, recommendations: [], excluded: { gpu_model: 0, region: 0, vram: 1, reliability: 1, budget: 2 } };
    expect(decodeMatchResponse(body).recommendations).toEqual([]);
  });

  it("rejects a response without recommendations or excluded", () => {
    const noRecs = clone();
    delete noRecs.recommendations;
    expect(() => decodeMatchResponse(noRecs)).toThrow(/recommendations/);
    const noExcluded = clone();
    delete noExcluded.excluded;
    expect(() => decodeMatchResponse(noExcluded)).toThrow(/excluded/);
  });

  it("rejects malformed nested offers and out-of-range values", () => {
    const badReliability = clone();
    badReliability.recommendations[0].offer.reliability = 99.2;
    expect(() => decodeMatchResponse(badReliability)).toThrow(/reliability/);
    const badScore = clone();
    badScore.recommendations[0].score = Number.NaN;
    expect(() => decodeMatchResponse(badScore)).toThrow(/score/);
    const missingId = clone();
    delete missingId.recommendations[1].offer.id;
    expect(() => decodeMatchResponse(missingId)).toThrow(/offer\.id/);
  });

  it("rejects counts and ranks that do not agree", () => {
    const counts = clone();
    counts.checked = 9;
    expect(() => decodeMatchResponse(counts)).toThrow(/add up/);
    const ranks = clone();
    ranks.recommendations[1].rank = 3;
    expect(() => decodeMatchResponse(ranks)).toThrow(/ranks/);
    const repeat = clone();
    repeat.recommendations[1].offer.id = repeat.recommendations[0].offer.id;
    expect(() => decodeMatchResponse(repeat)).toThrow(/repeat/);
  });

  it("orders results by the returned rank, not by any other value", () => {
    const body = clone();
    body.recommendations.reverse();
    expect(decodeMatchResponse(body).recommendations.map((r) => r.offer.id)).toEqual(["10000001", "10000002"]);
  });
});

describe("getMatchOptions", () => {
  const offers = JSON.parse(readFileSync(new URL("../../../fixtures/offers.json", import.meta.url), "utf8")) as { data: Offer[] };
  // The fixture is dev-sample data, so the test gives it a real API source.
  const envelope = (data: unknown[]) => ({ source: "vast-live", captured_at: "2026-10-10T20:00:00Z", snapshot_id: "s1", data });

  it("lists each GPU model and region once, sorted, from the decoded offers", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(envelope(offers.data))));
    const options = await getMatchOptions({ baseUrl: BASE, fetchImpl });
    expect(options.gpuNames).toEqual([...new Set(offers.data.map((o) => o.gpu_name))].sort());
    expect(options.regions).toEqual([...new Set(offers.data.map((o) => o.region))].sort());
  });

  it("leaves out the empty region of an offer with no location", () => {
    expect(matchOptionsFrom([{ ...offers.data[0], region: "" }, offers.data[1]]).regions).toEqual([offers.data[1].region]);
  });

  it("rejects an invalid offers response", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(envelope([{ gpu_name: " " }]))));
    const error = await getMatchOptions({ baseUrl: BASE, fetchImpl }).catch((e: unknown) => e);
    expect((error as ApiError).kind).toBe("invalid_response");
  });
});

describe("postMatch", () => {
  it("posts the request once and returns typed data", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(fixture.response), { status: 200 }));
    const result = await postMatch(fixture.request, { baseUrl: BASE, fetchImpl });
    expect(result.request_id).toBe("req_3f9a1c2e7b4d5a60");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/match`);
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify(fixture.request));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("reports an HTTP error without a retry", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: { code: "upstream_unavailable", message: "x" } }), { status: 503 }));
    const error = await postMatch(fixture.request, { baseUrl: BASE, fetchImpl }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(503);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("reports a malformed body as an invalid response", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ checked: 1 }), { status: 200 }));
    const error = await postMatch(fixture.request, { baseUrl: BASE, fetchImpl }).catch((e: unknown) => e);
    expect((error as ApiError).kind).toBe("invalid_response");
  });
});
