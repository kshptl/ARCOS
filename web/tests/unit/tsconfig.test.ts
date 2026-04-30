import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("tsconfig", () => {
  it("enforces strict + noUncheckedIndexedAccess", () => {
    const tsconfig = JSON.parse(readFileSync("tsconfig.json", "utf8"));
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.noUncheckedIndexedAccess).toBe(true);
  });
});
