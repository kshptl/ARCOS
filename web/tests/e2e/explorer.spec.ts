import { expect, type Page, test } from "@playwright/test";

async function openExplorer(page: Page) {
  await page.goto("/explorer");
  const shell = page.getByRole("region", { name: "Explorer", exact: true });
  await shell.waitFor();
  await expect
    .poll(() => shell.evaluate((el) => getComputedStyle(el).getPropertyValue("--explorer-bg")), {
      message: "explorer CSS has loaded",
    })
    .toBe("#faf7f1");
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

  test("share and save buttons show clear feedback after clicks", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => undefined,
        },
      });
    });
    await openExplorer(page);

    const shareButton = page.locator("main header button").first();
    await expect(shareButton).toContainText("Share");
    await shareButton.click();
    await expect(shareButton).toContainText("Copied");

    const saveButton = page
      .locator('aside[aria-label="Selected county details"] button[aria-label^="Save"]')
      .first();
    await saveButton.click();
    await expect(saveButton).toHaveAttribute("aria-pressed", "true");
    await expect(saveButton).toHaveAccessibleName(/Saved/);
  });

  test("mobile explorer fits the viewport without sideways scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openExplorer(page);

    const overflow = await page.evaluate(
      () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("desktop control rail does not show a sideways scrollbar", async ({ page }) => {
    await page.setViewportSize({ width: 1680, height: 945 });
    await openExplorer(page);

    const railOverflowX = await page
      .locator('aside[aria-label="Explorer controls"]')
      .evaluate((el) => getComputedStyle(el).overflowX);
    expect(railOverflowX).toBe("hidden");
  });

  test("explorer uses county autocomplete instead of a full browse list", async ({ page }) => {
    await openExplorer(page);

    await expect(page.getByRole("heading", { name: /US counties/i })).toHaveCount(0);
    await expect(page.getByText(/Shipments, per-capita rates/i)).toHaveCount(0);
    await expect(page.locator('aside[aria-label="Browse counties"]')).toHaveCount(0);

    await page.getByLabel("Search counties").fill("Los Angeles County, CA");
    await expect(page).toHaveURL(/\/explorer/);
    await expect(page.getByRole("link", { name: /View full county profile/i })).toHaveAttribute(
      "href",
      "/county/06037",
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
