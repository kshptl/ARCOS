# Operations

## Deploy target

**Cloudflare Pages** — chosen because:
- Domain `openarcos.org` is already in the same Cloudflare account (single-tenant)
- Unlimited bandwidth on the free tier (removes viral-moment risk)
- No commercial-use restrictions on free tier
- CDN/DDoS/TLS/DNS all on one dashboard

Project config (set in the Pages dashboard, **Settings → Builds & deployments**):

| Field | Value |
|---|---|
| Production branch | `main` |
| Framework preset | `Next.js (Static HTML Export)` (or `None` if the preset doesn't detect; the build command + output-dir are what matters) |
| Root directory | `web` |
| Build command | `pnpm install --frozen-lockfile && pnpm run build` |
| Build output directory | `out` |
| Node version | `20` (read from `web/.nvmrc`) |

Custom headers + cache-control live in `web/public/_headers` (copied into `web/out/_headers` at build time). That file is the single source of truth for CSP, cache rules, and security headers.

## Environment variables (Pages dashboard → Settings → Environment variables)

Set the same values for both the **Production** and **Preview** environments unless noted.

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SITE_ORIGIN` | `https://openarcos.org` (prod) / `https://<preview>.pages.dev` (preview) | |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | `openarcos.org` (prod) / empty (preview) | Leave empty to disable analytics on previews |
| `NEXT_PUBLIC_SENTRY_DSN` | project DSN | Leave empty to disable |
| `NEXT_PUBLIC_APP_ENV` | `production` / `staging` | |
| `NODE_VERSION` | `20` | Redundant with `.nvmrc` but explicit is safer |

## DNS + custom domain setup

Because `openarcos.org` already lives in your Cloudflare account, this is almost zero-config:

1. In the Cloudflare dashboard, open the Pages project after the first successful build.
2. **Pages → openarcos → Custom domains → Set up a custom domain**.
3. Enter `openarcos.org`. CF detects the domain in your account and offers to wire it for you — accept.
4. Repeat for `www.openarcos.org`.
5. In Cloudflare **DNS**, verify the auto-created records:
   - `CNAME @  openarcos.pages.dev` (proxied — orange cloud ON; CF Pages benefits from proxying)
   - `CNAME www openarcos.pages.dev` (proxied)
6. TLS is automatic (Cloudflare Universal SSL + Pages' own cert — both valid).
7. Confirm with `curl -I https://openarcos.org` — expect a 200 response and the `Content-Security-Policy` header from `_headers`.

Optional: in **Rules → Redirect Rules**, add a 301 from `www.openarcos.org/*` → `https://openarcos.org/$1` to avoid duplicate-content SEO issues.

## Preview deploys

Every push to a non-`main` branch or every PR gets a unique `<branch>.openarcos-xyz.pages.dev` preview URL. Safe to use for reviewing data-refresh PRs before they land on `main`.

## Weekly data rebuild

- `.github/workflows/build-data.yml` runs Mondays 03:00 UTC.
- On success it commits refreshed files under `web/public/data/` back to `main` with message `data: refresh YYYY-MM-DD`.
- CF Pages watches `main` and auto-redeploys on the new commit.

## Incident response

- **Build failing in CF Pages**: check the Pages dashboard build log. Most common: Node version mismatch (confirm `NODE_VERSION=20` env var or `.nvmrc`), missing env var causing a script to fail, or a transient pnpm registry hiccup (retry).
- **Lighthouse CI fails in GitHub Actions PR check**: inspect the uploaded report link; most likely a perf-metric drift. `.lighthouserc.json` thresholds are calibrated to real measurements, so failures are usually real regressions.
- **Schema validation fails**: pipeline emitted data that violates `pipeline/schemas/*.schema.json`. Either pipeline contract change or a genuine bug — update schemas, TS mirrors, and fixtures together or fix the pipeline.
- **Sentry reports browser errors post-deploy**: check if CSP in `web/public/_headers` is blocking a legitimate script (new analytics tool, new CDN, etc.). If a rollback is needed, revert the offending commit on `main`; CF Pages will auto-redeploy within ~1 minute. No explicit rollback command needed.
- **CSP blocking third-party**: add the host to the relevant directive in `web/public/_headers`, commit, push — a PR's preview deploy is the safest place to validate before merging.

## Why `_headers` + `_redirects` instead of `vercel.json`

`vercel.json` was the Plan 2 artifact. When we moved to Cloudflare Pages, it was replaced by:
- `web/public/_headers` — CSP, cache-control, security headers
- (No `_redirects` needed — CF Pages serves `foo.html` at `/foo` automatically)

The switch was motivated by single-vendor simplicity, unlimited bandwidth, and the commercial-use clause on Vercel Hobby. See the git commit that introduced this change for the full reasoning.
