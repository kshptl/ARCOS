import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Plausible } from "@/lib/analytics/Plausible";

beforeEach(() => {
  process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN = "";
});

afterEach(() => {
  process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN = "";
});

describe("Plausible", () => {
  it("renders nothing when no domain is set", () => {
    const { container } = render(<Plausible />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a script when domain is set", () => {
    process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN = "openarcos.org";
    const { getByTestId } = render(<Plausible />);
    const s = getByTestId("plausible-script");
    expect(s.getAttribute("data-domain")).toBe("openarcos.org");
  });
});
