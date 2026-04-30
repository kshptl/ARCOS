/**
 * FIPS normalization — TypeScript port of `pipeline/src/openarcos_pipeline/fips.py`.
 *
 * These two implementations MUST behave identically. They share a test
 * fixture: `web/tests/fixtures/fips_cases.json` is a copy of
 * `pipeline/tests/fixtures/fips_cases.json`.
 */

export const FIPS_STATE_MAP: Record<string, string> = {
  "01": "AL",
  "02": "AK",
  "04": "AZ",
  "05": "AR",
  "06": "CA",
  "08": "CO",
  "09": "CT",
  "10": "DE",
  "11": "DC",
  "12": "FL",
  "13": "GA",
  "15": "HI",
  "16": "ID",
  "17": "IL",
  "18": "IN",
  "19": "IA",
  "20": "KS",
  "21": "KY",
  "22": "LA",
  "23": "ME",
  "24": "MD",
  "25": "MA",
  "26": "MI",
  "27": "MN",
  "28": "MS",
  "29": "MO",
  "30": "MT",
  "31": "NE",
  "32": "NV",
  "33": "NH",
  "34": "NJ",
  "35": "NM",
  "36": "NY",
  "37": "NC",
  "38": "ND",
  "39": "OH",
  "40": "OK",
  "41": "OR",
  "42": "PA",
  "44": "RI",
  "45": "SC",
  "46": "SD",
  "47": "TN",
  "48": "TX",
  "49": "UT",
  "50": "VT",
  "51": "VA",
  "53": "WA",
  "54": "WV",
  "55": "WI",
  "56": "WY",
  "60": "AS",
  "66": "GU",
  "69": "MP",
  "72": "PR",
  "78": "VI",
};

export class InvalidFipsError extends Error {
  override name = "InvalidFipsError";
}

/**
 * Zero-pad to 5 digits. Accepts string or integer; rejects null, undefined,
 * boolean, non-digit strings, empty strings, negative numbers, and values
 * longer than 5 digits. Whitespace is trimmed.
 */
export function normalizeFips(value: unknown): string {
  if (value === null || value === undefined) {
    throw new InvalidFipsError(`invalid fips: ${String(value)}`);
  }
  if (typeof value === "boolean") {
    throw new InvalidFipsError("invalid fips: boolean not allowed");
  }
  let s: string;
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0) {
      throw new InvalidFipsError(`invalid fips numeric: ${value}`);
    }
    s = String(value);
  } else if (typeof value === "string") {
    s = value.trim();
  } else {
    throw new InvalidFipsError(`invalid fips type: ${typeof value}`);
  }
  if (s.length === 0) throw new InvalidFipsError("invalid fips: empty");
  if (!/^[0-9]+$/.test(s)) throw new InvalidFipsError(`invalid fips chars: ${s}`);
  if (s.length > 5) throw new InvalidFipsError(`invalid fips too long: ${s}`);
  return s.padStart(5, "0");
}

/**
 * True iff the value is already a proper 5-digit FIPS string with known state prefix.
 * Unlike normalizeFips, does NOT zero-pad shorter inputs.
 */
export function isValidFips(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const s = value.trim();
  if (s.length !== 5 || !/^[0-9]{5}$/.test(s)) return false;
  return Object.hasOwn(FIPS_STATE_MAP, s.slice(0, 2));
}

/** Return the 2-letter state abbreviation for a valid FIPS. */
export function stateFromFips(value: unknown): string {
  const n = normalizeFips(value);
  const prefix = n.slice(0, 2);
  const abbrev = FIPS_STATE_MAP[prefix];
  if (!abbrev) throw new InvalidFipsError(`unknown state prefix: ${prefix}`);
  return abbrev;
}
