// FIPS code helpers — bootstrap stub of pipeline/fips.py.

export function normalizeFips(raw: string | number): string {
  const s = String(raw).trim();
  if (s.length === 0) return "";
  // Strip any non-digit prefix; zero-pad to 5.
  const digits = s.replace(/\D/g, "");
  return digits.padStart(5, "0").slice(-5);
}

export function isValidFips(raw: string | number): boolean {
  const s = String(raw).trim();
  if (!/^\d{4,5}$/.test(s)) return false;
  const n = normalizeFips(s);
  return /^\d{5}$/.test(n);
}

export function stateFipsOf(fips: string): string {
  const n = normalizeFips(fips);
  return n.slice(0, 2);
}
