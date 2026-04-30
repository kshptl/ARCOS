import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateAllArtifacts, validateArtifact } from "@/scripts/validate-data";

const FIXTURE_DIR = path.join(__dirname, "..", "fixtures", "validate-data");
const SCHEMA_DIR = path.join(__dirname, "..", "..", "..", "pipeline", "schemas");

describe("validate-data", () => {
  it("accepts a valid county-metadata fixture", async () => {
    const result = await validateArtifact({
      schemaDir: SCHEMA_DIR,
      dataPath: path.join(FIXTURE_DIR, "county-metadata-good.json"),
      artifactName: "county-metadata",
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects a malformed county-metadata fixture", async () => {
    const result = await validateArtifact({
      schemaDir: SCHEMA_DIR,
      dataPath: path.join(FIXTURE_DIR, "county-metadata-bad.json"),
      artifactName: "county-metadata",
    });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("validateAllArtifacts walks a directory and returns per-file results", async () => {
    const results = await validateAllArtifacts({
      schemaDir: SCHEMA_DIR,
      dataDir: FIXTURE_DIR,
    });
    expect(results.length).toBeGreaterThan(0);
    const names = results.map((r) => r.file);
    expect(names).toContain("county-metadata-good.json");
  });

  it("accepts a valid county-shipments-by-year parquet fixture", async () => {
    const result = await validateArtifact({
      schemaDir: SCHEMA_DIR,
      dataPath: path.join(FIXTURE_DIR, "county-shipments-by-year-good.parquet"),
      artifactName: "county-shipments-by-year",
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects a malformed county-shipments-by-year parquet fixture", async () => {
    const result = await validateArtifact({
      schemaDir: SCHEMA_DIR,
      dataPath: path.join(FIXTURE_DIR, "county-shipments-by-year-bad.parquet"),
      artifactName: "county-shipments-by-year",
    });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("validateAllArtifacts includes parquet artifacts", async () => {
    const results = await validateAllArtifacts({
      schemaDir: SCHEMA_DIR,
      dataDir: FIXTURE_DIR,
    });
    const names = results.map((r) => r.file);
    expect(names).toContain("county-shipments-by-year-good.parquet");
  });
});
