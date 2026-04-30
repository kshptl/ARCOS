import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  children: ReactNode;
}

export function Button({ variant = "primary", children, style, ...rest }: ButtonProps) {
  const base = {
    fontFamily: "var(--font-display)",
    fontSize: "1rem",
    padding: "var(--space-sm) var(--space-md)",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--ink)",
    cursor: "pointer",
  };
  const colors =
    variant === "primary"
      ? { background: "var(--ink)", color: "var(--canvas)" }
      : { background: "transparent", color: "var(--ink)" };
  return (
    <button type="button" style={{ ...base, ...colors, ...style }} {...rest}>
      {children}
    </button>
  );
}
