import type { ReactNode } from 'react';
import styles from './Step.module.css';

export interface StepProps {
  id?: string;
  children: ReactNode;
}

export function Step({ id, children }: StepProps) {
  return (
    <article className={styles.step} data-step={id}>
      {children}
    </article>
  );
}
