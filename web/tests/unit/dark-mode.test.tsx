import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/local", () => ({
  default: () => ({ variable: "--mock-font", className: "mock" }),
}));

import About from "@/app/about/page";
import Methodology from "@/app/methodology/page";

describe("dark-mode scope", () => {
  it("methodology root has data-theme=dark", () => {
    const { container } = render(<Methodology />);
    expect(container.querySelector('[data-theme="dark"]')).toBeTruthy();
  });

  it("about root has data-theme=dark", () => {
    const { container } = render(<About />);
    expect(container.querySelector('[data-theme="dark"]')).toBeTruthy();
  });
});
