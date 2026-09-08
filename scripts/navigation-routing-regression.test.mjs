import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const shell = read("src/components/command-shell.tsx");
const header = read("src/components/site-header.tsx");
const commandCentre = read("src/routes/command/index.tsx");
const decisionInbox = read("src/routes/command/decision-inbox.tsx");
const controlTower = read("src/routes/command/control-tower.tsx");

test("command workspace exposes one canonical navigation layer", () => {
  assert.match(shell, /<SiteHeader showNavigation=\{false\} brandHref="\/command" \/>/);
  assert.doesNotMatch(shell, /NavigationView/);
  assert.doesNotMatch(shell, /COMMAND_TABS/);
  assert.doesNotMatch(shell, />Workspaces</);
  assert.doesNotMatch(shell, />More</);
  assert.doesNotMatch(shell, /\/command\/control-tower/);
  assert.match(shell, /<CanonicalAnchor[\s\S]{0,240}to=\{item\.to\}/);
  assert.match(shell, /href="\/command\/decision-inbox"/);
});

test("public navigation can be suppressed inside Command", () => {
  assert.match(header, /showNavigation\?: boolean/);
  assert.match(header, /showNavigation = true/);
  assert.match(header, /\{showNavigation \? \(/);
});

test("Command Centre source and workspace actions force canonical document loads", () => {
  assert.match(commandCentre, /href=\{packet\.source\}/);
  assert.match(commandCentre, /Open workspace →/);
  assert.match(commandCentre, /href="\/command\/planning"/);
  assert.doesNotMatch(commandCentre, /<Link\b/);
});

test("Action Inbox opens its owning canonical workspace", () => {
  assert.match(decisionInbox, /href=\{text\(item, "route"\)\}/);
  assert.match(decisionInbox, /Open workspace/);
  assert.doesNotMatch(decisionInbox, /Open owner/);
  assert.doesNotMatch(decisionInbox, /<Link\b/);
});

test("legacy Control Tower remains compatibility-only", () => {
  assert.match(controlTower, /createFileRoute\("\/command\/control-tower"\)/);
  assert.match(controlTower, /redirect\(\{ to: "\/command" \}\)/);
});
