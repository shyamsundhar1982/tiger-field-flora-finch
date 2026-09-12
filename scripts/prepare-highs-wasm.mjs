#!/usr/bin/env node
import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "highs", "build", "highs.wasm");
const targetDir = join(root, "src", "generated");
const target = join(targetDir, "highs.wasm");

const sourceStat = await stat(source).catch(() => null);
if (!sourceStat?.isFile()) {
  throw new Error("Pinned HiGHS runtime was not found at node_modules/highs/build/highs.wasm. Run npm ci first.");
}

await mkdir(targetDir, { recursive: true });
await copyFile(source, target);
console.log(`[highs-wasm] prepared ${target} (${sourceStat.size} bytes)`);
