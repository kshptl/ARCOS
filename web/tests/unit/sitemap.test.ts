import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data/loadCountyMeta", () => ({
  loadAllFips: vi.fn(async () => ["54059", "51097"]),
}));

import sitemap from "@/app/sitemap";

describe("sitemap", () => {
  it("includes all static routes and one url per county", async () => {
    const urls = await sitemap();
    const paths = urls.map((u) => new URL(u.url).pathname);
    expect(paths).toContain("/");
    expect(paths).toContain("/explorer");
    expect(paths).toContain("/rankings");
    expect(paths).toContain("/methodology");
    expect(paths).toContain("/about");
    expect(paths).toContain("/county/54059");
    expect(paths).toContain("/county/51097");
  });

  it("uses NEXT_PUBLIC_SITE_ORIGIN when set", async () => {
    process.env.NEXT_PUBLIC_SITE_ORIGIN = "https://staging.openarcos.org";
    const urls = await sitemap();
    process.env.NEXT_PUBLIC_SITE_ORIGIN = undefined;
    expect(urls[0]?.url.startsWith("https://staging.openarcos.org")).toBe(true);
  });
});
