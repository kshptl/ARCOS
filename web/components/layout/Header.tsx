"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useId, useState } from "react";
import { SearchBox } from "@/components/search/SearchBox";
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
  const searchNode = search ?? <SearchBox />;
  const [open, setOpen] = useState(false);
  const panelId = useId();

  // Close the dropdown on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className={styles.root}>
      <div className={styles.row}>
        <Link href="/" className={styles.brand} onClick={() => setOpen(false)}>
          openarcos
        </Link>
        <div className={styles.search}>{searchNode}</div>
        <nav className={styles.nav} aria-label="Primary">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          className={styles.hamburger}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden="true" className={styles.hamburgerIcon}>
            {open ? "\u2715" : "\u2630"}
          </span>
        </button>
      </div>
      {open ? (
        <div id={panelId} className={styles.mobilePanel} data-open="true">
          <nav aria-label="Primary mobile" className={styles.mobileNav}>
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className={styles.mobileSearch}>{searchNode}</div>
        </div>
      ) : (
        <div id={panelId} hidden />
      )}
    </header>
  );
}
