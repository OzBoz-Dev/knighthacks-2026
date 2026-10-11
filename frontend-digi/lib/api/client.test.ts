import { describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest, buildApiUrl, describeApiError, getApiBaseUrl } from "./client";

const BASE = "http://localhost:8000";

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

const expectApiError = async (promise: Promise<unknown>, kind: ApiError["kind"]) => {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).kind).toBe(kind);
  return error as ApiError;
};

describe("getApiBaseUrl", () => {
  it("strips trailing slashes", () => {
    expect(getApiBaseUrl("http://localhost:8000///")).toBe(BASE);
  });

  it("rejects missing or blank configuration", () => {
    for (const raw of [undefined, "", "   "]) {
      expect(() => getApiBaseUrl(raw)).toThrow(ApiError);
    }
  });

  it("rejects invalid or non-http URLs", () => {
    expect(() => getApiBaseUrl("not a url")).toThrow(ApiError);
    expect(() => getApiBaseUrl("ftp://example.com")).toThrow(ApiError);
  });
});

describe("buildApiUrl", () => {
  it("joins base and path regardless of slashes", () => {
    expect(buildApiUrl(`${BASE}/`, "/api/offers")).toBe(`${BASE}/api/offers`);
    expect(buildApiUrl(BASE, "api/offers")).toBe(`${BASE}/api/offers`);
  });

  it("encodes query values and skips empty ones", () => {
    const url = buildApiUrl(BASE, "/api/market/trends", {
      gpu_name: "RTX 4090 & A100",
      region: undefined,
      wallet: null,
      verified: true,
      limit: 5,
      gpu: ["a b", "c"],
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("gpu_name")).toBe("RTX 4090 & A100");
    expect(parsed.searchParams.has("region")).toBe(false);
    expect(parsed.searchParams.has("wallet")).toBe(false);
    expect(parsed.searchParams.get("verified")).toBe("true");
    expect(parsed.searchParams.get("limit")).toBe("5");
    expect(parsed.searchParams.getAll("gpu")).toEqual(["a b", "c"]);
  });
});

describe("apiRequest", () => {
  it("returns parsed JSON as unknown without a decoder", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true }));
    await expect(apiRequest("/api/health", { baseUrl: BASE, fetchImpl })).resolves.toEqual({
      ok: true,
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/health`);
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });

  it("sends JSON bodies with a content type and passes the abort signal", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: "r1" }));
    const controller = new AbortController();
    await apiRequest("/api/match", {
      method: "POST",
      body: { min_vram_gb: 24 },
      baseUrl: BASE,
      fetchImpl,
      signal: controller.signal,
    });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ min_vram_gb: 24 }));
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(init.signal).toBe(controller.signal);
  });

  it("applies the decoder to produce typed results", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ count: 3 }));
    const result = await apiRequest("/api/x", {
      baseUrl: BASE,
      fetchImpl,
      decode: (data: unknown) => (data as { count: number }).count * 2,
    });
    expect(result).toBe(6);
  });

  it("wraps decoder failures as invalid responses", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    await expectApiError(
      apiRequest("/api/x", {
        baseUrl: BASE,
        fetchImpl,
        decode: () => {
          throw new Error("bad shape");
        },
      }),
      "invalid_response",
    );
  });

  it("reports non-2xx responses as HTTP errors without exposing the body", async () => {
    const fetchImpl = vi.fn(async () => new Response("secret stack trace", { status: 503 }));
    const error = await expectApiError(apiRequest("/api/x", { baseUrl: BASE, fetchImpl }), "http");
    expect(error.status).toBe(503);
    expect(error.message).not.toContain("secret");
  });

  it("reads the API error code and its user-facing message", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: { code: "upstream_unavailable", message: "No offers are available now. Try again in a minute." } }, 503));
    const error = await expectApiError(apiRequest("/api/offers", { baseUrl: BASE, fetchImpl }), "http");
    expect(error.status).toBe(503);
    expect(error.code).toBe("upstream_unavailable");
    expect(error.message).toBe("No offers are available now. Try again in a minute.");
  });

  it("ignores an error body with an unknown code, no message, or a very long message", async () => {
    for (const body of [
      { error: { code: "teapot", message: "Short." } },
      { error: { code: "internal", message: "  " } },
      { error: { code: "internal", message: "x".repeat(400) } },
      { message: "not the agreed shape" },
    ]) {
      const error = await expectApiError(apiRequest("/api/x", { baseUrl: BASE, fetchImpl: vi.fn(async () => jsonResponse(body, 500)) }), "http");
      expect(error.code).toBeUndefined();
      expect(error.message).toBe("The solGPU API responded with status 500.");
    }
  });

  it("reports malformed JSON as an invalid response", async () => {
    const fetchImpl = vi.fn(async () => new Response("{not json", { status: 200 }));
    await expectApiError(apiRequest("/api/x", { baseUrl: BASE, fetchImpl }), "invalid_response");
  });

  it("reports network failures and does not retry", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expectApiError(
      apiRequest("/api/match", { method: "POST", body: {}, baseUrl: BASE, fetchImpl }),
      "network",
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("reports cancellation distinctly", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn(async () => {
      throw new DOMException("Aborted", "AbortError");
    });
    await expectApiError(
      apiRequest("/api/x", { baseUrl: BASE, fetchImpl, signal: controller.signal }),
      "aborted",
    );
  });

  it("fails with a configuration error when no base URL is available", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    const fetchImpl = vi.fn();
    await expectApiError(apiRequest("/api/x", { fetchImpl }), "config");
    expect(fetchImpl).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});

describe("describeApiError", () => {
  it("uses safe messages", () => {
    expect(describeApiError(new ApiError("network", "Could not reach the solGPU API."))).toBe(
      "Could not reach the solGPU API.",
    );
    expect(describeApiError(new Error("internal detail"))).toBe(
      "Something went wrong while loading data.",
    );
  });
});
