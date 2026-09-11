import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/routes/api/vibpe/assurance.ts", import.meta.url), "utf8");

test("VIBPE assurance API is backend-only, protected, and uses canonical assurance surfaces", () => {
  assert.match(source, /createFileRoute\("\/api\/vibpe\/assurance"\)/);
  assert.match(source, /requireBusinessActor\("view"\)/);
  assert.match(source, /requireBusinessActor\("approve"\)/);
  assert.match(source, /vyndi_vibpe_assurance_exceptions/);
  assert.match(source, /capture_vibpe_assurance_snapshot/);
  assert.doesNotMatch(source, /Link|Navigate|workspaceForRoute|WORKFLOW_STAGES|command-shell/);
});
