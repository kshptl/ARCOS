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
