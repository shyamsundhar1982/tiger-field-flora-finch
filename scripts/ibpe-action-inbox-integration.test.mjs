import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=(p)=>fs.readFileSync(p,"utf8");

test("Business Action Inbox surfaces open IBPE management actions",()=>{
  const source=read("src/lib/procure-to-pay-authority.ts");
  assert.match(source,/vyndi_ibpe_management_actions/);
  assert.match(source,/IBPE management action/);
  assert.match(source,/\/command\/ibpe-operating-workspace/);
  assert.match(source,/status in \('open','in_progress','blocked'\)/);
  assert.match(source,/\.\.\.ibpeManagementActions/);
});

test("Existing Action Inbox queues remain intact",()=>{
  const source=read("src/lib/procure-to-pay-authority.ts");
  for (const marker of ["Purchase approval","Receiving exception","Payable review","Plan approval","Material shortage"]) {
    assert.match(source,new RegExp(marker));
  }
});

test("IBPE action details include identity and operating metadata",()=>{
  const source=read("src/lib/procure-to-pay-authority.ts");
  assert.match(source,/'ID '\|\|id/);
  assert.match(source,/owner/);
  assert.match(source,/due_date/);
  assert.match(source,/status/);
});


test("IBPE action application is proposal-idempotent",()=>{
  const source=read("src/lib/ibpe-operating-governance.ts");
  assert.match(source,/source_proposal_id/);
  assert.match(source,/where id=\$1 and status='confirmed'/);
  assert.match(source,/alreadyApplied: true/);
  assert.match(source,/select id from vyndi_ibpe_management_actions where source_proposal_id=\$1/);
  assert.match(source,/payload_json->>'entityId'/);
});

test("IBPE action lineage migration enforces one action per authorised proposal",()=>{
  const migration=read("migrations/0045_ibpe_action_idempotency_lifecycle.sql");
  assert.match(migration,/add column if not exists source_proposal_id text/);
  assert.match(migration,/create unique index if not exists vyndi_ibpe_management_actions_source_proposal_uidx/);
  assert.match(migration,/cancelled_duplicate/);
  assert.match(migration,/canonicalActionId/);
  assert.match(migration,/system:0045/);
});

test("IBPE action lifecycle is audited and completed actions leave active inbox",()=>{
  const governance=read("src/lib/ibpe-operating-governance.ts");
  const inbox=read("src/lib/procure-to-pay-authority.ts");
  const ui=read("src/routes/command/decision-inbox.tsx");
  assert.match(governance,/updateIbpeManagementActionLifecycle/);
  assert.match(governance,/revision=revision\+1/);
  assert.match(governance,/status_\$\{data\.status\}/);
  assert.match(inbox,/status in \('open','in_progress','blocked'\)/);
  assert.doesNotMatch(inbox,/status in \('open','in_progress','blocked','done'\)/);
  assert.match(ui,/Management action completed and removed from the active inbox/);
  assert.match(ui,/>Start</);
  assert.match(ui,/>Complete</);
});
