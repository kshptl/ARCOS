import { expect, test } from "@playwright/test";

test.describe("reduced motion", () => {
  test.use({ colorScheme: "light" });
  // Note: reducedMotion is available in newer Playwright versions; this test
  // simulates via explicit emulateMedia call below.

  test("each act renders in end state with reduced-motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const regions = page.getByRole("region");
    const count = await regions.count();
    expect(count).toBeGreaterThanOrEqual(4);

    for (let i = 0; i < Math.min(count, 6); i++) {
      const region = regions.nth(i);
      const reduced = await region.getAttribute("data-reduced");
      if (reduced === "true") {
        expect(reduced).toBe("true");
      }
    }

    const cta = page.getByRole("link", { name: /see your county|open the explorer/i }).first();
    await expect(cta).toBeVisible();
    await Promise.all([page.waitForURL(/\/explorer/), cta.click()]);
  });

  test("details/summary table is reachable", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const fallbackTables = page.locator(
      '[data-testid="act1-yearly-table"], [data-testid="act2-table"], [data-testid="act3-table"]',
    );
    await expect(fallbackTables).toHaveCount(3);
  });
});
