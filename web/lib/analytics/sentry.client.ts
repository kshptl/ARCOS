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
