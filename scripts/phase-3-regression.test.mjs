import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const read=(p)=>fs.readFileSync(path.join(root,p),"utf8");
test("Phase 3: ERP execution route is present",()=>{const s=read("src/routes/command/erp-execution.tsx");assert.match(s,/ERP Execution Control/);assert.match(s,/Create SO/);assert.match(s,/Create PO/);assert.match(s,/Production → QC → finished bike/);});
test("Phase 3: venture boundary is explicit",()=>{const s=read("src/lib/operations/phase3.ts");assert.match(s,/"carbon" \| "aluminium"/);assert.match(s,/VentureId/);});
test("Phase 3: operational states are controlled",()=>{const s=read("src/lib/operations/phase3.ts");assert.match(s,/SalesStatus/);assert.match(s,/PurchaseStatus/);assert.match(s,/ProductionStatus/);assert.match(s,/InventoryTxnType/);});
