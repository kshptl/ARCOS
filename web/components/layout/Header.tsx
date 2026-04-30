import Link from "next/link";
import type { ReactNode } from "react";
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
  return (
    <header className={styles.root}>
      <div className={styles.row}>
        <Link href="/" className={styles.brand}>
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
      </div>
    </header>
  );
}
