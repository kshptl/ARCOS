import { describe, expect, it } from "vitest";
import { FIPS_STATE_MAP, isValidFips, normalizeFips, stateFromFips } from "@/lib/geo/fips";
import cases from "../fixtures/fips_cases.json";

type NormalizeCase = { in: string | number; out: string };
type StateCase = { fips: string; state: string };

describe("fips normalize (shared fixture with pipeline)", () => {
  for (const { in: input, out } of cases.normalize_ok as NormalizeCase[]) {
    it(`normalizes ${JSON.stringify(input)} -> ${out}`, () => {
      expect(normalizeFips(input)).toBe(out);
    });
  }

  for (const badInput of cases.normalize_fail as unknown[]) {
    it(`rejects invalid ${JSON.stringify(badInput)}`, () => {
      expect(() => normalizeFips(badInput as never)).toThrow();
    });
  }
});

describe("fips state map (incl. territories, matching pipeline)", () => {
  it("has 56 entries (50 states + DC + 5 territories)", () => {
    expect(Object.keys(FIPS_STATE_MAP)).toHaveLength(56);
    expect(FIPS_STATE_MAP["54"]).toBe("WV");
    expect(FIPS_STATE_MAP["06"]).toBe("CA");
    expect(FIPS_STATE_MAP["11"]).toBe("DC");
    expect(FIPS_STATE_MAP["72"]).toBe("PR");
  });

  for (const { fips, state } of cases.state_from_fips as StateCase[]) {
    it(`stateFromFips(${fips}) -> ${state}`, () => {
      expect(stateFromFips(fips)).toBe(state);
    });
  }

  it("stateFromFips throws for unknown prefix", () => {
    expect(() => stateFromFips("99999")).toThrow();
  });
});

describe("isValidFips", () => {
  for (const good of cases.valid_fips as string[]) {
    it(`accepts ${good}`, () => {
      expect(isValidFips(good)).toBe(true);
    });
  }

  for (const bad of cases.invalid_fips as unknown[]) {
    it(`rejects ${JSON.stringify(bad)}`, () => {
      expect(isValidFips(bad as never)).toBe(false);
    });
  }
});
