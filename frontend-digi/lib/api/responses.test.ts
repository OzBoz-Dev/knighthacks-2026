import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const blocks = [...read("../../../prd.md").matchAll(/```ts\n([\s\S]*?)\n```/g)].map((m) => m[1].trim());

describe("API type files", () => {
  it("keep the domain types equal to the first prd.md section 8 block", () => {
    const domain = read("./types.ts").replace(/\nexport type \* from "\.\/responses";\n?$/, "").trim();
    expect(domain).toBe(blocks[0]);
  });

  it("keep the wire formats equal to the API response contract block", () => {
    const wire = read("./responses.ts").split('from "./types";\n')[1].trim();
    expect(wire).toBe(blocks[1]);
  });
});
