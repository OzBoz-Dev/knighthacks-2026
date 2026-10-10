import { describe, expect, it } from "vitest";
import { isDevFixtureMode, loadDevFixtures } from "./dev-mode";
import { describeProvenance } from "./provenance";

describe("isDevFixtureMode", () => {
  it("requires both development mode and the explicit flag", () => {
    expect(isDevFixtureMode({ nodeEnv: "development", flag: "1" })).toBe(true);
    expect(isDevFixtureMode({ nodeEnv: "development", flag: undefined })).toBe(false);
    expect(isDevFixtureMode({ nodeEnv: "development", flag: "true" })).toBe(false);
    expect(isDevFixtureMode({ nodeEnv: "production", flag: "1" })).toBe(false);
    expect(isDevFixtureMode({ nodeEnv: "test", flag: "1" })).toBe(false);
  });
});

describe("loadDevFixtures", () => {
  it("does not load samples in production even when flagged", async () => {
    await expect(loadDevFixtures({ nodeEnv: "production", flag: "1" })).resolves.toBeNull();
  });

  it("loads clearly labelled samples in development", async () => {
    const fixtures = await loadDevFixtures({ nodeEnv: "development", flag: "1" });
    expect(fixtures).not.toBeNull();
    expect(fixtures!.sampleOffers.length).toBeGreaterThan(0);
    expect(fixtures!.sampleOffers.every((offer) => offer.id.startsWith("sample-"))).toBe(true);
    expect(describeProvenance(fixtures!.SAMPLE_PROVENANCE).kind).toBe("sample");
  });
});
