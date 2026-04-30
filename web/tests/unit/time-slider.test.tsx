import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TimeSlider } from "@/components/map/TimeSlider";

describe("TimeSlider", () => {
  it("renders with role=slider and aria-valuenow", () => {
    render(<TimeSlider years={[2006, 2007, 2008]} value={2007} onChange={() => {}} />);
    const slider = screen.getByRole("slider");
    expect(slider).toHaveAttribute("aria-valuemin", "2006");
    expect(slider).toHaveAttribute("aria-valuemax", "2008");
    expect(slider).toHaveAttribute("aria-valuenow", "2007");
    expect(slider.getAttribute("aria-valuetext")).toMatch(/2007/);
  });

  it("ArrowRight advances the year", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimeSlider years={[2006, 2007, 2008]} value={2007} onChange={onChange} />);
    const slider = screen.getByRole("slider");
    slider.focus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith(2008);
  });

  it("ArrowLeft decrements the year", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimeSlider years={[2006, 2007, 2008]} value={2007} onChange={onChange} />);
    const slider = screen.getByRole("slider");
    slider.focus();
    await user.keyboard("{ArrowLeft}");
    expect(onChange).toHaveBeenCalledWith(2006);
  });

  it("Home jumps to first year, End jumps to last", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimeSlider years={[2006, 2007, 2008]} value={2007} onChange={onChange} />);
    const slider = screen.getByRole("slider");
    slider.focus();
    await user.keyboard("{End}");
    expect(onChange).toHaveBeenCalledWith(2008);
    await user.keyboard("{Home}");
    expect(onChange).toHaveBeenCalledWith(2006);
  });

  it("clamps to boundaries", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimeSlider years={[2006, 2007, 2008]} value={2008} onChange={onChange} />);
    const slider = screen.getByRole("slider");
    slider.focus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders year labels for axis", () => {
    render(<TimeSlider years={[2006, 2007, 2008]} value={2007} onChange={() => {}} />);
    expect(screen.getByText("2006")).toBeInTheDocument();
    expect(screen.getByText("2008")).toBeInTheDocument();
  });
});
