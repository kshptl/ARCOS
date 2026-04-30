import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/local", () => ({
  default: () => ({ variable: "--mock-font", className: "mock" }),
}));

import About from "@/app/about/page";

describe("/about", () => {
  it("renders heading and contact link", () => {
    render(<About />);
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    // Use getAllByRole since MethodologyFooter also has a github link
    const githubLinks = screen.getAllByRole("link", { name: /github/i });
    expect(githubLinks.length).toBeGreaterThan(0);
  });

  it("applies dark-mode scope", () => {
    const { container } = render(<About />);
    expect(container.querySelector('[data-theme="dark"]')).toBeTruthy();
  });

  it("exports page metadata", async () => {
    const mod = await import("@/app/about/page");
    expect(mod.metadata?.title).toBe("About");
  });
});
