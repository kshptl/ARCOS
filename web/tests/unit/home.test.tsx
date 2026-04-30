import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/local", () => ({
  default: () => ({ variable: "--mock-font", className: "mock" }),
}));

import Home from "@/app/page";

describe("/", () => {
  it("renders a headline", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
  });

  it("links to /explorer", () => {
    render(<Home />);
    const link = screen.getByRole("link", { name: /explorer/i });
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("/explorer");
  });

  it("shows the '76 billion pills' eyebrow stat", () => {
    render(<Home />);
    expect(screen.getByText(/76 billion/i)).toBeTruthy();
  });
});
