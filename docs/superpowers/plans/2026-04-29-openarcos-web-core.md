# openarcos Web Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Next.js static site at `/web` with the Bold Poster design system, schema-validated data loaders, MiniSearch-backed search, and the non-interactive-heavy routes — `/methodology`, `/about`, `/rankings`, and all ~3,100 `/county/[fips]` pages. Leaves `/` and `/explorer` as stubs that Plan 3 replaces.

**Architecture:** Next.js 15 App Router in `output: 'export'` mode. Every route is statically generated at build time. Parquet reads use `hyparquet`'s Node export at build (the same library Plan 3 uses in the browser — one Parquet codebase end-to-end). JSON schemas in `/pipeline/schemas/` are the only interface between this package and the pipeline; `scripts/validate-data.ts` enforces the contract on every build. Observable Plot renders non-interactive charts. Vitest + React Testing Library for units; Playwright for E2E smokes.

**Tech Stack:** `next@15`, `react@19`, `typescript@5.5`, `@biomejs/biome@2`, `hyparquet@1.25`, `minisearch@7.2`, `@observablehq/plot@0.6`, `d3@7`, `ajv@8`, `vitest@4`, `@testing-library/react@16`, `@playwright/test@1.48`, `@lhci/cli@0.14`.

---

## File Structure

```
/web
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json                        # strict
├── next.config.mjs                      # output:'export', images.unoptimized:true
├── biome.json
├── vitest.config.ts
├── playwright.config.ts
├── .lighthouserc.json
├── vercel.json                          # CSP + cache-control headers
├── .gitignore
├── README.md
├── app/
│   ├── layout.tsx
│   ├── globals.css                      # re-exports styles/
│   ├── page.tsx                         # stub (Plan 3 replaces)
│   ├── explorer/page.tsx                # stub (Plan 3 replaces)
│   ├── methodology/page.tsx
│   ├── about/page.tsx
│   ├── rankings/page.tsx
│   ├── county/[fips]/page.tsx
│   ├── not-found.tsx
│   ├── sitemap.ts
│   └── robots.ts
├── components/
│   ├── ui/                              # Typography, Button, Pill, Tooltip
│   ├── brand/                           # BigNumeral, Accent
│   ├── charts/                          # TimeSeries, Bar, Sparkline, Slope
│   ├── search/                          # SearchBox, useSearchIndex
│   ├── county/                          # Hero, RankCallouts, CountyTimeSeries, TopDistributors, TopPharmacies, SimilarCounties
│   └── layout/                          # Header, Footer, MethodologyFooter
├── lib/
│   ├── data/
│   │   ├── schemas.ts                   # TS types mirroring /pipeline/schemas
│   │   ├── parquet.ts                   # hyparquet wrapper (Node + browser)
│   │   ├── loadCountyMeta.ts
│   │   ├── loadCounty.ts
│   │   ├── loadTimeseries.ts
│   │   ├── loadDistributors.ts
│   │   └── loadPharmacies.ts
│   ├── geo/
│   │   ├── fips.ts                      # mirror of pipeline/fips.py
│   │   └── similar.ts                   # similar-counties index (build-time)
│   └── format/{number,date,percent}.ts
├── public/
│   ├── data/                            # pipeline-emitted artifacts (committed)
│   ├── fonts/                           # Space Grotesk + Inter (self-hosted)
│   └── og/default.png
├── scripts/
│   ├── validate-data.ts                 # prebuild + CI gate
│   └── build-similar-counties.ts        # offline index build
├── styles/
│   ├── tokens.css                       # Bold Poster palette + type scale
│   └── globals.css
└── tests/
    ├── unit/…                           # vitest + @testing-library/react
    ├── fixtures/                        # committed sample data
    └── e2e/{home,methodology,rankings,county}.spec.ts
```

**Root-level touches** (adds to what Plan 1 already committed):
- `.github/workflows/ci.yml` — gains a `web` job parallel to `pipeline`
- `.gitattributes` — `*.woff2 binary` (already handled by Plan 1 for `*.parquet`)

---

## Phase 1 — Scaffold (tasks 1–8)

### Task 1: Initialize the web package

**Files:**
- Create: `web/package.json`
- Create: `web/.npmrc`
- Create: `web/.gitignore`
- Create: `web/README.md`

- [ ] **Step 1: Create the package directory**

```bash
mkdir -p web
cd web
```

- [ ] **Step 2: Initialize with pnpm**

```bash
pnpm init
```

- [ ] **Step 3: Overwrite `web/package.json`**

```json
{
  "name": "openarcos-web",
  "version": "0.1.0",
  "private": true,
  "description": "openarcos.org static site — journalist-grade analysis of ARCOS pill distribution",
  "engines": {
    "node": ">=20.10.0"
  },
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "biome check .",
    "format": "biome format --write .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "e2e:ui": "playwright test --ui",
    "validate-data": "tsx scripts/validate-data.ts",
    "build-similar": "tsx scripts/build-similar-counties.ts",
    "prebuild": "pnpm validate-data",
    "lhci": "lhci autorun"
  }
}
```

- [ ] **Step 4: Create `web/.npmrc` pinning strict install behavior**

```
engine-strict=true
auto-install-peers=true
strict-peer-dependencies=false
```

- [ ] **Step 5: Create `web/.gitignore`**

```
# deps
node_modules/
.pnpm-store/

# next
.next/
out/
*.tsbuildinfo
next-env.d.ts

# test artifacts
coverage/
playwright-report/
test-results/
.lighthouseci/

# env
.env
.env.local
.env.*.local

# editor
.vscode/
.idea/
```

- [ ] **Step 6: Create a one-liner `web/README.md`**

```markdown
# openarcos-web

See `docs/superpowers/plans/2026-04-29-openarcos-web-core.md` for the plan
and `docs/superpowers/specs/2026-04-27-openarcos-design.md` for the design.

## Quickstart

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # validates data + SSG export
pnpm test       # vitest
pnpm e2e        # playwright
```
```

- [ ] **Step 7: Commit**

```bash
git add web/package.json web/.npmrc web/.gitignore web/README.md
git commit -m "web: initialize pnpm package scaffolding"
```

---

### Task 2: Install Next.js + React + TypeScript

**Files:**
- Modify: `web/package.json` (via pnpm add)
- Create: `web/pnpm-lock.yaml`
- Create: `web/tsconfig.json`
- Create: `web/next.config.mjs`
- Create: `web/next-env.d.ts` (autogenerated; committed so CI doesn't mint dirty diffs)

- [ ] **Step 1: Install runtime deps**

```bash
cd web
pnpm add next@15 react@19 react-dom@19
pnpm add -D typescript@~5.5 @types/node @types/react @types/react-dom
```

- [ ] **Step 2: Create `web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", ".next", "out"]
}
```

- [ ] **Step 3: Create `web/next.config.mjs`**

```javascript
// @ts-check
/** @type {import('next').NextConfig} */
const config = {
  output: "export",
  images: {
    unoptimized: true, // required for static export
  },
  trailingSlash: false,
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    typedRoutes: true,
  },
};

export default config;
```

- [ ] **Step 4: Create a minimal `app/layout.tsx` and `app/page.tsx` so `next build` can verify**

```tsx
// web/app/layout.tsx
import type { ReactNode } from "react";

export const metadata = {
  title: "openarcos",
  description: "Analysis of ARCOS prescription opioid distribution data.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

```tsx
// web/app/page.tsx
export default function HomePage() {
  return <main>openarcos scaffold online.</main>;
}
```

- [ ] **Step 5: Verify it builds**

```bash
cd web && pnpm build
```

Expected: `next build` completes; `out/index.html` exists; no TypeScript errors.

- [ ] **Step 6: Commit the autogenerated `next-env.d.ts`**

```bash
git add web/next-env.d.ts
```

- [ ] **Step 7: Commit**

```bash
git add web/package.json web/pnpm-lock.yaml web/tsconfig.json web/next.config.mjs web/app/layout.tsx web/app/page.tsx web/next-env.d.ts
git commit -m "web: install next 15 + typescript, minimal static export builds"
```

---

### Task 3: Biome linter + formatter

**Files:**
- Create: `web/biome.json`
- Modify: `web/package.json` (dev dep)

- [ ] **Step 1: Install Biome**

```bash
cd web && pnpm add -D @biomejs/biome@~2
```

- [ ] **Step 2: Create `web/biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignoreUnknown": true,
    "includes": ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.json", "**/*.mjs"],
    "ignore": ["out/**", ".next/**", "public/data/**", "next-env.d.ts"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf"
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": {
        "useImportType": "error",
        "useNodejsImportProtocol": "error"
      },
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      }
    }
  },
  "organizeImports": {
    "enabled": true
  }
}
```

- [ ] **Step 3: Run Biome once to verify the scaffolded files pass**

```bash
cd web && pnpm lint
```

Expected: `Checked 4 files in ...` (no errors).

- [ ] **Step 4: Commit**

```bash
git add web/biome.json web/package.json web/pnpm-lock.yaml
git commit -m "web: add Biome with strict imports + unused-var rules"
```

---

### Task 4: Vitest + React Testing Library smoke

**Files:**
- Create: `web/vitest.config.ts`
- Create: `web/tests/setup.ts`
- Create: `web/tests/unit/smoke.test.ts`
- Modify: `web/package.json` (dev deps)

- [ ] **Step 1: Install**

```bash
cd web
pnpm add -D vitest@~4 @vitejs/plugin-react@~5 jsdom@~25 \
  @testing-library/react@~16 @testing-library/jest-dom@~6 @testing-library/user-event@~14
```

- [ ] **Step 2: Create `web/vitest.config.ts`**

```typescript
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      reporter: ["text", "html"],
      include: ["components/**", "lib/**", "app/**"],
      exclude: ["**/*.stories.*", "tests/**"],
    },
  },
  resolve: {
    alias: {
      "@": new URL(".", import.meta.url).pathname.replace(/\/$/, ""),
    },
  },
});
```

- [ ] **Step 3: Create `web/tests/setup.ts`**

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Create `web/tests/unit/smoke.test.ts`**

```typescript
import { describe, expect, it } from "vitest";

describe("smoke", () => {
  it("arithmetic works", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run tests to confirm**

```bash
cd web && pnpm test
```

Expected: 1 test, 1 passed.

- [ ] **Step 6: Commit**

```bash
git add web/vitest.config.ts web/tests/setup.ts web/tests/unit/smoke.test.ts web/package.json web/pnpm-lock.yaml
git commit -m "web: wire vitest + testing-library smoke test"
```

---

### Task 5: Playwright E2E smoke

**Files:**
- Create: `web/playwright.config.ts`
- Create: `web/tests/e2e/smoke.spec.ts`
- Modify: `web/.gitignore` (already covers `playwright-report/`)
- Modify: `web/package.json` (dev deps)

- [ ] **Step 1: Install**

```bash
cd web && pnpm add -D @playwright/test@~1.48 tsx@~4
pnpm exec playwright install --with-deps chromium
```

- [ ] **Step 2: Create `web/playwright.config.ts`**

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev --port 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
```

- [ ] **Step 3: Create `web/tests/e2e/smoke.spec.ts`**

```typescript
import { expect, test } from "@playwright/test";

test("home page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("openarcos scaffold online")).toBeVisible();
});
```

- [ ] **Step 4: Run the E2E smoke**

```bash
cd web && pnpm e2e
```

Expected: 1 test, 1 passed.

- [ ] **Step 5: Commit**

```bash
git add web/playwright.config.ts web/tests/e2e/smoke.spec.ts web/package.json web/pnpm-lock.yaml
git commit -m "web: wire playwright e2e smoke against dev server"
```

---

### Task 6: Self-host Space Grotesk + Inter

**Files:**
- Create: `web/public/fonts/SpaceGrotesk-Regular.woff2`
- Create: `web/public/fonts/SpaceGrotesk-Bold.woff2`
- Create: `web/public/fonts/Inter-Regular.woff2`
- Create: `web/public/fonts/Inter-Medium.woff2`
- Create: `web/public/fonts/Inter-Bold.woff2`
- Create: `web/public/fonts/LICENSE-OFL.txt`
- Create: `web/lib/fonts.ts`
- Modify: `web/app/layout.tsx`

Per spec §5 (visual) and §9 (licensing confirm). Both families are SIL OFL 1.1, which permits self-hosting and redistribution.

- [ ] **Step 1: Download the .woff2 files**

Space Grotesk (OFL 1.1):
```bash
cd web/public/fonts
# Space Grotesk — from the official GitHub release
curl -L -o SpaceGrotesk-Regular.woff2 \
  'https://cdn.jsdelivr.net/gh/floriankarsten/space-grotesk@4.0.0/fonts/webfonts/SpaceGrotesk-Regular.woff2'
curl -L -o SpaceGrotesk-Bold.woff2 \
  'https://cdn.jsdelivr.net/gh/floriankarsten/space-grotesk@4.0.0/fonts/webfonts/SpaceGrotesk-Bold.woff2'

# Inter — from the official release
curl -L -o Inter-Regular.woff2 \
  'https://cdn.jsdelivr.net/gh/rsms/inter@4.1/docs/font-files/Inter-Regular.woff2'
curl -L -o Inter-Medium.woff2 \
  'https://cdn.jsdelivr.net/gh/rsms/inter@4.1/docs/font-files/Inter-Medium.woff2'
curl -L -o Inter-Bold.woff2 \
  'https://cdn.jsdelivr.net/gh/rsms/inter@4.1/docs/font-files/Inter-Bold.woff2'
```

If CDN URLs move, swap in GitHub-release URLs from
- `floriankarsten/space-grotesk` releases → `fonts/webfonts/*.woff2`
- `rsms/inter` releases → `inter-4.1.zip` → `Inter Web/*.woff2`

- [ ] **Step 2: Create `web/public/fonts/LICENSE-OFL.txt`**

```
Copyright 2020 The Space Grotesk Project Authors (https://github.com/floriankarsten/space-grotesk)
Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter)

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is available with a FAQ at: https://openfontlicense.org

-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components
as distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting — in part or in whole — any of the components of the
Original Version, by changing formats or by porting the Font Software to
a new environment.

"Author" refers to any designer, engineer, programmer, technical writer
or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining a
copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components, in
Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the
corresponding Copyright Holder. This restriction only applies to the
primary font name as presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole, must
be distributed entirely under this license, and must not be distributed
under any other license. The requirement for fonts to remain under this
license does not apply to any document created using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```

- [ ] **Step 3: Create `web/lib/fonts.ts`**

```typescript
import localFont from "next/font/local";

export const displayFont = localFont({
  src: [
    {
      path: "../public/fonts/SpaceGrotesk-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/SpaceGrotesk-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-display",
  display: "swap",
  preload: true,
});

export const bodyFont = localFont({
  src: [
    {
      path: "../public/fonts/Inter-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/Inter-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/fonts/Inter-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-body",
  display: "swap",
  preload: true,
});
```

- [ ] **Step 4: Wire fonts into `web/app/layout.tsx`**

```tsx
import type { ReactNode } from "react";
import { bodyFont, displayFont } from "@/lib/fonts";

export const metadata = {
  title: "openarcos",
  description: "Analysis of ARCOS prescription opioid distribution data.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Verify build still succeeds**

```bash
cd web && pnpm build
```

Expected: build succeeds; `out/_next/static/media/` contains the hashed `.woff2` files.

- [ ] **Step 6: Commit**

```bash
git add web/public/fonts/ web/lib/fonts.ts web/app/layout.tsx
git commit -m "web: self-host Space Grotesk + Inter with next/font/local (OFL 1.1)"
```

---

### Task 7: TypeScript strict sanity + typecheck CI hook

**Files:**
- Modify: `web/package.json` (already has `typecheck` script from Task 1)
- Create: `web/tests/unit/tsconfig.test.ts`

- [ ] **Step 1: Write a test that fails if `strict` ever gets disabled**

```typescript
// web/tests/unit/tsconfig.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("tsconfig", () => {
  it("enforces strict + noUncheckedIndexedAccess", () => {
    const tsconfig = JSON.parse(readFileSync("tsconfig.json", "utf8"));
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.noUncheckedIndexedAccess).toBe(true);
  });
});
```

- [ ] **Step 2: Run it**

```bash
cd web && pnpm test tests/unit/tsconfig.test.ts
```

Expected: 1 test, 1 passed.

- [ ] **Step 3: Run the typecheck script itself to confirm it works**

```bash
cd web && pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add web/tests/unit/tsconfig.test.ts
git commit -m "web: lock strict TS config behind a vitest assertion"
```

---

### Task 8: Phase 1 milestone commit

**Files:** none modified in this task — this is the verification gate before moving to Phase 2.

- [ ] **Step 1: Run the full local verification loop**

```bash
cd web
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
```

Expected: each exits 0. Build produces a valid `out/` directory.

- [ ] **Step 2: Confirm git status is clean**

```bash
git status
```

Expected: `nothing to commit, working tree clean`.

- [ ] **Step 3: Tag the milestone (optional)**

```bash
git tag -a web-phase-1-done -m "web phase 1 scaffold complete"
```

No commit needed — Phase 1 is done.

---

**Phase 1 gate:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Optional tag `web-phase-1-done`.

---

## Phase 2 — Design system & tokens (tasks 9–14)

Bold Poster = editorial static-poster aesthetic. Canvas `#f5ecd7`, ink `#1a1a1a`, accent-hot `#c23b20`, accent-cool `#2a5f7a`. Type scale is aggressive (display ramps to 96px). All numerics use `font-variant-numeric: tabular-nums`. Dark mode is scoped to `/methodology` and `/about` only (spec §5).

---

### Task 9: Design tokens

**Files:**
- Create: `web/styles/tokens.css`
- Create: `web/tests/unit/tokens.test.ts`

- [ ] **Step 1: Write the failing test first**

```typescript
// web/tests/unit/tokens.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("design tokens", () => {
  const css = readFileSync("styles/tokens.css", "utf8");

  it("declares the Bold Poster palette", () => {
    expect(css).toMatch(/--ink:\s*#1a1a1a/);
    expect(css).toMatch(/--canvas:\s*#f5ecd7/);
    expect(css).toMatch(/--accent-hot:\s*#c23b20/);
    expect(css).toMatch(/--accent-cool:\s*#2a5f7a/);
  });

  it("declares a type scale with a display-96 step", () => {
    expect(css).toMatch(/--type-display-xl:\s*6rem/);
  });

  it("declares tabular-nums variable for numerics", () => {
    expect(css).toMatch(/--numeric:\s*tabular-nums/);
  });

  it("scopes dark mode to [data-theme='dark']", () => {
    expect(css).toMatch(/\[data-theme=['"]dark['"]\]/);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd web && pnpm test tests/unit/tokens.test.ts
```

Expected: FAIL — `styles/tokens.css` doesn't exist.

- [ ] **Step 3: Create `web/styles/tokens.css`**

```css
/* Bold Poster design tokens. Loaded globally; extended in
   styles/globals.css. Dark mode applies only when an ancestor sets
   data-theme="dark" — used on /methodology and /about. */

:root {
  /* palette */
  --ink: #1a1a1a;
  --ink-80: #1a1a1acc;
  --ink-60: #1a1a1a99;
  --ink-40: #1a1a1a66;
  --canvas: #f5ecd7;
  --canvas-warm: #f0e3c4;
  --canvas-shade: #ece0c2;
  --accent-hot: #c23b20;
  --accent-cool: #2a5f7a;
  --muted: #766d5a;
  --grid: rgba(26, 26, 26, 0.12);

  /* surface semantic tokens */
  --surface: var(--canvas);
  --surface-elevated: var(--canvas-warm);
  --text: var(--ink);
  --text-muted: var(--ink-60);
  --rule: var(--grid);

  /* type scale */
  --font-display: var(--font-display), "Space Grotesk", system-ui, sans-serif;
  --font-body: var(--font-body), "Inter", system-ui, sans-serif;
  --font-mono: ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace;

  --type-display-xl: 6rem;     /* 96px - act-opening numeral */
  --type-display-lg: 4.5rem;   /* 72px - section hero */
  --type-display-md: 3rem;     /* 48px - subsection */
  --type-display-sm: 2rem;     /* 32px - card hero */
  --type-h1: 2.25rem;          /* 36px */
  --type-h2: 1.5rem;           /* 24px */
  --type-h3: 1.25rem;          /* 20px */
  --type-body: 1.0625rem;      /* 17px */
  --type-body-sm: 0.9375rem;   /* 15px */
  --type-caption: 0.8125rem;   /* 13px */
  --type-eyebrow: 0.75rem;     /* 12px uppercase */

  --leading-tight: 1.05;
  --leading-snug: 1.25;
  --leading-normal: 1.5;
  --leading-loose: 1.7;

  --numeric: tabular-nums;
  --font-feature-numeric: "tnum", "lnum";

  /* spacing scale */
  --space-2xs: 0.25rem;
  --space-xs: 0.5rem;
  --space-sm: 0.75rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2.25rem;
  --space-2xl: 3.5rem;
  --space-3xl: 5.25rem;
  --space-4xl: 8rem;

  /* radii */
  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-lg: 8px;

  /* shadows */
  --shadow-soft: 0 1px 0 rgba(26, 26, 26, 0.08), 0 10px 24px rgba(26, 26, 26, 0.08);
  --shadow-strong: 0 2px 0 rgba(26, 26, 26, 0.1), 0 14px 32px rgba(26, 26, 26, 0.18);

  /* motion */
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-out: cubic-bezier(0, 0, 0, 1);
  --duration-fast: 140ms;
  --duration-med: 220ms;
  --duration-slow: 320ms;

  /* layout */
  --page-max: 1200px;
  --gutter: clamp(1rem, 3vw, 2rem);

  /* z */
  --z-header: 40;
  --z-tooltip: 60;
  --z-overlay: 80;
}

[data-theme="dark"] {
  --ink: #f3efe5;
  --ink-80: #f3efe5cc;
  --ink-60: #f3efe599;
  --ink-40: #f3efe566;
  --canvas: #161513;
  --canvas-warm: #1e1d1a;
  --canvas-shade: #232220;
  --accent-hot: #e56b4f;
  --accent-cool: #6ea8c4;
  --muted: #a8a08e;
  --grid: rgba(243, 239, 229, 0.14);
  --surface: var(--canvas);
  --surface-elevated: var(--canvas-warm);
  --text: var(--ink);
  --text-muted: var(--ink-60);
  --rule: var(--grid);
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-fast: 0ms;
    --duration-med: 0ms;
    --duration-slow: 0ms;
  }
}
```

- [ ] **Step 4: Run the test**

```bash
cd web && pnpm test tests/unit/tokens.test.ts
```

Expected: 4 tests, 4 passed.

- [ ] **Step 5: Commit**

```bash
git add web/styles/tokens.css web/tests/unit/tokens.test.ts
git commit -m "web: design tokens (Bold Poster palette, type scale, dark-mode scope)"
```

---

### Task 10: Global styles

**Files:**
- Create: `web/styles/globals.css`
- Create: `web/app/globals.css` (thin re-export so App Router can import it)
- Modify: `web/app/layout.tsx` (import globals)

- [ ] **Step 1: Create `web/styles/globals.css`**

```css
@import "./tokens.css";

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  color-scheme: light dark;
  font-family: var(--font-body);
  line-height: var(--leading-normal);
}

body {
  margin: 0;
  min-height: 100dvh;
  background: var(--surface);
  color: var(--text);
  font-size: var(--type-body);
  font-feature-settings: "kern" 1, "calt" 1;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

:is(h1, h2, h3, h4, .display) {
  font-family: var(--font-display);
  font-weight: 700;
  line-height: var(--leading-tight);
  letter-spacing: -0.01em;
  margin: 0 0 var(--space-md);
}

h1 { font-size: var(--type-h1); }
h2 { font-size: var(--type-h2); }
h3 { font-size: var(--type-h3); }

p, ul, ol {
  margin: 0 0 var(--space-md);
  max-width: 68ch;
}

a {
  color: inherit;
  text-decoration-color: var(--ink-40);
  text-underline-offset: 3px;
}
a:hover {
  text-decoration-color: var(--accent-hot);
}
a:focus-visible {
  outline: 2px solid var(--accent-cool);
  outline-offset: 3px;
  border-radius: var(--radius-sm);
}

:is(figure, blockquote) { margin: 0; }

hr {
  border: 0;
  border-top: 1px solid var(--rule);
  margin: var(--space-xl) 0;
}

.numeric,
[data-numeric] {
  font-variant-numeric: var(--numeric);
  font-feature-settings: var(--font-feature-numeric);
}

.eyebrow {
  font-family: var(--font-display);
  font-size: var(--type-eyebrow);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.container {
  max-width: var(--page-max);
  margin-inline: auto;
  padding-inline: var(--gutter);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 2: Create the App Router entrypoint `web/app/globals.css`**

```css
@import "../styles/globals.css";
```

- [ ] **Step 3: Import it in `web/app/layout.tsx`**

```tsx
import type { ReactNode } from "react";
import { bodyFont, displayFont } from "@/lib/fonts";
import "./globals.css";

export const metadata = {
  title: "openarcos",
  description: "Analysis of ARCOS prescription opioid distribution data.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
cd web && pnpm build
```

Expected: build succeeds; the generated `out/_next/static/css/*.css` contains the token variables.

- [ ] **Step 5: Commit**

```bash
git add web/styles/globals.css web/app/globals.css web/app/layout.tsx
git commit -m "web: global styles consuming design tokens"
```

---

### Task 11: BigNumeral

**Files:**
- Create: `web/components/brand/BigNumeral.tsx`
- Create: `web/components/brand/BigNumeral.module.css`
- Create: `web/tests/unit/BigNumeral.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// web/tests/unit/BigNumeral.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BigNumeral } from "@/components/brand/BigNumeral";

describe("<BigNumeral>", () => {
  it("renders the raw number with its unit", () => {
    render(<BigNumeral value={76_000_000_000} unit="pills" />);
    expect(screen.getByText("76,000,000,000")).toBeInTheDocument();
    expect(screen.getByText("pills")).toBeInTheDocument();
  });

  it("compacts when compact=true", () => {
    render(<BigNumeral value={76_000_000_000} unit="pills" compact />);
    expect(screen.getByText("76B")).toBeInTheDocument();
  });

  it("exposes an aria-label with compact + unit", () => {
    render(<BigNumeral value={76_000_000_000} unit="pills" compact ariaLabel="76 billion pills" />);
    expect(screen.getByRole("figure")).toHaveAttribute("aria-label", "76 billion pills");
  });

  it("uses tabular-nums", () => {
    render(<BigNumeral value={1234} unit="x" />);
    expect(screen.getByText("1,234").className).toMatch(/numeric/);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd web && pnpm test tests/unit/BigNumeral.test.tsx
```

Expected: FAIL — component missing.

- [ ] **Step 3: Create `web/components/brand/BigNumeral.module.css`**

```css
.root {
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-sm);
  font-family: var(--font-display);
  color: var(--text);
}

.value {
  font-size: var(--type-display-xl);
  font-weight: 700;
  line-height: var(--leading-tight);
  letter-spacing: -0.02em;
}

.unit {
  font-family: var(--font-display);
  font-size: var(--type-display-sm);
  color: var(--text-muted);
  letter-spacing: 0;
  text-transform: lowercase;
}

.numeric {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum", "lnum";
}

.accentHot .value { color: var(--accent-hot); }
.accentCool .value { color: var(--accent-cool); }

@media (max-width: 720px) {
  .value { font-size: var(--type-display-lg); }
  .unit { font-size: var(--type-h2); }
}
```

- [ ] **Step 4: Create `web/components/brand/BigNumeral.tsx`**

```tsx
import type { ReactNode } from "react";
import styles from "./BigNumeral.module.css";

export type BigNumeralTone = "default" | "hot" | "cool";

type Props = {
  value: number;
  unit: ReactNode;
  compact?: boolean;
  tone?: BigNumeralTone;
  ariaLabel?: string;
};

const COMPACT_FORMATTER = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const FULL_FORMATTER = new Intl.NumberFormat("en-US");

export function BigNumeral({ value, unit, compact = false, tone = "default", ariaLabel }: Props) {
  const display = compact ? COMPACT_FORMATTER.format(value) : FULL_FORMATTER.format(value);
  const toneClass =
    tone === "hot" ? styles.accentHot : tone === "cool" ? styles.accentCool : "";
  return (
    <figure
      className={`${styles.root} ${toneClass}`}
      role="figure"
      aria-label={ariaLabel ?? `${display} ${typeof unit === "string" ? unit : ""}`}
    >
      <span className={`${styles.value} ${styles.numeric}`}>{display}</span>
      <span className={styles.unit}>{unit}</span>
    </figure>
  );
}
```

- [ ] **Step 5: Run the test**

```bash
cd web && pnpm test tests/unit/BigNumeral.test.tsx
```

Expected: 4 tests, 4 passed.

- [ ] **Step 6: Commit**

```bash
git add web/components/brand/BigNumeral.tsx web/components/brand/BigNumeral.module.css web/tests/unit/BigNumeral.test.tsx
git commit -m "web: BigNumeral brand component with compact + tone variants"
```

---

### Task 12: Accent

**Files:**
- Create: `web/components/brand/Accent.tsx`
- Create: `web/components/brand/Accent.module.css`
- Create: `web/tests/unit/Accent.test.tsx`

Editorial accent — a highlight wrap for pull quotes and stand-out nouns.

- [ ] **Step 1: Write the failing test**

```tsx
// web/tests/unit/Accent.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Accent } from "@/components/brand/Accent";

describe("<Accent>", () => {
  it("renders inline span with the hot variant by default", () => {
    render(<Accent>76 billion</Accent>);
    const el = screen.getByText("76 billion");
    expect(el.tagName).toBe("SPAN");
    expect(el.className).toMatch(/hot/);
  });

  it("applies cool variant when tone='cool'", () => {
    render(<Accent tone="cool">14,000 deaths</Accent>);
    expect(screen.getByText("14,000 deaths").className).toMatch(/cool/);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd web && pnpm test tests/unit/Accent.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Create `web/components/brand/Accent.module.css`**

```css
.root {
  font-family: inherit;
  font-weight: 700;
  border-bottom: 3px solid currentColor;
  padding-bottom: 0;
  text-decoration: none;
  white-space: nowrap;
}

.hot  { color: var(--accent-hot); }
.cool { color: var(--accent-cool); }
```

- [ ] **Step 4: Create `web/components/brand/Accent.tsx`**

```tsx
import type { ReactNode } from "react";
import styles from "./Accent.module.css";

type Props = {
  tone?: "hot" | "cool";
  children: ReactNode;
};

export function Accent({ tone = "hot", children }: Props) {
  return <span className={`${styles.root} ${styles[tone]}`}>{children}</span>;
}
```

- [ ] **Step 5: Run the test**

```bash
cd web && pnpm test tests/unit/Accent.test.tsx
```

Expected: 2 tests, 2 passed.

- [ ] **Step 6: Commit**

```bash
git add web/components/brand/Accent.tsx web/components/brand/Accent.module.css web/tests/unit/Accent.test.tsx
git commit -m "web: Accent inline-highlight brand component"
```

---

### Task 13: UI primitives (Button, Pill, Tooltip, Typography)

**Files:**
- Create: `web/components/ui/Button.tsx` + `.module.css`
- Create: `web/components/ui/Pill.tsx` + `.module.css`
- Create: `web/components/ui/Tooltip.tsx` + `.module.css`
- Create: `web/components/ui/Typography.tsx` + `.module.css`
- Create: `web/tests/unit/ui.test.tsx`

- [ ] **Step 1: Write all four failing tests in one file**

```tsx
// web/tests/unit/ui.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Tooltip } from "@/components/ui/Tooltip";
import { Eyebrow } from "@/components/ui/Typography";

describe("<Button>", () => {
  it("renders with primary variant by default and fires onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>See your county</Button>);
    const btn = screen.getByRole("button", { name: /see your county/i });
    expect(btn.className).toMatch(/primary/);
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("supports ghost variant + disabled", () => {
    render(
      <Button variant="ghost" disabled>
        Later
      </Button>,
    );
    const btn = screen.getByRole("button", { name: /later/i });
    expect(btn.className).toMatch(/ghost/);
    expect(btn).toBeDisabled();
  });
});

describe("<Pill>", () => {
  it("renders children with a semantic tone class", () => {
    render(<Pill tone="hot">breaking</Pill>);
    expect(screen.getByText("breaking").className).toMatch(/hot/);
  });
});

describe("<Tooltip>", () => {
  it("reveals content on hover", async () => {
    render(
      <Tooltip content="source: DEA ARCOS">
        <span>?</span>
      </Tooltip>,
    );
    const trigger = screen.getByText("?");
    await userEvent.hover(trigger);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("source: DEA ARCOS");
  });
});

describe("<Eyebrow>", () => {
  it("renders an uppercase eyebrow label", () => {
    render(<Eyebrow>act 1</Eyebrow>);
    expect(screen.getByText("act 1").className).toMatch(/eyebrow/);
  });
});
```

- [ ] **Step 2: Run to confirm all fail**

```bash
cd web && pnpm test tests/unit/ui.test.tsx
```

Expected: FAIL — components missing.

- [ ] **Step 3: `web/components/ui/Button.module.css`**

```css
.root {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  font-family: var(--font-display);
  font-size: var(--type-body);
  font-weight: 700;
  border: 2px solid var(--ink);
  border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-lg);
  cursor: pointer;
  transition: transform var(--duration-fast) var(--ease-standard),
    background-color var(--duration-fast) var(--ease-standard);
}
.root:focus-visible {
  outline: 2px solid var(--accent-cool);
  outline-offset: 3px;
}
.root:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.primary {
  background: var(--ink);
  color: var(--canvas);
}
.primary:hover:not(:disabled) {
  transform: translateY(-1px);
  background: var(--accent-hot);
  border-color: var(--accent-hot);
}
.ghost {
  background: transparent;
  color: var(--ink);
}
.ghost:hover:not(:disabled) {
  background: var(--canvas-shade);
}
```

- [ ] **Step 4: `web/components/ui/Button.tsx`**

```tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
  children: ReactNode;
};

export function Button({ variant = "primary", className, children, ...rest }: Props) {
  const variantClass = styles[variant] ?? styles.primary;
  return (
    <button className={`${styles.root} ${variantClass} ${className ?? ""}`} {...rest}>
      {children}
    </button>
  );
}
```

- [ ] **Step 5: `web/components/ui/Pill.module.css`**

```css
.root {
  display: inline-flex;
  align-items: center;
  padding: var(--space-2xs) var(--space-sm);
  border-radius: 999px;
  font-family: var(--font-display);
  font-size: var(--type-caption);
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border: 1px solid currentColor;
}
.neutral { color: var(--text-muted); }
.hot     { color: var(--accent-hot); }
.cool    { color: var(--accent-cool); }
```

- [ ] **Step 6: `web/components/ui/Pill.tsx`**

```tsx
import type { ReactNode } from "react";
import styles from "./Pill.module.css";

type Props = {
  tone?: "neutral" | "hot" | "cool";
  children: ReactNode;
};

export function Pill({ tone = "neutral", children }: Props) {
  return <span className={`${styles.root} ${styles[tone]}`}>{children}</span>;
}
```

- [ ] **Step 7: `web/components/ui/Tooltip.module.css`**

```css
.root {
  position: relative;
  display: inline-block;
}
.trigger {
  cursor: help;
  text-decoration: underline dotted;
}
.content {
  position: absolute;
  bottom: calc(100% + var(--space-xs));
  left: 50%;
  transform: translateX(-50%);
  background: var(--ink);
  color: var(--canvas);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  font-size: var(--type-caption);
  white-space: nowrap;
  z-index: var(--z-tooltip);
  box-shadow: var(--shadow-soft);
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}
.root:hover .content,
.root:focus-within .content {
  opacity: 1;
}
```

- [ ] **Step 8: `web/components/ui/Tooltip.tsx`**

```tsx
"use client";

import { useId, type ReactNode } from "react";
import styles from "./Tooltip.module.css";

type Props = {
  content: ReactNode;
  children: ReactNode;
};

export function Tooltip({ content, children }: Props) {
  const id = useId();
  return (
    <span className={styles.root}>
      <span className={styles.trigger} tabIndex={0} aria-describedby={id}>
        {children}
      </span>
      <span id={id} role="tooltip" className={styles.content}>
        {content}
      </span>
    </span>
  );
}
```

- [ ] **Step 9: `web/components/ui/Typography.module.css`**

```css
.eyebrow {
  font-family: var(--font-display);
  font-size: var(--type-eyebrow);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.display {
  font-family: var(--font-display);
  font-size: var(--type-display-md);
  font-weight: 700;
  line-height: var(--leading-tight);
  letter-spacing: -0.01em;
}

.lede {
  font-family: var(--font-body);
  font-size: var(--type-h3);
  line-height: var(--leading-snug);
  color: var(--text-muted);
  max-width: 56ch;
}

.caption {
  font-size: var(--type-caption);
  color: var(--text-muted);
}
```

- [ ] **Step 10: `web/components/ui/Typography.tsx`**

```tsx
import type { ReactNode } from "react";
import styles from "./Typography.module.css";

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className={styles.eyebrow}>{children}</p>;
}

export function Display({ children }: { children: ReactNode }) {
  return <h1 className={styles.display}>{children}</h1>;
}

export function Lede({ children }: { children: ReactNode }) {
  return <p className={styles.lede}>{children}</p>;
}

export function Caption({ children }: { children: ReactNode }) {
  return <p className={styles.caption}>{children}</p>;
}
```

- [ ] **Step 11: Run the test**

```bash
cd web && pnpm test tests/unit/ui.test.tsx
```

Expected: 5 tests, 5 passed.

- [ ] **Step 12: Commit**

```bash
git add web/components/ui/ web/tests/unit/ui.test.tsx
git commit -m "web: ui primitives (Button, Pill, Tooltip, Typography)"
```

---

### Task 14: Layout (Header, Footer, MethodologyFooter)

**Files:**
- Create: `web/components/layout/Header.tsx` + `.module.css`
- Create: `web/components/layout/Footer.tsx` + `.module.css`
- Create: `web/components/layout/MethodologyFooter.tsx` + `.module.css`
- Create: `web/tests/unit/layout.test.tsx`
- Modify: `web/app/layout.tsx` (wrap children in Header + Footer)

Header carries the site title, nav links, and a slot for SearchBox (Task 35 fills it). Footer carries the data-source attribution + last-build date. MethodologyFooter is a lighter variant for `/methodology` + `/about`.

- [ ] **Step 1: Write the failing test**

```tsx
// web/tests/unit/layout.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { MethodologyFooter } from "@/components/layout/MethodologyFooter";

describe("<Header>", () => {
  it("renders brand + nav", () => {
    render(<Header />);
    expect(screen.getByText(/openarcos/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /explorer/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /rankings/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /methodology/i })).toBeInTheDocument();
  });

  it("renders the search slot when provided", () => {
    render(<Header search={<input placeholder="search counties" />} />);
    expect(screen.getByPlaceholderText(/search counties/i)).toBeInTheDocument();
  });
});

describe("<Footer>", () => {
  it("credits all three source datasets", () => {
    render(<Footer buildDate="2026-04-29" />);
    expect(screen.getByText(/Washington Post ARCOS/i)).toBeInTheDocument();
    expect(screen.getByText(/DEA Diversion Control/i)).toBeInTheDocument();
    expect(screen.getByText(/CDC WONDER/i)).toBeInTheDocument();
    expect(screen.getByText(/2026-04-29/)).toBeInTheDocument();
  });
});

describe("<MethodologyFooter>", () => {
  it("links to methodology + github", () => {
    render(<MethodologyFooter />);
    expect(screen.getByRole("link", { name: /methodology/i })).toHaveAttribute(
      "href",
      "/methodology",
    );
    expect(screen.getByRole("link", { name: /github/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd web && pnpm test tests/unit/layout.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: `web/components/layout/Header.module.css`**

```css
.root {
  position: sticky;
  top: 0;
  z-index: var(--z-header);
  background: var(--surface);
  border-bottom: 1px solid var(--rule);
  backdrop-filter: saturate(150%) blur(4px);
}
.row {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  padding: var(--space-md) var(--gutter);
  max-width: var(--page-max);
  margin-inline: auto;
}
.brand {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: var(--type-h2);
  color: var(--ink);
  text-decoration: none;
  letter-spacing: -0.02em;
}
.nav {
  display: flex;
  gap: var(--space-md);
  margin-left: auto;
  font-family: var(--font-display);
  font-size: var(--type-body-sm);
}
.nav a {
  text-decoration: none;
  color: var(--text-muted);
}
.nav a:hover,
.nav a[aria-current="page"] {
  color: var(--ink);
}
.search {
  flex: 0 1 320px;
}

@media (max-width: 720px) {
  .search { display: none; }
  .nav { font-size: var(--type-caption); }
}
```

- [ ] **Step 4: `web/components/layout/Header.tsx`**

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./Header.module.css";

type Props = {
  search?: ReactNode;
};

const NAV: Array<{ href: "/explorer" | "/rankings" | "/methodology" | "/about"; label: string }> = [
  { href: "/explorer", label: "Explorer" },
  { href: "/rankings", label: "Rankings" },
  { href: "/methodology", label: "Methodology" },
  { href: "/about", label: "About" },
];

export function Header({ search }: Props) {
  return (
    <header className={styles.root}>
      <div className={styles.row}>
        <Link href="/" className={styles.brand}>
          openarcos
        </Link>
        {search ? <div className={styles.search}>{search}</div> : null}
        <nav className={styles.nav} aria-label="Primary">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 5: `web/components/layout/Footer.module.css`**

```css
.root {
  border-top: 1px solid var(--rule);
  padding: var(--space-2xl) var(--gutter);
  background: var(--surface);
  color: var(--text-muted);
  font-size: var(--type-body-sm);
}
.inner {
  max-width: var(--page-max);
  margin-inline: auto;
  display: grid;
  gap: var(--space-xl);
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}
.group h2 {
  font-family: var(--font-display);
  font-size: var(--type-eyebrow);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink);
  margin: 0 0 var(--space-sm);
}
.group ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
.group li {
  margin-bottom: var(--space-xs);
}
.group a {
  color: var(--text-muted);
}
.meta {
  grid-column: 1 / -1;
  border-top: 1px solid var(--rule);
  padding-top: var(--space-lg);
  font-size: var(--type-caption);
}
```

- [ ] **Step 6: `web/components/layout/Footer.tsx`**

```tsx
import Link from "next/link";
import styles from "./Footer.module.css";

type Props = {
  buildDate?: string;
};

export function Footer({ buildDate }: Props) {
  return (
    <footer className={styles.root}>
      <div className={styles.inner}>
        <section className={styles.group}>
          <h2>Sources</h2>
          <ul>
            <li>
              <a
                href="https://github.com/wpinvestigative/arcos-api"
                target="_blank"
                rel="noreferrer"
              >
                Washington Post ARCOS API
              </a>
            </li>
            <li>
              <a
                href="https://www.deadiversion.usdoj.gov/pubs/reports/index.html"
                target="_blank"
                rel="noreferrer"
              >
                DEA Diversion Control reports
              </a>
            </li>
            <li>
              <a href="https://wonder.cdc.gov/" target="_blank" rel="noreferrer">
                CDC WONDER mortality
              </a>
            </li>
          </ul>
        </section>
        <section className={styles.group}>
          <h2>Site</h2>
          <ul>
            <li>
              <Link href="/methodology">Methodology</Link>
            </li>
            <li>
              <Link href="/about">About</Link>
            </li>
            <li>
              <a
                href="https://github.com/openarcos/openarcos"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
            </li>
          </ul>
        </section>
        <section className={styles.group}>
          <h2>About</h2>
          <p>
            openarcos.org — a journalist-grade analysis of the DEA ARCOS dataset. Not a news
            outlet; not affiliated with any publisher. All data is public.
          </p>
        </section>
        <div className={styles.meta}>
          {buildDate ? <span>Last build: {buildDate}. </span> : null}
          <span>Code: Apache 2.0. Fonts: SIL OFL 1.1.</span>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 7: `web/components/layout/MethodologyFooter.module.css`**

```css
.root {
  border-top: 1px solid var(--rule);
  padding: var(--space-xl) var(--gutter);
  font-size: var(--type-body-sm);
  color: var(--text-muted);
}
.inner {
  max-width: var(--page-max);
  margin-inline: auto;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
  justify-content: space-between;
}
```

- [ ] **Step 8: `web/components/layout/MethodologyFooter.tsx`**

```tsx
import Link from "next/link";
import styles from "./MethodologyFooter.module.css";

export function MethodologyFooter() {
  return (
    <footer className={styles.root}>
      <div className={styles.inner}>
        <p>
          Data sourced from WaPo ARCOS, DEA Diversion Control, and CDC WONDER. See{" "}
          <Link href="/methodology">methodology</Link> for full details.
        </p>
        <p>
          Code on{" "}
          <a href="https://github.com/openarcos/openarcos" target="_blank" rel="noreferrer">
            GitHub
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 9: Wire Header + Footer into `web/app/layout.tsx`**

```tsx
import type { ReactNode } from "react";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { bodyFont, displayFont } from "@/lib/fonts";
import "./globals.css";

export const metadata = {
  title: { default: "openarcos", template: "%s — openarcos" },
  description: "Analysis of ARCOS prescription opioid distribution data.",
};

const BUILD_DATE = new Date().toISOString().slice(0, 10);

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>
        <Header />
        <main>{children}</main>
        <Footer buildDate={BUILD_DATE} />
      </body>
    </html>
  );
}
```

- [ ] **Step 10: Run the tests**

```bash
cd web && pnpm test tests/unit/layout.test.tsx
```

Expected: 4 tests, 4 passed.

- [ ] **Step 11: Verify full build + e2e still pass**

```bash
cd web && pnpm build && pnpm e2e
```

Expected: both succeed.

- [ ] **Step 12: Commit**

```bash
git add web/components/layout/ web/tests/unit/layout.test.tsx web/app/layout.tsx
git commit -m "web: Header/Footer/MethodologyFooter wired into app layout"
```

---

**Phase 2 gate:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Optional tag `web-phase-2-done`.

---

## Phase 3 — Data contract & loaders (tasks 15–22)

This phase is the bridge between `/pipeline` and `/web`. The JSON Schemas in `/pipeline/schemas/` are the **only** inter-subsystem contract. TypeScript types here are a convenience mirror that MUST match the schemas; a prebuild validator catches drift.

### Task 15: TypeScript types mirroring pipeline schemas

**Files:**
- Create: `web/lib/data/schemas.ts`
- Create: `web/tests/unit/schemas.test.ts`

- [ ] **Step 1: Write the failing test**

Write to `web/tests/unit/schemas.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type {
  CountyMetadata,
  StateShipmentsByYear,
  CountyShipmentsByYear,
  TopDistributorsByYear,
  TopPharmacy,
  DEAEnforcementAction,
  CDCOverdoseByCountyYear,
  SearchIndexEntry,
} from '@/lib/data/schemas';

describe('schemas mirror', () => {
  it('CountyMetadata shape matches pipeline schema', () => {
    const row: CountyMetadata = {
      fips: '54059',
      name: 'Mingo County',
      state: 'WV',
      pop: 26839,
    };
    expect(row.fips).toHaveLength(5);
  });

  it('StateShipmentsByYear shape', () => {
    const row: StateShipmentsByYear = {
      state: 'WV',
      year: 2012,
      pills: 123456789,
      pills_per_capita: 66.3,
    };
    expect(row.year).toBeGreaterThanOrEqual(2006);
  });

  it('CountyShipmentsByYear shape', () => {
    const row: CountyShipmentsByYear = {
      fips: '54059',
      year: 2012,
      pills: 5000000,
      pills_per_capita: 200.1,
    };
    expect(row.fips).toHaveLength(5);
  });

  it('TopDistributorsByYear shape', () => {
    const row: TopDistributorsByYear = {
      distributor: 'McKesson Corp',
      year: 2012,
      pills: 1_000_000_000,
      share_pct: 37.5,
    };
    expect(row.share_pct).toBeLessThanOrEqual(100);
  });

  it('TopPharmacy shape', () => {
    const row: TopPharmacy = {
      pharmacy_id: 'BS1234567',
      name: 'Sav-Rite Pharmacy',
      address: '123 Main St, Kermit, WV',
      fips: '54059',
      total_pills: 12_000_000,
    };
    expect(row.fips).toHaveLength(5);
  });

  it('DEAEnforcementAction shape', () => {
    const row: DEAEnforcementAction = {
      year: 2012,
      action_count: 42,
      notable_actions: [
        { title: 'US v. Kermit Pharmacy', url: 'https://example.com', target: null },
      ],
    };
    expect(row.notable_actions).toHaveLength(1);
  });

  it('CDCOverdoseByCountyYear shape with suppressed', () => {
    const suppressed: CDCOverdoseByCountyYear = {
      fips: '54059',
      year: 2012,
      deaths: null,
      suppressed: true,
    };
    const visible: CDCOverdoseByCountyYear = {
      fips: '54059',
      year: 2012,
      deaths: 42,
      suppressed: false,
    };
    expect(suppressed.deaths).toBeNull();
    expect(visible.deaths).toBe(42);
  });

  it('SearchIndexEntry discriminated union by type', () => {
    const county: SearchIndexEntry = {
      type: 'county',
      id: '54059',
      label: 'Mingo County, WV',
      sublabel: '26,839 people',
      fips: '54059',
      state: 'WV',
      total_pills: 50_000_000,
    };
    const distributor: SearchIndexEntry = {
      type: 'distributor',
      id: 'mckesson-corp',
      label: 'McKesson Corp',
      sublabel: 'Top distributor',
      total_pills: 10_000_000_000,
    };
    expect(county.type).toBe('county');
    expect(distributor.type).toBe('distributor');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test schemas`
Expected: FAIL — cannot resolve `@/lib/data/schemas`.

- [ ] **Step 3: Implement the schemas mirror**

Write to `web/lib/data/schemas.ts`:

```ts
/**
 * TypeScript mirror of pipeline JSON Schemas.
 *
 * The authoritative contract lives in `/pipeline/schemas/*.schema.json`.
 * This file is a convenience mirror. Drift is caught in CI by
 * `scripts/validate-data.ts` which runs ajv validation on every file
 * in `public/data/` against the pipeline schemas.
 *
 * If you change a shape here, also change the JSON Schema — or the build
 * will fail at `prebuild`.
 */

export interface CountyMetadata {
  /** 5-digit zero-padded FIPS code */
  fips: string;
  /** County name, e.g. "Mingo County" */
  name: string;
  /** 2-letter USPS state abbreviation */
  state: string;
  /** 2012 population estimate (Census PEP) */
  pop: number;
}

export interface StateShipmentsByYear {
  /** 2-letter USPS abbreviation */
  state: string;
  /** Calendar year, 2006–2014 inclusive */
  year: number;
  /** Total dosage units shipped */
  pills: number;
  /** Pills per capita using state population estimate */
  pills_per_capita: number;
}

export interface CountyShipmentsByYear {
  fips: string;
  year: number;
  pills: number;
  pills_per_capita: number;
}

export interface TopDistributorsByYear {
  distributor: string;
  year: number;
  pills: number;
  /** Market share 0–100 */
  share_pct: number;
}

export interface TopPharmacy {
  pharmacy_id: string;
  name: string;
  address: string;
  fips: string;
  total_pills: number;
}

export interface DEANotableAction {
  title: string;
  url: string;
  /** Target of action; null if not identifiable */
  target: string | null;
}

export interface DEAEnforcementAction {
  year: number;
  action_count: number;
  notable_actions: DEANotableAction[];
}

/**
 * CDC WONDER D76 overdose deaths by county-year.
 *
 * When `suppressed` is true, `deaths` is null (CDC suppresses cells <10
 * for privacy). When `suppressed` is false, `deaths` is >= 10.
 */
export interface CDCOverdoseByCountyYear {
  fips: string;
  year: number;
  deaths: number | null;
  suppressed: boolean;
}

/** Common fields across all search-index entry types */
interface SearchIndexBase {
  id: string;
  label: string;
  sublabel: string;
  total_pills: number;
}

export interface SearchIndexCounty extends SearchIndexBase {
  type: 'county';
  fips: string;
  state: string;
}

export interface SearchIndexCity extends SearchIndexBase {
  type: 'city';
  fips: string;
  state: string;
}

export interface SearchIndexZip extends SearchIndexBase {
  type: 'zip';
  fips: string;
  state: string;
}

export interface SearchIndexDistributor extends SearchIndexBase {
  type: 'distributor';
}

export interface SearchIndexPharmacy extends SearchIndexBase {
  type: 'pharmacy';
  fips: string;
  state: string;
}

export type SearchIndexEntry =
  | SearchIndexCounty
  | SearchIndexCity
  | SearchIndexZip
  | SearchIndexDistributor
  | SearchIndexPharmacy;

/** Names of emitted artifacts, mirroring spec §4 */
export const ARTIFACT_NAMES = [
  'state-shipments-by-year',
  'county-shipments-by-year',
  'county-metadata',
  'top-distributors-by-year',
  'top-pharmacies',
  'dea-enforcement-actions',
  'cdc-overdose-by-county-year',
  'search-index',
] as const;

export type ArtifactName = (typeof ARTIFACT_NAMES)[number];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && pnpm test schemas`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add web/lib/data/schemas.ts web/tests/unit/schemas.test.ts
git commit -m "web: add typescript mirror of pipeline schemas"
```

### Task 16: ajv schema validator (prebuild gate)

**Files:**
- Create: `web/scripts/validate-data.ts`
- Create: `web/tests/unit/validate-data.test.ts`
- Modify: `web/package.json:scripts.validate-data` (already exists as stub)
- Modify: `web/package.json:scripts.prebuild` (already runs validate-data)

- [ ] **Step 1: Add dev dep**

```bash
cd web && pnpm add -D ajv@~8 ajv-formats@~3
```

- [ ] **Step 2: Write the failing test**

Write to `web/tests/unit/validate-data.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateArtifact, validateAllArtifacts } from '@/scripts/validate-data';
import path from 'node:path';

const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures', 'validate-data');
const SCHEMA_DIR = path.join(__dirname, '..', '..', '..', 'pipeline', 'schemas');

describe('validate-data', () => {
  it('accepts a valid county-metadata fixture', async () => {
    const result = await validateArtifact({
      schemaDir: SCHEMA_DIR,
      dataPath: path.join(FIXTURE_DIR, 'county-metadata-good.json'),
      artifactName: 'county-metadata',
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects a malformed county-metadata fixture', async () => {
    const result = await validateArtifact({
      schemaDir: SCHEMA_DIR,
      dataPath: path.join(FIXTURE_DIR, 'county-metadata-bad.json'),
      artifactName: 'county-metadata',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('validateAllArtifacts walks a directory and returns per-file results', async () => {
    const results = await validateAllArtifacts({
      schemaDir: SCHEMA_DIR,
      dataDir: FIXTURE_DIR,
    });
    expect(results.length).toBeGreaterThan(0);
    const names = results.map((r) => r.file);
    expect(names).toContain('county-metadata-good.json');
  });
});
```

- [ ] **Step 3: Create fixtures**

Create `web/tests/fixtures/validate-data/county-metadata-good.json`:

```json
[
  { "fips": "54059", "name": "Mingo County", "state": "WV", "pop": 26839 }
]
```

Create `web/tests/fixtures/validate-data/county-metadata-bad.json`:

```json
[
  { "fips": "5459", "name": "Mingo County", "state": "wv", "pop": -3 }
]
```

(FIPS too short, state lowercase, pop negative — all should trigger violations.)

- [ ] **Step 4: Run test to verify it fails**

Run: `cd web && pnpm test validate-data`
Expected: FAIL — cannot resolve `@/scripts/validate-data`.

- [ ] **Step 5: Implement the validator**

Write to `web/scripts/validate-data.ts`:

```ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { AnyValidateFunction, ErrorObject } from 'ajv';

export interface ValidateArtifactArgs {
  schemaDir: string;
  dataPath: string;
  artifactName: string;
}

export interface ValidateResult {
  file: string;
  artifactName: string;
  ok: boolean;
  errors: ErrorObject[];
}

const ajvCache = new Map<string, Ajv>();

function getAjv(schemaDir: string): Ajv {
  const cached = ajvCache.get(schemaDir);
  if (cached) return cached;
  const ajv = new Ajv({ strict: true, allErrors: true });
  addFormats.default ? addFormats.default(ajv) : (addFormats as unknown as typeof import('ajv-formats').default)(ajv);
  ajvCache.set(schemaDir, ajv);
  return ajv;
}

async function loadSchema(schemaDir: string, artifactName: string): Promise<AnyValidateFunction> {
  const schemaPath = path.join(schemaDir, `${artifactName}.schema.json`);
  const raw = await fs.readFile(schemaPath, 'utf8');
  const schema = JSON.parse(raw);
  const ajv = getAjv(schemaDir);
  const existing = ajv.getSchema(schema.$id ?? artifactName);
  if (existing) return existing;
  return ajv.compile(schema);
}

export async function validateArtifact(args: ValidateArtifactArgs): Promise<ValidateResult> {
  const { schemaDir, dataPath, artifactName } = args;
  const validate = await loadSchema(schemaDir, artifactName);
  const raw = await fs.readFile(dataPath, 'utf8');
  const data = JSON.parse(raw);
  const ok = validate(data);
  return {
    file: path.basename(dataPath),
    artifactName,
    ok: Boolean(ok),
    errors: ok ? [] : validate.errors ?? [],
  };
}

export interface ValidateAllArgs {
  schemaDir: string;
  dataDir: string;
}

export async function validateAllArtifacts(args: ValidateAllArgs): Promise<ValidateResult[]> {
  const { schemaDir, dataDir } = args;
  const entries = await fs.readdir(dataDir);
  const results: ValidateResult[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    // Accept both "<name>.json" and "<name>-<suffix>.json" (for fixture pairs)
    const stem = entry.replace(/\.json$/, '');
    const bestMatch = await findArtifactMatch(schemaDir, stem);
    if (!bestMatch) continue;
    const result = await validateArtifact({
      schemaDir,
      dataPath: path.join(dataDir, entry),
      artifactName: bestMatch,
    });
    results.push(result);
  }
  return results;
}

async function findArtifactMatch(schemaDir: string, stem: string): Promise<string | null> {
  const schemas = await fs.readdir(schemaDir);
  const names = schemas
    .filter((f) => f.endsWith('.schema.json'))
    .map((f) => f.replace(/\.schema\.json$/, ''));
  // Prefer exact match, then longest prefix match
  if (names.includes(stem)) return stem;
  const match = names
    .filter((n) => stem.startsWith(n))
    .sort((a, b) => b.length - a.length)[0];
  return match ?? null;
}

// CLI entrypoint: prebuild runs this with the real data dir.
async function main(): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const schemaDir = path.resolve(here, '..', '..', 'pipeline', 'schemas');
  const dataDir = path.resolve(here, '..', 'public', 'data');
  const results = await validateAllArtifacts({ schemaDir, dataDir });
  let failed = 0;
  for (const r of results) {
    if (r.ok) {
      // eslint-disable-next-line no-console
      console.log(`ok  ${r.file}`);
    } else {
      failed += 1;
      // eslint-disable-next-line no-console
      console.error(`FAIL ${r.file} (${r.artifactName})`);
      for (const err of r.errors) {
        // eslint-disable-next-line no-console
        console.error(`  ${err.instancePath || '/'} ${err.message}`);
      }
    }
  }
  if (failed > 0) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(2);
  });
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd web && pnpm test validate-data`
Expected: PASS (3 tests).

- [ ] **Step 7: Verify CLI entrypoint works against a good fixture**

```bash
cd web
pnpm exec tsx scripts/validate-data.ts || echo "expected fail: no real data yet"
```

Expected: FAIL — `public/data/` doesn't exist yet (Task 17 creates it).

- [ ] **Step 8: Commit**

```bash
git add web/scripts/validate-data.ts web/tests/unit/validate-data.test.ts \
        web/tests/fixtures/validate-data/ web/package.json web/pnpm-lock.yaml
git commit -m "web: ajv validator enforces schema contract at prebuild"
```

### Task 17: Commit a minimal valid data fixture

Goal: `pnpm build` succeeds without requiring the pipeline to have emitted real data. Empty arrays are valid per schema.

**Files:**
- Create: `web/public/data/state-shipments-by-year.json`
- Create: `web/public/data/county-metadata.json`
- Create: `web/public/data/top-distributors-by-year.json`
- Create: `web/public/data/dea-enforcement-actions.json`
- Create: `web/public/data/search-index.json`
- Create: `web/public/data/.README.md`
- Modify: `web/public/data/.gitignore` (remove/adjust so committed fixtures are tracked)

Note: 3 files in spec §4 are Parquet (county-shipments, top-pharmacies, cdc-overdose). Those can't be empty-JSON; they're populated when the pipeline runs. `scripts/validate-data.ts` silently skips non-JSON files (see Task 16 implementation: filter for `.json`). Parquet round-trips are validated during pipeline emit (Plan 1 Task 52).

- [ ] **Step 1: Write all empty-array fixtures**

For each of the 5 JSON artifact names, create the file with `[]`:

```bash
cd web
mkdir -p public/data
for name in state-shipments-by-year county-metadata top-distributors-by-year dea-enforcement-actions search-index; do
  printf '[]\n' > "public/data/${name}.json"
done
```

- [ ] **Step 2: Write the README**

Create `web/public/data/.README.md`:

```markdown
# /web/public/data

This directory is the emission target of the pipeline at `/pipeline`.

**Do not hand-edit these files.** They are regenerated by:
- `make build-data` (locally)
- `.github/workflows/build-data.yml` (weekly cron)

Empty-array stubs are committed so `pnpm build` works from a fresh clone
before the pipeline has ever run. The pipeline overwrites them on every
build.

Every file in this directory is validated against a JSON Schema in
`/pipeline/schemas/` by `web/scripts/validate-data.ts` on every build.
Drift between schema and emission fails the build on both sides.
```

- [ ] **Step 3: Run the validator against committed fixtures**

```bash
cd web && pnpm exec tsx scripts/validate-data.ts
```

Expected: all 5 files print `ok ...`. Exit code 0.

- [ ] **Step 4: Verify prebuild fires on real build**

```bash
cd web && pnpm build
```

Expected: prebuild runs validate-data (prints `ok` lines), then Next builds successfully with the minimal app.

- [ ] **Step 5: Commit**

```bash
git add web/public/data/
git commit -m "web: seed empty-array data fixtures for offline build"
```

### Task 18: hyparquet wrapper (Node + browser)

**Files:**
- Create: `web/lib/data/parquet.ts`
- Create: `web/tests/unit/parquet.test.ts`
- Create: `web/tests/fixtures/tiny.parquet` (committed binary fixture)

- [ ] **Step 1: Add dep**

```bash
cd web && pnpm add hyparquet@~1.25
```

- [ ] **Step 2: Generate the tiny parquet fixture**

We need a small known-contents parquet. Use polars from the pipeline side:

```bash
cd pipeline
uv run python - <<'PY'
import polars as pl
df = pl.DataFrame({
    "fips": ["54059", "51720", "21195"],
    "year": [2012, 2012, 2012],
    "pills": [5_000_000, 2_000_000, 3_000_000],
    "pills_per_capita": [186.3, 227.1, 200.0],
})
df.write_parquet("../web/tests/fixtures/tiny.parquet")
PY
```

Verify:

```bash
file web/tests/fixtures/tiny.parquet
```

Expected: binary file ~1–2 KB.

- [ ] **Step 3: Write the failing test**

Write to `web/tests/unit/parquet.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readParquetRows } from '@/lib/data/parquet';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('parquet wrapper', () => {
  it('reads all rows from a tiny parquet file in Node', async () => {
    const p = path.join(__dirname, '..', 'fixtures', 'tiny.parquet');
    const buf = await fs.readFile(p);
    const rows = await readParquetRows<Record<string, unknown>>(buf);
    expect(rows).toHaveLength(3);
    const first = rows[0];
    expect(first).toBeDefined();
    expect(first?.fips).toBe('54059');
    expect(first?.year).toBe(2012);
  });

  it('reads a subset of columns', async () => {
    const p = path.join(__dirname, '..', 'fixtures', 'tiny.parquet');
    const buf = await fs.readFile(p);
    const rows = await readParquetRows<{ fips: string }>(buf, { columns: ['fips'] });
    expect(rows).toHaveLength(3);
    const first = rows[0];
    expect(Object.keys(first ?? {})).toEqual(['fips']);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd web && pnpm test parquet`
Expected: FAIL — cannot resolve `@/lib/data/parquet`.

- [ ] **Step 5: Implement the wrapper**

Write to `web/lib/data/parquet.ts`:

```ts
/**
 * Minimal parquet reader wrapping hyparquet.
 *
 * Works in both Node (build time) and browser (client-side explorer in
 * Plan 3). We accept Buffer/Uint8Array/ArrayBuffer and normalise to
 * ArrayBuffer since hyparquet's API expects one.
 */
import { parquetRead } from 'hyparquet';

export type ParquetSource = ArrayBuffer | Uint8Array | Buffer;

export interface ReadOptions {
  /** Only read these columns (projection pushdown) */
  columns?: string[];
  /** Row range: [start, end) */
  rowStart?: number;
  rowEnd?: number;
}

function toArrayBuffer(src: ParquetSource): ArrayBuffer {
  if (src instanceof ArrayBuffer) return src;
  // Uint8Array (incl. Node Buffer) → slice its underlying buffer to be safe
  const { buffer, byteOffset, byteLength } = src as Uint8Array;
  return buffer.slice(byteOffset, byteOffset + byteLength) as ArrayBuffer;
}

/**
 * Read all (or some) rows from a parquet payload as an array of typed records.
 * Streams internally; materialises the projected rows to memory.
 */
export async function readParquetRows<T extends Record<string, unknown>>(
  source: ParquetSource,
  options: ReadOptions = {},
): Promise<T[]> {
  const file = toArrayBuffer(source);
  const rows: T[] = [];
  await new Promise<void>((resolve, reject) => {
    parquetRead({
      file,
      columns: options.columns,
      rowStart: options.rowStart,
      rowEnd: options.rowEnd,
      rowFormat: 'object',
      onComplete: (data) => {
        for (const row of data as T[]) rows.push(row);
        resolve();
      },
    }).catch(reject);
  });
  return rows;
}

/**
 * Fetch-and-read helper for client-side use in Plan 3. Emits a progress
 * callback so the explorer UI can render a loading bar for the ~5–10 MB
 * county-shipments parquet.
 */
export async function fetchParquetRows<T extends Record<string, unknown>>(
  url: string,
  opts: ReadOptions & { onProgress?: (bytes: number, total: number) => void } = {},
): Promise<T[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchParquetRows ${url} → HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length') ?? 0);
  if (!res.body || !opts.onProgress || total === 0) {
    const buf = await res.arrayBuffer();
    return readParquetRows<T>(buf, opts);
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.byteLength;
      opts.onProgress(received, total);
    }
  }
  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return readParquetRows<T>(merged, opts);
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd web && pnpm test parquet`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add web/lib/data/parquet.ts web/tests/unit/parquet.test.ts \
        web/tests/fixtures/tiny.parquet web/package.json web/pnpm-lock.yaml
git commit -m "web: hyparquet wrapper shared between build and client"
```

### Task 19: FIPS port with shared test fixture

Pipeline owns the fixture at `pipeline/tests/fixtures/fips_cases.json`. This task symlinks/copies the same cases so TS behavior must match Python behavior exactly.

**Files:**
- Create: `web/lib/geo/fips.ts`
- Create: `web/tests/unit/fips.test.ts`
- Create: `web/tests/fixtures/fips_cases.json` (mirror)

- [ ] **Step 1: Mirror the pipeline fixture**

```bash
cp pipeline/tests/fixtures/fips_cases.json web/tests/fixtures/fips_cases.json
```

Expected content (for reference, produced by Plan 1 Task 15):

```json
{
  "normalize": [
    { "in": "54059", "out": "54059" },
    { "in": "4059", "out": "04059" },
    { "in": 54059, "out": "54059" },
    { "in": " 54059 ", "out": "54059" }
  ],
  "invalid": [null, "", "54059x", "123456", "abc", false]
}
```

- [ ] **Step 2: Write the failing test**

Write to `web/tests/unit/fips.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import cases from '../fixtures/fips_cases.json';
import { normalizeFips, isValidFips, stateFromFips, FIPS_STATE_MAP } from '@/lib/geo/fips';

describe('fips normalize (shared fixture with pipeline)', () => {
  for (const { in: input, out } of cases.normalize as Array<{ in: string | number; out: string }>) {
    it(`normalizes ${JSON.stringify(input)} → ${out}`, () => {
      expect(normalizeFips(input)).toBe(out);
    });
  }

  for (const badInput of cases.invalid as unknown[]) {
    it(`rejects invalid ${JSON.stringify(badInput)}`, () => {
      expect(() => normalizeFips(badInput as never)).toThrow();
    });
  }
});

describe('fips state map', () => {
  it('has all 51 state prefixes (50 states + DC)', () => {
    expect(Object.keys(FIPS_STATE_MAP)).toHaveLength(51);
    expect(FIPS_STATE_MAP['54']).toBe('WV');
    expect(FIPS_STATE_MAP['06']).toBe('CA');
    expect(FIPS_STATE_MAP['11']).toBe('DC');
  });

  it('stateFromFips returns the correct abbreviation', () => {
    expect(stateFromFips('54059')).toBe('WV');
    expect(stateFromFips('06037')).toBe('CA');
    expect(() => stateFromFips('99999')).toThrow();
  });
});

describe('isValidFips', () => {
  it('accepts 5-digit strings with known state prefix', () => {
    expect(isValidFips('54059')).toBe(true);
  });
  it('rejects unknown state prefix', () => {
    expect(isValidFips('99999')).toBe(false);
  });
  it('rejects wrong length', () => {
    expect(isValidFips('5459')).toBe(false);
    expect(isValidFips('540590')).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd web && pnpm test fips`
Expected: FAIL — cannot resolve `@/lib/geo/fips`.

- [ ] **Step 4: Implement the port**

Write to `web/lib/geo/fips.ts`:

```ts
/**
 * FIPS normalization — TypeScript port of `pipeline/src/openarcos_pipeline/fips.py`.
 *
 * These two implementations MUST behave identically. They share a test
 * fixture: `web/tests/fixtures/fips_cases.json` is a copy of
 * `pipeline/tests/fixtures/fips_cases.json`.
 */

export const FIPS_STATE_MAP: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA',
  '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL',
  '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN',
  '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME',
  '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS',
  '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
  '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
  '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
  '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI',
  '56': 'WY',
};

export class InvalidFipsError extends Error {
  override name = 'InvalidFipsError';
}

/**
 * Zero-pad to 5 digits. Accepts string or integer; rejects null, undefined,
 * boolean, non-digit strings, empty strings, and values longer than 5 digits.
 * Whitespace is trimmed.
 */
export function normalizeFips(value: unknown): string {
  if (value === null || value === undefined) {
    throw new InvalidFipsError(`invalid fips: ${String(value)}`);
  }
  if (typeof value === 'boolean') {
    throw new InvalidFipsError(`invalid fips: boolean not allowed`);
  }
  let s: string;
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0) {
      throw new InvalidFipsError(`invalid fips numeric: ${value}`);
    }
    s = String(value);
  } else if (typeof value === 'string') {
    s = value.trim();
  } else {
    throw new InvalidFipsError(`invalid fips type: ${typeof value}`);
  }
  if (s.length === 0) throw new InvalidFipsError('invalid fips: empty');
  if (!/^[0-9]+$/.test(s)) throw new InvalidFipsError(`invalid fips chars: ${s}`);
  if (s.length > 5) throw new InvalidFipsError(`invalid fips too long: ${s}`);
  return s.padStart(5, '0');
}

/** True iff the value normalizes and its state prefix is known. */
export function isValidFips(value: unknown): boolean {
  try {
    const n = normalizeFips(value);
    return Object.prototype.hasOwnProperty.call(FIPS_STATE_MAP, n.slice(0, 2));
  } catch {
    return false;
  }
}

/** Return the 2-letter state abbreviation for a valid 5-digit FIPS. */
export function stateFromFips(value: unknown): string {
  const n = normalizeFips(value);
  const prefix = n.slice(0, 2);
  const abbrev = FIPS_STATE_MAP[prefix];
  if (!abbrev) throw new InvalidFipsError(`unknown state prefix: ${prefix}`);
  return abbrev;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd web && pnpm test fips`
Expected: PASS (~12 tests, matching pipeline test counts).

- [ ] **Step 6: Commit**

```bash
git add web/lib/geo/fips.ts web/tests/unit/fips.test.ts web/tests/fixtures/fips_cases.json
git commit -m "web: port fips normalization to typescript with shared fixture"
```

### Task 20: Number, date, and percent formatters

**Files:**
- Create: `web/lib/format/number.ts`
- Create: `web/lib/format/date.ts`
- Create: `web/lib/format/percent.ts`
- Create: `web/tests/unit/format.test.ts`

- [ ] **Step 1: Write the failing test**

Write to `web/tests/unit/format.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatCompact, formatFull, formatOrdinal } from '@/lib/format/number';
import { formatPercent } from '@/lib/format/percent';
import { formatYearRange, formatISODate } from '@/lib/format/date';

describe('formatCompact', () => {
  it('formats thousands', () => {
    expect(formatCompact(12_345)).toBe('12.3K');
  });
  it('formats millions', () => {
    expect(formatCompact(5_600_000)).toBe('5.6M');
  });
  it('formats billions', () => {
    expect(formatCompact(76_000_000_000)).toBe('76B');
  });
  it('formats small numbers untouched', () => {
    expect(formatCompact(42)).toBe('42');
  });
  it('handles null/undefined', () => {
    expect(formatCompact(null)).toBe('—');
    expect(formatCompact(undefined)).toBe('—');
  });
});

describe('formatFull', () => {
  it('formats with thousands separators', () => {
    expect(formatFull(1_234_567)).toBe('1,234,567');
  });
  it('handles null/undefined', () => {
    expect(formatFull(null)).toBe('—');
  });
});

describe('formatOrdinal', () => {
  it('1 → 1st', () => {
    expect(formatOrdinal(1)).toBe('1st');
  });
  it('2 → 2nd', () => {
    expect(formatOrdinal(2)).toBe('2nd');
  });
  it('3 → 3rd', () => {
    expect(formatOrdinal(3)).toBe('3rd');
  });
  it('4 → 4th', () => {
    expect(formatOrdinal(4)).toBe('4th');
  });
  it('11 → 11th', () => {
    expect(formatOrdinal(11)).toBe('11th');
  });
  it('21 → 21st', () => {
    expect(formatOrdinal(21)).toBe('21st');
  });
  it('102 → 102nd', () => {
    expect(formatOrdinal(102)).toBe('102nd');
  });
});

describe('formatPercent', () => {
  it('formats 0–100 input', () => {
    expect(formatPercent(37.5)).toBe('37.5%');
  });
  it('floors to one decimal by default', () => {
    expect(formatPercent(12.3456)).toBe('12.3%');
  });
  it('handles null', () => {
    expect(formatPercent(null)).toBe('—');
  });
});

describe('date formatters', () => {
  it('formats ISO date', () => {
    expect(formatISODate('2026-04-29')).toBe('Apr 29, 2026');
  });
  it('formats year range', () => {
    expect(formatYearRange(2006, 2014)).toBe('2006–2014');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test format`
Expected: FAIL — no format modules exist.

- [ ] **Step 3: Implement `lib/format/number.ts`**

```ts
const COMPACT_FMT = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const FULL_FMT = new Intl.NumberFormat('en-US');

export function formatCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return COMPACT_FMT.format(n);
}

export function formatFull(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return FULL_FMT.format(n);
}

const ORDINAL_RULES = new Intl.PluralRules('en-US', { type: 'ordinal' });
const ORDINAL_SUFFIXES: Record<Intl.LDMLPluralRule, string> = {
  one: 'st',
  two: 'nd',
  few: 'rd',
  other: 'th',
  zero: 'th',
  many: 'th',
};

export function formatOrdinal(n: number): string {
  const rule = ORDINAL_RULES.select(n);
  const suffix = ORDINAL_SUFFIXES[rule] ?? 'th';
  return `${n}${suffix}`;
}
```

- [ ] **Step 4: Implement `lib/format/percent.ts`**

```ts
/**
 * Format a percentage. Input is 0–100 (not 0–1) to match spec §4 share_pct.
 */
export function formatPercent(n: number | null | undefined, fractionDigits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${n.toFixed(fractionDigits)}%`;
}
```

- [ ] **Step 5: Implement `lib/format/date.ts`**

```ts
const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export function formatISODate(iso: string): string {
  // iso: "YYYY-MM-DD" → construct in UTC to avoid TZ drift
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return DATE_FMT.format(new Date(Date.UTC(y, m - 1, d)));
}

/** 2006, 2014 → "2006–2014" (en-dash) */
export function formatYearRange(start: number, end: number): string {
  if (start === end) return String(start);
  return `${start}\u2013${end}`;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd web && pnpm test format`
Expected: PASS (all ~14 tests).

- [ ] **Step 7: Commit**

```bash
git add web/lib/format/ web/tests/unit/format.test.ts
git commit -m "web: add number, percent, and date formatters"
```

### Task 21: loadCountyMeta (county-metadata.json loader)

**Files:**
- Create: `web/lib/data/loadCountyMeta.ts`
- Create: `web/tests/unit/loadCountyMeta.test.ts`

- [ ] **Step 1: Write the failing test**

Write to `web/tests/unit/loadCountyMeta.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadCountyMeta, loadCountyMetaByFips, resetCountyMetaCache } from '@/lib/data/loadCountyMeta';

describe('loadCountyMeta', () => {
  beforeEach(() => resetCountyMetaCache());

  it('returns the full county-metadata array', async () => {
    const spy = vi.spyOn(await import('node:fs/promises'), 'readFile');
    spy.mockResolvedValueOnce(
      JSON.stringify([
        { fips: '54059', name: 'Mingo County', state: 'WV', pop: 26839 },
        { fips: '51720', name: 'Norton', state: 'VA', pop: 3867 },
      ]),
    );
    const rows = await loadCountyMeta();
    expect(rows).toHaveLength(2);
    expect(rows[0]?.fips).toBe('54059');
    spy.mockRestore();
  });

  it('caches across calls', async () => {
    const spy = vi.spyOn(await import('node:fs/promises'), 'readFile');
    spy.mockResolvedValueOnce(
      JSON.stringify([{ fips: '54059', name: 'Mingo County', state: 'WV', pop: 26839 }]),
    );
    await loadCountyMeta();
    await loadCountyMeta();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('looks up one county by fips', async () => {
    const spy = vi.spyOn(await import('node:fs/promises'), 'readFile');
    spy.mockResolvedValueOnce(
      JSON.stringify([
        { fips: '54059', name: 'Mingo County', state: 'WV', pop: 26839 },
        { fips: '51720', name: 'Norton', state: 'VA', pop: 3867 },
      ]),
    );
    const row = await loadCountyMetaByFips('51720');
    expect(row?.name).toBe('Norton');
    spy.mockRestore();
  });

  it('returns null for missing fips', async () => {
    const spy = vi.spyOn(await import('node:fs/promises'), 'readFile');
    spy.mockResolvedValueOnce(JSON.stringify([]));
    const row = await loadCountyMetaByFips('99999');
    expect(row).toBeNull();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test loadCountyMeta`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the loader**

Write to `web/lib/data/loadCountyMeta.ts`:

```ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizeFips } from '@/lib/geo/fips';
import type { CountyMetadata } from '@/lib/data/schemas';

/**
 * Build-time loader for county-metadata.json. Reads directly from
 * public/data so that every route using generateStaticParams can iterate
 * all FIPS without a network round trip.
 */

const DATA_PATH = path.join(process.cwd(), 'public', 'data', 'county-metadata.json');

let cache: CountyMetadata[] | null = null;
let byFips: Map<string, CountyMetadata> | null = null;

export function resetCountyMetaCache(): void {
  cache = null;
  byFips = null;
}

export async function loadCountyMeta(): Promise<CountyMetadata[]> {
  if (cache) return cache;
  const raw = await fs.readFile(DATA_PATH, 'utf8');
  const parsed = JSON.parse(raw) as CountyMetadata[];
  cache = parsed;
  byFips = new Map(parsed.map((c) => [c.fips, c]));
  return parsed;
}

export async function loadCountyMetaByFips(fips: string): Promise<CountyMetadata | null> {
  if (!cache) await loadCountyMeta();
  const key = normalizeFips(fips);
  return byFips?.get(key) ?? null;
}

export async function loadAllFips(): Promise<string[]> {
  const rows = await loadCountyMeta();
  return rows.map((r) => r.fips);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && pnpm test loadCountyMeta`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add web/lib/data/loadCountyMeta.ts web/tests/unit/loadCountyMeta.test.ts
git commit -m "web: county-metadata loader with fips index"
```

### Task 22: Artifact loaders (timeseries, distributors, pharmacies, per-county)

Four loaders, each reading one pipeline artifact. Timeseries and distributors are small JSON; pharmacies and county-shipments are Parquet.

**Files:**
- Create: `web/lib/data/loadStateShipments.ts`
- Create: `web/lib/data/loadCountyShipments.ts`
- Create: `web/lib/data/loadTopDistributors.ts`
- Create: `web/lib/data/loadTopPharmacies.ts`
- Create: `web/lib/data/loadCDCOverdose.ts`
- Create: `web/lib/data/loadCountyBundle.ts`
- Create: `web/tests/unit/loaders.test.ts`

- [ ] **Step 1: Write the failing test**

Write to `web/tests/unit/loaders.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadStateShipments,
  resetStateShipmentsCache,
} from '@/lib/data/loadStateShipments';
import {
  loadTopDistributors,
  loadTopDistributorsByYear,
  resetTopDistributorsCache,
} from '@/lib/data/loadTopDistributors';
import { loadCountyBundle } from '@/lib/data/loadCountyBundle';

describe('loadStateShipments', () => {
  beforeEach(() => resetStateShipmentsCache());

  it('reads and caches state shipments JSON', async () => {
    const spy = vi.spyOn(await import('node:fs/promises'), 'readFile');
    spy.mockResolvedValueOnce(
      JSON.stringify([
        { state: 'WV', year: 2012, pills: 1e9, pills_per_capita: 100 },
        { state: 'VA', year: 2012, pills: 5e8, pills_per_capita: 50 },
      ]),
    );
    const rows = await loadStateShipments();
    expect(rows).toHaveLength(2);
    spy.mockRestore();
  });
});

describe('loadTopDistributors', () => {
  beforeEach(() => resetTopDistributorsCache());

  it('groups by year', async () => {
    const spy = vi.spyOn(await import('node:fs/promises'), 'readFile');
    spy.mockResolvedValueOnce(
      JSON.stringify([
        { distributor: 'McKesson', year: 2012, pills: 5e9, share_pct: 40 },
        { distributor: 'Cardinal', year: 2012, pills: 4e9, share_pct: 32 },
        { distributor: 'McKesson', year: 2013, pills: 6e9, share_pct: 42 },
      ]),
    );
    const byYear = await loadTopDistributorsByYear();
    expect(byYear.get(2012)).toHaveLength(2);
    expect(byYear.get(2013)).toHaveLength(1);
    spy.mockRestore();
  });

  it('returns full array via loadTopDistributors', async () => {
    const spy = vi.spyOn(await import('node:fs/promises'), 'readFile');
    spy.mockResolvedValueOnce(
      JSON.stringify([
        { distributor: 'McKesson', year: 2012, pills: 5e9, share_pct: 40 },
      ]),
    );
    const rows = await loadTopDistributors();
    expect(rows).toHaveLength(1);
    spy.mockRestore();
  });
});

describe('loadCountyBundle', () => {
  it('returns a structured bundle for one fips', async () => {
    // This is an integration-ish test — we stub the underlying individual
    // loaders by providing an in-memory bundle, via exposed override.
    const bundle = await loadCountyBundle('54059', {
      overrides: {
        meta: { fips: '54059', name: 'Mingo County', state: 'WV', pop: 26839 },
        shipments: [
          { fips: '54059', year: 2012, pills: 5_000_000, pills_per_capita: 186.3 },
        ],
        overdose: [
          { fips: '54059', year: 2012, deaths: 42, suppressed: false },
        ],
        pharmacies: [],
      },
    });
    expect(bundle.meta.fips).toBe('54059');
    expect(bundle.shipments).toHaveLength(1);
    expect(bundle.overdose[0]?.deaths).toBe(42);
  });

  it('throws for unknown fips when no override provided', async () => {
    await expect(loadCountyBundle('99999')).rejects.toThrow(/not found/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test loaders`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `loadStateShipments.ts`**

```ts
import fs from 'node:fs/promises';
import path from 'node:path';
import type { StateShipmentsByYear } from '@/lib/data/schemas';

const DATA_PATH = path.join(process.cwd(), 'public', 'data', 'state-shipments-by-year.json');

let cache: StateShipmentsByYear[] | null = null;

export function resetStateShipmentsCache(): void {
  cache = null;
}

export async function loadStateShipments(): Promise<StateShipmentsByYear[]> {
  if (cache) return cache;
  const raw = await fs.readFile(DATA_PATH, 'utf8');
  cache = JSON.parse(raw) as StateShipmentsByYear[];
  return cache;
}

export async function loadStateShipmentsByState(): Promise<Map<string, StateShipmentsByYear[]>> {
  const rows = await loadStateShipments();
  const grouped = new Map<string, StateShipmentsByYear[]>();
  for (const r of rows) {
    const bucket = grouped.get(r.state) ?? [];
    bucket.push(r);
    grouped.set(r.state, bucket);
  }
  for (const arr of grouped.values()) arr.sort((a, b) => a.year - b.year);
  return grouped;
}
```

- [ ] **Step 4: Implement `loadCountyShipments.ts`**

```ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { readParquetRows } from '@/lib/data/parquet';
import { normalizeFips } from '@/lib/geo/fips';
import type { CountyShipmentsByYear } from '@/lib/data/schemas';

const DATA_PATH = path.join(process.cwd(), 'public', 'data', 'county-shipments-by-year.parquet');

let cache: CountyShipmentsByYear[] | null = null;
let byFips: Map<string, CountyShipmentsByYear[]> | null = null;

export function resetCountyShipmentsCache(): void {
  cache = null;
  byFips = null;
}

export async function loadCountyShipments(): Promise<CountyShipmentsByYear[]> {
  if (cache) return cache;
  const buf = await fs.readFile(DATA_PATH);
  if (buf.byteLength === 0) {
    // Empty fixture placeholder; return no rows rather than crashing.
    cache = [];
    byFips = new Map();
    return cache;
  }
  cache = await readParquetRows<CountyShipmentsByYear>(buf);
  byFips = new Map();
  for (const row of cache) {
    const bucket = byFips.get(row.fips) ?? [];
    bucket.push(row);
    byFips.set(row.fips, bucket);
  }
  for (const arr of byFips.values()) arr.sort((a, b) => a.year - b.year);
  return cache;
}

export async function loadCountyShipmentsByFips(
  fips: string,
): Promise<CountyShipmentsByYear[]> {
  await loadCountyShipments();
  return byFips?.get(normalizeFips(fips)) ?? [];
}
```

Note: Parquet fixture at `public/data/county-shipments-by-year.parquet` may not exist when first running — Task 17 doesn't create parquet placeholders. We need a 0-byte placeholder. Add this to Task 17's retroactive list, or handle missing file here:

Alternate implementation guard (use this if the empty-file approach fails on the actual reader):

```ts
// At top of loadCountyShipments:
try {
  await fs.access(DATA_PATH);
} catch {
  cache = [];
  byFips = new Map();
  return cache;
}
```

- [ ] **Step 5: Implement `loadTopDistributors.ts`**

```ts
import fs from 'node:fs/promises';
import path from 'node:path';
import type { TopDistributorsByYear } from '@/lib/data/schemas';

const DATA_PATH = path.join(process.cwd(), 'public', 'data', 'top-distributors-by-year.json');

let cache: TopDistributorsByYear[] | null = null;
let byYear: Map<number, TopDistributorsByYear[]> | null = null;

export function resetTopDistributorsCache(): void {
  cache = null;
  byYear = null;
}

export async function loadTopDistributors(): Promise<TopDistributorsByYear[]> {
  if (cache) return cache;
  const raw = await fs.readFile(DATA_PATH, 'utf8');
  cache = JSON.parse(raw) as TopDistributorsByYear[];
  byYear = new Map();
  for (const row of cache) {
    const bucket = byYear.get(row.year) ?? [];
    bucket.push(row);
    byYear.set(row.year, bucket);
  }
  for (const arr of byYear.values()) arr.sort((a, b) => b.pills - a.pills);
  return cache;
}

export async function loadTopDistributorsByYear(): Promise<Map<number, TopDistributorsByYear[]>> {
  await loadTopDistributors();
  return byYear ?? new Map();
}
```

- [ ] **Step 6: Implement `loadTopPharmacies.ts`**

```ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { readParquetRows } from '@/lib/data/parquet';
import { normalizeFips } from '@/lib/geo/fips';
import type { TopPharmacy } from '@/lib/data/schemas';

const DATA_PATH = path.join(process.cwd(), 'public', 'data', 'top-pharmacies.parquet');

let cache: TopPharmacy[] | null = null;
let byFips: Map<string, TopPharmacy[]> | null = null;

export function resetTopPharmaciesCache(): void {
  cache = null;
  byFips = null;
}

export async function loadTopPharmacies(): Promise<TopPharmacy[]> {
  if (cache) return cache;
  try {
    await fs.access(DATA_PATH);
  } catch {
    cache = [];
    byFips = new Map();
    return cache;
  }
  const buf = await fs.readFile(DATA_PATH);
  if (buf.byteLength === 0) {
    cache = [];
    byFips = new Map();
    return cache;
  }
  cache = await readParquetRows<TopPharmacy>(buf);
  byFips = new Map();
  for (const row of cache) {
    const bucket = byFips.get(row.fips) ?? [];
    bucket.push(row);
    byFips.set(row.fips, bucket);
  }
  for (const arr of byFips.values()) arr.sort((a, b) => b.total_pills - a.total_pills);
  return cache;
}

export async function loadTopPharmaciesByFips(fips: string): Promise<TopPharmacy[]> {
  await loadTopPharmacies();
  return byFips?.get(normalizeFips(fips)) ?? [];
}
```

- [ ] **Step 7: Implement `loadCDCOverdose.ts`**

```ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { readParquetRows } from '@/lib/data/parquet';
import { normalizeFips } from '@/lib/geo/fips';
import type { CDCOverdoseByCountyYear } from '@/lib/data/schemas';

const DATA_PATH = path.join(process.cwd(), 'public', 'data', 'cdc-overdose-by-county-year.parquet');

let cache: CDCOverdoseByCountyYear[] | null = null;
let byFips: Map<string, CDCOverdoseByCountyYear[]> | null = null;

export function resetCDCOverdoseCache(): void {
  cache = null;
  byFips = null;
}

export async function loadCDCOverdose(): Promise<CDCOverdoseByCountyYear[]> {
  if (cache) return cache;
  try {
    await fs.access(DATA_PATH);
  } catch {
    cache = [];
    byFips = new Map();
    return cache;
  }
  const buf = await fs.readFile(DATA_PATH);
  if (buf.byteLength === 0) {
    cache = [];
    byFips = new Map();
    return cache;
  }
  cache = await readParquetRows<CDCOverdoseByCountyYear>(buf);
  byFips = new Map();
  for (const row of cache) {
    const bucket = byFips.get(row.fips) ?? [];
    bucket.push(row);
    byFips.set(row.fips, bucket);
  }
  for (const arr of byFips.values()) arr.sort((a, b) => a.year - b.year);
  return cache;
}

export async function loadCDCOverdoseByFips(
  fips: string,
): Promise<CDCOverdoseByCountyYear[]> {
  await loadCDCOverdose();
  return byFips?.get(normalizeFips(fips)) ?? [];
}
```

- [ ] **Step 8: Implement `loadCountyBundle.ts`**

This aggregates the per-FIPS slice required by `/county/[fips]` pages.

```ts
import { loadCountyMetaByFips } from '@/lib/data/loadCountyMeta';
import { loadCountyShipmentsByFips } from '@/lib/data/loadCountyShipments';
import { loadTopPharmaciesByFips } from '@/lib/data/loadTopPharmacies';
import { loadCDCOverdoseByFips } from '@/lib/data/loadCDCOverdose';
import type {
  CountyMetadata,
  CountyShipmentsByYear,
  TopPharmacy,
  CDCOverdoseByCountyYear,
} from '@/lib/data/schemas';

export interface CountyBundle {
  meta: CountyMetadata;
  shipments: CountyShipmentsByYear[];
  pharmacies: TopPharmacy[];
  overdose: CDCOverdoseByCountyYear[];
}

export interface CountyBundleOptions {
  /**
   * For unit tests: inject known data without touching disk.
   */
  overrides?: Partial<CountyBundle>;
}

export async function loadCountyBundle(
  fips: string,
  opts: CountyBundleOptions = {},
): Promise<CountyBundle> {
  if (opts.overrides?.meta) {
    return {
      meta: opts.overrides.meta,
      shipments: opts.overrides.shipments ?? [],
      pharmacies: opts.overrides.pharmacies ?? [],
      overdose: opts.overrides.overdose ?? [],
    };
  }
  const meta = await loadCountyMetaByFips(fips);
  if (!meta) throw new Error(`county not found: ${fips}`);
  const [shipments, pharmacies, overdose] = await Promise.all([
    loadCountyShipmentsByFips(fips),
    loadTopPharmaciesByFips(fips),
    loadCDCOverdoseByFips(fips),
  ]);
  return { meta, shipments, pharmacies, overdose };
}
```

- [ ] **Step 9: Run test to verify all pass**

Run: `cd web && pnpm test loaders`
Expected: PASS (~5 tests).

- [ ] **Step 10: Phase 3 verification gate**

```bash
cd web && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected:
- All unit tests pass
- `pnpm build` succeeds (prebuild → validate-data → next export)
- No lint or typecheck errors

- [ ] **Step 11: Commit**

```bash
git add web/lib/data/ web/tests/unit/loaders.test.ts
git commit -m "web: data loaders for all seven pipeline artifacts"
```

---

**Phase 3 gate:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Optional tag `web-phase-3-done`.

---

## Phase 4 — Static content pages (tasks 23–28)

Landing pages that don't need data munging: methodology, about, home stub, explorer stub. Dark-mode is scoped to `/methodology` and `/about` only via a `data-theme="dark"` attribute on those route segments.

### Task 23: App layout snapshot + metadata test

The layout was wired in Task 14. Now lock in expected behavior with a real snapshot.

**Files:**
- Create: `web/tests/unit/layout.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
import { describe, it, expect } from 'vitest';
import { metadata } from '@/app/layout';

describe('app/layout metadata', () => {
  it('has title default + template', () => {
    expect(metadata.title).toEqual({
      default: 'openarcos — prescription opioid distribution in the US',
      template: '%s — openarcos',
    });
  });
  it('has a non-trivial description', () => {
    expect(typeof metadata.description).toBe('string');
    expect(String(metadata.description).length).toBeGreaterThan(40);
  });
  it('opts into metadata.openGraph with siteName', () => {
    expect(metadata.openGraph).toBeDefined();
    expect(metadata.openGraph?.siteName).toBe('openarcos');
  });
});
```

- [ ] **Step 2: Run test to verify current metadata shape**

Run: `cd web && pnpm test layout`

If the existing layout doesn't expose the above metadata, adjust. Otherwise the test already passes. Expected: PASS.

- [ ] **Step 3: If adjustments needed, update `app/layout.tsx` metadata**

Ensure the layout exports this `metadata`:

```ts
export const metadata: Metadata = {
  title: {
    default: 'openarcos — prescription opioid distribution in the US',
    template: '%s — openarcos',
  },
  description:
    'An investigative map of prescription opioid shipments across US counties, 2006–2014. Built on DEA ARCOS, DEA Diversion Control, and CDC WONDER.',
  openGraph: {
    siteName: 'openarcos',
    type: 'website',
  },
  metadataBase: new URL('https://openarcos.org'),
};
```

- [ ] **Step 4: Run the test**

Run: `cd web && pnpm test layout`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/app/layout.tsx web/tests/unit/layout.test.tsx
git commit -m "web: lock in layout metadata with snapshot test"
```

### Task 24: /methodology page with Dataset JSON-LD and dark mode

**Files:**
- Create: `web/app/methodology/page.tsx`
- Create: `web/app/methodology/page.module.css`
- Create: `web/tests/unit/methodology.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Methodology from '@/app/methodology/page';

describe('/methodology', () => {
  it('renders a Dataset JSON-LD script', () => {
    const { container } = render(<Methodology />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeTruthy();
    const data = JSON.parse(script?.textContent ?? '{}');
    expect(data['@type']).toBe('Dataset');
    expect(data.name).toBeTruthy();
    expect(Array.isArray(data.distribution)).toBe(true);
  });

  it('lists all three sources with external links', () => {
    const { getByText, getAllByRole } = render(<Methodology />);
    expect(getByText(/Washington Post ARCOS/i)).toBeTruthy();
    expect(getByText(/DEA Diversion Control/i)).toBeTruthy();
    expect(getByText(/CDC WONDER/i)).toBeTruthy();
    const externals = getAllByRole('link', { name: /View at/i });
    expect(externals.length).toBeGreaterThanOrEqual(3);
  });

  it('applies dark-mode scope', () => {
    const { container } = render(<Methodology />);
    const root = container.querySelector('[data-theme="dark"]');
    expect(root).toBeTruthy();
  });

  it('exports page metadata with a title', async () => {
    const mod = await import('@/app/methodology/page');
    expect(mod.metadata?.title).toBe('Methodology');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test methodology`
Expected: FAIL — page not found.

- [ ] **Step 3: Implement the page**

Write to `web/app/methodology/page.tsx`:

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { MethodologyFooter } from '@/components/layout/MethodologyFooter';
import { Eyebrow } from '@/components/ui/Typography';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Methodology',
  description:
    'Sources, joins, caveats, and licenses for the openarcos opioid distribution analysis.',
};

const DATASET_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  name: 'openarcos county-year opioid distribution',
  description:
    'Merged, schema-validated aggregates of DEA ARCOS shipments, DEA enforcement actions, and CDC WONDER overdose deaths at the US county level.',
  url: 'https://openarcos.org/methodology',
  license: 'https://www.apache.org/licenses/LICENSE-2.0',
  creator: { '@type': 'Organization', name: 'openarcos' },
  distribution: [
    {
      '@type': 'DataDownload',
      encodingFormat: 'application/json',
      contentUrl: 'https://openarcos.org/data/county-metadata.json',
    },
    {
      '@type': 'DataDownload',
      encodingFormat: 'application/vnd.apache.parquet',
      contentUrl: 'https://openarcos.org/data/county-shipments-by-year.parquet',
    },
  ],
};

export default function Methodology() {
  return (
    <div data-theme="dark" className={styles.root}>
      <article className={styles.article}>
        <header className={styles.header}>
          <Eyebrow>Methodology</Eyebrow>
          <h1>How this site is built</h1>
          <p className={styles.lede}>
            openarcos is a static site assembled from three public datasets.
            Everything below — sources, cleaning, joins, caveats — is
            reproducible from the repo at{' '}
            <Link href="https://github.com/anomalyco/opencode">GitHub</Link>.
          </p>
        </header>

        <section id="sources">
          <h2>Sources</h2>
          <dl className={styles.sourceList}>
            <dt>Washington Post ARCOS</dt>
            <dd>
              County-, pharmacy-, and distributor-level shipments 2006–2014.{' '}
              <Link href="https://arcos-api.ext.nile.works/__swagger__/">
                View at arcos-api.ext.nile.works
              </Link>
              . Released under the Post's investigative usage terms.
            </dd>
            <dt>DEA Diversion Control</dt>
            <dd>
              Annual enforcement summaries and notable actions.{' '}
              <Link href="https://www.deadiversion.usdoj.gov/pubs/reports/index.html">
                View at deadiversion.usdoj.gov
              </Link>
              . Public domain (17 USC §105).
            </dd>
            <dt>CDC WONDER</dt>
            <dd>
              Overdose deaths by county-year via the D76 multiple-cause-of-death
              dataset.{' '}
              <Link href="https://wonder.cdc.gov/mcd.html">
                View at wonder.cdc.gov
              </Link>
              . Cells with fewer than 10 deaths are suppressed per CDC rules;
              we preserve this as a boolean flag rather than a zero.
            </dd>
          </dl>
        </section>

        <section id="joins">
          <h2>Joins</h2>
          <p>
            The pipeline builds a canonical <code>FIPS × year</code> grid from
            Census PEP population estimates, then LEFT JOINs each cleaned
            source. The result lives at <code>data/joined/master.parquet</code>{' '}
            and is the input to every emitted artifact.
          </p>
        </section>

        <section id="caveats">
          <h2>Caveats</h2>
          <ul>
            <li>
              ARCOS covers 2006–2014 only. Later years are not in this dataset.
            </li>
            <li>
              CDC suppression hides cells with fewer than 10 deaths in a
              county-year — the map shows these as "suppressed," not zero.
            </li>
            <li>
              Pill counts are in DEA "dosage units," not individual pills; a
              100mg tablet counts as one unit regardless of strength.
            </li>
            <li>
              DEA enforcement totals are scraped from annual PDFs; our counts
              are approximate and may diverge from DEA's internal tallies.
            </li>
          </ul>
        </section>

        <section id="licenses">
          <h2>Licenses</h2>
          <ul>
            <li>
              Code: Apache 2.0 —{' '}
              <Link href="https://github.com/anomalyco/opencode/blob/main/LICENSE">
                View license
              </Link>
            </li>
            <li>
              Fonts: SIL OFL 1.1 (Space Grotesk, Inter) —{' '}
              <Link href="/fonts/LICENSE-OFL.txt">View license</Link>
            </li>
            <li>
              Data: Each source's upstream license applies; see above.
            </li>
          </ul>
        </section>

        <section id="access-dates">
          <h2>Access dates</h2>
          <p>
            The data bundle is refreshed weekly by{' '}
            <code>.github/workflows/build-data.yml</code>. The build date is
            stamped in the site footer.
          </p>
        </section>

        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(DATASET_JSONLD) }}
        />
      </article>
      <MethodologyFooter />
    </div>
  );
}
```

Write to `web/app/methodology/page.module.css`:

```css
.root {
  /* data-theme="dark" inverts the surface for this route only */
  background: var(--surface);
  color: var(--text);
  min-height: 100vh;
  padding: var(--space-3xl) 0;
}

.article {
  max-width: 72ch;
  margin: 0 auto;
  padding: 0 var(--gutter);
}

.header {
  margin-bottom: var(--space-2xl);
  border-bottom: 1px solid var(--rule);
  padding-bottom: var(--space-xl);
}

.lede {
  font-size: var(--type-lede);
  color: var(--text-muted);
  max-width: 56ch;
  margin-top: var(--space-md);
}

.sourceList dt {
  font-family: var(--font-display);
  font-weight: 700;
  margin-top: var(--space-lg);
}

.sourceList dd {
  margin-left: 0;
  margin-top: var(--space-xs);
  color: var(--text-muted);
}

.article section {
  margin-top: var(--space-2xl);
}

.article h2 {
  font-size: var(--type-h2);
  margin-bottom: var(--space-md);
}

.article code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.9em;
  background: rgba(245, 236, 215, 0.08);
  padding: 0.1em 0.3em;
  border-radius: var(--radius-sm);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && pnpm test methodology`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add web/app/methodology/ web/tests/unit/methodology.test.tsx
git commit -m "web: methodology page with dataset json-ld and dark mode"
```

### Task 25: /about page with dark mode

**Files:**
- Create: `web/app/about/page.tsx`
- Create: `web/app/about/page.module.css`
- Create: `web/tests/unit/about.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import About from '@/app/about/page';

describe('/about', () => {
  it('renders heading and contact link', () => {
    render(<About />);
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    expect(screen.getByRole('link', { name: /github/i })).toBeTruthy();
  });

  it('applies dark-mode scope', () => {
    const { container } = render(<About />);
    expect(container.querySelector('[data-theme="dark"]')).toBeTruthy();
  });

  it('exports page metadata', async () => {
    const mod = await import('@/app/about/page');
    expect(mod.metadata?.title).toBe('About');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test about`
Expected: FAIL.

- [ ] **Step 3: Implement the page**

Write to `web/app/about/page.tsx`:

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { Eyebrow, Lede } from '@/components/ui/Typography';
import { MethodologyFooter } from '@/components/layout/MethodologyFooter';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'About',
  description: 'Who built openarcos and why.',
};

export default function About() {
  return (
    <div data-theme="dark" className={styles.root}>
      <article className={styles.article}>
        <Eyebrow>About</Eyebrow>
        <h1>Why this site</h1>
        <Lede>
          Between 2006 and 2014, drug companies shipped 76 billion oxycodone
          and hydrocodone pills across the United States. In a handful of
          counties, the per-capita pill count exceeds every plausible medical
          need. The Washington Post won a 2019 fight to open the DEA's ARCOS
          database; this site asks what the numbers show.
        </Lede>

        <section>
          <h2>What it is</h2>
          <p>
            openarcos is a fully static portfolio site. It joins three public
            datasets into a single browsable map. Everything is reproducible
            from the repo.
          </p>
        </section>

        <section>
          <h2>What it is not</h2>
          <p>
            This is not an accusation against any single pharmacy, distributor,
            or county. Shipment volume is not proof of wrongdoing; correlation
            with overdose deaths is not causation. Read the{' '}
            <Link href="/methodology">methodology</Link> for caveats.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            <Link href="https://github.com/anomalyco/opencode">
              GitHub
            </Link>{' '}
            — open an issue or send a PR. Press inquiries welcome via GitHub
            discussions.
          </p>
        </section>
      </article>
      <MethodologyFooter />
    </div>
  );
}
```

Write to `web/app/about/page.module.css`:

```css
.root {
  background: var(--surface);
  color: var(--text);
  min-height: 100vh;
  padding: var(--space-3xl) 0;
}

.article {
  max-width: 72ch;
  margin: 0 auto;
  padding: 0 var(--gutter);
}

.article section {
  margin-top: var(--space-xl);
}

.article h1 {
  font-size: var(--type-h1);
  margin: var(--space-sm) 0 var(--space-lg);
}

.article h2 {
  font-size: var(--type-h3);
  margin-bottom: var(--space-sm);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && pnpm test about`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/app/about/ web/tests/unit/about.test.tsx
git commit -m "web: about page with dark mode"
```

### Task 26: Dark-mode styles for /methodology and /about

The dark attribute `data-theme="dark"` was set on the article root in Tasks 24–25. Verify `styles/tokens.css` actually has rules for `[data-theme="dark"]` (Phase 2 Task 9 established this). Add missing tokens if needed.

**Files:**
- Modify: `web/styles/tokens.css:[data-theme="dark"]`
- Create: `web/tests/unit/dark-mode.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Methodology from '@/app/methodology/page';
import About from '@/app/about/page';
import Rankings from '@/app/rankings/page';

describe('dark-mode scope', () => {
  it('methodology root has data-theme=dark', () => {
    const { container } = render(<Methodology />);
    expect(container.querySelector('[data-theme="dark"]')).toBeTruthy();
  });

  it('about root has data-theme=dark', () => {
    const { container } = render(<About />);
    expect(container.querySelector('[data-theme="dark"]')).toBeTruthy();
  });

  it('rankings (content route) does NOT have data-theme=dark', () => {
    // rankings ships in Phase 7; for now this test stub-exists
    // and will be activated after that page lands.
    const mod = Rankings as unknown;
    if (typeof mod === 'function') {
      const { container } = render(<Rankings />);
      expect(container.querySelector('[data-theme="dark"]')).toBeFalsy();
    }
  });
});
```

Note: rankings doesn't exist yet — import will fail. Workaround: only write the first two assertions now; add the rankings assertion in Phase 7.

Simplified version for this task:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Methodology from '@/app/methodology/page';
import About from '@/app/about/page';

describe('dark-mode scope', () => {
  it('methodology root has data-theme=dark', () => {
    const { container } = render(<Methodology />);
    expect(container.querySelector('[data-theme="dark"]')).toBeTruthy();
  });

  it('about root has data-theme=dark', () => {
    const { container } = render(<About />);
    expect(container.querySelector('[data-theme="dark"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test**

Run: `cd web && pnpm test dark-mode`
Expected: PASS (already true from Tasks 24–25).

- [ ] **Step 3: Verify tokens.css has dark-mode tokens**

Read `web/styles/tokens.css` for `[data-theme="dark"]` block. It should already be present from Phase 2 Task 9. If missing, add:

```css
[data-theme='dark'] {
  --surface: #121212;
  --text: #f5ecd7;
  --text-muted: #a79c83;
  --rule: rgba(245, 236, 215, 0.16);
  --accent-hot: #e64a2e;
  --accent-cool: #5a9dc0;
}
```

- [ ] **Step 4: Visual smoke check**

```bash
cd web && pnpm dev --port 3000 &
sleep 3
curl -s http://localhost:3000/methodology | grep -c 'data-theme="dark"'
curl -s http://localhost:3000/about | grep -c 'data-theme="dark"'
kill %1
```

Expected: each returns `1` (the attribute appears once in each page).

- [ ] **Step 5: Commit**

```bash
git add web/styles/tokens.css web/tests/unit/dark-mode.test.tsx
git commit -m "web: verify dark-mode scope on methodology and about"
```

### Task 27: Home page stub

**Files:**
- Modify: `web/app/page.tsx`
- Create: `web/app/page.module.css`
- Create: `web/tests/unit/home.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home from '@/app/page';

describe('/', () => {
  it('renders a headline', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
  });

  it('links to /explorer', () => {
    render(<Home />);
    const link = screen.getByRole('link', { name: /explorer/i });
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/explorer');
  });

  it('shows the "76 billion pills" eyebrow stat', () => {
    render(<Home />);
    expect(screen.getByText(/76 billion/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test home`
Expected: FAIL — current stub has no such text.

- [ ] **Step 3: Implement the stub home**

Write to `web/app/page.tsx`:

```tsx
import Link from 'next/link';
import { BigNumeral } from '@/components/brand/BigNumeral';
import { Eyebrow, Lede } from '@/components/ui/Typography';
import { Button } from '@/components/ui/Button';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.root}>
      <section className={styles.hero}>
        <Eyebrow>2006–2014</Eyebrow>
        <h1 className={styles.h1}>
          Where the pills went, who sent them,
          <br />
          and who paid.
        </h1>
        <Lede>
          The DEA's ARCOS database tracks every prescription opioid shipped
          across the United States. This site lets you walk through what it
          shows — from the 76 billion pills that flowed between 2006 and 2014
          to the counties that buried their neighbors.
        </Lede>

        <div className={styles.numeral}>
          <BigNumeral value={76_000_000_000} unit="pills" compact />
        </div>

        <div className={styles.cta}>
          <Link href="/explorer" className={styles.ctaLink}>
            <Button variant="primary">Open the explorer →</Button>
          </Link>
          <p className={styles.ctaNote}>
            The full scrollytelling narrative is coming in the next release.
            In the meantime, explore the data directly.
          </p>
        </div>
      </section>
    </main>
  );
}
```

Write to `web/app/page.module.css`:

```css
.root {
  min-height: 100vh;
  padding: var(--space-4xl) 0;
  display: flex;
  align-items: center;
}

.hero {
  max-width: var(--page-max);
  margin: 0 auto;
  padding: 0 var(--gutter);
  width: 100%;
}

.h1 {
  font-size: var(--type-display-lg);
  font-family: var(--font-display);
  line-height: var(--leading-tight);
  margin: var(--space-md) 0 var(--space-lg);
  max-width: 18ch;
}

.numeral {
  margin: var(--space-2xl) 0;
}

.cta {
  margin-top: var(--space-xl);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  align-items: flex-start;
}

.ctaLink {
  text-decoration: none;
}

.ctaNote {
  color: var(--text-muted);
  max-width: 56ch;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && pnpm test home`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/app/page.tsx web/app/page.module.css web/tests/unit/home.test.tsx
git commit -m "web: home stub with hero, numeral, and explorer cta"
```

### Task 28: Explorer stub

**Files:**
- Create: `web/app/explorer/page.tsx`
- Create: `web/app/explorer/page.module.css`
- Create: `web/tests/unit/explorer-stub.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Explorer from '@/app/explorer/page';

describe('/explorer stub', () => {
  it('renders a headline', () => {
    render(<Explorer />);
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
  });

  it('has a county list fallback linking into /county/[fips]', async () => {
    render(await Explorer());
    const links = screen.getAllByRole('link');
    const countyLink = links.find((a) => a.getAttribute('href')?.startsWith('/county/'));
    expect(countyLink).toBeTruthy();
  });

  it('announces that the interactive version is coming', () => {
    render(<Explorer />);
    expect(screen.getByText(/launching/i)).toBeTruthy();
  });
});
```

Note: Since `loadCountyMeta` is async and the page is an async server component, render it as `render(await Explorer())`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test explorer-stub`
Expected: FAIL.

- [ ] **Step 3: Implement the stub**

Write to `web/app/explorer/page.tsx`:

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { loadCountyMeta } from '@/lib/data/loadCountyMeta';
import { Eyebrow, Lede } from '@/components/ui/Typography';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Explorer',
  description:
    'Browse all US counties by per-capita prescription opioid shipments, 2006–2014.',
};

export default async function Explorer() {
  const counties = await loadCountyMeta();

  return (
    <main className={styles.root}>
      <section className={styles.hero}>
        <Eyebrow>Explorer</Eyebrow>
        <h1>Every county, every year</h1>
        <Lede>
          The interactive map is launching with the full site narrative. In
          the meantime, every county has its own page with total shipments,
          peak per-capita year, top distributors, and overdose-death trend.
        </Lede>
      </section>

      <section className={styles.list}>
        <h2 className={styles.h2}>All counties ({counties.length})</h2>
        <ul className={styles.countyList}>
          {counties.map((c) => (
            <li key={c.fips}>
              <Link href={`/county/${c.fips}`}>
                {c.name}, {c.state}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
```

Write to `web/app/explorer/page.module.css`:

```css
.root {
  padding: var(--space-3xl) 0;
}

.hero,
.list {
  max-width: var(--page-max);
  margin: 0 auto;
  padding: 0 var(--gutter);
}

.list {
  margin-top: var(--space-3xl);
}

.h2 {
  font-size: var(--type-h2);
  font-family: var(--font-display);
  margin-bottom: var(--space-lg);
}

.countyList {
  columns: 4 16rem;
  column-gap: var(--space-xl);
  list-style: none;
  padding: 0;
  margin: 0;
}

.countyList li {
  break-inside: avoid;
  padding: var(--space-2xs) 0;
}

.countyList a {
  color: var(--text);
  text-decoration: none;
  border-bottom: 1px solid transparent;
}

.countyList a:hover {
  border-bottom-color: var(--accent-cool);
}
```

- [ ] **Step 4: Adjust test for async component**

If vitest async rendering of server components is awkward, simpler approach: export a default test that exercises the list using a mocked loader.

Alternative test using mock:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/data/loadCountyMeta', () => ({
  loadCountyMeta: async () => [
    { fips: '54059', name: 'Mingo County', state: 'WV', pop: 26839 },
  ],
}));

import Explorer from '@/app/explorer/page';

describe('/explorer stub', () => {
  it('renders county list with links', async () => {
    const ui = await Explorer();
    render(ui);
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    const countyLink = screen.getByText(/Mingo County/i);
    expect(countyLink.closest('a')?.getAttribute('href')).toBe('/county/54059');
  });

  it('announces launching soon', async () => {
    const ui = await Explorer();
    render(ui);
    expect(screen.getByText(/launching/i)).toBeTruthy();
  });
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd web && pnpm test explorer-stub`
Expected: PASS (2 tests).

- [ ] **Step 6: Phase 4 verification gate**

```bash
cd web && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected:
- All unit tests pass
- `/`, `/methodology`, `/about`, `/explorer` routes all render in the static export
- Build output at `web/out/` contains `.html` files for each route

- [ ] **Step 7: Commit**

```bash
git add web/app/explorer/ web/tests/unit/explorer-stub.test.tsx
git commit -m "web: explorer stub with fallback county list"
```

---

**Phase 4 gate:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Optional tag `web-phase-4-done`.

---

## Phase 5 — Small charts (tasks 29–33)

Four visual primitives used by `/rankings`, `/county/[fips]`, and (eventually) the scrolly acts in Plan 3. Every chart must render in SSG (no browser-only APIs at build), expose an `aria-label` summary, and include a `<details><table>` fallback for accessibility.

### Task 29: Install dependencies + shared helpers

**Files:**
- Modify: `web/package.json` (adds deps)
- Create: `web/components/charts/helpers.ts`
- Create: `web/components/charts/charts.module.css`
- Create: `web/tests/unit/chart-helpers.test.ts`

- [ ] **Step 1: Add deps**

```bash
cd web && pnpm add @observablehq/plot@~0.6 d3@~7
pnpm add -D @types/d3@~7
```

- [ ] **Step 2: Write the failing test**

Write to `web/tests/unit/chart-helpers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { rowsToTable, summarizeTrend } from '@/components/charts/helpers';

describe('rowsToTable', () => {
  it('returns a clean 2D array with headers first', () => {
    const table = rowsToTable(
      [
        { year: 2012, pills: 1000 },
        { year: 2013, pills: 2000 },
      ],
      ['year', 'pills'],
    );
    expect(table[0]).toEqual(['year', 'pills']);
    expect(table[1]).toEqual(['2012', '1,000']);
    expect(table[2]).toEqual(['2013', '2,000']);
  });

  it('formats numbers with full precision', () => {
    const [, row1] = rowsToTable([{ n: 1_234_567 }], ['n']);
    expect(row1?.[0]).toBe('1,234,567');
  });
});

describe('summarizeTrend', () => {
  it('summarizes a monotonic rise', () => {
    const summary = summarizeTrend([
      { year: 2006, value: 100 },
      { year: 2012, value: 300 },
    ]);
    expect(summary).toMatch(/rose from 100 to 300/);
  });

  it('summarizes a fall', () => {
    const summary = summarizeTrend([
      { year: 2006, value: 500 },
      { year: 2014, value: 100 },
    ]);
    expect(summary).toMatch(/fell from 500 to 100/);
  });

  it('handles a single point gracefully', () => {
    const summary = summarizeTrend([{ year: 2012, value: 100 }]);
    expect(summary).toMatch(/100/);
  });

  it('returns empty string for zero rows', () => {
    expect(summarizeTrend([])).toBe('');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd web && pnpm test chart-helpers`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement helpers**

Write to `web/components/charts/helpers.ts`:

```ts
import { formatFull } from '@/lib/format/number';

/**
 * Convert a row-oriented dataset into a 2D array suitable for a
 * `<details><table>` a11y fallback. Numbers are formatted with thousands
 * separators; other values are stringified.
 */
export function rowsToTable<T extends Record<string, unknown>>(
  rows: T[],
  columns: ReadonlyArray<keyof T & string>,
): string[][] {
  const header: string[] = [...columns];
  const body = rows.map((row) =>
    columns.map((col) => {
      const v = row[col];
      if (typeof v === 'number') return formatFull(v);
      if (v === null || v === undefined) return '—';
      return String(v);
    }),
  );
  return [header, ...body];
}

/**
 * One-line English summary of a time series for screen readers.
 */
export function summarizeTrend(
  points: Array<{ year: number; value: number | null }>,
): string {
  const present = points.filter((p): p is { year: number; value: number } => p.value !== null);
  if (present.length === 0) return '';
  const first = present[0];
  const last = present[present.length - 1];
  if (!first || !last) return '';
  if (present.length === 1) return `${formatFull(first.value)} in ${first.year}.`;
  const verb = last.value > first.value ? 'rose' : last.value < first.value ? 'fell' : 'held';
  return `${verb} from ${formatFull(first.value)} in ${first.year} to ${formatFull(last.value)} in ${last.year}.`;
}
```

Write to `web/components/charts/charts.module.css`:

```css
.root {
  display: block;
  max-width: 100%;
}

.root svg {
  display: block;
  max-width: 100%;
  height: auto;
  font-family: var(--font-body);
  font-feature-settings: var(--font-feature-numeric);
}

.details {
  margin-top: var(--space-sm);
  font-size: var(--type-sm);
  color: var(--text-muted);
}

.details summary {
  cursor: pointer;
  font-family: var(--font-display);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.details table {
  margin-top: var(--space-sm);
  border-collapse: collapse;
  width: 100%;
  font-variant-numeric: var(--numeric);
}

.details th,
.details td {
  text-align: left;
  padding: var(--space-2xs) var(--space-sm);
  border-bottom: 1px solid var(--rule);
}

.details td {
  color: var(--text);
}

.sparkline {
  vertical-align: middle;
}

.sparkline path {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd web && pnpm test chart-helpers`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add web/components/charts/ web/tests/unit/chart-helpers.test.ts \
        web/package.json web/pnpm-lock.yaml
git commit -m "web: chart helpers and shared styles"
```

### Task 30: TimeSeries chart (Observable Plot wrapper)

**Files:**
- Create: `web/components/charts/TimeSeries.tsx`
- Create: `web/tests/unit/chart-timeseries.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimeSeries } from '@/components/charts/TimeSeries';

const DATA = [
  { year: 2006, value: 100 },
  { year: 2010, value: 300 },
  { year: 2014, value: 200 },
];

describe('TimeSeries', () => {
  it('renders an svg', () => {
    const { container } = render(
      <TimeSeries data={DATA} x="year" y="value" ariaLabel="Test trend" />,
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('exposes an aria-label summary', () => {
    const { container } = render(
      <TimeSeries data={DATA} x="year" y="value" ariaLabel="pills per year" />,
    );
    const root = container.firstElementChild;
    expect(root?.getAttribute('aria-label')).toMatch(/pills per year/);
  });

  it('renders a <details> fallback table with all points', () => {
    render(<TimeSeries data={DATA} x="year" y="value" ariaLabel="t" />);
    const summary = screen.getByText(/show data/i);
    expect(summary).toBeTruthy();
    expect(screen.getByText('2006')).toBeTruthy();
    expect(screen.getByText('2014')).toBeTruthy();
  });

  it('handles empty data without crashing', () => {
    const { container } = render(<TimeSeries data={[]} x="year" y="value" ariaLabel="t" />);
    expect(container.querySelector('[role="figure"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test chart-timeseries`
Expected: FAIL.

- [ ] **Step 3: Implement**

Write to `web/components/charts/TimeSeries.tsx`:

```tsx
import * as Plot from '@observablehq/plot';
import type { ReactElement } from 'react';
import { rowsToTable, summarizeTrend } from './helpers';
import styles from './charts.module.css';

export interface TimeSeriesProps<T extends Record<string, unknown>> {
  data: T[];
  x: keyof T & string;
  y: keyof T & string;
  /** Optional series key — each unique value becomes its own line */
  series?: keyof T & string;
  /** Width in CSS pixels; defaults to responsive 640 */
  width?: number;
  /** Height in CSS pixels; defaults to 280 */
  height?: number;
  /** Color override for single-series charts */
  color?: string;
  /** Short description for aria-label */
  ariaLabel: string;
}

export function TimeSeries<T extends Record<string, unknown>>(
  props: TimeSeriesProps<T>,
): ReactElement {
  const { data, x, y, series, width = 640, height = 280, color, ariaLabel } = props;
  const columns = series ? [x, series, y] : [x, y];

  const summary =
    data.length > 0
      ? summarizeTrend(
          data
            .filter((d): d is T & Record<string, number> => typeof d[x] === 'number')
            .map((d) => ({
              year: d[x] as number,
              value: typeof d[y] === 'number' ? (d[y] as number) : null,
            })),
        )
      : '';

  const chart =
    data.length > 0
      ? Plot.plot({
          width,
          height,
          marginLeft: 56,
          marginBottom: 36,
          x: { label: String(x), tickFormat: 'd', grid: false },
          y: {
            label: String(y),
            grid: true,
            nice: true,
          },
          marks: [
            series
              ? Plot.line(data, { x, y, stroke: series, strokeWidth: 1.8 })
              : Plot.line(data, { x, y, stroke: color ?? 'var(--accent-cool)', strokeWidth: 2 }),
            Plot.dot(data, { x, y, fill: 'currentColor', r: 2.5 }),
          ],
        })
      : null;

  return (
    <figure
      role="figure"
      aria-label={`${ariaLabel}. ${summary}`}
      className={styles.root}
    >
      {chart && <PlotRender plot={chart} />}
      <details className={styles.details}>
        <summary>Show data</summary>
        <DataTable rows={data} columns={columns} />
      </details>
    </figure>
  );
}

function PlotRender({ plot }: { plot: ReturnType<typeof Plot.plot> }): ReactElement {
  // Plot returns an SVGSVGElement; Next RSC can serialise via outerHTML.
  const html = plot.outerHTML;
  return (
    <div
      aria-hidden="true"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function DataTable<T extends Record<string, unknown>>({
  rows,
  columns,
}: {
  rows: T[];
  columns: Array<keyof T & string>;
}): ReactElement {
  const table = rowsToTable(rows, columns);
  const [header, ...body] = table;
  return (
    <table>
      <thead>
        <tr>
          {header?.map((h) => <th key={h}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {body.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => <td key={j}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && pnpm test chart-timeseries`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add web/components/charts/TimeSeries.tsx web/tests/unit/chart-timeseries.test.tsx
git commit -m "web: TimeSeries chart with a11y fallback"
```

### Task 31: Bar chart (horizontal, tabular-figure labels)

**Files:**
- Create: `web/components/charts/Bar.tsx`
- Create: `web/tests/unit/chart-bar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Bar } from '@/components/charts/Bar';

const DATA = [
  { label: 'McKesson', value: 5_000_000_000 },
  { label: 'Cardinal', value: 4_000_000_000 },
  { label: 'AmerisourceBergen', value: 3_000_000_000 },
];

describe('Bar', () => {
  it('renders a bar per item', () => {
    const { container } = render(<Bar data={DATA} ariaLabel="top distributors" />);
    expect(container.querySelectorAll('rect').length).toBeGreaterThanOrEqual(3);
  });

  it('labels include tabular-figure-formatted numbers', () => {
    render(<Bar data={DATA} ariaLabel="top distributors" />);
    expect(screen.getByText(/5\.0B|5B/)).toBeTruthy();
  });

  it('exposes aria-label summary mentioning the top item', () => {
    const { container } = render(<Bar data={DATA} ariaLabel="top distributors" />);
    const figure = container.querySelector('[role="figure"]');
    expect(figure?.getAttribute('aria-label')).toMatch(/top distributors/i);
    expect(figure?.getAttribute('aria-label')).toMatch(/McKesson/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test chart-bar`
Expected: FAIL.

- [ ] **Step 3: Implement**

Write to `web/components/charts/Bar.tsx`:

```tsx
import type { ReactElement } from 'react';
import { formatCompact, formatFull } from '@/lib/format/number';
import { rowsToTable } from './helpers';
import styles from './charts.module.css';

export interface BarProps<T extends Record<string, unknown>> {
  data: T[];
  label?: keyof T & string;
  value?: keyof T & string;
  width?: number;
  /** Row height in px; total height = rows * rowHeight */
  rowHeight?: number;
  /** Optional highlight selector */
  highlight?: (row: T) => boolean;
  ariaLabel: string;
}

export function Bar<T extends Record<string, unknown>>(props: BarProps<T>): ReactElement {
  const {
    data,
    label = 'label' as keyof T & string,
    value = 'value' as keyof T & string,
    width = 560,
    rowHeight = 28,
    highlight,
    ariaLabel,
  } = props;

  const rows = [...data].sort(
    (a, b) => (Number(b[value]) ?? 0) - (Number(a[value]) ?? 0),
  );
  const max = rows.reduce((m, r) => Math.max(m, Number(r[value]) ?? 0), 0);
  const labelWidth = 160;
  const valueWidth = 72;
  const barWidth = width - labelWidth - valueWidth - 16;
  const height = rows.length * rowHeight;
  const top = rows[0];
  const summary = top
    ? `${ariaLabel}. Top: ${String(top[label])} at ${formatFull(Number(top[value]))}.`
    : ariaLabel;

  return (
    <figure role="figure" aria-label={summary} className={styles.root}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
      >
        {rows.map((row, i) => {
          const v = Number(row[value]) ?? 0;
          const w = max > 0 ? (v / max) * barWidth : 0;
          const y = i * rowHeight;
          const isHi = highlight ? highlight(row) : false;
          return (
            <g key={String(row[label])} transform={`translate(0, ${y})`}>
              <text
                x={0}
                y={rowHeight / 2}
                dominantBaseline="middle"
                fontSize="13"
                fill="currentColor"
              >
                {String(row[label])}
              </text>
              <rect
                x={labelWidth}
                y={rowHeight * 0.2}
                width={w}
                height={rowHeight * 0.6}
                fill={isHi ? 'var(--accent-hot)' : 'var(--accent-cool)'}
                rx={2}
              />
              <text
                x={labelWidth + w + 6}
                y={rowHeight / 2}
                dominantBaseline="middle"
                fontSize="13"
                fill="currentColor"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatCompact(v)}
              </text>
            </g>
          );
        })}
      </svg>
      <details className={styles.details}>
        <summary>Show data</summary>
        <Table rows={rows} columns={[label, value]} />
      </details>
    </figure>
  );
}

function Table<T extends Record<string, unknown>>({
  rows,
  columns,
}: {
  rows: T[];
  columns: Array<keyof T & string>;
}): ReactElement {
  const table = rowsToTable(rows, columns);
  const [header, ...body] = table;
  return (
    <table>
      <thead>
        <tr>{header?.map((h) => <th key={h}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {body.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => <td key={j}>{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && pnpm test chart-bar`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/components/charts/Bar.tsx web/tests/unit/chart-bar.test.tsx
git commit -m "web: horizontal Bar chart with tabular figures"
```

### Task 32: Sparkline (inline 100×24)

**Files:**
- Create: `web/components/charts/Sparkline.tsx`
- Create: `web/tests/unit/chart-sparkline.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Sparkline } from '@/components/charts/Sparkline';

describe('Sparkline', () => {
  it('renders inline svg of default size', () => {
    const { container } = render(<Sparkline values={[1, 2, 3, 4, 5]} ariaLabel="rising" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('width')).toBe('100');
    expect(svg?.getAttribute('height')).toBe('24');
  });

  it('exposes aria-label', () => {
    const { container } = render(<Sparkline values={[1, 2]} ariaLabel="trend" />);
    expect(container.firstElementChild?.getAttribute('aria-label')).toBe('trend');
  });

  it('renders nothing visible for < 2 points but is not null', () => {
    const { container } = render(<Sparkline values={[]} ariaLabel="empty" />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test chart-sparkline`
Expected: FAIL.

- [ ] **Step 3: Implement**

Write to `web/components/charts/Sparkline.tsx`:

```tsx
import type { ReactElement } from 'react';
import styles from './charts.module.css';

export interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  ariaLabel: string;
}

export function Sparkline(props: SparklineProps): ReactElement {
  const { values, width = 100, height = 24, ariaLabel } = props;
  const path = toPath(values, width, height);
  return (
    <svg
      className={styles.sparkline}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
    >
      {path && <path d={path} />}
    </svg>
  );
}

function toPath(values: number[], width: number, height: number): string | null {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const y = (v: number) => height - ((v - min) / span) * (height - 2) - 1;
  const pts = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${y(v).toFixed(1)}`);
  return pts.join(' ');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && pnpm test chart-sparkline`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/components/charts/Sparkline.tsx web/tests/unit/chart-sparkline.test.tsx
git commit -m "web: inline Sparkline primitive"
```

### Task 33: Slope chart (two-column with ghosting)

**Files:**
- Create: `web/components/charts/Slope.tsx`
- Create: `web/tests/unit/chart-slope.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Slope } from '@/components/charts/Slope';

const DATA = [
  { name: 'McKesson', start: 3_000_000_000, end: 6_000_000_000 },
  { name: 'Cardinal', start: 2_500_000_000, end: 4_500_000_000 },
  { name: 'Mom & Pop', start: 1_000_000, end: 800_000 },
];

describe('Slope', () => {
  it('renders labels for each row', () => {
    render(
      <Slope
        data={DATA}
        left={{ key: 'start', label: '2006' }}
        right={{ key: 'end', label: '2014' }}
        rowLabelKey="name"
        ariaLabel="top distributors 2006–2014"
      />,
    );
    expect(screen.getByText('McKesson')).toBeTruthy();
    expect(screen.getByText('Cardinal')).toBeTruthy();
  });

  it('applies featured emphasis via highlight', () => {
    const { container } = render(
      <Slope
        data={DATA}
        left={{ key: 'start', label: '2006' }}
        right={{ key: 'end', label: '2014' }}
        rowLabelKey="name"
        highlight={(d) => d.name === 'McKesson'}
        ariaLabel="top"
      />,
    );
    const strokes = Array.from(container.querySelectorAll('line')).map((l) =>
      l.getAttribute('stroke'),
    );
    expect(strokes.some((s) => s?.includes('accent-hot'))).toBe(true);
  });

  it('has aria-label', () => {
    const { container } = render(
      <Slope
        data={DATA}
        left={{ key: 'start', label: '2006' }}
        right={{ key: 'end', label: '2014' }}
        rowLabelKey="name"
        ariaLabel="top distributors 2006–2014"
      />,
    );
    expect(
      container.querySelector('[role="figure"]')?.getAttribute('aria-label'),
    ).toMatch(/top distributors/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && pnpm test chart-slope`
Expected: FAIL.

- [ ] **Step 3: Implement**

Write to `web/components/charts/Slope.tsx`:

```tsx
import type { ReactElement } from 'react';
import styles from './charts.module.css';

export interface SlopeProps<T extends Record<string, unknown>> {
  data: T[];
  left: { key: keyof T & string; label: string };
  right: { key: keyof T & string; label: string };
  rowLabelKey: keyof T & string;
  highlight?: (row: T) => boolean;
  width?: number;
  height?: number;
  ariaLabel: string;
}

export function Slope<T extends Record<string, unknown>>(
  props: SlopeProps<T>,
): ReactElement {
  const {
    data,
    left,
    right,
    rowLabelKey,
    highlight,
    width = 480,
    height = 320,
    ariaLabel,
  } = props;

  const xLeft = 140;
  const xRight = width - 140;
  const values = data.flatMap((d) => [Number(d[left.key]) ?? 0, Number(d[right.key]) ?? 0]);
  const max = Math.max(...values, 1);
  const y = (v: number) => height - (v / max) * (height - 40) - 20;

  return (
    <figure role="figure" aria-label={ariaLabel} className={styles.root}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <text x={xLeft} y={12} textAnchor="middle" fontSize="12" fill="currentColor">
          {left.label}
        </text>
        <text x={xRight} y={12} textAnchor="middle" fontSize="12" fill="currentColor">
          {right.label}
        </text>
        {data.map((row, i) => {
          const a = Number(row[left.key]) ?? 0;
          const b = Number(row[right.key]) ?? 0;
          const isHi = highlight ? highlight(row) : false;
          const stroke = isHi ? 'var(--accent-hot)' : 'var(--text-muted)';
          const strokeOpacity = isHi ? 1 : 0.35;
          return (
            <g key={i}>
              <line
                x1={xLeft}
                y1={y(a)}
                x2={xRight}
                y2={y(b)}
                stroke={stroke}
                strokeOpacity={strokeOpacity}
                strokeWidth={isHi ? 2 : 1}
              />
              <text
                x={xLeft - 8}
                y={y(a)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="12"
                fill={isHi ? 'var(--text)' : 'var(--text-muted)'}
              >
                {String(row[rowLabelKey])}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && pnpm test chart-slope`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/components/charts/Slope.tsx web/tests/unit/chart-slope.test.tsx
git commit -m "web: Slope chart with highlight emphasis"
```

**Phase 5 gate:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Optional tag `web-phase-5-done`.

---

## Phase 6 — Search (tasks 34–38)

Grouped fuzzy search across 5 entity types. Lazy-loads the `search-index.json` on first input focus so the payload doesn't block initial page render. **Per design decision, the index includes every county, city, zip, distributor, and pharmacy (no top-N pharmacy cap), making the file ~8–12 MB.** The hook mitigates with a "Loading…" indicator and a sessionStorage cache (populated after first successful load) so subsequent pages on the same session reuse it without re-downloading.

> **Note for Plan 3:** If post-launch telemetry shows the initial search interaction is slow on mid-tier mobile, revisit the decision to include all pharmacies. Options: top-N cap per county, or a two-tier index (places/distributors load immediately; pharmacies load on pharmacy-scoped query).

### Task 34 — `useSearchIndex` hook

**Files:**
- Create: `web/components/search/useSearchIndex.ts`
- Create: `web/tests/unit/useSearchIndex.test.tsx`

- [ ] **Step 1: Install MiniSearch**

Run:

```bash
pnpm add minisearch@~7.2
```

Expected: `minisearch` added to dependencies.

- [ ] **Step 2: Write the failing test**

```tsx
// web/tests/unit/useSearchIndex.test.tsx
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSearchIndex, resetSearchIndexCache } from "@/components/search/useSearchIndex";

const FIXTURE = [
  { type: "county", id: "54059", label: "Mingo County", sublabel: "WV", fips: "54059", state: "WV", total_pills: 123456 },
  { type: "city", id: "city:54:williamson", label: "Williamson", sublabel: "WV", state: "WV" },
  { type: "distributor", id: "distributor:mckesson", label: "McKesson", sublabel: "distributor", total_pills: 999 },
  { type: "pharmacy", id: "pharmacy:1", label: "Tug Valley Pharmacy", sublabel: "Williamson, WV", fips: "54059", state: "WV", total_pills: 5000 },
  { type: "zip", id: "zip:25661", label: "25661", sublabel: "Williamson, WV", state: "WV" },
];

beforeEach(() => {
  resetSearchIndexCache();
  globalThis.sessionStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(FIXTURE), { status: 200, headers: { "content-type": "application/json" } })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useSearchIndex", () => {
  it("starts idle, loads on load(), exposes MiniSearch", async () => {
    const { result } = renderHook(() => useSearchIndex());
    expect(result.current.status).toBe("idle");

    await act(async () => {
      await result.current.load();
    });

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.entries).toHaveLength(5);
    const hits = result.current.search("mingo");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.id).toBe("54059");
  });

  it("caches in sessionStorage and skips fetch on second hook instance", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const { result: r1 } = renderHook(() => useSearchIndex());
    await act(async () => {
      await r1.current.load();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resetSearchIndexCache(); // in-memory only; sessionStorage survives
    const { result: r2 } = renderHook(() => useSearchIndex());
    await act(async () => {
      await r2.current.load();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1); // not called again
    expect(r2.current.entries).toHaveLength(5);
  });

  it("returns status=error on fetch failure and exposes a retry via load()", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    const { result } = renderHook(() => useSearchIndex());
    await act(async () => {
      await result.current.load();
    });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error?.message).toContain("network down");

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(FIXTURE), { status: 200 }));
    await act(async () => {
      await result.current.load();
    });
    await waitFor(() => expect(result.current.status).toBe("ready"));
  });
});
```

- [ ] **Step 3: Run the test and see it fail**

Run:

```bash
pnpm test -- useSearchIndex
```

Expected: FAIL — module does not exist.

- [ ] **Step 4: Implement `useSearchIndex`**

```ts
// web/components/search/useSearchIndex.ts
"use client";

import MiniSearch from "minisearch";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SearchIndexEntry } from "@/lib/data/schemas";

const SEARCH_INDEX_URL = "/data/search-index.json";
const SESSION_KEY = "openarcos:search-index:v1";

// Module-level cache so multiple hook instances share the same loaded index.
let cachedEntries: SearchIndexEntry[] | null = null;
let cachedMini: MiniSearch<SearchIndexEntry> | null = null;
let inflight: Promise<void> | null = null;

export function resetSearchIndexCache(): void {
  cachedEntries = null;
  cachedMini = null;
  inflight = null;
}

export type SearchIndexStatus = "idle" | "loading" | "ready" | "error";

export interface UseSearchIndexResult {
  status: SearchIndexStatus;
  error: Error | null;
  entries: SearchIndexEntry[];
  search: (query: string, opts?: { limit?: number }) => SearchIndexEntry[];
  load: () => Promise<void>;
}

function buildMini(entries: SearchIndexEntry[]): MiniSearch<SearchIndexEntry> {
  const mini = new MiniSearch<SearchIndexEntry>({
    idField: "id",
    fields: ["label", "sublabel"],
    storeFields: ["type", "id", "label", "sublabel", "fips", "state", "total_pills"],
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
      boost: { label: 2 },
    },
  });
  mini.addAll(entries);
  return mini;
}

function tryReadSession(): SearchIndexEntry[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SearchIndexEntry[];
  } catch {
    return null;
  }
}

function writeSession(entries: SearchIndexEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(entries));
  } catch {
    // quota exceeded — swallow; the next page load will re-fetch
  }
}

export function useSearchIndex(): UseSearchIndexResult {
  const [status, setStatus] = useState<SearchIndexStatus>(cachedEntries ? "ready" : "idle");
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (cachedEntries && cachedMini) {
      setStatus("ready");
      return;
    }

    // Try sessionStorage first.
    const session = tryReadSession();
    if (session) {
      cachedEntries = session;
      cachedMini = buildMini(session);
      if (mountedRef.current) setStatus("ready");
      return;
    }

    if (inflight) {
      await inflight;
      if (mountedRef.current) setStatus(cachedEntries ? "ready" : "error");
      return;
    }

    setStatus("loading");
    setError(null);

    inflight = (async () => {
      try {
        const res = await fetch(SEARCH_INDEX_URL, { credentials: "omit" });
        if (!res.ok) throw new Error(`search-index.json fetch failed: ${res.status}`);
        const entries = (await res.json()) as SearchIndexEntry[];
        cachedEntries = entries;
        cachedMini = buildMini(entries);
        writeSession(entries);
      } catch (err) {
        cachedEntries = null;
        cachedMini = null;
        throw err;
      } finally {
        inflight = null;
      }
    })();

    try {
      await inflight;
      if (mountedRef.current) setStatus("ready");
    } catch (err) {
      if (mountedRef.current) {
        setStatus("error");
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }, []);

  const search = useCallback((query: string, opts?: { limit?: number }) => {
    if (!cachedMini || !query.trim()) return [];
    const limit = opts?.limit ?? 25;
    const hits = cachedMini.search(query, { combineWith: "AND" });
    const byId = new Map<string, SearchIndexEntry>(
      (cachedEntries ?? []).map((e) => [e.id, e]),
    );
    const out: SearchIndexEntry[] = [];
    for (const hit of hits) {
      const entry = byId.get(String(hit.id));
      if (entry) out.push(entry);
      if (out.length >= limit) break;
    }
    return out;
  }, []);

  const entries = useMemo(() => cachedEntries ?? [], [status]);

  return { status, error, entries, search, load };
}
```

- [ ] **Step 5: Run the test and see it pass**

Run:

```bash
pnpm test -- useSearchIndex
```

Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add web/components/search/useSearchIndex.ts web/tests/unit/useSearchIndex.test.tsx web/package.json web/pnpm-lock.yaml
git commit -m "web: add useSearchIndex hook with sessionStorage cache"
```

---

### Task 35 — `SearchBox` component

**Files:**
- Create: `web/components/search/SearchBox.tsx`
- Create: `web/components/search/SearchBox.module.css`

- [ ] **Step 1: Module CSS**

```css
/* web/components/search/SearchBox.module.css */
.root {
  position: relative;
  display: inline-block;
  width: 100%;
  max-width: 320px;
}

.input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-family: var(--font-body);
  font-size: var(--type-body);
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--rule);
  border-radius: var(--radius-sm);
  transition: border-color var(--motion-fast) ease;
}

.input:focus {
  outline: 2px solid var(--accent-cool);
  outline-offset: 2px;
  border-color: var(--accent-cool);
}

.panel {
  position: absolute;
  top: calc(100% + 0.25rem);
  left: 0;
  right: 0;
  z-index: var(--z-popover);
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  max-height: 60vh;
  overflow: auto;
  padding: 0.5rem 0;
}

.status {
  padding: 0.5rem 0.75rem;
  color: var(--text-muted);
  font-size: var(--type-caption);
}

.group {
  padding: 0.25rem 0;
}

.groupHeader {
  padding: 0.25rem 0.75rem;
  font-family: var(--font-display);
  font-size: var(--type-eyebrow);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.item {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  cursor: pointer;
  text-decoration: none;
  color: var(--text);
}

.item:hover,
.item[data-active="true"] {
  background: var(--canvas-shade);
}

.itemLabel {
  font-weight: 500;
}

.itemSub {
  color: var(--text-muted);
  font-size: var(--type-caption);
}
```

- [ ] **Step 2: Implement `SearchBox`**

```tsx
// web/components/search/SearchBox.tsx
"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useSearchIndex } from "./useSearchIndex";
import type { SearchIndexEntry } from "@/lib/data/schemas";
import styles from "./SearchBox.module.css";

const GROUP_DEFS: Array<{ key: "places" | "distributors" | "pharmacies"; label: string; types: SearchIndexEntry["type"][] }> = [
  { key: "places", label: "Places", types: ["county", "city", "zip"] },
  { key: "distributors", label: "Distributors", types: ["distributor"] },
  { key: "pharmacies", label: "Pharmacies", types: ["pharmacy"] },
];

const MAX_PER_GROUP = 5;

function groupResults(hits: SearchIndexEntry[]): Array<{ key: string; label: string; items: SearchIndexEntry[] }> {
  return GROUP_DEFS.map((g) => ({
    key: g.key,
    label: g.label,
    items: hits.filter((h) => g.types.includes(h.type)).slice(0, MAX_PER_GROUP),
  })).filter((g) => g.items.length > 0);
}

function hrefFor(entry: SearchIndexEntry): string {
  if (entry.type === "county" && entry.fips) return `/county/${entry.fips}`;
  if (entry.type === "city" && entry.fips) return `/county/${entry.fips}`;
  if (entry.type === "zip" && entry.fips) return `/county/${entry.fips}`;
  if (entry.type === "pharmacy" && entry.fips) return `/county/${entry.fips}`;
  // distributors currently have no dedicated page (v2); link to rankings anchor
  if (entry.type === "distributor") return `/rankings#distributor-${entry.id.replace(/^distributor:/, "")}`;
  return "/rankings";
}

export function SearchBox({ placeholder = "Search counties, distributors, pharmacies…" }: { placeholder?: string }) {
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const { status, error, search, load } = useSearchIndex();

  const groups = useMemo(() => (query.trim() ? groupResults(search(query, { limit: 30 })) : []), [query, search]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // Lazy-load the index on first focus.
  const onFocus = () => {
    setOpen(true);
    if (status === "idle") void load();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIdx >= 0 && flat[activeIdx]) {
      e.preventDefault();
      const target = flat[activeIdx]!;
      window.location.assign(hrefFor(target));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIdx(-1);
      inputRef.current?.blur();
    }
  };

  useEffect(() => {
    setActiveIdx(-1);
  }, [query]);

  return (
    <div className={styles.root}>
      <label htmlFor={`${listboxId}-input`} className="visually-hidden">
        Search
      </label>
      <input
        id={`${listboxId}-input`}
        ref={inputRef}
        type="search"
        className={styles.input}
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={onFocus}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeIdx >= 0 ? `${listboxId}-opt-${activeIdx}` : undefined}
      />
      {open && (
        <div id={listboxId} role="listbox" className={styles.panel}>
          {status === "loading" && <div className={styles.status}>Loading search index…</div>}
          {status === "error" && (
            <div className={styles.status}>
              Search index failed to load. <button type="button" onClick={() => void load()}>Retry</button>
              {error ? ` (${error.message})` : null}
            </div>
          )}
          {status === "ready" && query.trim() && groups.length === 0 && (
            <div className={styles.status}>No matches for “{query}”</div>
          )}
          {status === "ready" &&
            groups.map((g) => (
              <div key={g.key} className={styles.group}>
                <div className={styles.groupHeader}>{g.label}</div>
                {g.items.map((entry) => {
                  const idx = flat.indexOf(entry);
                  return (
                    <Link
                      key={entry.id}
                      id={`${listboxId}-opt-${idx}`}
                      role="option"
                      aria-selected={idx === activeIdx}
                      data-active={idx === activeIdx}
                      className={styles.item}
                      href={hrefFor(entry) as never}
                    >
                      <span className={styles.itemLabel}>{entry.label}</span>
                      {entry.sublabel && <span className={styles.itemSub}>{entry.sublabel}</span>}
                    </Link>
                  );
                })}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web/components/search/SearchBox.tsx web/components/search/SearchBox.module.css
git commit -m "web: add SearchBox grouped combobox"
```

---

### Task 36 — SearchBox unit tests

**Files:**
- Create: `web/tests/unit/SearchBox.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// web/tests/unit/SearchBox.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchBox } from "@/components/search/SearchBox";
import { resetSearchIndexCache } from "@/components/search/useSearchIndex";

const FIXTURE = [
  { type: "county", id: "54059", label: "Mingo County", sublabel: "WV", fips: "54059", state: "WV", total_pills: 1 },
  { type: "county", id: "51097", label: "King and Queen County", sublabel: "VA", fips: "51097", state: "VA", total_pills: 1 },
  { type: "distributor", id: "distributor:mckesson", label: "McKesson", sublabel: "distributor", total_pills: 1 },
  { type: "pharmacy", id: "pharmacy:1", label: "Tug Valley Pharmacy", sublabel: "Williamson, WV", fips: "54059", state: "WV", total_pills: 1 },
  { type: "pharmacy", id: "pharmacy:2", label: "Sav-Rite 2", sublabel: "Kermit, WV", fips: "54059", state: "WV", total_pills: 1 },
];

beforeEach(() => {
  resetSearchIndexCache();
  globalThis.sessionStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(FIXTURE), { status: 200 })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SearchBox", () => {
  it("shows a Loading state on first focus, then groups results", async () => {
    const user = userEvent.setup();
    render(<SearchBox />);
    const input = screen.getByRole("combobox");
    await user.click(input);
    // loading or ready: with a sync mock resolve, it may have already loaded
    await waitFor(() => expect(screen.queryByText(/loading search index/i)).not.toBeInTheDocument());

    await user.type(input, "Mingo");
    await waitFor(() => expect(screen.getByText("Mingo County")).toBeInTheDocument());
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    // Group header present
    expect(screen.getByText(/places/i)).toBeInTheDocument();
  });

  it("caps groups at 5 items and separates Pharmacies from Places", async () => {
    const user = userEvent.setup();
    render(<SearchBox />);
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByRole("combobox"), "pharmacy");
    await waitFor(() => expect(screen.getByText(/pharmacies/i)).toBeInTheDocument());
    const pharmacyHits = screen.queryAllByRole("option");
    // at most 5 in pharmacies group, none in other groups for this query
    expect(pharmacyHits.length).toBeLessThanOrEqual(5);
  });

  it("navigates with keyboard and activates via Enter", async () => {
    const user = userEvent.setup();
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      value: { assign },
      writable: true,
    });
    render(<SearchBox />);
    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.type(input, "Mingo");
    await waitFor(() => expect(screen.getByText("Mingo County")).toBeInTheDocument());
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");
    expect(assign).toHaveBeenCalledWith("/county/54059");
  });

  it("shows a no-matches message for an empty result set", async () => {
    const user = userEvent.setup();
    render(<SearchBox />);
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByRole("combobox"), "xyzzyqqq");
    await waitFor(() => expect(screen.getByText(/no matches/i)).toBeInTheDocument());
  });

  it("surfaces an error state with a retry button when fetch fails", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockRejectedValueOnce(new Error("boom"));
    const user = userEvent.setup();
    render(<SearchBox />);
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByRole("combobox"), "mingo");
    await waitFor(() => expect(screen.getByText(/failed to load/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test**

```bash
pnpm test -- SearchBox
```

Expected: PASS (5 tests).

- [ ] **Step 3: Commit**

```bash
git add web/tests/unit/SearchBox.test.tsx
git commit -m "web: test SearchBox grouping, keyboard nav, error state"
```

---

### Task 37 — Wire SearchBox into `Header`

**Files:**
- Modify: `web/components/layout/Header.tsx`
- Modify: `web/tests/unit/layout.test.tsx`

- [ ] **Step 1: Update the failing test first**

Open `web/tests/unit/layout.test.tsx` and add the following test inside the `Header` describe block:

```tsx
it("renders a SearchBox combobox in the header", () => {
  render(<Header />);
  expect(screen.getByRole("combobox")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test and see it fail**

```bash
pnpm test -- layout
```

Expected: FAIL — no combobox role in Header.

- [ ] **Step 3: Update Header**

Open `web/components/layout/Header.tsx`. Replace the search slot placeholder with `<SearchBox />`:

```tsx
// web/components/layout/Header.tsx
import Link from "next/link";
import { SearchBox } from "@/components/search/SearchBox";
import styles from "./Header.module.css";

const NAV: Array<{ href: "/explorer" | "/rankings" | "/methodology" | "/about"; label: string }> = [
  { href: "/explorer", label: "Explorer" },
  { href: "/rankings", label: "Rankings" },
  { href: "/methodology", label: "Methodology" },
  { href: "/about", label: "About" },
];

export function Header() {
  return (
    <header className={styles.root}>
      <div className={`${styles.inner} container`}>
        <Link href="/" className={styles.brand}>
          openarcos
        </Link>
        <div className={styles.searchSlot}>
          <SearchBox />
        </div>
        <nav className={styles.nav} aria-label="Primary">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={styles.navLink}>
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Run the test and see it pass**

```bash
pnpm test -- layout
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/components/layout/Header.tsx web/tests/unit/layout.test.tsx
git commit -m "web: mount SearchBox in Header"
```

---

### Task 38 — E2E smoke: search → county page

**Files:**
- Create: `web/tests/e2e/search.spec.ts`
- Modify: `web/public/data/search-index.json` (add a single Mingo County entry for the smoke test)
- Modify: `web/public/data/county-metadata.json` (add a single Mingo County entry)
- Create: `web/app/county/[fips]/page.tsx` *(stub — Phase 8 fills it out; this task's commit just creates a minimal placeholder so the smoke test can land)*

- [ ] **Step 1: Seed search-index.json with one real entry**

Replace the empty array in `web/public/data/search-index.json` with:

```json
[
  {
    "type": "county",
    "id": "54059",
    "label": "Mingo County",
    "sublabel": "WV",
    "fips": "54059",
    "state": "WV",
    "total_pills": 100000
  }
]
```

- [ ] **Step 2: Seed county-metadata.json**

Replace the empty array in `web/public/data/county-metadata.json` with:

```json
[
  { "fips": "54059", "name": "Mingo County", "state": "WV", "pop": 22999 }
]
```

- [ ] **Step 3: Stub county page**

```tsx
// web/app/county/[fips]/page.tsx
import { notFound } from "next/navigation";
import { loadCountyMetaByFips, loadAllFips } from "@/lib/data/loadCountyMeta";

export const dynamic = "error";
export const dynamicParams = false;

export async function generateStaticParams() {
  const fips = await loadAllFips();
  return fips.map((f) => ({ fips: f }));
}

export default async function CountyPage({ params }: { params: Promise<{ fips: string }> }) {
  const { fips } = await params;
  const meta = await loadCountyMetaByFips(fips);
  if (!meta) notFound();
  return (
    <main>
      <h1>{meta.name}</h1>
      <p>{meta.state}</p>
    </main>
  );
}
```

- [ ] **Step 4: E2E test**

```ts
// web/tests/e2e/search.spec.ts
import { expect, test } from "@playwright/test";

test("typing Mingo, pressing Enter, lands on /county/54059", async ({ page }) => {
  await page.goto("/");
  const combobox = page.getByRole("combobox");
  await combobox.click();
  await combobox.fill("Mingo");
  // wait for the group to appear and arrow-down to the first option
  await expect(page.getByText("Mingo County")).toBeVisible();
  await combobox.press("ArrowDown");
  await combobox.press("Enter");
  await expect(page).toHaveURL(/\/county\/54059$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Mingo County/);
});
```

- [ ] **Step 5: Run the E2E**

```bash
pnpm e2e -- search.spec
```

Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add web/tests/e2e/search.spec.ts web/public/data/search-index.json web/public/data/county-metadata.json web/app/county/[fips]/page.tsx
git commit -m "web: e2e smoke for search → county navigation"
```

---

**Phase 6 gate:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`. Optional tag `web-phase-6-done`.

---

## Phase 7 — `/rankings` (tasks 39–42)

Two-tab rankings page. **Distributors** tab is pre-rendered from the year-indexed JSON at build time (small, server-side; includes a sparkline of each distributor's yearly share). **Pharmacies** tab streams the `top-pharmacies.parquet` artifact on the client via `hyparquet` and paginates 100 per page; this also exercises the browser Parquet loader ahead of Plan 3's explorer.

### Task 39 — Rankings page scaffold with tabs

**Files:**
- Create: `web/app/rankings/page.tsx`
- Create: `web/app/rankings/page.module.css`
- Create: `web/app/rankings/Tabs.tsx`
- Create: `web/app/rankings/Tabs.module.css`
- Create: `web/tests/unit/rankings.test.tsx`

- [ ] **Step 1: Module CSS**

```css
/* web/app/rankings/page.module.css */
.root {
  padding: var(--space-2xl) 0;
}

.header {
  margin-bottom: var(--space-xl);
}

.title {
  font-family: var(--font-display);
  font-size: var(--type-display-lg);
  line-height: var(--lead-tight);
  margin: 0 0 var(--space-sm) 0;
}

.lede {
  max-width: 56ch;
  color: var(--text-muted);
}
```

```css
/* web/app/rankings/Tabs.module.css */
.root {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--rule);
  margin-bottom: var(--space-lg);
}

.tab {
  padding: 0.5rem 1rem;
  font-family: var(--font-display);
  font-size: var(--type-body);
  background: transparent;
  border: 0;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  cursor: pointer;
  margin-bottom: -1px;
}

.tab[aria-selected="true"] {
  color: var(--text);
  border-bottom-color: var(--accent-hot);
}

.panel {
  padding: var(--space-md) 0;
}
```

- [ ] **Step 2: Tabs component**

```tsx
// web/app/rankings/Tabs.tsx
"use client";

import { useState, useId } from "react";
import styles from "./Tabs.module.css";

export interface TabDef {
  key: string;
  label: string;
  panel: React.ReactNode;
}

export function Tabs({ tabs, initial = 0 }: { tabs: TabDef[]; initial?: number }) {
  const [active, setActive] = useState(initial);
  const rootId = useId();
  return (
    <div>
      <div className={styles.root} role="tablist" aria-label="Rankings">
        {tabs.map((t, i) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`${rootId}-tab-${t.key}`}
            aria-selected={i === active}
            aria-controls={`${rootId}-panel-${t.key}`}
            tabIndex={i === active ? 0 : -1}
            className={styles.tab}
            onClick={() => setActive(i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t, i) =>
        i === active ? (
          <div
            key={t.key}
            role="tabpanel"
            id={`${rootId}-panel-${t.key}`}
            aria-labelledby={`${rootId}-tab-${t.key}`}
            className={styles.panel}
          >
            {t.panel}
          </div>
        ) : null,
      )}
    </div>
  );
}
```

- [ ] **Step 3: Failing test**

```tsx
// web/tests/unit/rankings.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Tabs } from "@/app/rankings/Tabs";

describe("Tabs", () => {
  it("renders tabs with correct aria and switches panels on click", async () => {
    const user = userEvent.setup();
    render(
      <Tabs
        tabs={[
          { key: "a", label: "Alpha", panel: <p>alpha-panel</p> },
          { key: "b", label: "Beta", panel: <p>beta-panel</p> },
        ]}
      />,
    );
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("alpha-panel")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Beta" }));
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("beta-panel")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run the test and see it fail**

```bash
pnpm test -- rankings
```

Expected: FAIL — Tabs not found.

- [ ] **Step 5: Minimal rankings page**

```tsx
// web/app/rankings/page.tsx
import type { Metadata } from "next";
import { Tabs } from "./Tabs";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Rankings",
  description: "Top distributors and top pharmacies by prescription opioid pills shipped (2006–2014).",
};

export default function RankingsPage() {
  return (
    <main className={`${styles.root} container`}>
      <header className={styles.header}>
        <p className="eyebrow">2006–2014</p>
        <h1 className={styles.title}>Rankings</h1>
        <p className={styles.lede}>
          Who shipped the most prescription opioids, and to whom. Based on Washington Post ARCOS aggregates.
        </p>
      </header>
      <Tabs
        tabs={[
          { key: "distributors", label: "Distributors", panel: <p>(populated in Task 40)</p> },
          { key: "pharmacies", label: "Pharmacies", panel: <p>(populated in Task 41)</p> },
        ]}
      />
    </main>
  );
}
```

- [ ] **Step 6: Run the test and see it pass**

```bash
pnpm test -- rankings
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add web/app/rankings/page.tsx web/app/rankings/page.module.css web/app/rankings/Tabs.tsx web/app/rankings/Tabs.module.css web/tests/unit/rankings.test.tsx
git commit -m "web: add /rankings page scaffold with tabs"
```

---

### Task 40 — Distributors tab

**Files:**
- Create: `web/app/rankings/DistributorsPanel.tsx`
- Create: `web/app/rankings/DistributorsPanel.module.css`
- Modify: `web/app/rankings/page.tsx`
- Create: `web/tests/unit/distributors-panel.test.tsx`

- [ ] **Step 1: CSS**

```css
/* web/app/rankings/DistributorsPanel.module.css */
.table {
  width: 100%;
  border-collapse: collapse;
}

.table th,
.table td {
  text-align: left;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--rule);
  vertical-align: baseline;
}

.table th {
  font-family: var(--font-display);
  font-size: var(--type-eyebrow);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum", "lnum";
}

.sparkCell {
  width: 120px;
}

.row:target {
  background: var(--canvas-shade);
}
```

- [ ] **Step 2: Slug helper**

Add to `web/lib/format/slug.ts`:

```ts
// web/lib/format/slug.ts
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

With a test:

```ts
// web/tests/unit/slug.test.ts
import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/format/slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("McKesson Corporation")).toBe("mckesson-corporation");
  });
  it("strips punctuation", () => {
    expect(slugify("AmerisourceBergen, Inc.")).toBe("amerisourcebergen-inc");
  });
});
```

- [ ] **Step 3: Loader extension**

Modify `web/lib/data/loadTopDistributors.ts` to also expose a distributor-grouped view:

```ts
// web/lib/data/loadTopDistributors.ts  (append to file)
import type { TopDistributorsByYear } from "./schemas";

export interface DistributorAggregate {
  distributor: string;
  slug: string;
  total_pills: number;
  share_pct_by_year: Array<{ year: number; share_pct: number; pills: number }>;
  mean_rank: number;
}

export async function loadDistributorsAggregated(): Promise<DistributorAggregate[]> {
  const { slugify } = await import("@/lib/format/slug");
  const all = await loadTopDistributorsAll();
  const byName = new Map<string, Array<TopDistributorsByYear[number]>>();
  for (const row of all) {
    const arr = byName.get(row.distributor) ?? [];
    arr.push(row);
    byName.set(row.distributor, arr);
  }
  const ranksByYear = new Map<number, Map<string, number>>();
  const byYear = new Map<number, Array<TopDistributorsByYear[number]>>();
  for (const row of all) {
    const arr = byYear.get(row.year) ?? [];
    arr.push(row);
    byYear.set(row.year, arr);
  }
  for (const [year, rows] of byYear) {
    const sorted = [...rows].sort((a, b) => b.pills - a.pills);
    const m = new Map<string, number>();
    sorted.forEach((r, i) => m.set(r.distributor, i + 1));
    ranksByYear.set(year, m);
  }
  const out: DistributorAggregate[] = [];
  for (const [name, rows] of byName) {
    const total = rows.reduce((s, r) => s + r.pills, 0);
    const ranks = rows.map((r) => ranksByYear.get(r.year)?.get(name) ?? 99);
    const mean = ranks.reduce((s, r) => s + r, 0) / ranks.length;
    out.push({
      distributor: name,
      slug: slugify(name),
      total_pills: total,
      share_pct_by_year: rows
        .sort((a, b) => a.year - b.year)
        .map((r) => ({ year: r.year, share_pct: r.share_pct, pills: r.pills })),
      mean_rank: mean,
    });
  }
  return out.sort((a, b) => b.total_pills - a.total_pills);
}

async function loadTopDistributorsAll(): Promise<TopDistributorsByYear> {
  // existing loader reads the JSON; mirror that here
  const { promises: fs } = await import("node:fs");
  const path = await import("node:path");
  const file = path.resolve(process.cwd(), "public/data/top-distributors-by-year.json");
  const raw = await fs.readFile(file, "utf-8");
  return JSON.parse(raw) as TopDistributorsByYear;
}
```

> Implementation note: if the existing `loadTopDistributors.ts` already exports a `loadAll()` function from Task 22, reuse it instead of defining `loadTopDistributorsAll` here.

- [ ] **Step 4: Panel component**

```tsx
// web/app/rankings/DistributorsPanel.tsx
import { Sparkline } from "@/components/charts/Sparkline";
import { formatCompact } from "@/lib/format/number";
import { formatPercent } from "@/lib/format/percent";
import type { DistributorAggregate } from "@/lib/data/loadTopDistributors";
import styles from "./DistributorsPanel.module.css";

export function DistributorsPanel({ rows }: { rows: DistributorAggregate[] }) {
  return (
    <table className={styles.table}>
      <caption className="visually-hidden">
        Top distributors by total pills shipped 2006–2014
      </caption>
      <thead>
        <tr>
          <th scope="col">Rank</th>
          <th scope="col">Distributor</th>
          <th scope="col" className={styles.num}>Total pills</th>
          <th scope="col">Share 2006–2014</th>
          <th scope="col" className={styles.sparkCell}>Yearly share</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const avgShare =
            r.share_pct_by_year.reduce((s, y) => s + y.share_pct, 0) / r.share_pct_by_year.length;
          return (
            <tr
              key={r.slug}
              id={`distributor-${r.slug}`}
              className={styles.row}
            >
              <td className={styles.num}>{i + 1}</td>
              <td>{r.distributor}</td>
              <td className={styles.num}>{formatCompact(r.total_pills)}</td>
              <td className={styles.num}>{formatPercent(avgShare)}</td>
              <td className={styles.sparkCell}>
                <Sparkline
                  values={r.share_pct_by_year.map((y) => y.share_pct)}
                  ariaLabel={`${r.distributor} yearly share sparkline`}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 5: Wire into page**

```tsx
// web/app/rankings/page.tsx  (replace imports/body)
import type { Metadata } from "next";
import { Tabs } from "./Tabs";
import { DistributorsPanel } from "./DistributorsPanel";
import { loadDistributorsAggregated } from "@/lib/data/loadTopDistributors";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Rankings",
  description: "Top distributors and top pharmacies by prescription opioid pills shipped (2006–2014).",
};

export default async function RankingsPage() {
  const distributors = await loadDistributorsAggregated();
  return (
    <main className={`${styles.root} container`}>
      <header className={styles.header}>
        <p className="eyebrow">2006–2014</p>
        <h1 className={styles.title}>Rankings</h1>
        <p className={styles.lede}>
          Who shipped the most prescription opioids, and to whom. Based on Washington Post ARCOS aggregates.
        </p>
      </header>
      <Tabs
        tabs={[
          { key: "distributors", label: "Distributors", panel: <DistributorsPanel rows={distributors} /> },
          { key: "pharmacies", label: "Pharmacies", panel: <p>(populated in Task 41)</p> },
        ]}
      />
    </main>
  );
}
```

- [ ] **Step 6: Panel unit test**

```tsx
// web/tests/unit/distributors-panel.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DistributorsPanel } from "@/app/rankings/DistributorsPanel";

describe("DistributorsPanel", () => {
  it("renders a row per distributor with rank and a target anchor id", () => {
    const rows = [
      {
        distributor: "McKesson",
        slug: "mckesson",
        total_pills: 10_000_000_000,
        mean_rank: 1,
        share_pct_by_year: [
          { year: 2006, share_pct: 22.1, pills: 1 },
          { year: 2014, share_pct: 23.4, pills: 1 },
        ],
      },
    ];
    render(<DistributorsPanel rows={rows} />);
    expect(screen.getByText("McKesson")).toBeInTheDocument();
    const row = document.getElementById("distributor-mckesson");
    expect(row).not.toBeNull();
  });
});
```

- [ ] **Step 7: Run tests**

```bash
pnpm test -- rankings distributors-panel slug
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add web/app/rankings/DistributorsPanel.tsx web/app/rankings/DistributorsPanel.module.css web/app/rankings/page.tsx web/lib/data/loadTopDistributors.ts web/lib/format/slug.ts web/tests/unit/distributors-panel.test.tsx web/tests/unit/slug.test.ts
git commit -m "web: add distributors rankings tab"
```

---

### Task 41 — Pharmacies tab with client-side parquet pagination

**Files:**
- Create: `web/app/rankings/PharmaciesPanel.tsx`
- Create: `web/app/rankings/PharmaciesPanel.module.css`
- Create: `web/app/rankings/usePharmacyPages.ts`
- Modify: `web/app/rankings/page.tsx`
- Create: `web/tests/unit/pharmacies-panel.test.tsx`

- [ ] **Step 1: Pagination hook**

```ts
// web/app/rankings/usePharmacyPages.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchParquetRows } from "@/lib/data/parquet";
import type { TopPharmacy } from "@/lib/data/schemas";

const PHARMACIES_URL = "/data/top-pharmacies.parquet";
const PAGE_SIZE = 100;

export type PharmacyPageStatus = "idle" | "loading" | "ready" | "error";

export interface UsePharmacyPagesResult {
  status: PharmacyPageStatus;
  error: Error | null;
  rows: TopPharmacy[];
  total: number | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
}

let cached: { rows: TopPharmacy[]; total: number } | null = null;

export function resetPharmacyPagesCache(): void {
  cached = null;
}

export function usePharmacyPages(): UsePharmacyPagesResult {
  const [status, setStatus] = useState<PharmacyPageStatus>(cached ? "ready" : "idle");
  const [error, setError] = useState<Error | null>(null);
  const [rows, setRows] = useState<TopPharmacy[]>(cached?.rows.slice(0, PAGE_SIZE) ?? []);
  const [total, setTotal] = useState<number | null>(cached?.total ?? null);
  const pageRef = useRef(cached ? 1 : 0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadMore = useCallback(async () => {
    if (status === "loading") return;
    try {
      if (!cached) {
        setStatus("loading");
        const all = await fetchParquetRows<TopPharmacy>(PHARMACIES_URL);
        all.sort((a, b) => b.total_pills - a.total_pills);
        cached = { rows: all, total: all.length };
      }
      const next = pageRef.current + 1;
      const window = cached.rows.slice(0, next * PAGE_SIZE);
      pageRef.current = next;
      if (mountedRef.current) {
        setRows(window);
        setTotal(cached.total);
        setStatus("ready");
      }
    } catch (err) {
      if (mountedRef.current) {
        setStatus("error");
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }, [status]);

  useEffect(() => {
    if (pageRef.current === 0) void loadMore();
  }, [loadMore]);

  const hasMore = total !== null && rows.length < total;

  return { status, error, rows, total, hasMore, loadMore };
}
```

- [ ] **Step 2: Panel CSS**

```css
/* web/app/rankings/PharmaciesPanel.module.css */
.table {
  width: 100%;
  border-collapse: collapse;
}

.table th,
.table td {
  text-align: left;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--rule);
  vertical-align: baseline;
}

.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum", "lnum";
}

.footer {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
  padding: var(--space-md) 0;
}

.status {
  color: var(--text-muted);
  font-size: var(--type-caption);
}
```

- [ ] **Step 3: Panel component**

```tsx
// web/app/rankings/PharmaciesPanel.tsx
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { formatCompact } from "@/lib/format/number";
import { usePharmacyPages } from "./usePharmacyPages";
import styles from "./PharmaciesPanel.module.css";

export function PharmaciesPanel() {
  const { status, error, rows, total, hasMore, loadMore } = usePharmacyPages();

  if (status === "error") {
    return (
      <p className={styles.status} role="alert">
        Failed to load pharmacy data: {error?.message}. <Button variant="ghost" onClick={() => void loadMore()}>Retry</Button>
      </p>
    );
  }
  if (status === "idle" || (status === "loading" && rows.length === 0)) {
    return <p className={styles.status}>Loading pharmacies…</p>;
  }

  return (
    <div>
      <table className={styles.table}>
        <caption className="visually-hidden">
          Top pharmacies by total pills shipped 2006–2014
        </caption>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Pharmacy</th>
            <th scope="col">Address</th>
            <th scope="col">County</th>
            <th scope="col" className={styles.num}>Total pills</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.pharmacy_id}>
              <td className={styles.num}>{i + 1}</td>
              <td>{r.name}</td>
              <td>{r.address}</td>
              <td>
                {r.fips ? (
                  <Link href={`/county/${r.fips}` as never}>{r.fips}</Link>
                ) : (
                  "—"
                )}
              </td>
              <td className={styles.num}>{formatCompact(r.total_pills)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.footer}>
        {hasMore ? (
          <Button variant="primary" onClick={() => void loadMore()} disabled={status === "loading"}>
            {status === "loading" ? "Loading…" : "Show more"}
          </Button>
        ) : (
          <span className={styles.status}>
            Showing all {total ?? rows.length} pharmacies
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire into page**

Replace the pharmacies panel placeholder in `web/app/rankings/page.tsx`:

```tsx
import { PharmaciesPanel } from "./PharmaciesPanel";
// ...
<Tabs
  tabs={[
    { key: "distributors", label: "Distributors", panel: <DistributorsPanel rows={distributors} /> },
    { key: "pharmacies", label: "Pharmacies", panel: <PharmaciesPanel /> },
  ]}
/>
```

- [ ] **Step 5: Unit test for the panel**

```tsx
// web/tests/unit/pharmacies-panel.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PharmaciesPanel } from "@/app/rankings/PharmaciesPanel";
import { resetPharmacyPagesCache } from "@/app/rankings/usePharmacyPages";

const makeRows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    pharmacy_id: `p${i}`,
    name: `Pharmacy ${i}`,
    address: "123 Main St",
    fips: "54059",
    total_pills: 1000 - i,
  }));

beforeEach(() => {
  resetPharmacyPagesCache();
  vi.mock("@/lib/data/parquet", () => ({
    fetchParquetRows: vi.fn(async () => makeRows(150)),
  }));
});

afterEach(() => {
  vi.resetModules();
});

describe("PharmaciesPanel", () => {
  it("renders first 100 then adds more on click", async () => {
    const user = userEvent.setup();
    render(<PharmaciesPanel />);
    await waitFor(() => expect(screen.getByText("Pharmacy 0")).toBeInTheDocument());
    expect(screen.queryByText("Pharmacy 100")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /show more/i }));
    await waitFor(() => expect(screen.getByText("Pharmacy 100")).toBeInTheDocument());
    expect(screen.getByText(/showing all 150 pharmacies/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run the test**

```bash
pnpm test -- pharmacies-panel
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add web/app/rankings/PharmaciesPanel.tsx web/app/rankings/PharmaciesPanel.module.css web/app/rankings/usePharmacyPages.ts web/app/rankings/page.tsx web/tests/unit/pharmacies-panel.test.tsx
git commit -m "web: add pharmacies rankings tab with client-side pagination"
```

---

### Task 42 — Rankings E2E + anchor test

**Files:**
- Create: `web/tests/e2e/rankings.spec.ts`

- [ ] **Step 1: E2E test**

```ts
// web/tests/e2e/rankings.spec.ts
import { expect, test } from "@playwright/test";

test.describe("/rankings", () => {
  test("renders distributors tab by default and can switch to pharmacies", async ({ page }) => {
    await page.goto("/rankings");
    await expect(page.getByRole("heading", { level: 1, name: /rankings/i })).toBeVisible();
    // distributors table present
    await expect(page.getByRole("columnheader", { name: /distributor/i })).toBeVisible();
    // switch to pharmacies
    await page.getByRole("tab", { name: /pharmacies/i }).click();
    await expect(page.getByRole("tab", { name: /pharmacies/i })).toHaveAttribute("aria-selected", "true");
  });

  test("distributor rows expose id anchors for deep links", async ({ page }) => {
    await page.goto("/rankings");
    const rows = page.locator("tr[id^='distributor-']");
    // at least 1 row; in a fully-seeded run there will be many, in stub state may be 0
    const count = await rows.count();
    if (count > 0) {
      const id = await rows.first().getAttribute("id");
      expect(id).toMatch(/^distributor-/);
    }
  });
});
```

- [ ] **Step 2: Run the E2E**

```bash
pnpm e2e -- rankings.spec
```

Expected: PASS. (First test is the hard contract; second test is conditional on there being data.)

- [ ] **Step 3: Commit**

```bash
git add web/tests/e2e/rankings.spec.ts
git commit -m "web: e2e for rankings tab switching + anchor id"
```

---

**Phase 7 gate:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`. Optional tag `web-phase-7-done`.

---

## Phase 8 — `/county/[fips]` (tasks 43–50)

The deepest route: one fully-SSG page per US county (~3,100 pages). Each page assembles hero numerals, comparative rank callouts, a multi-series time chart, top distributors and pharmacies, and similar-counties links. All data is pre-loaded at build time via the existing loaders; no client Parquet on this page.

### Task 43 — Full county page with `generateStaticParams`

**Files:**
- Modify: `web/app/county/[fips]/page.tsx` (stubbed in Task 38)
- Create: `web/app/county/[fips]/page.module.css`
- Create: `web/tests/unit/county-page.test.tsx`

- [ ] **Step 1: Module CSS**

```css
/* web/app/county/[fips]/page.module.css */
.root {
  padding: var(--space-2xl) 0 var(--space-3xl) 0;
}

.crumbs {
  color: var(--text-muted);
  font-size: var(--type-caption);
  margin-bottom: var(--space-sm);
}

.heroGrid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
  gap: var(--space-2xl);
  align-items: end;
  margin-bottom: var(--space-2xl);
}

@media (max-width: 820px) {
  .heroGrid {
    grid-template-columns: 1fr;
    gap: var(--space-md);
  }
}

.section {
  margin-top: var(--space-2xl);
}

.sectionTitle {
  font-family: var(--font-display);
  font-size: var(--type-h2);
  margin: 0 0 var(--space-md) 0;
}
```

- [ ] **Step 2: Replace stub page**

```tsx
// web/app/county/[fips]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Hero } from "@/components/county/Hero";
import { RankCallouts } from "@/components/county/RankCallouts";
import { CountyTimeSeries } from "@/components/county/CountyTimeSeries";
import { TopDistributors } from "@/components/county/TopDistributors";
import { TopPharmacies } from "@/components/county/TopPharmacies";
import { SimilarCounties } from "@/components/county/SimilarCounties";
import { MethodologyFooter } from "@/components/layout/MethodologyFooter";
import { loadCountyBundle } from "@/lib/data/loadCountyBundle";
import { loadAllFips, loadCountyMetaByFips } from "@/lib/data/loadCountyMeta";
import { loadSimilarCounties } from "@/lib/geo/similar";
import { loadCountyRanks } from "@/lib/data/loadCountyRanks";
import { loadCountyDistributors } from "@/lib/data/loadCountyDistributors";
import { loadStateShipments } from "@/lib/data/loadStateShipments";
import styles from "./page.module.css";

export const dynamic = "error";
export const dynamicParams = false;

export async function generateStaticParams() {
  const fips = await loadAllFips();
  return fips.map((f) => ({ fips: f }));
}

export async function generateMetadata({ params }: { params: Promise<{ fips: string }> }): Promise<Metadata> {
  const { fips } = await params;
  const meta = await loadCountyMetaByFips(fips);
  if (!meta) return { title: "Unknown county" };
  return {
    title: `${meta.name}, ${meta.state}`,
    description: `Prescription opioid shipments into ${meta.name}, ${meta.state} (2006–2014). Pills, distributors, pharmacies, overdose deaths, and peer-county comparisons.`,
  };
}

export default async function CountyPage({ params }: { params: Promise<{ fips: string }> }) {
  const { fips } = await params;
  const meta = await loadCountyMetaByFips(fips);
  if (!meta) notFound();
  const bundle = await loadCountyBundle(fips);
  const ranks = await loadCountyRanks(fips);
  const topDistributors = await loadCountyDistributors(fips);
  const stateSeries = await loadStateShipments();
  const similar = await loadSimilarCounties(fips);

  return (
    <main className={`${styles.root} container`}>
      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <a href="/">openarcos</a> / <a href={`/?state=${meta.state}`}>{meta.state}</a> /{" "}
        <span aria-current="page">{meta.name}</span>
      </nav>

      <div className={styles.heroGrid}>
        <Hero meta={meta} bundle={bundle} />
        <RankCallouts meta={meta} ranks={ranks} />
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Pills shipped, year by year</h2>
        <CountyTimeSeries fips={fips} meta={meta} bundle={bundle} stateSeries={stateSeries} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Top distributors into {meta.name}</h2>
        <TopDistributors rows={topDistributors} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Top pharmacies in {meta.name}</h2>
        <TopPharmacies rows={bundle.pharmacies} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Similar counties</h2>
        <SimilarCounties current={meta} similar={similar} />
      </section>

      <MethodologyFooter />
    </main>
  );
}
```

- [ ] **Step 3: Smoke test for the page**

```tsx
// web/tests/unit/county-page.test.tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data/loadCountyMeta", () => ({
  loadAllFips: vi.fn(async () => ["54059"]),
  loadCountyMetaByFips: vi.fn(async () => ({ fips: "54059", name: "Mingo County", state: "WV", pop: 22999 })),
}));
vi.mock("@/lib/data/loadCountyBundle", () => ({
  loadCountyBundle: vi.fn(async () => ({
    meta: { fips: "54059", name: "Mingo County", state: "WV", pop: 22999 },
    shipments: [{ fips: "54059", year: 2012, pills: 15_000_000, pills_per_capita: 652 }],
    pharmacies: [],
    overdose: [],
  })),
}));
vi.mock("@/lib/data/loadCountyRanks", () => ({
  loadCountyRanks: vi.fn(async () => ({
    fips: "54059",
    national_rank: 12,
    peer_rank: 3,
    peer_size: 210,
    overdose_rank: 8,
  })),
}));
vi.mock("@/lib/data/loadCountyDistributors", () => ({
  loadCountyDistributors: vi.fn(async () => []),
}));
vi.mock("@/lib/data/loadStateShipments", () => ({
  loadStateShipments: vi.fn(async () => []),
}));
vi.mock("@/lib/geo/similar", () => ({
  loadSimilarCounties: vi.fn(async () => []),
}));

import CountyPage, { generateStaticParams, generateMetadata } from "@/app/county/[fips]/page";

describe("CountyPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generateStaticParams returns all fips", async () => {
    await expect(generateStaticParams()).resolves.toEqual([{ fips: "54059" }]);
  });

  it("generateMetadata uses meta", async () => {
    await expect(generateMetadata({ params: Promise.resolve({ fips: "54059" }) })).resolves.toMatchObject({
      title: "Mingo County, WV",
    });
  });

  it("renders the page for a known FIPS", async () => {
    const ui = await CountyPage({ params: Promise.resolve({ fips: "54059" }) });
    render(ui);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Mingo County/);
  });
});
```

- [ ] **Step 4: Run the test (it will fail for missing sub-modules; continue through Task 49 to make it green)**

```bash
pnpm test -- county-page
```

Expected: FAIL — this is expected; the remaining Task 44–49 modules fill in.

- [ ] **Step 5: Commit the scaffold**

```bash
git add web/app/county/[fips]/page.tsx web/app/county/[fips]/page.module.css web/tests/unit/county-page.test.tsx
git commit -m "web: scaffold full /county/[fips] page composition"
```

---

### Task 44 — `Hero` component

**Files:**
- Create: `web/components/county/Hero.tsx`
- Create: `web/components/county/Hero.module.css`
- Create: `web/tests/unit/hero.test.tsx`
- Create: `web/lib/data/countyHeroStats.ts`

- [ ] **Step 1: Stats helper**

```ts
// web/lib/data/countyHeroStats.ts
import type { CountyMetadata, CountyShipmentsByYear } from "@/lib/data/schemas";

export interface CountyHeroStats {
  totalPills: number;
  peakYear: number | null;
  peakPerCapita: number | null;
  years: number[];
}

export function computeCountyHeroStats(
  meta: CountyMetadata[number],
  shipments: CountyShipmentsByYear,
): CountyHeroStats {
  if (shipments.length === 0) {
    return { totalPills: 0, peakYear: null, peakPerCapita: null, years: [] };
  }
  const total = shipments.reduce((s, r) => s + r.pills, 0);
  let peak = shipments[0]!;
  for (const r of shipments) {
    if (r.pills_per_capita > peak.pills_per_capita) peak = r;
  }
  return {
    totalPills: total,
    peakYear: peak.year,
    peakPerCapita: peak.pills_per_capita,
    years: shipments.map((r) => r.year).sort((a, b) => a - b),
  };
}
```

- [ ] **Step 2: Hero CSS**

```css
/* web/components/county/Hero.module.css */
.root {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.name {
  font-family: var(--font-display);
  font-size: var(--type-display-xl);
  line-height: var(--lead-tight);
  margin: 0;
}

.state {
  font-family: var(--font-display);
  font-size: var(--type-h2);
  color: var(--text-muted);
  margin: 0;
}

.stats {
  display: flex;
  gap: var(--space-xl);
  margin-top: var(--space-md);
  flex-wrap: wrap;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
}

.statLabel {
  font-family: var(--font-display);
  font-size: var(--type-eyebrow);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}
```

- [ ] **Step 3: Hero component**

```tsx
// web/components/county/Hero.tsx
import { BigNumeral } from "@/components/brand/BigNumeral";
import { formatCompact, formatFull } from "@/lib/format/number";
import { computeCountyHeroStats } from "@/lib/data/countyHeroStats";
import type { CountyMetadata, CountyShipmentsByYear, TopPharmacy, CDCOverdoseByCountyYear } from "@/lib/data/schemas";
import styles from "./Hero.module.css";

export interface CountyBundle {
  meta: CountyMetadata[number];
  shipments: CountyShipmentsByYear;
  pharmacies: TopPharmacy[];
  overdose: CDCOverdoseByCountyYear;
}

export function Hero({ meta, bundle }: { meta: CountyMetadata[number]; bundle: CountyBundle }) {
  const stats = computeCountyHeroStats(meta, bundle.shipments);
  return (
    <div className={styles.root}>
      <h1 className={styles.name}>{meta.name}</h1>
      <p className={styles.state}>{meta.state} · pop {formatCompact(meta.pop)}</p>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Pills shipped 2006–2014</span>
          <BigNumeral value={stats.totalPills} unit="pills" compact ariaLabel={`${formatFull(stats.totalPills)} pills shipped to ${meta.name} from 2006 to 2014`} />
        </div>
        {stats.peakPerCapita !== null && stats.peakYear !== null && (
          <div className={styles.stat}>
            <span className={styles.statLabel}>Peak per-capita</span>
            <BigNumeral value={stats.peakPerCapita} unit={`per person in ${stats.peakYear}`} tone="hot" />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Unit test**

```tsx
// web/tests/unit/hero.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Hero } from "@/components/county/Hero";

describe("Hero", () => {
  it("renders county name, state, and stats", () => {
    const meta = { fips: "54059", name: "Mingo County", state: "WV", pop: 22999 };
    const bundle = {
      meta,
      shipments: [
        { fips: "54059", year: 2010, pills: 10_000_000, pills_per_capita: 435 },
        { fips: "54059", year: 2012, pills: 15_000_000, pills_per_capita: 652 },
      ],
      pharmacies: [],
      overdose: [],
    };
    render(<Hero meta={meta} bundle={bundle} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Mingo County");
    expect(screen.getByText(/WV/)).toBeInTheDocument();
    expect(screen.getByText(/per person in 2012/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run tests and commit**

```bash
pnpm test -- hero
```

Expected: PASS.

```bash
git add web/components/county/Hero.tsx web/components/county/Hero.module.css web/lib/data/countyHeroStats.ts web/tests/unit/hero.test.tsx
git commit -m "web: add county Hero component"
```

---

### Task 45 — `RankCallouts` component

**Files:**
- Create: `web/components/county/RankCallouts.tsx`
- Create: `web/components/county/RankCallouts.module.css`
- Create: `web/lib/data/loadCountyRanks.ts`
- Create: `web/tests/unit/rank-callouts.test.tsx`

- [ ] **Step 1: Ranks loader**

```ts
// web/lib/data/loadCountyRanks.ts
import { promises as fs } from "node:fs";
import path from "node:path";

export interface CountyRanks {
  fips: string;
  national_rank: number; // 1..N
  national_total: number;
  peer_rank: number; // 1..peer_size, by population band
  peer_size: number;
  overdose_rank: number | null;
  overdose_total: number;
}

let cache: Map<string, CountyRanks> | null = null;

export function resetCountyRanksCache(): void {
  cache = null;
}

async function ensureLoaded(): Promise<Map<string, CountyRanks>> {
  if (cache) return cache;
  const file = path.resolve(process.cwd(), "public/data/county-ranks.json");
  try {
    const raw = await fs.readFile(file, "utf-8");
    const rows = JSON.parse(raw) as CountyRanks[];
    cache = new Map(rows.map((r) => [r.fips, r]));
  } catch {
    cache = new Map();
  }
  return cache;
}

export async function loadCountyRanks(fips: string): Promise<CountyRanks> {
  const m = await ensureLoaded();
  return (
    m.get(fips) ?? {
      fips,
      national_rank: 0,
      national_total: 0,
      peer_rank: 0,
      peer_size: 0,
      overdose_rank: null,
      overdose_total: 0,
    }
  );
}
```

> The `county-ranks.json` artifact is produced by `web/scripts/build-county-ranks.ts` (added in Task 46 as part of the `build-similar-counties.ts` companion script). If the file is absent, the loader returns a zero-filled default so the page still renders during early development.

- [ ] **Step 2: CSS**

```css
/* web/components/county/RankCallouts.module.css */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--space-md);
}

.card {
  padding: var(--space-md);
  background: var(--canvas-warm);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
}

.rank {
  font-family: var(--font-display);
  font-size: var(--type-display-md);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.of {
  color: var(--text-muted);
  font-size: var(--type-caption);
}

.label {
  font-family: var(--font-display);
  font-size: var(--type-eyebrow);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}
```

- [ ] **Step 3: Component**

```tsx
// web/components/county/RankCallouts.tsx
import { formatOrdinal } from "@/lib/format/number";
import type { CountyMetadata } from "@/lib/data/schemas";
import type { CountyRanks } from "@/lib/data/loadCountyRanks";
import styles from "./RankCallouts.module.css";

export function RankCallouts({
  meta,
  ranks,
}: {
  meta: CountyMetadata[number];
  ranks: CountyRanks;
}) {
  return (
    <div className={styles.grid} aria-label="Rank callouts">
      <div className={styles.card}>
        <span className={styles.label}>Nationally</span>
        <span className={styles.rank}>{ranks.national_rank > 0 ? formatOrdinal(ranks.national_rank) : "—"}</span>
        <span className={styles.of}>
          {ranks.national_rank > 0 ? `of ${ranks.national_total} counties by pills shipped` : "insufficient data"}
        </span>
      </div>
      <div className={styles.card}>
        <span className={styles.label}>Among peers</span>
        <span className={styles.rank}>{ranks.peer_rank > 0 ? formatOrdinal(ranks.peer_rank) : "—"}</span>
        <span className={styles.of}>
          {ranks.peer_rank > 0
            ? `of ${ranks.peer_size} counties with similar population`
            : "insufficient data"}
        </span>
      </div>
      <div className={styles.card}>
        <span className={styles.label}>Overdose deaths</span>
        <span className={styles.rank}>
          {ranks.overdose_rank !== null ? formatOrdinal(ranks.overdose_rank) : "—"}
        </span>
        <span className={styles.of}>
          {ranks.overdose_rank !== null
            ? `of ${ranks.overdose_total} counties (CDC WONDER, per-capita)`
            : "suppressed or unavailable"}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Unit test**

```tsx
// web/tests/unit/rank-callouts.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RankCallouts } from "@/components/county/RankCallouts";

describe("RankCallouts", () => {
  it("renders ordinal ranks and counts", () => {
    render(
      <RankCallouts
        meta={{ fips: "54059", name: "Mingo", state: "WV", pop: 22999 }}
        ranks={{ fips: "54059", national_rank: 12, national_total: 3143, peer_rank: 3, peer_size: 210, overdose_rank: 8, overdose_total: 2400 }}
      />,
    );
    expect(screen.getByText("12th")).toBeInTheDocument();
    expect(screen.getByText("3rd")).toBeInTheDocument();
    expect(screen.getByText("8th")).toBeInTheDocument();
  });

  it("shows an em-dash when ranks are missing", () => {
    render(
      <RankCallouts
        meta={{ fips: "54059", name: "Mingo", state: "WV", pop: 22999 }}
        ranks={{ fips: "54059", national_rank: 0, national_total: 0, peer_rank: 0, peer_size: 0, overdose_rank: null, overdose_total: 0 }}
      />,
    );
    expect(screen.getAllByText("—")).toHaveLength(3);
  });
});
```

- [ ] **Step 5: Run tests and commit**

```bash
pnpm test -- rank-callouts
```

Expected: PASS.

```bash
git add web/components/county/RankCallouts.tsx web/components/county/RankCallouts.module.css web/lib/data/loadCountyRanks.ts web/tests/unit/rank-callouts.test.tsx
git commit -m "web: add county RankCallouts component"
```

---

### Task 46 — Similar counties + build scripts

**Files:**
- Create: `web/lib/geo/similar.ts`
- Create: `web/scripts/build-county-ranks.ts`
- Create: `web/scripts/build-similar-counties.ts`
- Modify: `web/package.json` (add `build-similar`, `build-ranks` scripts)
- Create: `web/tests/unit/similar.test.ts`

- [ ] **Step 1: Similar loader**

```ts
// web/lib/geo/similar.ts
import { promises as fs } from "node:fs";
import path from "node:path";

export interface SimilarCountyRef {
  fips: string;
  name: string;
  state: string;
  pop: number;
  pills_total: number;
}

let cache: Map<string, SimilarCountyRef[]> | null = null;

export function resetSimilarCache(): void {
  cache = null;
}

export async function loadSimilarCounties(fips: string): Promise<SimilarCountyRef[]> {
  if (!cache) {
    const file = path.resolve(process.cwd(), "public/data/similar-counties.json");
    try {
      const raw = await fs.readFile(file, "utf-8");
      const map = JSON.parse(raw) as Record<string, SimilarCountyRef[]>;
      cache = new Map(Object.entries(map));
    } catch {
      cache = new Map();
    }
  }
  return cache.get(fips) ?? [];
}
```

- [ ] **Step 2: Build-ranks script**

```ts
// web/scripts/build-county-ranks.ts
import { promises as fs } from "node:fs";
import path from "node:path";
import { readParquetRows } from "@/lib/data/parquet";
import { fileURLToPath } from "node:url";

interface CountyShipmentRow {
  fips: string;
  year: number;
  pills: number;
  pills_per_capita: number;
}

interface CDCRow {
  fips: string;
  year: number;
  deaths: number | null;
  suppressed: boolean;
}

interface CountyMetaRow {
  fips: string;
  name: string;
  state: string;
  pop: number;
}

interface CountyRankRow {
  fips: string;
  national_rank: number;
  national_total: number;
  peer_rank: number;
  peer_size: number;
  overdose_rank: number | null;
  overdose_total: number;
}

function popBand(pop: number): string {
  if (pop < 10_000) return "<10k";
  if (pop < 50_000) return "10k-50k";
  if (pop < 250_000) return "50k-250k";
  if (pop < 1_000_000) return "250k-1m";
  return "1m+";
}

async function main() {
  const root = path.resolve(process.cwd(), "public/data");
  const meta: CountyMetaRow[] = JSON.parse(await fs.readFile(path.join(root, "county-metadata.json"), "utf-8"));
  const shipments = await readParquetRows<CountyShipmentRow>(await fs.readFile(path.join(root, "county-shipments-by-year.parquet"))).catch(() => [] as CountyShipmentRow[]);
  const overdose = await readParquetRows<CDCRow>(await fs.readFile(path.join(root, "cdc-overdose-by-county-year.parquet"))).catch(() => [] as CDCRow[]);

  // Totals per fips
  const totalsByFips = new Map<string, number>();
  for (const r of shipments) totalsByFips.set(r.fips, (totalsByFips.get(r.fips) ?? 0) + r.pills);

  // National rank: sort by total pills desc
  const nationalSorted = [...meta].map((m) => ({ ...m, total: totalsByFips.get(m.fips) ?? 0 }))
    .sort((a, b) => b.total - a.total);
  const nationalRank = new Map<string, number>();
  nationalSorted.forEach((r, i) => nationalRank.set(r.fips, i + 1));

  // Peer rank: within pop band, sort by total pills desc
  const peerBands = new Map<string, Array<{ fips: string; total: number }>>();
  for (const m of meta) {
    const band = popBand(m.pop);
    const arr = peerBands.get(band) ?? [];
    arr.push({ fips: m.fips, total: totalsByFips.get(m.fips) ?? 0 });
    peerBands.set(band, arr);
  }
  const peerRank = new Map<string, { rank: number; size: number }>();
  for (const [, arr] of peerBands) {
    arr.sort((a, b) => b.total - a.total);
    arr.forEach((r, i) => peerRank.set(r.fips, { rank: i + 1, size: arr.length }));
  }

  // Overdose rank: per-capita deaths (deaths/pop), exclude suppressed-only counties
  const deathsByFips = new Map<string, number>();
  for (const r of overdose) {
    if (r.deaths === null) continue;
    deathsByFips.set(r.fips, (deathsByFips.get(r.fips) ?? 0) + r.deaths);
  }
  const overdosePerCapita: Array<{ fips: string; rate: number }> = [];
  for (const m of meta) {
    const d = deathsByFips.get(m.fips);
    if (d !== undefined && m.pop > 0) overdosePerCapita.push({ fips: m.fips, rate: d / m.pop });
  }
  overdosePerCapita.sort((a, b) => b.rate - a.rate);
  const overdoseRank = new Map<string, number>();
  overdosePerCapita.forEach((r, i) => overdoseRank.set(r.fips, i + 1));

  const out: CountyRankRow[] = meta.map((m) => ({
    fips: m.fips,
    national_rank: nationalRank.get(m.fips) ?? 0,
    national_total: nationalSorted.length,
    peer_rank: peerRank.get(m.fips)?.rank ?? 0,
    peer_size: peerRank.get(m.fips)?.size ?? 0,
    overdose_rank: overdoseRank.get(m.fips) ?? null,
    overdose_total: overdosePerCapita.length,
  }));

  await fs.writeFile(path.join(root, "county-ranks.json"), JSON.stringify(out));
  console.log(`wrote ${out.length} county ranks`);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
```

- [ ] **Step 3: Build-similar script**

```ts
// web/scripts/build-similar-counties.ts
import { promises as fs } from "node:fs";
import path from "node:path";
import { readParquetRows } from "@/lib/data/parquet";
import { fileURLToPath } from "node:url";

interface CountyMetaRow {
  fips: string;
  name: string;
  state: string;
  pop: number;
}

async function main() {
  const root = path.resolve(process.cwd(), "public/data");
  const meta: CountyMetaRow[] = JSON.parse(await fs.readFile(path.join(root, "county-metadata.json"), "utf-8"));
  let totals: Map<string, number> = new Map();
  try {
    const shipments = await readParquetRows<{ fips: string; pills: number }>(await fs.readFile(path.join(root, "county-shipments-by-year.parquet")));
    for (const r of shipments) totals.set(r.fips, (totals.get(r.fips) ?? 0) + r.pills);
  } catch {
    totals = new Map();
  }
  const byState = new Map<string, CountyMetaRow[]>();
  for (const m of meta) {
    const arr = byState.get(m.state) ?? [];
    arr.push(m);
    byState.set(m.state, arr);
  }
  const out: Record<string, Array<{ fips: string; name: string; state: string; pop: number; pills_total: number }>> = {};
  for (const m of meta) {
    const peers = (byState.get(m.state) ?? []).filter((p) => p.fips !== m.fips);
    peers.sort((a, b) => Math.abs(a.pop - m.pop) - Math.abs(b.pop - m.pop));
    out[m.fips] = peers.slice(0, 4).map((p) => ({
      fips: p.fips,
      name: p.name,
      state: p.state,
      pop: p.pop,
      pills_total: totals.get(p.fips) ?? 0,
    }));
  }
  await fs.writeFile(path.join(root, "similar-counties.json"), JSON.stringify(out));
  console.log(`wrote similar-counties.json for ${Object.keys(out).length} counties`);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Wire into package.json + prebuild**

Modify `web/package.json` scripts:

```json
{
  "scripts": {
    "build-ranks": "tsx scripts/build-county-ranks.ts",
    "build-similar": "tsx scripts/build-similar-counties.ts",
    "prebuild": "pnpm run validate-data && pnpm run build-ranks && pnpm run build-similar"
  }
}
```

- [ ] **Step 5: Unit test for similar loader**

```ts
// web/tests/unit/similar.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadSimilarCounties, resetSimilarCache } from "@/lib/geo/similar";

beforeEach(() => {
  resetSimilarCache();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadSimilarCounties", () => {
  it("returns [] when file is absent", async () => {
    await expect(loadSimilarCounties("00000")).resolves.toEqual([]);
  });

  it("returns ranked neighbors when file is present", async () => {
    const fs = await import("node:fs");
    vi.spyOn(fs.promises, "readFile").mockResolvedValueOnce(
      JSON.stringify({ "54059": [{ fips: "54099", name: "Logan", state: "WV", pop: 33000, pills_total: 5 }] }),
    );
    resetSimilarCache();
    const out = await loadSimilarCounties("54059");
    expect(out).toHaveLength(1);
    expect(out[0]!.name).toBe("Logan");
  });
});
```

- [ ] **Step 6: Run the test and commit**

```bash
pnpm test -- similar
```

Expected: PASS.

```bash
git add web/lib/geo/similar.ts web/scripts/build-county-ranks.ts web/scripts/build-similar-counties.ts web/package.json web/tests/unit/similar.test.ts
git commit -m "web: add similar-counties + county-ranks build scripts"
```

---

### Task 47 — `CountyTimeSeries` component

**Files:**
- Create: `web/components/county/CountyTimeSeries.tsx`
- Create: `web/components/county/CountyTimeSeries.module.css`
- Create: `web/tests/unit/county-timeseries.test.tsx`

- [ ] **Step 1: CSS**

```css
/* web/components/county/CountyTimeSeries.module.css */
.root {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  font-size: var(--type-caption);
  color: var(--text-muted);
}

.swatch {
  display: inline-block;
  width: 0.75rem;
  height: 0.75rem;
  margin-right: 0.25rem;
  vertical-align: middle;
  border-radius: 2px;
}
```

- [ ] **Step 2: Component**

```tsx
// web/components/county/CountyTimeSeries.tsx
"use client";

import { useMemo } from "react";
import { TimeSeries } from "@/components/charts/TimeSeries";
import type {
  CountyMetadata,
  StateShipmentsByYear,
} from "@/lib/data/schemas";
import type { CountyBundle } from "./Hero";
import styles from "./CountyTimeSeries.module.css";

function medianByYear(rows: StateShipmentsByYear): Map<number, number> {
  const byYear = new Map<number, number[]>();
  for (const r of rows) {
    const arr = byYear.get(r.year) ?? [];
    arr.push(r.pills_per_capita);
    byYear.set(r.year, arr);
  }
  const out = new Map<number, number>();
  for (const [year, arr] of byYear) {
    arr.sort((a, b) => a - b);
    const mid = Math.floor(arr.length / 2);
    out.set(year, arr.length % 2 ? (arr[mid] ?? 0) : ((arr[mid - 1] ?? 0) + (arr[mid] ?? 0)) / 2);
  }
  return out;
}

export function CountyTimeSeries({
  fips,
  meta,
  bundle,
  stateSeries,
}: {
  fips: string;
  meta: CountyMetadata[number];
  bundle: CountyBundle;
  stateSeries: StateShipmentsByYear;
}) {
  const rows = useMemo(() => {
    const stateRows = stateSeries.filter((s) => s.state === meta.state);
    const medians = medianByYear(stateSeries);
    const countySeries = bundle.shipments.map((r) => ({
      year: r.year,
      value: r.pills_per_capita,
      series: meta.name,
    }));
    const stateSeriesRows = stateRows.map((r) => ({
      year: r.year,
      value: r.pills_per_capita,
      series: `${meta.state} state avg`,
    }));
    const medianRows = [...medians.entries()].map(([year, value]) => ({
      year,
      value,
      series: "US median",
    }));
    return [...countySeries, ...stateSeriesRows, ...medianRows];
  }, [bundle.shipments, stateSeries, meta.state, meta.name]);

  return (
    <div className={styles.root} data-fips={fips}>
      <TimeSeries
        data={rows}
        x="year"
        y="value"
        series="series"
        ariaLabel={`Pills per capita in ${meta.name}, ${meta.state}, compared with state and national medians, 2006–2014.`}
      />
      <div className={styles.legend} aria-hidden="true">
        <span><span className={styles.swatch} style={{ background: "var(--accent-hot)" }} />{meta.name}</span>
        <span><span className={styles.swatch} style={{ background: "var(--accent-cool)" }} />{meta.state} state avg</span>
        <span><span className={styles.swatch} style={{ background: "var(--muted)" }} />US median</span>
      </div>
    </div>
  );
}
```

> The TimeSeries component's `color` prop is unused here; series colors are determined by Observable Plot's default palette. If a future task needs a strict color mapping, extend `TimeSeries` to accept a `{series: color}` map.

- [ ] **Step 3: Unit test**

```tsx
// web/tests/unit/county-timeseries.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CountyTimeSeries } from "@/components/county/CountyTimeSeries";

describe("CountyTimeSeries", () => {
  it("renders a figure with aria label referencing the county", () => {
    const meta = { fips: "54059", name: "Mingo", state: "WV", pop: 22999 };
    const bundle = {
      meta,
      shipments: [
        { fips: "54059", year: 2010, pills: 1, pills_per_capita: 400 },
        { fips: "54059", year: 2011, pills: 1, pills_per_capita: 500 },
      ],
      pharmacies: [],
      overdose: [],
    };
    render(
      <CountyTimeSeries
        fips="54059"
        meta={meta}
        bundle={bundle}
        stateSeries={[
          { state: "WV", year: 2010, pills: 1, pills_per_capita: 200 },
          { state: "WV", year: 2011, pills: 1, pills_per_capita: 250 },
          { state: "VA", year: 2010, pills: 1, pills_per_capita: 100 },
          { state: "VA", year: 2011, pills: 1, pills_per_capita: 120 },
        ]}
      />,
    );
    const fig = screen.getByRole("figure");
    expect(fig.getAttribute("aria-label")).toMatch(/Mingo/);
    // <details> fallback table should be present (from TimeSeries)
    expect(screen.getByRole("group")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run tests and commit**

```bash
pnpm test -- county-timeseries
```

Expected: PASS.

```bash
git add web/components/county/CountyTimeSeries.tsx web/components/county/CountyTimeSeries.module.css web/tests/unit/county-timeseries.test.tsx
git commit -m "web: add county time-series component"
```

---

### Task 48 — `TopDistributors` component

**Files:**
- Create: `web/components/county/TopDistributors.tsx`
- Create: `web/lib/data/loadCountyDistributors.ts`
- Create: `web/tests/unit/top-distributors.test.tsx`

- [ ] **Step 1: Loader**

```ts
// web/lib/data/loadCountyDistributors.ts
import { promises as fs } from "node:fs";
import path from "node:path";

export interface CountyDistributorRow {
  distributor: string;
  pills: number;
  share_pct: number;
}

let cache: Map<string, CountyDistributorRow[]> | null = null;

export function resetCountyDistributorsCache(): void {
  cache = null;
}

export async function loadCountyDistributors(fips: string): Promise<CountyDistributorRow[]> {
  if (!cache) {
    const file = path.resolve(process.cwd(), "public/data/county-distributors.json");
    try {
      const raw = await fs.readFile(file, "utf-8");
      const map = JSON.parse(raw) as Record<string, CountyDistributorRow[]>;
      cache = new Map(Object.entries(map));
    } catch {
      cache = new Map();
    }
  }
  return (cache.get(fips) ?? []).slice(0, 10);
}
```

> The `county-distributors.json` artifact is a v2 addition beyond spec §4; for v1 it is emitted by the pipeline aggregate step via a new SQL `sql/county_distributors.sql` (grouping distributor pills by county) and a new emit function. Update Plan 1 accordingly as a follow-up (see Risks section). If the file is missing, the loader returns an empty array and the component renders a "no data" placeholder.

- [ ] **Step 2: Component**

```tsx
// web/components/county/TopDistributors.tsx
import { Bar } from "@/components/charts/Bar";
import type { CountyDistributorRow } from "@/lib/data/loadCountyDistributors";

export function TopDistributors({ rows }: { rows: CountyDistributorRow[] }) {
  if (rows.length === 0) {
    return <p>No distributor-level data available for this county.</p>;
  }
  return (
    <Bar
      data={rows.map((r) => ({ label: r.distributor, value: r.pills, highlight: r === rows[0] }))}
      label="label"
      value="value"
      highlight="highlight"
      ariaLabel="Top distributors into this county by pills shipped 2006–2014"
    />
  );
}
```

- [ ] **Step 3: Unit test**

```tsx
// web/tests/unit/top-distributors.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TopDistributors } from "@/components/county/TopDistributors";

describe("TopDistributors", () => {
  it("renders a Bar chart when data is present", () => {
    render(<TopDistributors rows={[{ distributor: "McKesson", pills: 500_000_000, share_pct: 30 }]} />);
    expect(screen.getByRole("figure")).toBeInTheDocument();
  });

  it("shows a placeholder when empty", () => {
    render(<TopDistributors rows={[]} />);
    expect(screen.getByText(/no distributor-level data/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Commit**

```bash
pnpm test -- top-distributors
```

Expected: PASS.

```bash
git add web/components/county/TopDistributors.tsx web/lib/data/loadCountyDistributors.ts web/tests/unit/top-distributors.test.tsx
git commit -m "web: add county TopDistributors component"
```

---

### Task 49 — `TopPharmacies` component

**Files:**
- Create: `web/components/county/TopPharmacies.tsx`
- Create: `web/components/county/TopPharmacies.module.css`
- Create: `web/tests/unit/top-pharmacies.test.tsx`

- [ ] **Step 1: CSS**

```css
/* web/components/county/TopPharmacies.module.css */
.table {
  width: 100%;
  border-collapse: collapse;
}

.table th,
.table td {
  text-align: left;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--rule);
  vertical-align: baseline;
}

.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum", "lnum";
}

.sparkCell {
  width: 110px;
}
```

- [ ] **Step 2: Component**

```tsx
// web/components/county/TopPharmacies.tsx
import { Sparkline } from "@/components/charts/Sparkline";
import { formatCompact } from "@/lib/format/number";
import type { TopPharmacy } from "@/lib/data/schemas";
import styles from "./TopPharmacies.module.css";

export function TopPharmacies({ rows }: { rows: TopPharmacy[] }) {
  const displayRows = rows
    .slice()
    .sort((a, b) => b.total_pills - a.total_pills)
    .slice(0, 20);
  if (displayRows.length === 0) {
    return <p>No pharmacy-level data available for this county.</p>;
  }
  return (
    <table className={styles.table}>
      <caption className="visually-hidden">
        Top pharmacies by pills shipped 2006–2014
      </caption>
      <thead>
        <tr>
          <th scope="col">Rank</th>
          <th scope="col">Pharmacy</th>
          <th scope="col">Address</th>
          <th scope="col" className={styles.num}>Total pills</th>
          <th scope="col" className={styles.sparkCell}>Yearly trend</th>
        </tr>
      </thead>
      <tbody>
        {displayRows.map((r, i) => (
          <tr key={r.pharmacy_id}>
            <td className={styles.num}>{i + 1}</td>
            <td>{r.name}</td>
            <td>{r.address}</td>
            <td className={styles.num}>{formatCompact(r.total_pills)}</td>
            <td className={styles.sparkCell}>
              {r.yearly ? (
                <Sparkline values={r.yearly} ariaLabel={`${r.name} yearly trend`} />
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

> The `yearly` field on `TopPharmacy` is a v2 extension beyond the spec's shape (`{pharmacy_id,name,address,fips,total_pills}`). For v1, the spark column is empty (`r.yearly` is undefined) and renders nothing. When the pipeline adds per-year pharmacy aggregates in a future iteration, update `schemas.ts` to include `yearly?: number[]`.

- [ ] **Step 3: Schema note**

Modify `web/lib/data/schemas.ts` to make the optional field explicit (doesn't break existing fixtures):

```ts
// web/lib/data/schemas.ts  (TopPharmacy interface update)
export interface TopPharmacy {
  pharmacy_id: string;
  name: string;
  address: string;
  fips: string;
  total_pills: number;
  yearly?: number[]; // v2 addition; undefined today
}
```

- [ ] **Step 4: Unit test**

```tsx
// web/tests/unit/top-pharmacies.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TopPharmacies } from "@/components/county/TopPharmacies";

describe("TopPharmacies", () => {
  it("renders rows sorted desc by total_pills", () => {
    render(
      <TopPharmacies
        rows={[
          { pharmacy_id: "a", name: "Small", address: "1", fips: "54059", total_pills: 10 },
          { pharmacy_id: "b", name: "Big", address: "2", fips: "54059", total_pills: 999 },
        ]}
      />,
    );
    const rows = screen.getAllByRole("row").slice(1); // skip header
    expect(rows[0]).toHaveTextContent("Big");
  });

  it("shows a placeholder when empty", () => {
    render(<TopPharmacies rows={[]} />);
    expect(screen.getByText(/no pharmacy-level data/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run tests and commit**

```bash
pnpm test -- top-pharmacies
```

Expected: PASS.

```bash
git add web/components/county/TopPharmacies.tsx web/components/county/TopPharmacies.module.css web/lib/data/schemas.ts web/tests/unit/top-pharmacies.test.tsx
git commit -m "web: add county TopPharmacies component"
```

---

### Task 50 — `SimilarCounties` component + E2E for random FIPS

**Files:**
- Create: `web/components/county/SimilarCounties.tsx`
- Create: `web/components/county/SimilarCounties.module.css`
- Create: `web/tests/unit/similar-counties.test.tsx`
- Create: `web/tests/e2e/county.spec.ts`

- [ ] **Step 1: CSS**

```css
/* web/components/county/SimilarCounties.module.css */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-md);
}

.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  padding: var(--space-md);
  background: var(--canvas-warm);
  border-radius: var(--radius-md);
  text-decoration: none;
  color: var(--text);
  transition: background var(--motion-fast) ease;
}

.card:hover {
  background: var(--canvas-shade);
}

.name {
  font-family: var(--font-display);
  font-size: var(--type-h3);
  margin: 0;
}

.meta {
  color: var(--text-muted);
  font-size: var(--type-caption);
}
```

- [ ] **Step 2: Component**

```tsx
// web/components/county/SimilarCounties.tsx
import Link from "next/link";
import { formatCompact } from "@/lib/format/number";
import type { CountyMetadata } from "@/lib/data/schemas";
import type { SimilarCountyRef } from "@/lib/geo/similar";
import styles from "./SimilarCounties.module.css";

export function SimilarCounties({
  current,
  similar,
}: {
  current: CountyMetadata[number];
  similar: SimilarCountyRef[];
}) {
  if (similar.length === 0) {
    return <p>No similar-county comparisons available for this county.</p>;
  }
  return (
    <div className={styles.grid}>
      {similar.map((s) => (
        <Link key={s.fips} href={`/county/${s.fips}` as never} className={styles.card}>
          <h3 className={styles.name}>{s.name}</h3>
          <span className={styles.meta}>
            {s.state} · pop {formatCompact(s.pop)} · {formatCompact(s.pills_total)} pills
          </span>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Unit test**

```tsx
// web/tests/unit/similar-counties.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SimilarCounties } from "@/components/county/SimilarCounties";

describe("SimilarCounties", () => {
  it("renders a link per similar county", () => {
    render(
      <SimilarCounties
        current={{ fips: "54059", name: "Mingo", state: "WV", pop: 22999 }}
        similar={[
          { fips: "54099", name: "Logan", state: "WV", pop: 33000, pills_total: 500_000 },
          { fips: "54005", name: "Boone", state: "WV", pop: 22000, pills_total: 400_000 },
        ]}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/county/54099");
  });

  it("shows a placeholder when no peers", () => {
    render(
      <SimilarCounties
        current={{ fips: "54059", name: "Mingo", state: "WV", pop: 22999 }}
        similar={[]}
      />,
    );
    expect(screen.getByText(/no similar-county comparisons/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: E2E for random FIPS**

```ts
// web/tests/e2e/county.spec.ts
import { expect, test } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";

async function allFips(): Promise<string[]> {
  const file = path.resolve(process.cwd(), "public/data/county-metadata.json");
  const raw = await fs.readFile(file, "utf-8");
  return (JSON.parse(raw) as Array<{ fips: string }>).map((r) => r.fips);
}

test("a random county page renders full composition", async ({ page }) => {
  const fips = await allFips();
  // seed fixture may contain only Mingo; use the first entry
  const pick = fips[Math.floor(Math.random() * fips.length)] ?? "54059";
  await page.goto(`/county/${pick}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Hero stats block
  await expect(page.getByText(/Pills shipped 2006–2014/i)).toBeVisible();
  // Rank callouts
  await expect(page.getByText(/Nationally/i)).toBeVisible();
  // Time series figure
  const fig = page.getByRole("figure").first();
  await expect(fig).toBeVisible();
  // Section headings
  await expect(page.getByRole("heading", { name: /pills shipped, year by year/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /top distributors/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /top pharmacies/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /similar counties/i })).toBeVisible();
});

test("unknown FIPS 404s at build time", async ({ page }) => {
  const response = await page.goto("/county/99999", { waitUntil: "commit" });
  // SSG with dynamicParams=false → this path is simply not emitted; Next serves 404
  expect(response?.status()).toBe(404);
});
```

- [ ] **Step 5: Run the E2E**

```bash
pnpm e2e -- county.spec
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/components/county/SimilarCounties.tsx web/components/county/SimilarCounties.module.css web/tests/unit/similar-counties.test.tsx web/tests/e2e/county.spec.ts
git commit -m "web: add SimilarCounties component + county E2E"
```

---

**Phase 8 gate:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`. Optional tag `web-phase-8-done`.

---

## Phase 9 — SEO, analytics, security (tasks 51–54)

### Task 51 — `app/sitemap.ts`

**Files:**
- Create: `web/app/sitemap.ts`
- Create: `web/tests/unit/sitemap.test.ts`

- [ ] **Step 1: Sitemap generator**

```ts
// web/app/sitemap.ts
import type { MetadataRoute } from "next";
import { loadAllFips } from "@/lib/data/loadCountyMeta";

const STATIC_ROUTES: Array<{ path: string; priority: number; changeFreq: "daily" | "weekly" | "monthly" }> = [
  { path: "/", priority: 1.0, changeFreq: "weekly" },
  { path: "/explorer", priority: 0.9, changeFreq: "weekly" },
  { path: "/rankings", priority: 0.8, changeFreq: "weekly" },
  { path: "/methodology", priority: 0.5, changeFreq: "monthly" },
  { path: "/about", priority: 0.3, changeFreq: "monthly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://openarcos.org";
  const lastModified = new Date();
  const staticEntries = STATIC_ROUTES.map((r) => ({
    url: `${base}${r.path}`,
    lastModified,
    changeFrequency: r.changeFreq,
    priority: r.priority,
  }));
  const fips = await loadAllFips();
  const countyEntries = fips.map((f) => ({
    url: `${base}/county/${f}`,
    lastModified,
    changeFrequency: "monthly" as const,
    priority: 0.4,
  }));
  return [...staticEntries, ...countyEntries];
}
```

- [ ] **Step 2: Unit test**

```ts
// web/tests/unit/sitemap.test.ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data/loadCountyMeta", () => ({
  loadAllFips: vi.fn(async () => ["54059", "51097"]),
}));

import sitemap from "@/app/sitemap";

describe("sitemap", () => {
  it("includes all static routes and one url per county", async () => {
    const urls = await sitemap();
    const paths = urls.map((u) => new URL(u.url).pathname);
    expect(paths).toContain("/");
    expect(paths).toContain("/explorer");
    expect(paths).toContain("/rankings");
    expect(paths).toContain("/methodology");
    expect(paths).toContain("/about");
    expect(paths).toContain("/county/54059");
    expect(paths).toContain("/county/51097");
  });

  it("uses NEXT_PUBLIC_SITE_ORIGIN when set", async () => {
    process.env.NEXT_PUBLIC_SITE_ORIGIN = "https://staging.openarcos.org";
    const urls = await sitemap();
    delete process.env.NEXT_PUBLIC_SITE_ORIGIN;
    expect(urls[0]?.url.startsWith("https://staging.openarcos.org")).toBe(true);
  });
});
```

- [ ] **Step 3: Run and commit**

```bash
pnpm test -- sitemap
```

Expected: PASS.

```bash
git add web/app/sitemap.ts web/tests/unit/sitemap.test.ts
git commit -m "web: generate sitemap with all static + county routes"
```

---

### Task 52 — `app/robots.ts`

**Files:**
- Create: `web/app/robots.ts`
- Create: `web/tests/unit/robots.test.ts`

- [ ] **Step 1: Robots**

```ts
// web/app/robots.ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://openarcos.org";
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
```

- [ ] **Step 2: Unit test**

```ts
// web/tests/unit/robots.test.ts
import { describe, expect, it } from "vitest";
import robots from "@/app/robots";

describe("robots", () => {
  it("allows all crawlers and points to sitemap", () => {
    const r = robots();
    expect(r.rules).toEqual([{ userAgent: "*", allow: "/" }]);
    expect(r.sitemap).toContain("/sitemap.xml");
  });
});
```

- [ ] **Step 3: Run and commit**

```bash
pnpm test -- robots
```

Expected: PASS.

```bash
git add web/app/robots.ts web/tests/unit/robots.test.ts
git commit -m "web: add permissive robots.txt"
```

---

### Task 53 — Plausible analytics + Sentry

**Files:**
- Modify: `web/app/layout.tsx`
- Create: `web/lib/analytics/Plausible.tsx`
- Create: `web/lib/analytics/sentry.client.ts`
- Modify: `web/package.json` (add `@sentry/nextjs`)
- Create: `web/tests/unit/plausible.test.tsx`

- [ ] **Step 1: Plausible component**

```tsx
// web/lib/analytics/Plausible.tsx
import Script from "next/script";

export function Plausible() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  const src = process.env.NEXT_PUBLIC_PLAUSIBLE_SRC ?? "https://plausible.io/js/script.js";
  if (!domain) return null;
  return (
    <Script
      src={src}
      data-domain={domain}
      strategy="afterInteractive"
      data-testid="plausible-script"
    />
  );
}
```

- [ ] **Step 2: Sentry client init**

```ts
// web/lib/analytics/sentry.client.ts
"use client";

import * as Sentry from "@sentry/nextjs";

let initialized = false;

export function initSentryOnce(): void {
  if (initialized) return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    tracesSampleRate: 0, // errors only; no perf sampling for v1
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? "production",
    enabled: true,
  });
  initialized = true;
}
```

- [ ] **Step 3: Install dep**

```bash
pnpm add @sentry/nextjs
```

- [ ] **Step 4: Wire into layout**

Modify `web/app/layout.tsx` to include Plausible and initialize Sentry on the client:

```tsx
// web/app/layout.tsx (imports)
import { Plausible } from "@/lib/analytics/Plausible";
import { SentryBootstrap } from "@/lib/analytics/SentryBootstrap";
```

Create `web/lib/analytics/SentryBootstrap.tsx`:

```tsx
// web/lib/analytics/SentryBootstrap.tsx
"use client";

import { useEffect } from "react";
import { initSentryOnce } from "./sentry.client";

export function SentryBootstrap() {
  useEffect(() => {
    initSentryOnce();
  }, []);
  return null;
}
```

Modify the `RootLayout` JSX to render both (order: Plausible in `<head>` via Next's Script; SentryBootstrap inside `<body>` before `{children}`):

```tsx
// web/app/layout.tsx  (body)
<body>
  <SentryBootstrap />
  <Plausible />
  <Header />
  <main>{children}</main>
  <Footer buildDate={BUILD_DATE} />
</body>
```

- [ ] **Step 5: Unit test**

```tsx
// web/tests/unit/plausible.test.tsx
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Plausible } from "@/lib/analytics/Plausible";

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
});

describe("Plausible", () => {
  it("renders nothing when no domain is set", () => {
    const { container } = render(<Plausible />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a script when domain is set", () => {
    process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN = "openarcos.org";
    const { getByTestId } = render(<Plausible />);
    const s = getByTestId("plausible-script");
    expect(s.getAttribute("data-domain")).toBe("openarcos.org");
  });
});
```

- [ ] **Step 6: Run and commit**

```bash
pnpm test -- plausible
```

Expected: PASS.

```bash
git add web/lib/analytics/Plausible.tsx web/lib/analytics/sentry.client.ts web/lib/analytics/SentryBootstrap.tsx web/app/layout.tsx web/package.json web/pnpm-lock.yaml web/tests/unit/plausible.test.tsx
git commit -m "web: wire Plausible (env-gated) and Sentry errors-only"
```

---

### Task 54 — CSP & cache headers via `vercel.json`

**Files:**
- Create: `web/vercel.json`
- Create: `web/tests/unit/vercel-config.test.ts`

- [ ] **Step 1: Config**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "pnpm run build",
  "outputDirectory": "out",
  "cleanUrls": true,
  "trailingSlash": false,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(), payment=()" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; img-src 'self' data:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' https://plausible.io https://browser.sentry-cdn.com; connect-src 'self' https://plausible.io https://*.ingest.sentry.io; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
        }
      ]
    },
    {
      "source": "/data/(.*)\\.parquet",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/data/(.*)\\.json",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=86400, stale-while-revalidate=604800" }
      ]
    },
    {
      "source": "/fonts/(.*)\\.woff2",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

- [ ] **Step 2: Unit test (parses JSON; asserts required headers exist)**

```ts
// web/tests/unit/vercel-config.test.ts
import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("vercel.json", () => {
  it("includes CSP, immutable parquet cache, SWR json cache", async () => {
    const raw = await fs.readFile(path.resolve(process.cwd(), "vercel.json"), "utf-8");
    const json = JSON.parse(raw) as {
      headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
    };
    const all = json.headers.flatMap((h) => h.headers);
    const csp = all.find((h) => h.key === "Content-Security-Policy");
    expect(csp?.value).toMatch(/default-src 'self'/);
    expect(csp?.value).toMatch(/plausible\.io/);
    expect(csp?.value).toMatch(/sentry\.io/);

    const parquetRule = json.headers.find((h) => h.source.includes("parquet"));
    expect(parquetRule?.headers.find((h) => h.key === "Cache-Control")?.value).toMatch(/immutable/);

    const jsonRule = json.headers.find((h) => h.source.includes("\\.json"));
    expect(jsonRule?.headers.find((h) => h.key === "Cache-Control")?.value).toMatch(/stale-while-revalidate/);
  });
});
```

- [ ] **Step 3: Run and commit**

```bash
pnpm test -- vercel-config
```

Expected: PASS.

```bash
git add web/vercel.json web/tests/unit/vercel-config.test.ts
git commit -m "web: add vercel.json with CSP + cache headers"
```

---

**Phase 9 gate:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Optional tag `web-phase-9-done`.

---

## Phase 10 — CI + Deploy (tasks 55–59)

### Task 55 — `ci.yml` web job

**Files:**
- Modify: `.github/workflows/ci.yml` (created in Plan 1 Phase 10)

- [ ] **Step 1: Append a `web` job**

If `ci.yml` does not exist yet (Plan 1 Phase 10 Task 55 should have created it), create it with this content; otherwise append the `web` job to the existing `jobs:` block:

```yaml
# .github/workflows/ci.yml
name: ci

on:
  pull_request:
    paths:
      - "pipeline/**"
      - "web/**"
      - ".github/workflows/ci.yml"
  push:
    branches: [main]

jobs:
  pipeline:
    # (content added by Plan 1 Task 55)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: pipeline
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v4
        with:
          enable-cache: true
      - run: uv sync --frozen
      - run: uv run ruff check
      - run: uv run pytest

  web:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 11
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: pnpm
          cache-dependency-path: web/pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint
      - run: pnpm run typecheck
      - run: pnpm run test
      - run: pnpm run validate-data
      - run: pnpm run build-ranks
      - run: pnpm run build-similar
      - run: pnpm run build
      - uses: microsoft/playwright-github-action@v1
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm run e2e

  lighthouse:
    needs: [web]
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 11
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: pnpm
          cache-dependency-path: web/pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
      - run: pnpm run build-ranks
      - run: pnpm run build-similar
      - run: pnpm run build
      - run: pnpm exec lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "web: add CI job for lint/test/build/e2e/lighthouse"
```

---

### Task 56 — Lighthouse CI config

**Files:**
- Create: `web/.lighthouserc.json`

- [ ] **Step 1: Config**

```json
{
  "ci": {
    "collect": {
      "staticDistDir": "out",
      "url": [
        "http://localhost/",
        "http://localhost/explorer",
        "http://localhost/rankings",
        "http://localhost/methodology",
        "http://localhost/county/54059"
      ],
      "numberOfRuns": 2
    },
    "assert": {
      "assertions": {
        "categories:performance": ["warn", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.9 }],
        "categories:best-practices": ["error", { "minScore": 0.9 }],
        "categories:seo": ["error", { "minScore": 0.9 }]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

> Note: `categories:performance` is `warn` during web-core only; Plan 3 tightens it to `error` once the scrolly + explorer are in place. The `/explorer` and `/` thresholds will always pass in web-core because both are static stubs; they get real teeth after Plan 3.

- [ ] **Step 2: Commit**

```bash
git add web/.lighthouserc.json
git commit -m "web: add Lighthouse CI assertions (\u22650.9 a11y/bp/seo; perf warn)"
```

---

### Task 57 — Ops docs + DNS cutover notes

**Files:**
- Create: `docs/ops.md`
- Modify: `web/README.md`

- [ ] **Step 1: docs/ops.md**

```markdown
# Operations

## Deploy target
- Vercel project: openarcos (production: main branch)
- Root directory: `web`
- Build command: `pnpm run build` (prebuild runs validate-data + build-ranks + build-similar)
- Output directory: `out`
- Framework preset: Next.js

## Environment variables (Vercel)
- `NEXT_PUBLIC_SITE_ORIGIN` — e.g., `https://openarcos.org`
- `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` — e.g., `openarcos.org` (leave empty to disable analytics)
- `NEXT_PUBLIC_SENTRY_DSN` — the project's browser DSN (leave empty to disable)
- `NEXT_PUBLIC_APP_ENV` — `production` | `staging`

## DNS cutover
1. Register `openarcos.org` at the chosen registrar.
2. Nameservers: point to Cloudflare. DNS-only (unproxied / grey-cloud) because Vercel handles TLS + caching.
3. In Cloudflare DNS, add:
   - `A @ 76.76.21.21` (Vercel anycast; confirm with `vercel domains`)
   - `CNAME www openarcos.org`
4. In Vercel project settings > Domains, add `openarcos.org` and `www.openarcos.org`. Vercel will verify via a TXT record that must be added in Cloudflare.
5. After verification, Vercel issues a Let's Encrypt cert automatically.
6. Confirm `https://openarcos.org` resolves and `curl -I https://openarcos.org` shows the expected `Content-Security-Policy` header.

## Weekly data rebuild
- `build-data.yml` runs Mondays 03:00 UTC (see Plan 1 Phase 10).
- On success it commits refreshed files under `web/public/data/` back to `main` with message `data: refresh YYYY-MM-DD`.
- A push to `main` triggers Vercel to redeploy automatically.

## Incident response
- If Lighthouse CI fails: check the LHCI public-storage link in the PR check; investigate the dropped category.
- If schema validation fails: the pipeline emitted data that violates `/pipeline/schemas/*.schema.json`. Either the pipeline changed shape unexpectedly (bug) or the schema version needs a deliberate bump (update schemas, TS mirrors, and fixtures together).
- If Sentry reports browser errors post-deploy: confirm CSP is not blocking a legitimate script; rollback via `vercel rollback` if severe.
```

- [ ] **Step 2: Append to web/README.md**

```markdown
## Deployment
See [../docs/ops.md](../docs/ops.md).
```

- [ ] **Step 3: Commit**

```bash
git add docs/ops.md web/README.md
git commit -m "docs: ops.md with Vercel + Cloudflare DNS cutover"
```

---

### Task 58 — Root `.gitattributes` (verify binaries)

**Files:**
- Modify: root `.gitattributes` (created in Plan 1 Task 4 with `*.parquet binary`; append woff2)

- [ ] **Step 1: Ensure complete coverage**

Root `.gitattributes` should contain (replace or extend as needed):

```
*.parquet binary
*.woff2 binary
*.pdf binary
```

- [ ] **Step 2: Commit if changed**

```bash
git add .gitattributes
git diff --cached --quiet || git commit -m "chore: mark woff2 as binary for git"
```

---

### Task 59: Final verification sweep

Before marking the plan DONE, run the full local verification matrix and fix any issues surfaced. This catches cross-task regressions that per-phase gates missed (e.g. a later task subtly broke an earlier one's test).

**Files:** none (audit only)

- [ ] **Step 1:** Full local matrix. Run from the repo root:

```bash
cd web && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
```

- [ ] **Step 2:** Investigate and fix any failures. Commit each fix separately with message `fix(sweep): <one-line-description>`.

- [ ] **Step 3:** Re-run the full matrix. All checks must pass before moving on:

```bash
cd web && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
```

- [ ] **Step 4:** Commit a no-op marker if nothing broke:

```bash
git commit --allow-empty -m "chore: final verification sweep clean"
```

---

### Task 60 — Final verification + push

- [ ] **Step 1: Full local loop**

Run the full verification sequence; every command must succeed:

```bash
cd web
pnpm install --frozen-lockfile
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run validate-data
pnpm run build-ranks
pnpm run build-similar
pnpm run build
pnpm run e2e
```

Expected: all pass.

- [ ] **Step 2: Push to origin**

```bash
git status  # should show clean tree (all Phase 1–9 commits landed)
git log --oneline origin/main..HEAD
git push origin main
```

- [ ] **Step 3: Watch CI**

```bash
gh run watch
```

Expected: `pipeline`, `web`, `lighthouse` jobs all green.

- [ ] **Step 4: Tag release**

```bash
git tag -a web-core-v1 -m "openarcos web-core implementation complete"
git push origin web-core-v1
```

---

**Phase 10 gate:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Optional tag `web-phase-10-done`.

---

## Risks

| Risk | Mitigation |
|---|---|
| Schema drift between pipeline and web TS mirror | `scripts/validate-data.ts` runs in `prebuild` — PRs fail if `web/public/data/` doesn't match `/pipeline/schemas/`. TS mirror lives in `lib/data/schemas.ts` with a doc comment naming the source of truth. |
| Parquet loader mismatch between build (Node) and client | One library (`hyparquet`) used in both; `readParquetRows` wrapper tested against a committed fixture from the pipeline's own build. |
| `search-index.json` grows past 12 MB | `useSearchIndex` lazy-loads on first input focus, caches in sessionStorage (no second download per session). Plan 3 revisits if telemetry shows slow first-search on mobile. |
| 3,100 county pages bloat build time | Next's static generator handles this at ~1–2 min on a typical runner; if a future regression pushes over the 10-min CI budget, enable partial prerender via `dynamicParams=true` + on-demand ISR. |
| Plan 1's pipeline does not yet emit `county-distributors.json` | Task 48's loader returns `[]` when the file is absent; the component renders a placeholder. Follow-up task in Plan 1: add `sql/county_distributors.sql` + a new emit function. |
| Plan 1's top-pharmacies parquet lacks per-year arrays (`yearly?: number[]`) | Task 49's schema change is backward-compatible (`yearly?` is optional). Sparkline column is empty until the pipeline is extended in a future iteration. |
| Vercel CSP blocks third-party legitimately needed (e.g., a new analytics host) | CSP source lives in `web/vercel.json` — amend and re-deploy; `tests/unit/vercel-config.test.ts` asserts the allow-list shape. |
| Lighthouse perf regression from chart render | Perf assertion is `warn` in web-core and becomes `error` after Plan 3 lands the scrolly + explorer, which have their own perf budgets. |

## Cross-plan self-review

- **Spec §5 routes covered:** `/` (stub + full home via Plan 3), `/explorer` (stub + full via Plan 3), `/rankings`, `/methodology`, `/about`, `/county/[fips]`. ✔
- **Spec §4 artifacts consumed:** state-shipments-by-year.json (Plan 2 Task 22), county-metadata.json (21), county-shipments-by-year.parquet (22), top-distributors-by-year.json (22 → aggregated in 40), top-pharmacies.parquet (22 → paginated in 41, per-county in 49), cdc-overdose-by-county-year.parquet (22 → via bundle in 43), dea-enforcement-actions.json (not consumed in Plan 2 by design — Plan 3 uses it in Act 3; sanity check confirms it's still validated in Phase 3 Task 16), search-index.json (34). 2 net-new web-only artifacts declared (`county-ranks.json` and `similar-counties.json`) are built from the primary 8 and are not part of spec §4. ✔
- **Spec §5 a11y commitments covered:** focus rings (tokens.css in Phase 2), tabular-nums (tokens + numeric class), aria-labels on figures (Phase 5 + 8), `<details><table>` fallback on every chart, semantic tabs in Phase 7. ✔
- **Spec §7 failure modes covered:** schema drift (validate-data.ts in CI + prebuild), search-index failure (Task 34 error state with retry), Parquet failure on client (Task 41 retry button), bad FIPS (Task 43 `notFound()` via dynamicParams=false). JS-disabled fallback is inherent to SSG. WebGL-disabled is a Plan 3 concern. Reduced-motion is a Plan 3 concern. ✔
- **Type consistency:** `CountyBundle` is defined once in `components/county/Hero.tsx` and re-imported elsewhere — no duplicate definitions. `SearchIndexEntry`, `TopPharmacy`, `CountyRanks`, `SimilarCountyRef` are each defined in exactly one place and referenced by path. ✔
- **Placeholder scan:** no "TBD" or "similar to Task N" strings; every step has concrete paths and commands. ✔
- **Fresh-eyes gaps caught during review:**
  - Added `docs/ops.md` as a concrete artifact rather than a handwave.
  - Made `yearly?` explicit on `TopPharmacy` so the sparkline column degrades gracefully.
  - Tightened Tasks 41 and 49 to acknowledge that `county-distributors.json` and per-pharmacy-year data are net-new requirements on the pipeline; added them to Risks.

## Execution handoff

Plan 2 is complete and saved to `docs/superpowers/plans/2026-04-29-openarcos-web-core.md`.

**REQUIRED SUB-SKILL for execution:** Use `superpowers:subagent-driven-development` (recommended — fresh subagent per task with review between) or `superpowers:executing-plans` (inline, batch with checkpoints).

Plan 1 (pipeline, 58 tasks) is its prerequisite for real data. For development against fixtures, Plan 2 can start at any time — Task 17 committed empty-array JSON stubs that let `pnpm build` succeed before the pipeline emits real content.

Plan 3 (web-interactive, 38 tasks) depends on Plan 2's scaffold and data loaders; start it after Plan 2 Phase 6 lands (Header + SearchBox wired). Plan 3's Phase 1 scrolly-spike can be done in parallel with Plan 2's Phase 7 or 8 on a separate branch.
