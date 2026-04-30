import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScrollyStage } from "@/components/scrolly/ScrollyStage";
import { Step } from "@/components/scrolly/Step";

describe("ScrollyStage", () => {
  it("renders with a sticky canvas slot and children", () => {
    render(
      <ScrollyStage canvas={<div data-testid="canvas">map</div>} ariaLabel="test">
        <div data-testid="child">step</div>
      </ScrollyStage>,
    );
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders with aria-label summary", () => {
    render(
      <ScrollyStage
        canvas={<div />}
        ariaLabel="Act 1 summary of 76 billion pills shipped 2006-2014"
      >
        <div>step</div>
      </ScrollyStage>,
    );
    expect(screen.getByRole("region").getAttribute("aria-label")).toContain("76 billion");
  });

  it("renders <details> fallback when dataSummary provided", () => {
    render(
      <ScrollyStage
        canvas={<div />}
        ariaLabel="act"
        dataSummary={
          <table data-testid="fallback">
            <tbody>
              <tr>
                <td>x</td>
              </tr>
            </tbody>
          </table>
        }
      >
        <div>step</div>
      </ScrollyStage>,
    );
    expect(screen.getByTestId("fallback")).toBeInTheDocument();
    expect(screen.getByText(/show data/i)).toBeInTheDocument();
  });

  /*
   * Bug 1: the Step text article must render with a CSS-module classname
   * that we can style as position: sticky. We assert the class is applied
   * here; the full sticky behaviour (media queries, reduced-motion opt-out)
   * is exercised via e2e / visual tests. The article element is what gets
   * pinned, so it is the correct target.
   */
  it("pins the step article via a CSS-module sticky class", () => {
    const { container } = render(
      <ScrollyStage canvas={<div />} ariaLabel="act">
        <Step id="a1">
          <h3>heading</h3>
          <p>body</p>
        </Step>
      </ScrollyStage>,
    );
    const article = container.querySelector("article[data-step='a1']");
    expect(article).not.toBeNull();
    // CSS-module scoped classname contains the unscoped name
    expect(article?.className).toMatch(/step/);
  });

  /*
   * Bug 2: the "Show data" <summary> must live INSIDE the sticky canvas
   * wrapper (not below it as a grid row) so it is always visible during the
   * act's scroll range. We assert the summary and the canvas share a common
   * ancestor that is a direct child of the <section> (i.e. the sticky div).
   */
  it("renders the data toggle inside the sticky canvas container", () => {
    const { container } = render(
      <ScrollyStage
        canvas={<div data-testid="canvas-inner">canvas</div>}
        ariaLabel="act"
        dataSummary={<table data-testid="t" />}
      >
        <div>step</div>
      </ScrollyStage>,
    );
    const summary = screen.getByText(/show data/i);
    const canvas = screen.getByTestId("canvas-inner");
    const section = container.querySelector("section");
    expect(section).not.toBeNull();
    const children = section ? Array.from(section.children) : [];
    const stickyLike = children.find((c) => c.contains(summary) && c.contains(canvas));
    expect(stickyLike).toBeDefined();
  });

  it("omits the data toggle when no dataSummary is supplied", () => {
    render(
      <ScrollyStage canvas={<div />} ariaLabel="act">
        <div>step</div>
      </ScrollyStage>,
    );
    expect(screen.queryByText(/show data/i)).toBeNull();
  });
});
