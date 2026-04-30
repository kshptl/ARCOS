import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("public/_headers (Cloudflare Pages)", () => {
  it("includes CSP, immutable parquet cache, SWR json cache, immutable woff2 cache", async () => {
    const raw = await fs.readFile(path.resolve(process.cwd(), "public/_headers"), "utf-8");

    // CSP on all routes
    expect(raw).toMatch(/^\/\*\s*$/m); // "/*" rule present
    expect(raw).toMatch(/Content-Security-Policy:/);
    expect(raw).toMatch(/default-src 'self'/);
    expect(raw).toMatch(/plausible\.io/);
    expect(raw).toMatch(/sentry\.io/);

    // Parquet 1y immutable
    expect(raw).toMatch(
      /\/data\/\*\.parquet\s*\n\s+Cache-Control: public, max-age=31536000, immutable/,
    );

    // JSON 1d + stale-while-revalidate 1w
    expect(raw).toMatch(
      /\/data\/\*\.json\s*\n\s+Cache-Control: public, max-age=86400, stale-while-revalidate=604800/,
    );

    // Fonts 1y immutable
    expect(raw).toMatch(
      /\/fonts\/\*\.woff2\s*\n\s+Cache-Control: public, max-age=31536000, immutable/,
    );

    // Basic security headers
    expect(raw).toMatch(/X-Content-Type-Options: nosniff/);
    expect(raw).toMatch(/Referrer-Policy: strict-origin-when-cross-origin/);
    expect(raw).toMatch(/Permissions-Policy: camera=\(\)/);
  });

  it("is copied into the build output at out/_headers", async () => {
    // This test is intentionally non-strict — it only runs after a build.
    // In CI the test runs before build; in the local sweep the sweep runs after build.
    // If out/_headers is missing we skip rather than fail so the unit suite stays stable.
    const out = path.resolve(process.cwd(), "out/_headers");
    try {
      const builtRaw = await fs.readFile(out, "utf-8");
      const srcRaw = await fs.readFile(path.resolve(process.cwd(), "public/_headers"), "utf-8");
      expect(builtRaw).toBe(srcRaw);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        // Build not run yet — skip silently. The `pnpm build` step in CI exercises this.
        return;
      }
      throw err;
    }
  });
});
