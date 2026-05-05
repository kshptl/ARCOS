#!/usr/bin/env tsx
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface SyncCDCOverdoseOptions {
  rootDir?: string;
}

export interface SyncCDCOverdoseResult {
  copied: boolean;
  source: string;
  destination: string;
}

const ARTIFACT_NAME = "cdc_county_overdose.json";

function defaultRootDir() {
  return path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
}

export async function syncCDCOverdose(
  options: SyncCDCOverdoseOptions = {},
): Promise<SyncCDCOverdoseResult> {
  const rootDir = options.rootDir ?? defaultRootDir();
  const source = path.join(rootDir, "pipeline", "data", "processed", ARTIFACT_NAME);
  const destination = path.join(rootDir, "web", "public", "data", ARTIFACT_NAME);

  try {
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(source, destination);
    console.log(`copied ${source} to ${destination}`);
    return { copied: true, source, destination };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      console.warn(`missing ${source}; keeping existing ${destination}`);
      return { copied: false, source, destination };
    }
    throw err;
  }
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  syncCDCOverdose().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
