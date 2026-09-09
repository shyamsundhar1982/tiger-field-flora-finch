import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const session = await readFile(new URL("../src/lib/vibpe-session.ts", import.meta.url), "utf8");
const knowledge = await readFile(new URL("../src/lib/vibpe-external-knowledge.ts", import.meta.url), "utf8");

test("VIBPE advisory session state is explicitly non-governing", () => {
  assert.match(session, /Runtime-local advisory state only/);
  assert.match(session, /activeScenario/);
  assert.match(session, /planningHorizonMonths/);
});

test("external and inferred knowledge cannot govern internal truth", () => {
  assert.match(knowledge, /external-reference/);
  assert.match(knowledge, /model-inference/);
  assert.match(knowledge, /cannot overwrite controlled VYNDI master or transaction truth/);
});
