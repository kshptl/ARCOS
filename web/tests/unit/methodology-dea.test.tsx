import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Methodology from "@/app/methodology/page";

describe("Methodology page — DEA source note", () => {
  it("documents Federal Register as the DEA enforcement-count source", () => {
    const { container } = render(<Methodology />);
    const text = container.textContent ?? "";
    // Source attribution
    expect(text).toMatch(/Federal Register/);
    expect(text).toMatch(/federalregister\.gov/);
    // What is counted
    expect(text).toMatch(/Final Orders/i);
    expect(text).toMatch(/Revocations/i);
    expect(text).toMatch(/Immediate Suspension/i);
    expect(text).toMatch(/Orders to Show Cause/i);
    expect(text).toMatch(/Settlements/i);
    expect(text).toMatch(/Admonitions/i);
    // Key caveats
    expect(text).toMatch(/Decision and Order/i);
    expect(text).toMatch(/publication/i);
    expect(text).toMatch(/Criminal prosecutions/i);
    expect(text).toMatch(/DOJ/);
  });
});
