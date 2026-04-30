import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("design tokens", () => {
  const css = readFileSync("styles/tokens.css", "utf8");

  it("declares the Bold Poster palette", () => {
    expect(css).toMatch(/--ink:\s*#1a1a1a/);
    expect(css).toMatch(/--canvas:\s*#f5ecd7/);
    expect(css).toMatch(/--accent-hot:\s*#c23b20/);
    expect(css).toMatch(/--accent-cool:\s*#2a5f7a/);
  });

  it("declares a type scale with a display-96 step", () => {
    expect(css).toMatch(/--type-display-xl:\s*6rem/);
  });

  it("declares tabular-nums variable for numerics", () => {
    expect(css).toMatch(/--numeric:\s*tabular-nums/);
  });

  it("scopes dark mode to [data-theme='dark']", () => {
    expect(css).toMatch(/\[data-theme=['"]dark['"]\]/);
  });
});
