import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Filters } from "@/components/explorer/Filters";

describe("Filters", () => {
  it("renders year select with 2006..2014 and metric select", () => {
    render(
      <Filters
        year={2012}
        metric="pills"
        years={[2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByLabelText(/Year/)).toHaveValue("2012");
    expect(screen.getByLabelText(/Metric/)).toHaveValue("pills");
  });

  it("fires onChange with the new year", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Filters year={2012} metric="pills" years={[2011, 2012, 2013]} onChange={onChange} />);
    await user.selectOptions(screen.getByLabelText(/Year/), "2013");
    expect(onChange).toHaveBeenCalledWith({ year: 2013 });
  });

  it("fires onChange with the new metric", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Filters year={2012} metric="pills" years={[2012]} onChange={onChange} />);
    await user.selectOptions(screen.getByLabelText(/Metric/), "deaths");
    expect(onChange).toHaveBeenCalledWith({ metric: "deaths" });
  });
});
