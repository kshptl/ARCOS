import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Tooltip } from "@/components/ui/Tooltip";
import { Eyebrow } from "@/components/ui/Typography";

describe("<Button>", () => {
  it("renders with primary variant by default and fires onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>See your county</Button>);
    const btn = screen.getByRole("button", { name: /see your county/i });
    expect(btn.className).toMatch(/primary/);
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("supports ghost variant + disabled", () => {
    render(
      <Button variant="ghost" disabled>
        Later
      </Button>,
    );
    const btn = screen.getByRole("button", { name: /later/i });
    expect(btn.className).toMatch(/ghost/);
    expect(btn).toBeDisabled();
  });
});

describe("<Pill>", () => {
  it("renders children with a semantic tone class", () => {
    render(<Pill tone="hot">breaking</Pill>);
    expect(screen.getByText("breaking").className).toMatch(/hot/);
  });
});

describe("<Tooltip>", () => {
  it("reveals content on hover", async () => {
    render(
      <Tooltip content="source: DEA ARCOS">
        <span>?</span>
      </Tooltip>,
    );
    const trigger = screen.getByText("?");
    await userEvent.hover(trigger);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("source: DEA ARCOS");
  });
});

describe("<Eyebrow>", () => {
  it("renders an uppercase eyebrow label", () => {
    render(<Eyebrow>act 1</Eyebrow>);
    expect(screen.getByText("act 1").className).toMatch(/eyebrow/);
  });
});
