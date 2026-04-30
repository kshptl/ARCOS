import Link from "next/link";
import { MethodologyFooter } from "@/components/layout/MethodologyFooter";
import { SearchBox } from "@/components/search/SearchBox";
import { Eyebrow, Lede } from "@/components/ui/Typography";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <div data-theme="dark" className={styles.root}>
      <article className={styles.article}>
        <Eyebrow>404</Eyebrow>
        <h1>County not found</h1>
        <Lede>
          That URL didn&apos;t match a US county FIPS code. Counties are indexed by their five-digit
          FIPS (for example, <code>/county/54059</code> for Mingo County, WV).
        </Lede>

        <section>
          <h2>Search for a county, distributor, or pharmacy</h2>
          <div className={styles.searchContainer}>
            <SearchBox />
          </div>
        </section>

        <section>
          <h2>Or start somewhere else</h2>
          <p className={styles.links}>
            <Link href="/">Home</Link>
            <Link href="/explorer">Explorer</Link>
            <Link href="/rankings">Rankings</Link>
            <Link href="/methodology">Methodology</Link>
          </p>
        </section>
      </article>
      <MethodologyFooter />
    </div>
  );
}
