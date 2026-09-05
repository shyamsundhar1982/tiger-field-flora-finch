import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const read=(p)=>fs.readFileSync(path.join(root,p),"utf8");
test("Phase 4: intelligence route exists",()=>{const s=read("src/routes/command/intelligence.tsx");assert.match(s,/Management Intelligence/);assert.match(s,/Generate management actions/);assert.match(s,/Approve/);});
test("Phase 4: signal engine exists",()=>{const s=read("src/lib/operations/phase4.ts");assert.match(s,/generateAlerts/);assert.match(s,/Working-capital watch/);assert.match(s,/replenish/);});
test("Phase 4: venture boundary is explicit",()=>{const s=read("src/lib/operations/phase4.ts");assert.match(s,/"carbon" \| "aluminium"/);assert.match(s,/VentureId/);});
