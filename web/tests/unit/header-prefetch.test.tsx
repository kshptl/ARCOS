import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    prefetch,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    prefetch?: boolean;
    children: ReactNode;
  }) => (
    <a href={href} data-prefetch={String(prefetch)} {...props}>
      {children}
    </a>
  ),
}));

import { Header } from "@/components/layout/Header";

describe("<Header> prefetch behavior", () => {
  it("keeps visible navigation from preloading extra pages during initial load", () => {
    render(<Header search={<input aria-label="search" />} />);

    expect(screen.getByRole("link", { name: "openarcos" })).toHaveAttribute(
      "data-prefetch",
      "false",
    );
    expect(screen.getByRole("link", { name: "Explorer" })).toHaveAttribute(
      "data-prefetch",
      "false",
    );
    expect(screen.getByRole("link", { name: "Rankings" })).toHaveAttribute(
      "data-prefetch",
      "false",
    );
    expect(screen.getByRole("link", { name: "Methodology" })).toHaveAttribute(
      "data-prefetch",
      "false",
    );
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("data-prefetch", "false");
  });
});
