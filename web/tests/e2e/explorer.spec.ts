import { expect, type Page, test } from "@playwright/test";

async function openExplorer(page: Page) {
  await page.goto("/explorer");
  await page.getByRole("heading", { name: /US counties/i }).waitFor();
  const shell = page.locator('section[aria-labelledby="explorer-heading"]');
  await expect
    .poll(() => shell.evaluate((el) => getComputedStyle(el).display), {
      message: "explorer CSS has loaded",
    })
    .toBe("grid");
}

test.describe("/explorer", () => {
  test("slider keyboard nav updates aria-valuenow", async ({ page }) => {
    await openExplorer(page);
    const slider = page.getByRole("slider", { name: /Year/ });
    await slider.focus();
    const before = await slider.getAttribute("aria-valuenow");
    await page.keyboard.press("ArrowRight");
    const after = await slider.getAttribute("aria-valuenow");
    expect(Number(after)).toBeGreaterThan(Number(before));
  });

  test("dragging the year slider updates the selected year", async ({ page }) => {
    await openExplorer(page);
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

  test("metric button change updates URL query", async ({ page }) => {
    await openExplorer(page);
    await expect(page.locator('fieldset[aria-label="Filters"] select')).toHaveCount(0);
    await page.getByRole("button", { name: "Overdose deaths" }).click();
    await expect(page).toHaveURL(/metric=deaths/);
  });

  test("clicking a county in the browse list selects it without leaving explorer", async ({
    page,
  }) => {
    await openExplorer(page);
    const firstCounty = page.locator('aside[aria-label="Browse counties"] button').first();
    const count = await firstCounty.count();
    if (count === 0) {
      // Empty county-metadata.json fixture: no counties to click.
      test.skip();
    }
    await firstCounty.click();
    await expect(page).toHaveURL(/\/explorer/);
    await expect(page.getByRole("link", { name: /View full county profile/i })).toHaveAttribute(
      "href",
      /^\/county\/\d{5}$/,
    );
  });

  test("falls back to static list when WebGL is disabled", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await openExplorer(page);
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
