import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { MethodologyFooter } from "@/components/layout/MethodologyFooter";

describe("<Header>", () => {
  it("renders brand + nav", () => {
    render(<Header />);
    expect(screen.getByText(/openarcos/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /explorer/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /rankings/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /methodology/i })).toBeInTheDocument();
  });

  it("renders the search slot when provided", () => {
    render(<Header search={<input placeholder="search counties" />} />);
    expect(screen.getByPlaceholderText(/search counties/i)).toBeInTheDocument();
  });

  it("renders a SearchBox combobox in the header", () => {
    render(<Header />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});

describe("<Footer>", () => {
  it("credits all three source datasets", () => {
    render(<Footer buildDate="2026-04-29" />);
    expect(screen.getByText(/Washington Post ARCOS/i)).toBeInTheDocument();
    expect(screen.getByText(/DEA Diversion Control/i)).toBeInTheDocument();
    expect(screen.getByText(/CDC WONDER/i)).toBeInTheDocument();
    expect(screen.getByText(/2026-04-29/)).toBeInTheDocument();
  });
});

describe("<MethodologyFooter>", () => {
  it("links to methodology + github", () => {
    render(<MethodologyFooter />);
    expect(screen.getByRole("link", { name: /methodology/i })).toHaveAttribute(
      "href",
      "/methodology",
    );
    expect(screen.getByRole("link", { name: /github/i })).toBeInTheDocument();
  });
});
