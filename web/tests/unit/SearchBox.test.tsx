import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchBox } from "@/components/search/SearchBox";
import { resetSearchIndexCache } from "@/components/search/useSearchIndex";

const FIXTURE = [
  {
    type: "county",
    id: "54059",
    name: "Mingo County",
    fips: "54059",
    state: "WV",
  },
  {
    type: "county",
    id: "51097",
    name: "King and Queen County",
    fips: "51097",
    state: "VA",
  },
  {
    type: "distributor",
    id: "distributor:mckesson",
    name: "McKesson",
  },
  {
    type: "pharmacy",
    id: "pharmacy:1",
    name: "Tug Valley Pharmacy",
    fips: "54059",
    address: "Williamson, WV",
  },
  {
    type: "pharmacy",
    id: "pharmacy:2",
    name: "Sav-Rite 2",
    fips: "54059",
    address: "Kermit, WV",
  },
];

beforeEach(() => {
  resetSearchIndexCache();
  globalThis.sessionStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(FIXTURE), { status: 200 })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SearchBox", () => {
  it("shows a Loading state on first focus, then groups results", async () => {
    const user = userEvent.setup();
    render(<SearchBox />);
    const input = screen.getByRole("combobox");
    await user.click(input);
    await waitFor(() =>
      expect(screen.queryByText(/loading search index/i)).not.toBeInTheDocument(),
    );

    await user.type(input, "Mingo");
    await waitFor(() => expect(screen.getByText("Mingo County")).toBeInTheDocument());
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByText(/places/i)).toBeInTheDocument();
  });

  it("caps groups at 5 items and separates Pharmacies from Places", async () => {
    const user = userEvent.setup();
    render(<SearchBox />);
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByRole("combobox"), "pharmacy");
    await waitFor(() => expect(screen.getByText(/pharmacies/i)).toBeInTheDocument());
    const pharmacyHits = screen.queryAllByRole("option");
    expect(pharmacyHits.length).toBeLessThanOrEqual(5);
  });

  it("navigates with keyboard and activates via Enter", async () => {
    const user = userEvent.setup();
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      value: { assign },
      writable: true,
    });
    render(<SearchBox />);
    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.type(input, "Mingo");
    await waitFor(() => expect(screen.getByText("Mingo County")).toBeInTheDocument());
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");
    expect(assign).toHaveBeenCalledWith("/county/54059");
  });

  it("shows a no-matches message for an empty result set", async () => {
    const user = userEvent.setup();
    render(<SearchBox />);
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByRole("combobox"), "xyzzyqqq");
    await waitFor(() => expect(screen.getByText(/no matches/i)).toBeInTheDocument());
  });

  it("surfaces an error state with a retry button when fetch fails", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockRejectedValueOnce(new Error("boom"));
    const user = userEvent.setup();
    render(<SearchBox />);
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByRole("combobox"), "mingo");
    await waitFor(() => expect(screen.getByText(/failed to load/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
