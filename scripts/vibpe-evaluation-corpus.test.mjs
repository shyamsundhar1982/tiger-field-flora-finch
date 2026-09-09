import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const corpus = await readFile(new URL("../docs/VIBPE-COPILOT-2-EVALUATION-CORPUS.md", import.meta.url), "utf8");

for (const prompt of [
  "Bye",
  "How to plan for the next 6 months",
  "20 lakh fund will manage the situation",
  "Next what?",
  "Increase Longitude demand 25%",
]) {
  test(`evaluation corpus includes: ${prompt}`, () => assert.match(corpus, new RegExp(prompt.replace(/[?+]/g, "\\$&"), "i")));
}
