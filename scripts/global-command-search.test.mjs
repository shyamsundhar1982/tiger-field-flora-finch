import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shell = readFileSync(new URL("../src/components/command-shell-v2.tsx", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../src/lib/operating-workflow.ts", import.meta.url), "utf8");
const manual = readFileSync(new URL("../src/routes/command/user-manual.tsx", import.meta.url), "utf8");

test("global Command search is role-aware and filterable without runtime DOM indexing", () => {
  assert.match(shell, /function CommandSearch\(/);
  assert.match(shell, /const SEARCH_ENTRIES/);
  assert.match(shell, /WORKSPACE_NAVIGATION\[workspace\.id\]/);
  assert.match(shell, /isAccessible\(role, entry\.to\)/);
  assert.match(shell, /Search pages, workspaces or routes/);
  assert.match(shell, /Filter search by workspace/);
  assert.match(shell, /Filter search by type/);
  assert.match(shell, /All workspaces/);
  assert.match(shell, /All types/);
  assert.match(shell, /Workspaces/);
  assert.match(shell, /Pages/);
  assert.match(shell, /<CommandSearch role=\{role\} \/>/);
  assert.doesNotMatch(shell, /MutationObserver/);
  assert.doesNotMatch(shell, /createTreeWalker/);
  assert.doesNotMatch(shell, /document\.body\.innerText/);
  assert.doesNotMatch(shell, /document\.querySelectorAll/);
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
