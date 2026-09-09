import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const shell = read("src/components/command-shell.tsx");
const header = read("src/components/site-header.tsx");
const metadata = read("src/lib/page-metadata.ts");
const commandCentre = read("src/routes/command/index.tsx");
const decisionInbox = read("src/routes/command/decision-inbox.tsx");
const controlTower = read("src/routes/command/control-tower.tsx");

test("command workspace exposes one canonical primary navigation layer", () => {
  assert.match(shell, /<SiteHeader showNavigation=\{false\} brandHref="\/command" \/>/);
  assert.doesNotMatch(shell, /NavigationView/);
  assert.doesNotMatch(shell, /COMMAND_TABS/);
  assert.doesNotMatch(shell, />Workspaces</);
  assert.doesNotMatch(shell, />More</);
  assert.doesNotMatch(shell, /\/command\/control-tower/);
  assert.match(shell, /<CanonicalAnchor[\s\S]{0,240}to=\{item\.to\}/);
  assert.match(shell, /href="\/command\/decision-inbox"/);
});

test("secondary reference, monitor, specialist and showcase functions remain discoverable", () => {
  assert.match(shell, /More functions/);
  assert.match(shell, /navigationGroups/);
  assert.match(shell, /<SecondaryMode mode="understand" role=\{role\} \/>/);
  assert.match(shell, /<SecondaryMode mode="observe" role=\{role\} \/>/);
  assert.match(shell, /<SecondaryMode mode="operate" role=\{role\} \/>/);
  assert.match(shell, /<SecondaryMode mode="showcase" role=\{role\} \/>/);
  assert.match(shell, /href=\{page\.route\}/);

  for (const route of [
    "/command/epr-live",
    "/command/receivables",
    "/command/investor-board",
    "/command/epr-workflow",
    "/command/epr-execution",
    "/command/payables",
    "/command/legal-control",
    "/command/investor-pitch",
    "/command/investor-pitch-external",
    "/command/platform-walkthrough",
    "/command/demo-company",
  ]) {
    assert.match(metadata, new RegExp(route.replaceAll("/", "\\/")));
  }
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
  assert.match(commandCentre, /href="\/command\/control-tower"/);
  assert.match(commandCentre, /ERP Reports →/);
  assert.doesNotMatch(commandCentre, /<Link\b/);
});

test("Action Inbox opens its owning canonical workspace", () => {
  assert.match(decisionInbox, /href=\{text\(item, "route"\)\}/);
  assert.match(decisionInbox, /Open workspace/);
  assert.doesNotMatch(decisionInbox, /Open owner/);
  assert.doesNotMatch(decisionInbox, /<Link\b/);
});

test("Control Tower is the registered read-only ERP reporting console", () => {
  assert.match(metadata, /"\/command\/control-tower"/);
  assert.match(controlTower, /createFileRoute\("\/command\/control-tower"\)/);
  assert.match(controlTower, /loader: \(\) => getAllErpSuiteReports\(\)/);
  assert.match(controlTower, /ERP Control Tower/);
  assert.match(controlTower, /Download full ERP pack/);
  assert.match(controlTower, /downloadCsv/);
  assert.doesNotMatch(controlTower, /redirect\(/);
});
