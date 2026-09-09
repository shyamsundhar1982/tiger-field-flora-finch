import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const context = await readFile(new URL("../src/lib/vibpe-governed-context.ts", import.meta.url), "utf8");

test("governed context keeps internal truth ahead of scenario and external evidence", () => {
  assert.match(context, /governed-internal.*scenario-assumption.*external-reference.*model-inference/s);
  assert.match(context, /externalAuthority: "advisory-only"/);
  assert.match(context, /scenarioAuthority: "advisory-only"/);
});
