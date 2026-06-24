import { render, screen } from "@testing-library/react";
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

  it("lists all four sources with external links", () => {
    const { container } = render(<Methodology />);
    const article = container.querySelector("article");
    expect(article).toBeTruthy();
    expect(article?.textContent).toMatch(/ARCOS county shipments/i);
    expect(article?.textContent).toMatch(/DEA ARCOS retail summary PDFs/i);
    expect(article?.textContent).toMatch(/DEA Diversion Control/i);
    expect(article?.textContent).toMatch(/CDC WONDER/i);
    expect(screen.getByRole("link", { name: /Mendeley Data/i })).toHaveAttribute(
      "href",
      "https://data.mendeley.com/datasets/dwfgxrh7tn/9",
    );
    expect(screen.getByRole("link", { name: /federal register api/i })).toHaveAttribute(
      "href",
      "https://www.federalregister.gov/api",
    );
    expect(screen.getByRole("link", { name: /deadiversion\.usdoj\.gov/i })).toHaveAttribute(
      "href",
      "https://www.deadiversion.usdoj.gov/arcos/retail_drug_summary/arcos-drug-summary-reports.html",
    );
    expect(screen.getByRole("link", { name: /wonder\.cdc\.gov/i })).toHaveAttribute(
      "href",
      "https://wonder.cdc.gov/ucd-icd10.html",
    );
  });

  it("documents CDC WONDER sourcing and suppression rules", () => {
    render(<Methodology />);

    expect(screen.getByText(/Underlying Cause of Death 1999-2020/i)).toBeInTheDocument();
    expect(screen.getByText(/interactive UI scrape/i)).toBeInTheDocument();
    expect(screen.getByText(/one state\/DC query at a time/i)).toBeInTheDocument();
    expect(screen.getAllByText(/2006–2014/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Drug\/Alcohol Induced Causes D1-D4/i)).toBeInTheDocument();
    expect(screen.getByText(/X40-X44, X60-X64, X85, Y10-Y14/i)).toBeInTheDocument();
    expect(screen.getByText(/42 USC 242m\(d\)/i)).toBeInTheDocument();
    expect(screen.getAllByText(/<10/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/never zero/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/10-20/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/statistically unreliable/i).length).toBeGreaterThan(0);
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
