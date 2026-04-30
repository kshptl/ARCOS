import { describe, expect, it } from "vitest";
import robots from "@/app/robots";

describe("robots", () => {
  it("allows all crawlers and points to sitemap", () => {
    const r = robots();
    expect(r.rules).toEqual([{ userAgent: "*", allow: "/" }]);
    expect(String(r.sitemap)).toContain("/sitemap.xml");
  });
});
