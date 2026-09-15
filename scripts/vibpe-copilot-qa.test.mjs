import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { VIBPE_QA_CASES } from "./vibpe-copilot-qa-cases.mjs";

const qa = await readFile(new URL("../src/lib/vibpe-copilot-qa.ts", import.meta.url), "utf8");
const specialist = await readFile(new URL("../src/lib/vibpe-qa-governed-queries.ts", import.meta.url), "utf8");
const copilot = await readFile(new URL("../src/lib/vibpe-copilot-2.ts", import.meta.url), "utf8");
const runner = await readFile(new URL("./vibpe-copilot-qa-runner.mjs", import.meta.url), "utf8");

test("QA corpus covers exactly two scenarios in all eight requested packs", () => {
  assert.equal(VIBPE_QA_CASES.length, 16);
  const counts = new Map();
  for (const item of VIBPE_QA_CASES) counts.set(item.pack, (counts.get(item.pack) ?? 0) + 1);
  assert.deepEqual([...counts.keys()].sort(), [
    "actual-vs-plan",
    "cash-ledger-reconciliation",
    "demand-commitment-feasibility",
    "funding",
    "inventory",
    "job-card-traveller",
    "liquidity",
    "procurement-recommendations",
  ]);
  for (const count of counts.values()) assert.equal(count, 2);
});

test("correction engine classifies all requested dimensions and fails closed on mutation scope", () => {
  for (const dimension of [
    "correctness",
    "completeness",
    "provenance",
    "ledger-vs-plan-semantics",
    "freshness",
    "repetition",
    "actionability",
  ]) assert.match(qa, new RegExp(`"${dimension}"`));

  assert.ok(qa.includes("/^migrations\\//"));
  assert.ok(qa.includes("transaction(?:al)?\\s+business\\s+data"));
  assert.ok(qa.includes("Any QA mutation requires a governed test fixture or sandbox."));
  assert.ok(qa.includes("VIBPE QA correction scope violation"));
});

test("specialist answer layer is read-only and uses canonical governed authorities", () => {
  assert.doesNotMatch(specialist, /insert\s+into|update\s+[a-z_]|delete\s+from|create\s+table/i);
  for (const source of [
    "vyndi_cash_authority",
    "vyndi_report_procurement_net_requirement",
    "epr_production_job_cards",
    "epr_travellers",
    "vyndi_monthly_transaction_actuals",
    "vyndi_plan_revisions",
    "vyndi_ibpe_runs",
  ]) assert.match(specialist, new RegExp(source));
});

test("real Co-Pilot routes governed QA specialists before knowledge/planning fallback", () => {
  assert.match(copilot, /tryVibpeQaGovernedDataAnswer/);
  const specialistCall = copilot.indexOf("await tryVibpeQaGovernedDataAnswer");
  const governanceCall = copilot.indexOf("await tryGovernanceDataAnswer");
  const operationalCall = copilot.indexOf("await tryOperationalDataAnswer");
  const knowledgeCall = copilot.indexOf("isKnowledgeQuestion(question)");
  assert.ok(specialistCall >= 0 && specialistCall < governanceCall);
  assert.ok(governanceCall < operationalCall && operationalCall < knowledgeCall);
});

test("planning procurement and funding remain advisory and non-committing", () => {
  assert.match(copilot, /does not create, approve or issue a PO automatically/);
  assert.match(copilot, /not current cash ledger truth and not an approved funding commitment/);
  assert.match(copilot, /funding requires human approval/);
});

test("executable QA runner invokes runVibpeCopilot2 and emits JSON and Markdown evidence", () => {
  assert.match(runner, /runVibpeCopilot2\(sql, question, governedBaseline/);
  assert.match(runner, /ssrLoadModule\("\/src\/lib\/vibpe-copilot-2\.ts"\)/);
  assert.match(runner, /JSON\.stringify\(\{ \.\.\.meta, audits \}/);
  assert.match(runner, /markdownReport\(meta, audits\)/);
  assert.match(runner, /transactionalBusinessDataAutoMutation: false/);
  assert.match(runner, /automaticProcurementCommitment: false/);
  assert.match(runner, /automaticFundingCommitment: false/);
  assert.match(runner, /automaticCustomerPromise: false/);
});