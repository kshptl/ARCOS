import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/local", () => ({
  default: () => ({ variable: "--mock-font", className: "mock" }),
}));

import Methodology from "@/app/methodology/page";

describe("/methodology", () => {
  it("renders a Dataset JSON-LD script", () => {
    const { container } = render(<Methodology />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeTruthy();
    const data = JSON.parse(script?.textContent ?? "{}");
    expect(data["@type"]).toBe("Dataset");
    expect(data.name).toBeTruthy();
    expect(Array.isArray(data.distribution)).toBe(true);
  });

  it("lists all three sources with external links", () => {
    const { container, getAllByRole } = render(<Methodology />);
    const article = container.querySelector("article");
    expect(article).toBeTruthy();
    expect(article?.textContent).toMatch(/Washington Post ARCOS/i);
    expect(article?.textContent).toMatch(/DEA Diversion Control/i);
    expect(article?.textContent).toMatch(/CDC WONDER/i);
    const externals = getAllByRole("link", { name: /View at/i });
    expect(externals.length).toBeGreaterThanOrEqual(3);
  });

  it("applies dark-mode scope", () => {
    const { container } = render(<Methodology />);
    const root = container.querySelector('[data-theme="dark"]');
    expect(root).toBeTruthy();
  });

  it("exports page metadata with a title", async () => {
    const mod = await import("@/app/methodology/page");
    expect(mod.metadata?.title).toBe("Methodology");
  });
});
