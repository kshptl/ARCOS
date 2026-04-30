"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import styles from "./CitationPopover.module.css";

type Props = {
  source: string;
  year: number;
  url: string;
};

export function CitationPopover({ source, year, url }: Props) {
  const [open, setOpen] = useState(false);
  const dialogId = useId();
  const rootRef = useRef<HTMLSpanElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (rootRef.current && target && !rootRef.current.contains(target)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [open, close]);

  return (
    <span ref={rootRef} className={styles.root}>
      <button
        type="button"
        className={styles.trigger}
        aria-label="Cite"
        aria-expanded={open}
        aria-controls={dialogId}
        onClick={() => setOpen((prev) => !prev)}
      >
        ?
      </button>
      {open ? (
        <div id={dialogId} role="dialog" aria-label="Citation" className={styles.popover}>
          <p className={styles.source}>{source}</p>
          <p className={styles.meta}>{year}</p>
          <a href={url} target="_blank" rel="noreferrer" className={styles.link}>
            {new URL(url).host}
          </a>
        </div>
      ) : null}
    </span>
  );
}
