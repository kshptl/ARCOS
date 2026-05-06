import { expect, test } from "@playwright/test";

test("typing Mingo, pressing Enter, lands on /county/54059", async ({ page }) => {
  await page.goto("/");
  const combobox = page.getByRole("combobox");
  await combobox.click();
  await combobox.fill("Mingo");
  const mingoOption = page.getByRole("option", { name: /Mingo County/i });
  await expect(mingoOption).toBeVisible();
  await combobox.press("ArrowDown");
  await expect(mingoOption).toHaveAttribute("aria-selected", "true");
  await Promise.all([page.waitForURL(/\/county\/54059$/), combobox.press("Enter")]);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Mingo County/);
});
