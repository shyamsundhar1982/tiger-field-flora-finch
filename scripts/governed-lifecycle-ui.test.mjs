import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=(p)=>fs.readFileSync(p,"utf8");

test("shared governed lifecycle component exposes status and governed actions",()=>{
  const source=read("src/components/governed-lifecycle.tsx");
  assert.match(source,/export function GovernedLifecycle/);
  assert.match(source,/statusToneClass/);
  assert.match(source,/actions\.map/);
  assert.match(source,/disabled:cursor-not-allowed/);
});

test("Action Inbox uses the shared lifecycle pattern for IBPE actions",()=>{
  const source=read("src/routes/command/decision-inbox.tsx");
  assert.match(source,/GovernedLifecycle/);
  assert.match(source,/Start action/);
  assert.match(source,/Complete action/);
  assert.match(source,/updateIbpeManagementActionLifecycle/);
});

test("Master Plan preserves canonical submit and approval authority with shared lifecycle UI",()=>{
  const source=read("src/routes/command/planning.tsx");
  assert.match(source,/GovernedLifecycle/);
  assert.match(source,/submitOperatingPlan/);
  assert.match(source,/approveOperatingPlan/);
  assert.match(source,/Submit for approval/);
  assert.match(source,/Approve revision/);
});

test("Receiving preserves quarantine evidence and disposition authority with shared lifecycle UI",()=>{
  const source=read("src/routes/command/receiving.tsx");
  assert.match(source,/GovernedLifecycle/);
  assert.match(source,/status="quarantine"/);
  assert.match(source,/Disposition evidence is mandatory/);
  assert.match(source,/Accept to stock/);
  assert.match(source,/Reject material/);
  assert.match(source,/resolveGoodsReceipt/);
});
