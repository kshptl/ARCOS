import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("next/font/local", () => ({
  default: () => ({ variable: "--mock-font", className: "mock" }),
}));

import Methodology from "@/app/methodology/page";
import About from "@/app/about/page";

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
