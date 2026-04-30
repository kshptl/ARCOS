"use client";

import { Component, type ReactNode } from "react";
import styles from "./ErrorBoundary.module.css";

type Props = { children: ReactNode; label?: string };
type State = { err: Error | null };

export class ScrollyErrorBoundary extends Component<Props, State> {
  override state: State = { err: null };

  static getDerivedStateFromError(err: Error): State {
    return { err };
  }

  override componentDidCatch(err: Error): void {
    console.error("[scrolly error]", err);
  }

  override render(): ReactNode {
    if (this.state.err) {
      const issueUrl = `https://github.com/openarcos/openarcos.org/issues/new?labels=bug&title=${encodeURIComponent(
        `Scrolly error (${this.props.label ?? "unknown"}): ${this.state.err.message}`,
      )}`;
      return (
        <div role="alert" className={styles.inline}>
          <p>This chart could not load.</p>
          <a href={issueUrl} className={styles.report} target="_blank" rel="noreferrer">
            Report on GitHub
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}
