import type { CountyRanks } from "@/lib/data/loadCountyRanks";
import type { CountyMetadata } from "@/lib/data/schemas";
import { formatOrdinal } from "@/lib/format/number";
import styles from "./RankCallouts.module.css";

export function RankCallouts({ meta: _meta, ranks }: { meta: CountyMetadata; ranks: CountyRanks }) {
  return (
    <section className={styles.grid} aria-label="Rank callouts">
      <div className={styles.card}>
        <span className={styles.label}>Nationally</span>
        <span className={styles.rank}>
          {ranks.national_rank > 0 ? formatOrdinal(ranks.national_rank) : "—"}
        </span>
        <span className={styles.of}>
          {ranks.national_rank > 0
            ? `of ${ranks.national_total} counties by pills shipped`
            : "insufficient data"}
        </span>
      </div>
      <div className={styles.card}>
        <span className={styles.label}>Among peers</span>
        <span className={styles.rank}>
          {ranks.peer_rank > 0 ? formatOrdinal(ranks.peer_rank) : "—"}
        </span>
        <span className={styles.of}>
          {ranks.peer_rank > 0
            ? `of ${ranks.peer_size} counties with similar population`
            : "insufficient data"}
        </span>
      </div>
      <div className={styles.card}>
        <span className={styles.label}>Overdose deaths</span>
        <span className={styles.rank}>
          {ranks.overdose_rank !== null ? formatOrdinal(ranks.overdose_rank) : "—"}
        </span>
        <span className={styles.of}>
          {ranks.overdose_rank !== null
            ? `of ${ranks.overdose_total} counties (CDC WONDER, per-capita)`
            : "suppressed or unavailable"}
        </span>
      </div>
    </section>
  );
}
