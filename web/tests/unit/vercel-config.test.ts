import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("vercel.json", () => {
  it("includes CSP, immutable parquet cache, SWR json cache", async () => {
    const raw = await fs.readFile(path.resolve(process.cwd(), "vercel.json"), "utf-8");
    const json = JSON.parse(raw) as {
      headers: Array<{
        source: string;
        headers: Array<{ key: string; value: string }>;
      }>;
    };
    const all = json.headers.flatMap((h) => h.headers);
    const csp = all.find((h) => h.key === "Content-Security-Policy");
    expect(csp?.value).toMatch(/default-src 'self'/);
    expect(csp?.value).toMatch(/plausible\.io/);
    expect(csp?.value).toMatch(/sentry\.io/);

    const parquetRule = json.headers.find((h) => h.source.includes("parquet"));
    expect(parquetRule?.headers.find((h) => h.key === "Cache-Control")?.value).toMatch(/immutable/);

    const jsonRule = json.headers.find((h) => h.source.includes("\\.json"));
    expect(jsonRule?.headers.find((h) => h.key === "Cache-Control")?.value).toMatch(
      /stale-while-revalidate/,
    );
  });
});
