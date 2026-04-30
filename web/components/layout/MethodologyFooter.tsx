import Link from "next/link";
import styles from "./MethodologyFooter.module.css";

export function MethodologyFooter() {
  return (
    <footer className={styles.root}>
      <div className={styles.inner}>
        <p>
          Data sourced from WaPo ARCOS, DEA Diversion Control, and CDC WONDER. See{" "}
          <Link href="/methodology">methodology</Link> for full details.
        </p>
        <p>
          Code on{" "}
          <a href="https://github.com/openarcos/openarcos" target="_blank" rel="noreferrer">
            GitHub
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
