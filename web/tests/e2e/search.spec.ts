import { expect, test } from "@playwright/test";

test("typing Mingo, pressing Enter, lands on /county/54059", async ({ page }) => {
  await page.goto("/");
  const combobox = page.getByRole("combobox");
  await combobox.click();
  await combobox.fill("Mingo");
  await expect(page.getByText("Mingo County")).toBeVisible();
  await combobox.press("ArrowDown");
  await combobox.press("Enter");
  await expect(page).toHaveURL(/\/county\/54059$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Mingo County/);
});
