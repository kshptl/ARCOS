import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ErrorObject, ValidateFunction } from "ajv";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

export interface ValidateArtifactArgs {
  schemaDir: string;
  dataPath: string;
  artifactName: string;
}

export interface ValidateResult {
  file: string;
  artifactName: string;
  ok: boolean;
  errors: ErrorObject[];
}

const ajvCache = new Map<string, Ajv>();

function getAjv(schemaDir: string): Ajv {
  const cached = ajvCache.get(schemaDir);
  if (cached) return cached;
  const ajv = new Ajv({ strict: true, allErrors: true });
  // ajv-formats has different default/cjs/esm exports depending on how it's imported
  const formatsFn =
    (addFormats as unknown as { default?: typeof addFormats }).default ??
    (addFormats as unknown as typeof addFormats);
  (formatsFn as (a: Ajv) => Ajv)(ajv);
  ajvCache.set(schemaDir, ajv);
  return ajv;
}

async function loadSchema(schemaDir: string, artifactName: string): Promise<ValidateFunction> {
  const schemaPath = path.join(schemaDir, `${artifactName}.schema.json`);
  const raw = await fs.readFile(schemaPath, "utf8");
  const schema = JSON.parse(raw);
  const ajv = getAjv(schemaDir);
  const existing = ajv.getSchema(schema.$id ?? artifactName);
  if (existing) return existing as ValidateFunction;
  return ajv.compile(schema);
}

export async function validateArtifact(args: ValidateArtifactArgs): Promise<ValidateResult> {
  const { schemaDir, dataPath, artifactName } = args;
  const validate = await loadSchema(schemaDir, artifactName);
  const data = await loadArtifact(dataPath);
  const ok = validate(data);
  return {
    file: path.basename(dataPath),
    artifactName,
    ok: Boolean(ok),
    errors: ok ? [] : (validate.errors ?? []),
  };
}

/**
 * Read an artifact from disk into a JSON-Schema-validatable shape.
 *
 * JSON files are parsed directly. Parquet files are materialised to an
 * array of plain objects via `hyparquet` so that the same
 * array-of-objects schemas used for the JSON artifacts apply unchanged.
 * BigInt columns are coerced to `number` because `ajv`'s `integer`
 * validator rejects BigInt values.
 *
 * hyparquet is imported dynamically to avoid eager resolution under
 * tsx: its package.json `exports` map only declares ESM, and a static
 * top-level import of this script chains into the runtime's CJS
 * resolver (even via the `../lib/data/parquet.js` helper) which then
 * fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`. Dynamic import sidesteps
 * that codepath — see also `build-county-ranks.mts` which uses the same
 * pattern.
 */
async function loadArtifact(dataPath: string): Promise<unknown> {
  const ext = path.extname(dataPath).toLowerCase();
  if (ext === ".json") {
    const raw = await fs.readFile(dataPath, "utf8");
    return JSON.parse(raw);
  }
  if (ext === ".parquet") {
    const buf = await fs.readFile(dataPath);
    const { parquetRead } = await import("hyparquet");
    // Copy to a fresh ArrayBuffer to guarantee hyparquet's instanceof check passes.
    const ab = new ArrayBuffer(buf.byteLength);
    new Uint8Array(ab).set(buf);
    const rows: Record<string, unknown>[] = [];
    await new Promise<void>((resolve, reject) => {
      parquetRead({
        file: ab,
        rowFormat: "object",
        onComplete: (data) => {
          for (const row of data as Record<string, unknown>[]) rows.push(row);
          resolve();
        },
      }).catch(reject);
    });
    return rows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        out[key] = typeof value === "bigint" ? Number(value) : value;
      }
      return out;
    });
  }
  throw new Error(`validate-data: unsupported extension ${ext} for ${dataPath}`);
}

export interface ValidateAllArgs {
  schemaDir: string;
  dataDir: string;
}

export async function validateAllArtifacts(args: ValidateAllArgs): Promise<ValidateResult[]> {
  const { schemaDir, dataDir } = args;
  const entries = await fs.readdir(dataDir);
  const results: ValidateResult[] = [];
  for (const entry of entries) {
    const ext = path.extname(entry).toLowerCase();
    if (ext !== ".json" && ext !== ".parquet") continue;
    const stem = entry.slice(0, entry.length - ext.length);
    const bestMatch = await findArtifactMatch(schemaDir, stem);
    if (!bestMatch) continue;
    const result = await validateArtifact({
      schemaDir,
      dataPath: path.join(dataDir, entry),
      artifactName: bestMatch,
    });
    results.push(result);
  }
  return results;
}

async function findArtifactMatch(schemaDir: string, stem: string): Promise<string | null> {
  const schemas = await fs.readdir(schemaDir);
  const names = schemas
    .filter((f) => f.endsWith(".schema.json"))
    .map((f) => f.replace(/\.schema\.json$/, ""));
  if (names.includes(stem)) return stem;
  const match = names.filter((n) => stem.startsWith(n)).sort((a, b) => b.length - a.length)[0];
  return match ?? null;
}

async function main(): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const schemaDir = path.resolve(here, "..", "..", "pipeline", "schemas");
  const dataDir = path.resolve(here, "..", "public", "data");
  const results = await validateAllArtifacts({ schemaDir, dataDir });
  let failed = 0;
  for (const r of results) {
    if (r.ok) {
      console.log(`ok  ${r.file}`);
    } else {
      failed += 1;
      console.error(`FAIL ${r.file} (${r.artifactName})`);
      for (const err of r.errors) {
        console.error(`  ${err.instancePath || "/"} ${err.message}`);
      }
    }
  }
  if (failed > 0) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(2);
  });
}
