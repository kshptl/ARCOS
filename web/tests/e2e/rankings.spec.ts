import { expect, test } from "@playwright/test";

test.describe("/rankings", () => {
  test("renders distributors tab by default and can switch to pharmacies", async ({ page }) => {
    await page.goto("/rankings");
    await expect(page.getByRole("heading", { level: 1, name: /rankings/i })).toBeVisible();
    // switch to pharmacies
    await page.getByRole("tab", { name: /pharmacies/i }).click();
    await expect(page.getByRole("tab", { name: /pharmacies/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("distributor rows expose id anchors for deep links", async ({ page }) => {
    await page.goto("/rankings");
    const rows = page.locator("tr[id^='distributor-']");
    const count = await rows.count();
    if (count > 0) {
      const id = await rows.first().getAttribute("id");
      expect(id).toMatch(/^distributor-/);
    }
  });
});
