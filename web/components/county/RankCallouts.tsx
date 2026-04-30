import type { CountyRanks } from "@/lib/data/loadCountyRanks";
import type { CountyMetadata } from "@/lib/data/schemas";
import { formatOrdinal } from "@/lib/format/number";
import styles from "./RankCallouts.module.css";

/**
 * Callouts for national, peer-population, and overdose rank. The
 * shipment-derived ranks (national, peer) are rendered as em-dashes
 * when `suppressed` is true — a suppressed county's apparent rank is
 * based on zero pills and misleads readers about ARCOS-source data
 * being unavailable.
 *
 * `hasSimilarPeers=false` also forces the peer-rank card to em-dash so
 * it can't disagree with the SimilarCounties section (e.g. hero
 * claiming "1st of 2 similar-population counties" while SimilarCounties
 * reports none available). The two components read from different
 * artifacts — county-ranks.json (population-band bucket) and
 * similar-counties.json (state neighbours) — so we treat an empty
 * similar-counties set as ground truth for "no comparable peers".
 */
export function RankCallouts({
  meta: _meta,
  ranks,
  suppressed = false,
  hasSimilarPeers = true,
}: {
  meta: CountyMetadata;
  ranks: CountyRanks;
  suppressed?: boolean;
  hasSimilarPeers?: boolean;
}) {
  const hideShipmentRank = suppressed;
  const hidePeerRank = hideShipmentRank || !hasSimilarPeers;
  return (
    <section className={styles.grid} aria-label="Rank callouts">
      <div className={styles.card}>
        <span className={styles.label}>Nationally</span>
        <span className={styles.rank}>
          {!hideShipmentRank && ranks.national_rank > 0 ? formatOrdinal(ranks.national_rank) : "—"}
        </span>
        <span className={styles.of}>
          {!hideShipmentRank && ranks.national_rank > 0
            ? `of ${ranks.national_total} counties by pills shipped`
            : hideShipmentRank
              ? "suppressed or unavailable"
              : "insufficient data"}
        </span>
      </div>
      <div className={styles.card}>
        <span className={styles.label}>Among peers</span>
        <span className={styles.rank}>
          {!hidePeerRank && ranks.peer_rank > 0 ? formatOrdinal(ranks.peer_rank) : "—"}
        </span>
        <span className={styles.of}>
          {!hidePeerRank && ranks.peer_rank > 0
            ? `of ${ranks.peer_size} counties with similar population`
            : hideShipmentRank
              ? "suppressed or unavailable"
              : "no comparable peers"}
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
