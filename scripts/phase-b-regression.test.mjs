import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("Phase B: financial model has explicit Carbon and Aluminium ventures", () => {
  const source = read("src/lib/finance/model.ts");
  assert.match(source, /export type VentureId="aluminium"\|"carbon"/);
  assert.match(source, /id:"aluminium",venture:"aluminium"/);
  assert.match(source, /id:"carbon",venture:"carbon"/);
  assert.match(source, /scenario==="stress"\?lines\.filter\(l=>l\.id==="carbon"\)/);
});

test("Phase B: accounting and integrity controls reconcile cash and balance sheet", () => {
  const accounting = read("src/lib/finance/accounting.ts");
  const integrity = read("src/lib/finance/integrity.ts");
  assert.match(accounting, /balanceCheck:totalAssets-totalLiabilitiesEquity/);
  assert.match(accounting, /closingCash:cash/);
  assert.match(integrity, /maxBalanceError/);
  assert.match(integrity, /maxCashError/);
  assert.match(integrity, /Number\.isFinite/);
});

test("Phase B: BOM costing is quantity and tier aware", () => {
  const source = read("src/lib/finance/bom-engine.ts");
  assert.match(source, /type BomTier="core"\|"pro"\|"apex"/);
  assert.match(source, /quantity\*c\.unitCostInr/);
  assert.match(source, /bomTotalInr\("core"/);
  assert.match(source, /bomTotalInr\("pro"/);
  assert.match(source, /bomTotalInr\("apex"/);
});

test("Phase B: sales lifecycle excludes leads and cancellations from revenue", async () => {
  const sales = await import(path.join(root, "src/lib/finance/sales-rules.ts"));
  assert.equal(sales.isOrderBookStatus("lead"), false);
  assert.equal(sales.isRevenueStatus("lead"), false);
  assert.equal(sales.isOrderBookStatus("confirmed"), true);
  assert.equal(sales.isRevenueStatus("delivered"), true);
  assert.equal(sales.isRevenueStatus("cancelled"), false);
});

test("Phase B: People/Opex propagates headcount, hiring and overhead", async () => {
  const people = await import(path.join(root, "src/lib/finance/people-opex-engine.ts"));
  const rows = people.buildPeopleOpexMonths();
  assert.equal(rows.length, 36);
  assert.equal(rows[0].headcount, 1);
  assert.ok(rows[7].headcount > rows[0].headcount);
  assert.ok(rows[7].totalOpex > rows[0].totalOpex);
  assert.ok(people.peopleOpexTotals(rows).totalOpex > 0);
});

test("Phase B: Decision Engine propagates through planning and accounting", () => {
  const source = read("src/lib/finance/decision-engine.ts");
  for (const pattern of [/buildModelWithInputs/, /buildAccountingModel/, /applyDecisionOverrides/, /fundingGap/, /breakEvenMonth/]) assert.match(source, pattern);
});

test("Phase B: venture model reconciles Carbon + Aluminium into consolidated output", () => {
  const source = read("src/lib/finance/venture-finance.ts");
  for (const pattern of [/carbon:VentureMonthRow\[\]/, /aluminium:VentureMonthRow\[\]/, /parent:VentureMonthRow\[\]/, /const consolidated=/, /revenue=c\.revenue\+a\.revenue/, /cogs=c\.cogs\+a\.cogs/]) assert.match(source, pattern);
});

test("Phase B: Control Tower covers all eight management domains", () => {
  const source = read("src/lib/finance/control-tower-engine.ts");
  for (const area of ["cash", "sales", "production", "inventory", "quality", "engineering", "people", "compliance"]) assert.match(source, new RegExp(area));
});

test("Phase B: Board and compliance layers are wired", () => {
  const board = read("src/lib/finance/board-engine.ts");
  const compliance = read("src/lib/finance/compliance-engine.ts");
  assert.match(board, /buildBoardKpis/);
  assert.match(board, /BoardRisk/);
  assert.match(compliance, /AccountingRow/);
  assert.match(compliance, /PeopleOpexAssumptions/);
  assert.match(compliance, /buildComplianceMonths/);
});
