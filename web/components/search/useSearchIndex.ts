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
    fields: ["name"],
    storeFields: ["type", "id", "name", "fips", "state", "address"],
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
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
    const byId = new Map<string, SearchIndexEntry>((cachedEntries ?? []).map((e) => [e.id, e]));
    const out: SearchIndexEntry[] = [];
    for (const hit of hits) {
      const entry = byId.get(String(hit.id));
      if (entry) out.push(entry);
      if (out.length >= limit) break;
    }
    return out;
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run when status changes so entries reflect the latest cache
  const entries = useMemo(() => cachedEntries ?? [], [status]);

  return { status, error, entries, search, load };
}
