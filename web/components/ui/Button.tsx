import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
  children: ReactNode;
};

export function Button({ variant = "primary", className, children, ...rest }: Props) {
  const variantClass = styles[variant] ?? styles.primary;
  return (
    <button className={`${styles.root} ${variantClass} ${className ?? ""}`} {...rest}>
      {children}
    </button>
  );
}
