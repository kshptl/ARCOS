"use client";

import { type ReactNode, useId, useState } from "react";
import styles from "./Tabs.module.css";

export interface TabDef {
  key: string;
  label: string;
  panel: ReactNode;
}

export function Tabs({ tabs, initial = 0 }: { tabs: TabDef[]; initial?: number }) {
  const [active, setActive] = useState(initial);
  const rootId = useId();
  return (
    <div>
      <div className={styles.root} role="tablist" aria-label="Rankings">
        {tabs.map((t, i) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`${rootId}-tab-${t.key}`}
            aria-selected={i === active}
            aria-controls={`${rootId}-panel-${t.key}`}
            tabIndex={i === active ? 0 : -1}
            className={styles.tab}
            onClick={() => setActive(i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t, i) =>
        i === active ? (
          <div
            key={t.key}
            role="tabpanel"
            id={`${rootId}-panel-${t.key}`}
            aria-labelledby={`${rootId}-tab-${t.key}`}
            className={styles.panel}
          >
            {t.panel}
          </div>
        ) : null,
      )}
    </div>
  );
}
