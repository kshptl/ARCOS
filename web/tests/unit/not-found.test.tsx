import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/font/local", () => ({
  default: () => ({ variable: "--mock-font", className: "mock" }),
}));

import NotFound from "@/app/not-found";
import { resetSearchIndexCache } from "@/components/search/useSearchIndex";

beforeEach(() => {
  resetSearchIndexCache();
  globalThis.sessionStorage?.clear?.();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("/ (not-found)", () => {
  it("renders a level-1 heading", () => {
    render(<NotFound />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toBeInTheDocument();
    expect(h1.textContent).toMatch(/county not found/i);
  });

  it("mounts a SearchBox in the body", () => {
    render(<NotFound />);
    // SearchBox exposes role=combobox
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("links back to the home page", () => {
    render(<NotFound />);
    const homeLinks = screen
      .getAllByRole("link")
      .filter((a) => a.getAttribute("href") === "/");
    expect(homeLinks.length).toBeGreaterThan(0);
  });

  it("links to the explorer", () => {
    render(<NotFound />);
    const explorerLinks = screen
      .getAllByRole("link")
      .filter((a) => a.getAttribute("href") === "/explorer");
    expect(explorerLinks.length).toBeGreaterThan(0);
  });
});
