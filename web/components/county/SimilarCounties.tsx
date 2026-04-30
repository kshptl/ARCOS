import Link from "next/link";
import type { CountyMetadata } from "@/lib/data/schemas";
import { formatCompact } from "@/lib/format/number";
import type { SimilarCountyRef } from "@/lib/geo/similar";
import styles from "./SimilarCounties.module.css";

export function SimilarCounties({
  current: _current,
  similar,
}: {
  current: CountyMetadata;
  similar: SimilarCountyRef[];
}) {
  if (similar.length === 0) {
    return <p>No similar-county comparisons available for this county.</p>;
  }
  return (
    <div className={styles.grid}>
      {similar.map((s) => (
        <Link
          key={s.fips}
          href={`/county/${s.fips}` as `/county/${string}`}
          className={styles.card}
        >
          <h3 className={styles.name}>{s.name}</h3>
          <span className={styles.meta}>
            {s.state} · pop {formatCompact(s.pop)} · {formatCompact(s.pills_total)} pills
          </span>
        </Link>
      ))}
    </div>
  );
}
