import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { syncCDCOverdose } from "@/scripts/sync-cdc-overdose.mts";

const tempDirs: string[] = [];

async function makeTempRoot() {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "sync-cdc-overdose-"));
  tempDirs.push(rootDir);
  return rootDir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("syncCDCOverdose", () => {
  it("copies source JSON into public data dir", async () => {
    const rootDir = await makeTempRoot();
    const source = path.join(rootDir, "pipeline", "data", "processed", "cdc_county_overdose.json");
    const destination = path.join(rootDir, "web", "public", "data", "cdc_county_overdose.json");
    const sourceJson = JSON.stringify({ records: [{ fips: "01001", deaths: 12 }] });

    await fs.mkdir(path.dirname(source), { recursive: true });
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(source, sourceJson);

    const result = await syncCDCOverdose({ rootDir });

    const copied = JSON.parse(await fs.readFile(destination, "utf-8"));
    expect(copied.records[0]).toEqual({ fips: "01001", deaths: 12 });
    expect(result).toEqual({ copied: true, source, destination });
  });

  it("keeps existing public artifact when source is absent", async () => {
    const rootDir = await makeTempRoot();
    const source = path.join(rootDir, "pipeline", "data", "processed", "cdc_county_overdose.json");
    const destination = path.join(rootDir, "web", "public", "data", "cdc_county_overdose.json");
    const existingJson = JSON.stringify({ records: [{ fips: "01003", deaths: 4 }] });

    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, existingJson);

    const result = await syncCDCOverdose({ rootDir });

    await expect(fs.readFile(destination, "utf-8")).resolves.toBe(existingJson);
    expect(result).toEqual({ copied: false, source, destination });
  });
});
