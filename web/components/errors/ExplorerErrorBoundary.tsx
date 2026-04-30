"use client";

import { Component, type ReactNode } from "react";
import { GITHUB_ISSUE_NEW_URL } from "@/lib/config";
import styles from "./ErrorBoundary.module.css";

type Props = { children: ReactNode };
type State = { err: Error | null };

export class ExplorerErrorBoundary extends Component<Props, State> {
  override state: State = { err: null };

  static getDerivedStateFromError(err: Error): State {
    return { err };
  }

  override componentDidCatch(err: Error): void {
    console.error("[explorer error]", err);
  }

  override render(): ReactNode {
    if (this.state.err) {
      const issueUrl = `${GITHUB_ISSUE_NEW_URL}?labels=bug&title=${encodeURIComponent(
        `Explorer error: ${this.state.err.message}`,
      )}`;
      return (
        <div role="alert" className={styles.root}>
          <p className={styles.heading}>The explorer ran into a problem.</p>
          <p className={styles.body}>{this.state.err.message}</p>
          <a href={issueUrl} className={styles.report} target="_blank" rel="noreferrer">
            Report this on GitHub
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}
