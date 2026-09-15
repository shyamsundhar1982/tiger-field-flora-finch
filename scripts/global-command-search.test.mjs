import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shell = readFileSync(new URL("../src/components/command-shell-v2.tsx", import.meta.url), "utf8");

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
