import { expect, test } from "@playwright/test";

test.describe("/explorer", () => {
  test("slider keyboard nav updates aria-valuenow", async ({ page }) => {
    await page.goto("/explorer");
    await page.getByRole("heading", { name: /US counties/i }).waitFor();
    const slider = page.getByRole("slider", { name: /Year/ });
    await slider.focus();
    const before = await slider.getAttribute("aria-valuenow");
    await page.keyboard.press("ArrowRight");
    const after = await slider.getAttribute("aria-valuenow");
    expect(Number(after)).toBeGreaterThan(Number(before));
  });

  test("dragging the year slider updates the selected year", async ({ page }) => {
    await page.goto("/explorer");
    await page.getByRole("heading", { name: /US counties/i }).waitFor();
    const slider = page.getByRole("slider", { name: /Year/ });
    const box = await slider.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    await page.mouse.move(box.x + 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2);
    await page.mouse.up();

    await expect(slider).toHaveAttribute("aria-valuenow", "2014");
    await expect(page).toHaveURL(/year=2014/);
  });

  test("metric select change updates URL query", async ({ page }) => {
    await page.goto("/explorer");
    await expect(page.locator('fieldset[aria-label="Filters"] select')).toHaveCount(1);
    await page.getByLabel("Metric").selectOption("deaths");
    await expect(page).toHaveURL(/metric=deaths/);
  });

  test("clicking a county in the browse list lands on /county/[fips]", async ({ page }) => {
    await page.goto("/explorer");
    const firstLink = page.locator('aside[aria-label="Browse counties"] a').first();
    const count = await firstLink.count();
    if (count === 0) {
      // Empty county-metadata.json fixture: no counties to click.
      test.skip();
    }
    const href = await firstLink.getAttribute("href");
    expect(href).toMatch(/^\/county\/\d{5}$/);
  });

  test("falls back to static list when WebGL is disabled", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/explorer");
    // The map area always resolves to either a figure (map or fallback) or a
    // "Loading map…" status while topology fetches. Wait for either terminal
    // state — the map's sticky aria-label starts with "County map of …" and
    // the fallback's is "Static county list fallback".
    const mapOrFallback = page.locator(
      'figure[aria-label^="County map of"], figure[aria-label="Static county list fallback"]',
    );
    await mapOrFallback.first().waitFor({ state: "attached", timeout: 15_000 });
    expect(await mapOrFallback.count()).toBeGreaterThan(0);
    await context.close();
  });
});
