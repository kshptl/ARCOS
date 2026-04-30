import { BigNumeral } from "@/components/brand/BigNumeral";
import { computeCountyHeroStats } from "@/lib/data/countyHeroStats";
import type { CountyBundle } from "@/lib/data/loadCountyBundle";
import type { CountyMetadata } from "@/lib/data/schemas";
import { formatCompact, formatFull } from "@/lib/format/number";
import styles from "./Hero.module.css";

export function Hero({ meta, bundle }: { meta: CountyMetadata; bundle: CountyBundle }) {
  const stats = computeCountyHeroStats(meta, bundle.shipments);
  return (
    <div className={styles.root}>
      <h1 className={styles.name}>{meta.name}</h1>
      <p className={styles.state}>
        {meta.state} · pop {formatCompact(meta.pop)}
      </p>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Pills shipped 2006–2014</span>
          <BigNumeral
            value={stats.totalPills}
            unit="pills"
            compact
            ariaLabel={`${formatFull(stats.totalPills)} pills shipped to ${meta.name} from 2006 to 2014`}
          />
        </div>
        {stats.peakPerCapita !== null && stats.peakYear !== null && (
          <div className={styles.stat}>
            <span className={styles.statLabel}>Peak per-capita</span>
            <BigNumeral
              value={stats.peakPerCapita}
              unit={`per person in ${stats.peakYear}`}
              tone="hot"
            />
          </div>
        )}
      </div>
    </div>
  );
}
