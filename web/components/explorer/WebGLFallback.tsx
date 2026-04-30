import type { CountyMetadata } from "@/lib/data/schemas";
import styles from "./WebGLFallback.module.css";

export interface WebGLFallbackProps {
  counties: CountyMetadata[];
  reason: string;
}

export function WebGLFallback({ counties, reason }: WebGLFallbackProps) {
  return (
    <figure role="figure" aria-label="Static county list fallback" className={styles.root}>
      <div role="alert" className={styles.notice}>
        {reason} Use the keyboard-navigable list below or enable WebGL for the full map.
      </div>
      <ul className={styles.list}>
        {counties.map((c) => (
          <li key={c.fips}>
            <a href={`/county/${c.fips}`}>
              {c.name}, {c.state}
            </a>
          </li>
        ))}
      </ul>
    </figure>
  );
}
