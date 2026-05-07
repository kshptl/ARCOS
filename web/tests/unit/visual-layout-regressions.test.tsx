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
    expect(src).toMatch(/--detail-width:\s*clamp\(16rem,\s*20vw,\s*18\.5rem\)/);
    expect(src).toMatch(/\.root\s*{[\s\S]*?position:\s*relative/);
    expect(src).toMatch(/\.root\s*{[\s\S]*?display:\s*block/);
    expect(src).not.toMatch(
      /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(240px,\s*300px\)/,
    );
    expect(src).not.toMatch(/grid-template-columns:[^;]*minmax\(220px,\s*280px\)/);
  });

  it("floats the explorer controls and summary over the map instead of a left rail", () => {
    const src = css("components/explorer/Explorer.module.css");
    expect(src).not.toMatch(/\.rail\s*{/);
    expect(src).toMatch(/\.controlBar\s*{[\s\S]*?position:\s*absolute/);
    expect(src).toMatch(/\.controlBar\s*{[\s\S]*?top:\s*var\(--overlay-gap\)/);
    expect(src).toMatch(
      /\.controlBar\s*{[\s\S]*?right:\s*calc\(var\(--detail-width\)\s*\+\s*var\(--overlay-gap\)\s*\*\s*2\)/,
    );
    expect(src).toMatch(
      /\.controlBar\s*{[\s\S]*?grid-template-columns:\s*minmax\(15rem,\s*0\.75fr\)\s+minmax\(26rem,\s*1\.55fr\)\s+minmax\(18rem,\s*0\.8fr\)/,
    );
    expect(src).not.toMatch(/\.downloadButton\s*{/);
    expect(src).toMatch(/\.stats\s*{[\s\S]*?position:\s*absolute/);
    expect(src).toMatch(/\.stat\s*{[\s\S]*?padding:\s*0\.58rem\s+0\.72rem/);
    expect(src).toMatch(/\.mapShell\s*{[\s\S]*?min-height:\s*0/);
    expect(src).toMatch(/\.mapShell\s*{[\s\S]*?inset:\s*0/);
  });

  it("locks the desktop explorer into one viewport without the map footer", () => {
    const styles = css("components/explorer/Explorer.module.css");
    const globals = css("styles/globals.css");
    const component = css("components/explorer/Explorer.tsx");

    expect(styles).toMatch(/\.root\s*{[\s\S]*?height:\s*calc\(100dvh\s*-\s*61px\)/);
    expect(styles).toMatch(/\.root\s*{[\s\S]*?overflow:\s*hidden/);
    expect(styles).toMatch(/\.main\s*{[\s\S]*?position:\s*absolute/);
    expect(styles).toMatch(/\.main\s*{[\s\S]*?display:\s*block/);
    expect(styles).toMatch(/\.mapShell\s*{[\s\S]*?min-height:\s*0/);
    expect(styles).toMatch(/\.mapShell\s*{[\s\S]*?position:\s*absolute/);
    expect(styles).toMatch(/\.mapCanvas\s*{[\s\S]*?min-height:\s*0/);
    expect(styles).toMatch(/\.mapCanvas\s*{[\s\S]*?position:\s*absolute/);
    expect(styles).not.toMatch(/\.mapStatus\s*{/);
    expect(component).not.toMatch(/<footer className=\{styles\.mapStatus\}/);
    expect(component).not.toMatch(/Download data/);
    expect(globals).toMatch(/body:has\(>\s*main\s+section\[aria-label="Explorer"\]\)\s*>\s*footer/);
  });

  it("keeps the mobile explorer map to a sane viewport height", () => {
    const styles = css("components/explorer/Explorer.module.css");
    expect(styles).toMatch(
      /@media\s*\(max-width:\s*760px\)[\s\S]*?\.mapCanvas\s*{[\s\S]*?height:\s*min\(62vh,\s*26rem\)/,
    );
  });

  it("keeps explorer year ticks horizontal with a centered active pill", () => {
    const src = css("components/map/TimeSlider.module.css");
    expect(src).toMatch(/\.ticks\s*{[\s\S]*?min-height:\s*1\.55rem/);
    expect(src).toMatch(/\.tick\s*{[\s\S]*?text-align:\s*center/);
    expect(src).not.toMatch(/\.tick\s*{[\s\S]*?transform:\s*rotate\(-45deg\)/);
    expect(src).toMatch(/\.tickActive\s*{[\s\S]*?justify-self:\s*center/);
    expect(src).toMatch(/\.tickActive\s*{[\s\S]*?border-radius:\s*999px/);
  });

  it("keeps the explorer detail panel scrollable to its last action", () => {
    const src = css("components/explorer/Explorer.module.css");
    expect(src).toMatch(/\.detailPanel\s*{[\s\S]*?min-height:\s*0/);
    expect(src).toMatch(/\.detailPanel\s*{[\s\S]*?position:\s*absolute/);
    expect(src).toMatch(/\.detailPanel\s*{[\s\S]*?gap:\s*0\.7rem/);
    expect(src).toMatch(/\.detailPanel\s*{[\s\S]*?padding:\s*0\.85rem/);
    expect(src).toMatch(
      /\.detailPanel\s*{[\s\S]*?padding-bottom:\s*max\(0\.85rem,\s*env\(safe-area-inset-bottom\)\)/,
    );
  });

  it("reserves enough desktop header width for the full search placeholder", () => {
    const header = css("components/layout/Header.module.css");
    const search = css("components/search/SearchBox.module.css");
    expect(header).toMatch(/\.row\s*{[\s\S]*?min-height:\s*60px/);
    expect(header).toMatch(/\.search\s*{[\s\S]*?flex:\s*0\s+1\s+22rem/);
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
