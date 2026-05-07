import { expect, test } from "@playwright/test";

test.describe("homepage scrolly", () => {
  test("4 acts are reachable by scrolling", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const regions = page.getByRole("region");
    const count = await regions.count();
    expect(count).toBeGreaterThanOrEqual(4);

    for (let i = 0; i < 4; i++) {
      const region = regions.nth(i);
      await region.scrollIntoViewIfNeeded();
      const label = await region.getAttribute("aria-label");
      expect(label).toMatch(/act\s\d/i);
    }
  });

  test("CTA lands at /explorer", async ({ page }) => {
    await page.goto("/");
    const cta = page.getByRole("link", { name: /see your county|open the explorer/i }).first();
    await cta.scrollIntoViewIfNeeded();
    await Promise.all([page.waitForURL(/\/explorer$/), cta.click()]);
  });

  test("scrolly charts keep hidden data tables for screen-reader fallback", async ({ page }) => {
    await page.goto("/");
    const fallbackTables = page.locator(
      '[data-testid="act1-yearly-table"], [data-testid="act2-table"], [data-testid="act3-table"]',
    );
    await expect(fallbackTables).toHaveCount(3);
  });

  test("Act 3 copy cards pin into a readable stack", async ({ page }) => {
    await page.goto("/");
    await page.locator('article[data-step="act3-retreat"]').scrollIntoViewIfNeeded();

    await expect
      .poll(async () => {
        const cards = await page.locator('article[data-step^="act3"]').evaluateAll((articles) =>
          articles.map((article) => {
            const rect = article.getBoundingClientRect();
            return {
              position: getComputedStyle(article).position,
              top: rect.top,
              bottom: rect.bottom,
            };
          }),
        );

        return (
          cards.length === 4 &&
          cards.every((card) => card.position === "sticky") &&
          cards.every((card, index) => index === 0 || card.top >= cards[index - 1]!.bottom - 1)
        );
      })
      .toBe(true);
  });
});
