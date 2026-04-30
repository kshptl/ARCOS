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
  const raw = await fs.readFile(dataPath, "utf8");
  const data = JSON.parse(raw);
  const ok = validate(data);
  return {
    file: path.basename(dataPath),
    artifactName,
    ok: Boolean(ok),
    errors: ok ? [] : (validate.errors ?? []),
  };
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
    if (!entry.endsWith(".json")) continue;
    const stem = entry.replace(/\.json$/, "");
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
