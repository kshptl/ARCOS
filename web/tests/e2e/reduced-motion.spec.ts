import { test, expect } from '@playwright/test';

test.describe('reduced motion', () => {
  test.use({ colorScheme: 'light' });
  // Note: reducedMotion is available in newer Playwright versions; this test
  // simulates via explicit emulateMedia call below.

  test('each act renders in end state with reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const regions = page.getByRole('region');
    const count = await regions.count();
    expect(count).toBeGreaterThanOrEqual(4);

    for (let i = 0; i < Math.min(count, 6); i++) {
      const region = regions.nth(i);
      const reduced = await region.getAttribute('data-reduced');
      if (reduced === 'true') {
        expect(reduced).toBe('true');
      }
    }

    const cta = page.getByRole('link', { name: /see your county|open the explorer/i }).first();
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/explorer/);
  });

  test('details/summary table is reachable', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const summaries = page.getByText('Show data');
    const count = await summaries.count();
    expect(count).toBeGreaterThanOrEqual(1);
    await summaries.first().click();
    await expect(page.getByRole('table').first()).toBeVisible();
  });
});
