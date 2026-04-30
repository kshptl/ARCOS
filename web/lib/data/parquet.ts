/**
 * Minimal parquet reader wrapping hyparquet.
 *
 * Works in both Node (build time) and browser (client-side explorer in
 * Plan 3). We accept Buffer/Uint8Array/ArrayBuffer and normalise to
 * ArrayBuffer since hyparquet's API expects one.
 */
import { parquetRead } from "hyparquet";

export type ParquetSource = ArrayBuffer | Uint8Array | Buffer;

export interface ReadOptions {
  /** Only read these columns (projection pushdown) */
  columns?: string[];
  /** Row range: [start, end) */
  rowStart?: number;
  rowEnd?: number;
}

function toArrayBuffer(src: ParquetSource): ArrayBuffer {
  if (src instanceof ArrayBuffer) return src;
  const u8 = src as Uint8Array;
  // Copy to a fresh ArrayBuffer to guarantee hyparquet's instanceof ArrayBuffer check passes
  // (node Buffer's underlying storage is sometimes a SharedArrayBuffer, and u8.buffer.slice
  // may return ArrayBufferLike in TS but an identical runtime type here is fine).
  const ab = new ArrayBuffer(u8.byteLength);
  new Uint8Array(ab).set(u8);
  return ab;
}

/**
 * Read all (or some) rows from a parquet payload as an array of typed records.
 * Streams internally; materialises the projected rows to memory.
 */
export async function readParquetRows<T>(
  source: ParquetSource,
  options: ReadOptions = {},
): Promise<T[]> {
  const file = toArrayBuffer(source);
  const rows: T[] = [];
  await new Promise<void>((resolve, reject) => {
    parquetRead({
      file,
      columns: options.columns,
      rowStart: options.rowStart,
      rowEnd: options.rowEnd,
      rowFormat: "object",
      onComplete: (data) => {
        for (const row of data as T[]) rows.push(row);
        resolve();
      },
    }).catch(reject);
  });
  return rows;
}

/**
 * Fetch-and-read helper for client-side use in Plan 3. Emits a progress
 * callback so the explorer UI can render a loading bar for the ~5–10 MB
 * county-shipments parquet.
 */
export async function fetchParquetRows<T>(
  url: string,
  opts: ReadOptions & { onProgress?: (bytes: number, total: number) => void } = {},
): Promise<T[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchParquetRows ${url} → HTTP ${res.status}`);
  const total = Number(res.headers.get("content-length") ?? 0);
  if (!res.body || !opts.onProgress || total === 0) {
    const buf = await res.arrayBuffer();
    return readParquetRows<T>(buf, opts);
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.byteLength;
      opts.onProgress(received, total);
    }
  }
  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return readParquetRows<T>(merged, opts);
}
