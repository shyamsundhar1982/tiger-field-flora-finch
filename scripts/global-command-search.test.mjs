import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shell = readFileSync(new URL("../src/components/command-shell-v2.tsx", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../src/lib/operating-workflow.ts", import.meta.url), "utf8");
const manual = readFileSync(new URL("../src/routes/command/user-manual.tsx", import.meta.url), "utf8");
const traceability = readFileSync(new URL("../src/components/traceability-document-centre-v2.tsx", import.meta.url), "utf8");

test("global Command search is a governed universal entry point without runtime DOM indexing", () => {
  assert.match(shell, /function CommandSearch\(/);
  assert.match(shell, /const SEARCH_ENTRIES/);
  assert.match(shell, /WORKSPACE_NAVIGATION\[workspace\.id\]/);
  assert.match(shell, /isAccessible\(role, entry\.to\)/);
  assert.match(shell, /Search orders, job cards, serials, POs, GRNs, suppliers, SKUs, quality, pages/);
  assert.match(shell, /Search records/);
  assert.match(shell, /Search governed records for/);
  assert.match(shell, /vyndi:traceability-search/);
  assert.match(shell, /new CustomEvent/);
  assert.match(shell, /detail: \{ query: trimmed \}/);
  assert.match(shell, /RBAC-filtered governed records and traceability/);
  assert.match(shell, /Matching pages remain quick navigation shortcuts/);
  assert.match(shell, /<CommandSearch role=\{role\} \/>/);
  assert.doesNotMatch(shell, /Filter search by workspace/);
  assert.doesNotMatch(shell, /Filter search by type/);
  assert.doesNotMatch(shell, /MutationObserver/);
  assert.doesNotMatch(shell, /createTreeWalker/);
  assert.doesNotMatch(shell, /document\.body\.innerText/);
  assert.doesNotMatch(shell, /document\.querySelectorAll/);
});

test("free-text Command searches hand off to the existing permission-aware Traceability Centre", () => {
  assert.match(traceability, /window\.addEventListener\("vyndi:traceability-search"/);
  assert.match(traceability, /DIRECT_SEARCH_SENTINEL/);
  assert.match(traceability, /interpretTraceabilityQuery\(trimmed\)/);
  assert.match(traceability, /searchTraceability\(\{ data: \{ query: serverQuery, limit: 60 \} \}\)/);
  assert.match(traceability, /direct partial-ID, SKU, supplier, model and vernacular search/i);
});

test("User Manual is a searchable Command reference page without global runtime scanning", () => {
  assert.match(workflow, /label: "Help & Reference"/);
  assert.match(workflow, /to: "\/command\/user-manual", label: "User Manual"/);
  assert.match(manual, /createFileRoute\("\/command\/user-manual"\)/);
  assert.match(manual, /data-user-manual="vyndi-um-001-rev-1"/);
  assert.match(manual, /User & Operator Manual/);
  assert.match(manual, /Search the manual/);
  assert.match(manual, /Print dossier/);
  assert.match(manual, /VIBPE Co-Pilot 2\.0/);
  assert.doesNotMatch(manual, /MutationObserver/);
  assert.doesNotMatch(manual, /createTreeWalker/);
});
