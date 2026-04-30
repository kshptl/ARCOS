"use client";

import Link from "next/link";
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { useSearchIndex } from "./useSearchIndex";
import type { SearchIndexEntry } from "@/lib/data/schemas";
import styles from "./SearchBox.module.css";

const GROUP_DEFS: Array<{
  key: "places" | "distributors" | "pharmacies";
  label: string;
  types: SearchIndexEntry["type"][];
}> = [
  { key: "places", label: "Places", types: ["county", "city", "zip"] },
  { key: "distributors", label: "Distributors", types: ["distributor"] },
  { key: "pharmacies", label: "Pharmacies", types: ["pharmacy"] },
];

const MAX_PER_GROUP = 5;

function groupResults(
  hits: SearchIndexEntry[],
): Array<{ key: string; label: string; items: SearchIndexEntry[] }> {
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
  if (entry.type === "distributor") {
    return `/rankings#distributor-${entry.id.replace(/^distributor:/, "")}`;
  }
  return "/rankings";
}

export function SearchBox({
  placeholder = "Search counties, distributors, pharmacies…",
}: { placeholder?: string }) {
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const { status, error, search, load } = useSearchIndex();

  const groups = useMemo(
    () => (query.trim() ? groupResults(search(query, { limit: 30 })) : []),
    [query, search],
  );
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const onFocus = () => {
    setOpen(true);
    if (status === "idle") void load();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIdx >= 0 && flat[activeIdx]) {
      e.preventDefault();
      const target = flat[activeIdx];
      if (target) window.location.assign(hrefFor(target));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIdx(-1);
      inputRef.current?.blur();
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset active index whenever query changes
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
        aria-activedescendant={
          activeIdx >= 0 ? `${listboxId}-opt-${activeIdx}` : undefined
        }
      />
      {open && (
        <div id={listboxId} role="listbox" className={styles.panel}>
          {status === "loading" && (
            <div className={styles.status}>Loading search index…</div>
          )}
          {status === "error" && (
            <div className={styles.status}>
              Search index failed to load.{" "}
              <button type="button" onClick={() => void load()}>
                Retry
              </button>
              {error ? ` (${error.message})` : null}
            </div>
          )}
          {status === "ready" && query.trim() && groups.length === 0 && (
            <div className={styles.status}>No matches for "{query}"</div>
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
                      href={hrefFor(entry) as `/${string}`}
                    >
                      <span className={styles.itemLabel}>{entry.label}</span>
                      {entry.sublabel && (
                        <span className={styles.itemSub}>{entry.sublabel}</span>
                      )}
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
