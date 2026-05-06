import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(resolve(__dirname, "../../app/page.tsx"), "utf8");

describe("homepage copy", () => {
  it("spells out the hero pill count instead of using compact 76B text", () => {
    const heroLede = pageSource.match(/<p className={styles\.lede}>[\s\S]*?<\/p>/)?.[0] ?? "";

    expect(heroLede).toContain("value={76_000_000_000}");
    expect(heroLede).not.toMatch(/\bcompact\b/);
  });

  it("gives Act 2 an explanatory paragraph, not just the heading", () => {
    const act2Step = pageSource.match(/<Step id="act2">[\s\S]*?<\/Step>/)?.[0] ?? "";

    expect(act2Step).toMatch(/McKesson/i);
    expect(act2Step).toMatch(/Cardinal Health/i);
    expect(act2Step).toMatch(/AmerisourceBergen/i);
    expect(act2Step).toMatch(/everyone else\s+combined/i);
  });
});
