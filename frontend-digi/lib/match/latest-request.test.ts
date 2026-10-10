import { describe, expect, it } from "vitest";
import { createLatestRequest } from "./latest-request";

describe("createLatestRequest", () => {
  it("aborts the older request and marks only the newest one current", () => {
    const latest = createLatestRequest();
    const first = latest.start();
    const second = latest.start();
    expect(first.signal.aborted).toBe(true);
    expect(first.isCurrent()).toBe(false);
    expect(second.signal.aborted).toBe(false);
    expect(second.isCurrent()).toBe(true);
  });

  it("cancels the current request on unmount", () => {
    const latest = createLatestRequest();
    const only = latest.start();
    latest.cancel();
    expect(only.signal.aborted).toBe(true);
    expect(only.isCurrent()).toBe(false);
  });
});
