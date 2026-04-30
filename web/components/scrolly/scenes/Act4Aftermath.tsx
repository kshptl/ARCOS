'use client';

import { Sparkline } from '@/components/charts/Sparkline';
import { formatFull } from '@/lib/format/number';
import { useScrollyProgress } from '../progressContext';
import styles from './scenes.module.css';

export interface Act4County {
  fips: string;
  name: string;
  state: string;
  deaths: number[];
}

export interface Act4AftermathProps {
  counties: Act4County[];
}

export function Act4Aftermath({ counties }: Act4AftermathProps) {
  const progress = useScrollyProgress();
  const opacity = Math.min(1, progress * 2);

  return (
    <div className={styles.act}>
      <div className={styles.gridMultiples} style={{ opacity }}>
        {counties.map((c) => (
          <figure key={c.fips} data-testid="small-multiple" className={styles.multiple}>
            <figcaption>
              <a href={`/county/${c.fips}`}>
                {c.name}, {c.state}
              </a>
            </figcaption>
            <Sparkline values={c.deaths} ariaLabel={`${c.name} overdose deaths trend`} />
            <span className={styles.multValue}>{formatFull(c.deaths[c.deaths.length - 1] ?? 0)}</span>
          </figure>
        ))}
      </div>
      <p className={styles.ctaLede}>
        Every county has its own story. Find yours.
      </p>
      <a href="/explorer" className={styles.cta}>
        See your county →
      </a>
    </div>
  );
}
