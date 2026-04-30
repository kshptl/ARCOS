const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function formatISODate(iso: string): string {
  // iso: "YYYY-MM-DD" — construct in UTC to avoid TZ drift
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return DATE_FMT.format(new Date(Date.UTC(y, m - 1, d)));
}

/** 2006, 2014 -> "2006\u20132014" (en-dash) */
export function formatYearRange(start: number, end: number): string {
  if (start === end) return String(start);
  return `${start}\u2013${end}`;
}
