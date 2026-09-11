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
