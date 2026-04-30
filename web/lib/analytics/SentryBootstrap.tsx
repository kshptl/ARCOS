"use client";

import { useEffect } from "react";
import { initSentryOnce } from "./sentry.client";

export function SentryBootstrap() {
  useEffect(() => {
    initSentryOnce();
  }, []);
  return null;
}
