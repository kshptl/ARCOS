import fs from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

async function allFips(): Promise<string[]> {
  const file = path.resolve(process.cwd(), "public/data/county-metadata.json");
  const raw = await fs.readFile(file, "utf-8");
  return (JSON.parse(raw) as Array<{ fips: string }>).map((r) => r.fips);
}

test("a random county page renders full composition", async ({ page }) => {
  const fips = await allFips();
  const pick = fips[Math.floor(Math.random() * fips.length)] ?? "54059";
  await page.goto(`/county/${pick}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/Pills shipped 2006–2014/i)).toBeVisible();
  await expect(page.getByText(/Nationally/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /pills shipped, year by year/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /top distributors/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /top pharmacies/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /similar counties/i })).toBeVisible();
});
