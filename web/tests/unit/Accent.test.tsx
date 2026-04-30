import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Accent } from "@/components/brand/Accent";

describe("<Accent>", () => {
  it("renders inline span with the hot variant by default", () => {
    render(<Accent>76 billion</Accent>);
    const el = screen.getByText("76 billion");
    expect(el.tagName).toBe("SPAN");
    expect(el.className).toMatch(/hot/);
  });

  it("applies cool variant when tone='cool'", () => {
    render(<Accent tone="cool">14,000 deaths</Accent>);
    expect(screen.getByText("14,000 deaths").className).toMatch(/cool/);
  });
});
