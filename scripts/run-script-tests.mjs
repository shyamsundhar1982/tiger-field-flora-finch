import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

async function collect(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await collect(path)));
    else if (entry.isFile() && entry.name.endsWith(".test.mjs")) files.push(path);
  }
  return files;
}

const files = (await collect("scripts")).sort();
if (!files.length) {
  console.error("No script test files were found.");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--test", ...files], {
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
