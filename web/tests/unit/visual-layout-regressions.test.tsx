import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TopPharmacies } from "@/components/county/TopPharmacies";
import { ScrollyProgressContext } from "@/components/scrolly/progressContext";
import { Act3Enforcement } from "@/components/scrolly/scenes/Act3Enforcement";

const ACTIONS_FULL = [
  { year: 2006, action_count: 32, notable_actions: [] },
  { year: 2007, action_count: 40, notable_actions: [] },
  { year: 2008, action_count: 22, notable_actions: [] },
  { year: 2009, action_count: 22, notable_actions: [] },
  { year: 2010, action_count: 25, notable_actions: [] },
  { year: 2011, action_count: 69, notable_actions: [] },
  { year: 2012, action_count: 42, notable_actions: [] },
  { year: 2013, action_count: 31, notable_actions: [] },
  { year: 2014, action_count: 20, notable_actions: [] },
];

function css(path: string): string {
  return readFileSync(path, "utf8");
}

describe("visual layout regressions", () => {
  it("keeps the mobile scrolly canvas sticky while the steps advance", () => {
    const src = css("components/scrolly/ScrollyStage.module.css");
    expect(src).toMatch(
      /@media\s*\(max-width:\s*720px\)[\s\S]*?\.sticky\s*{[\s\S]*?position:\s*sticky/,
    );
  });

  it("uses block padding on county pages so global container gutters survive", () => {
    const src = css("app/county/[fips]/page.module.css");
    expect(src).toMatch(/\.root\s*{[\s\S]*?padding-block:/);
    expect(src).not.toMatch(/\.root\s*{[\s\S]*?padding:\s*[^;]*\s0(?:\s|;)/);
  });

  it("wraps the pharmacies table in a constrained horizontal scroller", () => {
    const styles = css("components/county/TopPharmacies.module.css");
    expect(styles).toMatch(/\.tableScroller\s*{[\s\S]*?overflow-x:\s*auto/);

    render(
      <TopPharmacies
        rows={[
          {
            pharmacy_id: "a",
            name: "Mingo Pharmacy",
            address: "123 Long Road",
            fips: "54059",
            total_pills: 100,
            yearly: [10, 20, 30],
          },
        ]}
      />,
    );

    const table = screen.getByRole("table", { name: /top pharmacies/i });
    expect(table.parentElement?.className).toMatch(/tableScroller/);
    const scroller = screen.getByRole("region", { name: /scrollable top pharmacies table/i });
    expect(scroller).toContainElement(table);
    expect(scroller).toHaveAttribute("tabindex", "0");
  });

  it("uses a full-width explorer dashboard shell with the provided palette", () => {
    const src = css("components/explorer/Explorer.module.css");
    expect(src).toMatch(/--explorer-bg:\s*#faf7f1/);
    expect(src).toMatch(/--explorer-cream:\s*#f4edd9/);
    expect(src).toMatch(/--explorer-sage:\s*#acb3aa/);
    expect(src).toMatch(/--explorer-rust:\s*#b3462c/);
    expect(src).toMatch(
      /grid-template-columns:\s*minmax\(260px,\s*320px\)\s+minmax\(0,\s*1fr\)\s+minmax\(280px,\s*340px\)/,
    );
  });

  it("reserves enough desktop header width for the full search placeholder", () => {
    const header = css("components/layout/Header.module.css");
    const search = css("components/search/SearchBox.module.css");
    expect(header).toMatch(/\.search\s*{[\s\S]*?flex:\s*0\s+1\s+24rem/);
    expect(search).toMatch(/\.root\s*{[\s\S]*?max-width:\s*24rem/);
  });

  it("uses opaque scrolly step panels so chart text cannot show through", () => {
    const src = css("components/scrolly/Step.module.css");
    expect(src).toMatch(/\.step\s*{[\s\S]*?background:\s*var\(--canvas\)/);
    expect(src).not.toMatch(/\.step\s*{[\s\S]*?background:\s*color-mix\([^;]*transparent/);
  });

  it("lets selected scrolly stages pin text cards into a measured stack", () => {
    const src = css("components/scrolly/ScrollyStage.module.css");
    expect(src).toMatch(
      /\.stage\[data-step-layout="stacked"\]\s+\.steps\s*>\s*article\s*{[\s\S]*?top:\s*var\(--stacked-step-top,\s*10vh\)/,
    );
    expect(src).not.toMatch(
      /\.stage\[data-step-layout="stacked"\]\s+\.steps\s*>\s*article\s*{[\s\S]*?position:\s*static/,
    );
  });

  it("highlights the active parked scrolly text card", () => {
    const src = css("components/scrolly/ScrollyStage.module.css");
    expect(src).toMatch(/\[data-active-step="0"\][\s\S]*?article:nth-child\(1\)/);
    expect(src).toMatch(/\[data-active-step="1"\][\s\S]*?article:nth-child\(2\)/);
    expect(src).toMatch(/border-color:\s*var\(--accent-hot\)/);
  });

  it("uses the stacked text-card layout for Act 3 on the homepage", () => {
    const src = css("app/page.tsx");
    const act3Stage = src.match(
      /<ScrollyStage[\s\S]*?canvas=\{<Act3Enforcement[\s\S]*?<\/ScrollyStage>/,
    );
    expect(act3Stage, "Act 3 ScrollyStage not found").toBeTruthy();
    expect(act3Stage?.[0]).toMatch(/stepLayout="stacked"/);
  });

  it("lets chart-only scrolly scenes fill the sticky card", () => {
    const src = css("components/scrolly/scenes/scenes.module.css");
    expect(src).toMatch(/\.chartPanel\s*{[\s\S]*?width:\s*100%/);
    expect(src).toMatch(/\.chartPanel\s*{[\s\S]*?height:\s*100%/);
    expect(src).toMatch(/\.chartPanel\s+\.chart\s*{[\s\S]*?height:\s*100%/);
  });

  it("uses a responsive homepage title class instead of an unbounded 96px inline title", () => {
    const page = css("app/page.tsx");
    const styles = css("app/page.module.css");
    expect(page).toMatch(/className=\{styles\.h1\}/);
    expect(page).not.toMatch(/fontSize:\s*"var\(--type-display-xl\)"/);
    expect(styles).toMatch(/\.h1\s*{[\s\S]*?font-size:\s*clamp\(/);
  });

  it("places the Act 3 industry-pushback annotation outside the 2013 bar body", () => {
    const { container } = render(
      <ScrollyProgressContext.Provider value={0.5}>
        <Act3Enforcement actions={ACTIONS_FULL} />
      </ScrollyProgressContext.Provider>,
    );

    const yearLabel = Array.from(container.querySelectorAll("svg text")).find(
      (node) => node.textContent === "2013",
    );
    expect(yearLabel).toBeTruthy();
    const yearGroup = yearLabel?.parentElement;
    const bar = yearGroup?.querySelector('rect[data-testid="timeline-tick"]');
    expect(bar).toBeTruthy();

    const annotation = container.querySelector('[data-testid="act3-annotation-2013"] text');
    expect(annotation).toBeTruthy();

    const barTop = Number(bar?.getAttribute("y"));
    const annotationBaseline = Number(annotation?.getAttribute("y"));
    expect(annotationBaseline).toBeLessThan(barTop - 4);
  });
});
