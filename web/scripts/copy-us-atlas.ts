/**
 * Copy us-atlas counties-10m.json from node_modules into public/data/ so the
 * Explorer map can fetch it at /data/counties-10m.json without a CDN round-trip
 * or CSP changes. Idempotent; safe to run repeatedly.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_ROOT = path.resolve(__dirname, "..");

const SRC = path.join(WEB_ROOT, "node_modules", "us-atlas", "counties-10m.json");
const DEST_DIR = path.join(WEB_ROOT, "public", "data");
const DEST = path.join(DEST_DIR, "counties-10m.json");

async function main(): Promise<void> {
  try {
    await fs.access(SRC);
  } catch {
    throw new Error(`copy-us-atlas: source not found at ${SRC}. Run \`pnpm install\` first.`);
  }
  await fs.mkdir(DEST_DIR, { recursive: true });
  await fs.copyFile(SRC, DEST);
  console.log(`copy-us-atlas: wrote ${path.relative(WEB_ROOT, DEST)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
