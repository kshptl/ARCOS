import { describe, it, expect } from "vitest";
import { validateArtifact, validateAllArtifacts } from "@/scripts/validate-data";
import path from "node:path";

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
});
