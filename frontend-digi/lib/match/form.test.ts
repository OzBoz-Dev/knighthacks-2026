import { describe, expect, it } from "vitest";
import { buildMatchRequest, DEMO_PRESET, formMatchesRequest, INITIAL_MATCH_VALUES } from "./form";

const valid = { ...INITIAL_MATCH_VALUES, minVram: 24, maxPrice: 2 };

describe("DEMO_PRESET", () => {
  it("fills 24 GB, $2/hour, 95% reliability, and Balanced with no optional filters", () => {
    expect(buildMatchRequest(DEMO_PRESET).request).toEqual({ min_vram_gb: 24, max_price_per_hour: 2, min_reliability: 0.95, priority: "balanced" });
  });

  it("leaves every value editable after the preset", () => {
    expect(buildMatchRequest({ ...DEMO_PRESET, maxPrice: 1.5, priority: "cheapest" }).request).toMatchObject({ max_price_per_hour: 1.5, priority: "cheapest" });
  });
});

describe("formMatchesRequest", () => {
  it("is true only while the form still builds the submitted request", () => {
    const submitted = buildMatchRequest(valid).request!;
    expect(formMatchesRequest(valid, submitted)).toBe(true);
    expect(formMatchesRequest({ ...valid, maxPrice: 3 }, submitted)).toBe(false);
    expect(formMatchesRequest({ ...valid, region: "US" }, submitted)).toBe(false);
    expect(formMatchesRequest({ ...valid, maxPrice: "" }, submitted)).toBe(false);
  });
});

describe("buildMatchRequest", () => {
  it("builds a MatchRequest and sends 95% reliability as the ratio 0.95", () => {
    expect(buildMatchRequest(valid)).toEqual({
      errors: null,
      request: { min_vram_gb: 24, max_price_per_hour: 2, min_reliability: 0.95, priority: "balanced" },
    });
  });

  it("starts with 95% reliability and Balanced priority", () => {
    expect(INITIAL_MATCH_VALUES.minReliability).toBe(95);
    expect(INITIAL_MATCH_VALUES.priority).toBe("balanced");
  });

  it("blocks empty and negative numbers with a field error", () => {
    const empty = buildMatchRequest(INITIAL_MATCH_VALUES);
    expect(empty.request).toBeNull();
    expect(Object.keys(empty.errors!)).toEqual(["minVram", "maxPrice"]);
    expect(buildMatchRequest({ ...valid, minVram: -1 }).errors?.minVram).toMatch(/negative/);
    expect(buildMatchRequest({ ...valid, maxPrice: 0 }).errors?.maxPrice).toMatch(/more than/);
    expect(buildMatchRequest({ ...valid, maxPrice: -2 }).errors?.maxPrice).toMatch(/more than/);
    expect(buildMatchRequest({ ...valid, minReliability: 101 }).errors?.minReliability).toBeDefined();
    expect(buildMatchRequest({ ...valid, minReliability: "" }).errors?.minReliability).toBeDefined();
    expect(buildMatchRequest({ ...valid, maxPrice: "1." }).errors?.maxPrice).toBeDefined();
  });

  it("keeps zero VRAM distinct from an empty field", () => {
    expect(buildMatchRequest({ ...valid, minVram: 0 }).request?.min_vram_gb).toBe(0);
  });

  it("omits unused optional filters and removes repeated GPU names", () => {
    expect(buildMatchRequest(valid).request).not.toHaveProperty("gpu_names");
    expect(buildMatchRequest(valid).request).not.toHaveProperty("region");
    const request = buildMatchRequest({ ...valid, gpuNames: ["RTX 4090", "RTX 4090", "L40S"], region: "US", priority: "cheapest" }).request;
    expect(request).toMatchObject({ gpu_names: ["RTX 4090", "L40S"], region: "US", priority: "cheapest" });
  });

  it("converts a fractional percentage without a float error", () => {
    expect(buildMatchRequest({ ...valid, minReliability: 99.2 }).request?.min_reliability).toBe(0.992);
  });
});

describe("VRAM validation wording", () => {
  it("asks for VRAM per GPU and still sends min_vram_gb with the same number", () => {
    expect(buildMatchRequest({ ...DEMO_PRESET, minVram: "" }).errors?.minVram).toBe("Enter the minimum VRAM per GPU in GB.");
    expect(buildMatchRequest({ ...DEMO_PRESET, minVram: 40 }).request?.min_vram_gb).toBe(40);
  });
});
