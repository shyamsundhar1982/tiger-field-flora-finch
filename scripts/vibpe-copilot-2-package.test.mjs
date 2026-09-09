import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

for (const file of [
  "../src/lib/vibpe-intent.ts",
  "../src/lib/vibpe-copilot-2.ts",
  "../src/lib/vibpe-planning.ts",
  "../src/lib/vibpe-optimiser.ts",
  "../src/lib/vibpe-business-operator.ts",
  "../src/lib/vibpe-session.ts",
  "../src/lib/vibpe-external-knowledge.ts",
]) {
  test(`VIBPE 2 package file exists: ${file}`, async () => {
    const content = await readFile(new URL(file, import.meta.url), "utf8");
    assert.ok(content.length > 20);
  });
}
