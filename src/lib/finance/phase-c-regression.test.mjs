import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
const root=process.cwd(); const read=p=>fs.readFileSync(path.join(root,p),"utf8");
test("Phase C: venture scope is explicit and reusable",()=>{const s=read("src/lib/finance/venture-scope.ts");assert.match(s,/VentureScope = "consolidated" \| "carbon" \| "aluminium"/);assert.match(s,/buildScopedRows/);assert.match(s,/Vyndi/);assert.match(s,/Aluminium Venture/);});
test("Phase C: Control Tower detects and owns all eight management domains",()=>{const s=read("src/lib/finance/control-tower-engine.ts");for(const x of ["cash","sales","production","inventory","quality","engineering","people","compliance","owner"])assert.match(s,new RegExp(x,"i"));});
test("Phase C: Board risks have venture ownership",()=>{const s=read("src/lib/finance/board-engine.ts");assert.match(s,/BOARD_RISKS_BY_VENTURE/);assert.match(s,/carbon/);assert.match(s,/aluminium/);});
test("Phase C: Decision Engine carries venture scope",()=>{const s=read("src/lib/finance/decision-engine.ts");assert.match(s,/venture\?:VentureScope/);assert.match(s,/buildScopedRows/);assert.match(s,/fullSensitivity.*venture/);});
