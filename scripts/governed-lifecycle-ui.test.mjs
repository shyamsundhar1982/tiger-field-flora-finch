import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("shared governed lifecycle component is present", () => {
  const source = read("src/components/governed-lifecycle.tsx");
  assert.match(source, /export function GovernedLifecycle/);
  assert.match(source, /actions\.map/);
});

test("Action Inbox uses governed lifecycle controls", () => {
  const source = read("src/routes/command/decision-inbox.tsx");
  assert.match(source, /GovernedLifecycle/);
  assert.match(source, /Start action/);
  assert.match(source, /Complete action/);
});

test("Master Plan exposes governed submit and approval lifecycle", () => {
  const source = read("src/routes/command/planning.tsx");
  assert.match(source, /GovernedLifecycle/);
  assert.match(source, /Submit for approval/);
  assert.match(source, /Approve revision/);
});

test("Receiving exposes quarantine disposition through governed lifecycle", () => {
  const source = read("src/routes/command/receiving.tsx");
  assert.match(source, /GovernedLifecycle/);
  assert.match(source, /Disposition evidence is mandatory/);
  assert.match(source, /Accept to stock/);
  assert.match(source, /Reject material/);
});

test("historical Demand route redirects to canonical Commercial truth", () => {
  const source = read("src/routes/command/demand.tsx");
  assert.match(source, /createFileRoute\("\/command\/demand"\)/);
  assert.match(source, /redirect\(\{ to: "\/command\/sales", replace: true \}\)/);
  assert.doesNotMatch(source, /component:/);
});

test("Governance persists OPEN and CLOSED enforcement separately from evidence status", () => {
  const page = read("src/routes/command/governance.tsx");
  const authority = read("src/lib/governance-control-authority.ts");
  assert.match(page, /listGovernanceControls/);
  assert.match(page, /saveOperatingActionStatus/);
  assert.match(page, /governance-gate:/);
  assert.match(page, /Gate \{gate\.gateOpen \? "OPEN" : "CLOSED"\}/);
  assert.match(page, /closing a gate does not fabricate or alter evidence status/i);
  assert.match(authority, /vyndi_operating_actions/);
  assert.match(authority, /status !== "done"/);
});

test("Risk editor writes through canonical audited authority", () => {
  const page = read("src/routes/command/risk.tsx");
  const authority = read("src/lib/finance-governance-authority.ts");
  assert.match(page, /transitionRiskRegisterItem/);
  assert.match(page, /Save audited change/);
  assert.match(page, /sourceReference/);
  assert.match(authority, /RISK_STATUS_CHANGED/);
  assert.match(authority, /insert into vyndi_audit_events/);
});

test("Legal editor writes through canonical audited authority", () => {
  const page = read("src/routes/command/legal.tsx");
  const authority = read("src/lib/finance-governance-authority.ts");
  assert.match(page, /transitionLegalRegisterItem/);
  assert.match(page, /Save audited change/);
  assert.match(page, /sourceReference/);
  assert.match(authority, /LEGAL_STATUS_CHANGED/);
  assert.match(authority, /insert into vyndi_audit_events/);
});

test("Production prints a dedicated material requisition record instead of the whole workspace", () => {
  const source = read("src/routes/command/production.tsx");
  assert.match(source, /function printRequisitionRecord/);
  assert.match(source, /Material Requisition &amp; Issue Record/);
  assert.match(source, /Controlled Production Record/);
  assert.match(source, /Stores issue \/ verification/);
  assert.match(source, /Production receipt/);
  assert.match(source, /const rows = materialLines\.map/);
  assert.match(source, /\{materialLines\.map\(\(line: any\) =>/);
  assert.match(source, /SKU \/ material item/);
  assert.doesNotMatch(source, /<th>SKU \/ operation<\/th>/);
  assert.doesNotMatch(source, /onClick=\{\(\) => window\.print\(\)\}/);
});
