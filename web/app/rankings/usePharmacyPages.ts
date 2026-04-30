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
