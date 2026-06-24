import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(resolve(__dirname, "../../app/page.tsx"), "utf8");

describe("homepage copy", () => {
  it("uses the Act 1 data total for the hero pill count instead of stale hardcoded copy", () => {
    const heroLede = pageSource.match(/<p className={styles\.lede}>[\s\S]*?<\/p>/)?.[0] ?? "";

    expect(heroLede).toContain("value={totalPills}");
    expect(heroLede).not.toContain("76_000_000_000");
    expect(heroLede).not.toMatch(/\bcompact\b/);
  });

  it("does not keep the old 76 billion shipment total in homepage narrative copy", () => {
    expect(pageSource).not.toMatch(/76\s+billion/i);
    expect(pageSource).not.toMatch(/76-billion/i);
    expect(pageSource).not.toContain("76_000_000_000");
  });

  it("gives Act 2 an explanatory paragraph, not just the heading", () => {
    const act2Step = pageSource.match(/<Step id="act2">[\s\S]*?<\/Step>/)?.[0] ?? "";

    expect(act2Step).toMatch(/McKesson/i);
    expect(act2Step).toMatch(/Cardinal Health/i);
    expect(act2Step).toMatch(/AmerisourceBergen/i);
    expect(act2Step).toMatch(/everyone else\s+combined/i);
  });
});
