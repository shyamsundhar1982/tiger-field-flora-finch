import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/routes/api/vibpe/assurance.ts", import.meta.url), "utf8");
const bridge = readFileSync(new URL("../src/routes/api/vibpe/chatgpt-assurance.ts", import.meta.url), "utf8");

test("VIBPE assurance API is backend-only, protected, and uses canonical assurance surfaces", () => {
  assert.match(source, /createFileRoute\("\/api\/vibpe\/assurance"\)/);
  assert.match(source, /requireBusinessActor\("view"\)/);
  assert.match(source, /requireBusinessActor\("approve"\)/);
  assert.match(source, /vyndi_vibpe_assurance_exceptions_all/);
  assert.match(source, /capture_vibpe_assurance_snapshot/);
  assert.doesNotMatch(source, /Link|Navigate|workspaceForRoute|WORKFLOW_STAGES|command-shell/);
});

test("VIBPE ChatGPT assurance bridge is token-protected, read-only, and exposes the unified live state", () => {
  assert.match(bridge, /createFileRoute\("\/api\/vibpe\/chatgpt-assurance"\)/);
  assert.match(bridge, /VIBPE_CHATGPT_BRIDGE_TOKEN/);
  assert.match(bridge, /authorization/);
  assert.match(bridge, /bridge_not_configured/);
  assert.match(bridge, /unauthorized/);
  assert.match(bridge, /vibpe-assurance-bridge\/v1/);
  assert.match(bridge, /vyndi_vibpe_assurance_snapshots/);
  assert.match(bridge, /vyndi_vibpe_assurance_exceptions_all/);
  assert.match(bridge, /vyndi_vibpe_ui_coverage_summary/);
  assert.match(bridge, /vyndi_vibpe_ui_capability_registry/);
  assert.match(bridge, /vyndi_vibpe_ui_observations/);
  assert.match(bridge, /vyndi_vibpe_surface_registry/);
  assert.match(bridge, /vyndi_vibpe_gate_registry/);
  assert.doesNotMatch(bridge, /capture_vibpe_assurance_snapshot/);
  assert.doesNotMatch(bridge, /insert\s+into|update\s+\w+\s+set|delete\s+from/i);
});
