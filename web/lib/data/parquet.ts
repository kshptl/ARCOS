// Parquet wrapper. In Plan 2 this uses hyparquet; for the bootstrap stub
// we provide a minimal interface so Plan 3 modules can import it and unit
// tests can mock it. The real implementation is in Plan 2.

export interface FetchParquetOptions {
  onProgress?: (received: number, total: number | null) => void;
}

export async function fetchParquetRows<T>(
  url: string,
  _options: FetchParquetOptions = {},
): Promise<T[]> {
  // Bootstrap stub: try JSON fallback by replacing .parquet with .json
  if (typeof fetch === "undefined") return [];
  const jsonUrl = url.replace(/\.parquet$/, ".json");
  try {
    const res = await fetch(jsonUrl);
    if (!res.ok) return [];
    return (await res.json()) as T[];
  } catch {
    return [];
  }
}

export async function readParquetRows<T>(_path: string): Promise<T[]> {
  // Build-time Node reader stub. Plan 2 replaces with hyparquet.
  return [];
}
