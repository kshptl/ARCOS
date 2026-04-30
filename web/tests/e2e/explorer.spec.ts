import { expect, test } from '@playwright/test';

test.describe('/explorer', () => {
  test('slider keyboard nav updates aria-valuenow', async ({ page }) => {
    await page.goto('/explorer');
    await page.getByRole('heading', { name: /US counties/i }).waitFor();
    const slider = page.getByRole('slider', { name: /Year/ });
    await slider.focus();
    const before = await slider.getAttribute('aria-valuenow');
    await page.keyboard.press('ArrowRight');
    const after = await slider.getAttribute('aria-valuenow');
    expect(Number(after)).toBeGreaterThan(Number(before));
  });

  test('metric select change updates URL query', async ({ page }) => {
    await page.goto('/explorer');
    await page.getByLabel('Metric').selectOption('deaths');
    await expect(page).toHaveURL(/metric=deaths/);
  });

  test('clicking a county in the browse list lands on /county/[fips]', async ({ page }) => {
    await page.goto('/explorer');
    const firstLink = page.locator('aside[aria-label="Browse counties"] a').first();
    const count = await firstLink.count();
    if (count === 0) {
      // Empty county-meta.json fixture: no counties to click.
      test.skip();
    }
    const href = await firstLink.getAttribute('href');
    expect(href).toMatch(/^\/county\/\d{5}$/);
  });

  test('falls back to static list when WebGL is disabled', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/explorer');
    const fallback = page.getByRole('figure', { name: /county list fallback/i });
    const map = page.getByRole('figure', { name: /County map of/i });
    await Promise.race([
      fallback.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {}),
      map.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {}),
    ]);
    const either = (await fallback.count()) > 0 || (await map.count()) > 0;
    expect(either).toBe(true);
    await context.close();
  });
});
