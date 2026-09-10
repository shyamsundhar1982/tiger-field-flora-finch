import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const shellEntry = read("src/components/command-shell.tsx");
const shell = read("src/components/command-shell-v2.tsx");
const bridge = read("src/components/protected-navigation-bridge.tsx");
const header = read("src/components/site-header.tsx");
const metadata = read("src/lib/page-metadata.ts");
const commandCentre = read("src/routes/command/index.tsx");
const decisionInbox = read("src/routes/command/decision-inbox.tsx");
const controlTower = read("src/routes/command/control-tower.tsx");
const managementIntelligence = read("src/routes/command/management-intelligence.tsx");
const ibpeWorkspaceRoute = read("src/routes/command/control-tower/ibpe-operating-workspace.tsx");
const ibpeOperatingWorkspace = read("src/lib/ibpe-operating-workspace.ts");

test("command workspace exposes one canonical primary navigation layer", () => {
  assert.match(shellEntry, /export \{ CommandShell \} from "\.\/command-shell-v2"/);
  assert.match(shell, /<SiteHeader showNavigation=\{false\} brandHref="\/command" \/>/);
  assert.match(shell, /Core workspaces/);
  assert.match(shell, /ClientLink/);
  assert.match(shell, /\/command\/decision-inbox/);
  assert.doesNotMatch(shell, /NavigationView/);
  assert.doesNotMatch(shell, /COMMAND_TABS/);
});

test("secondary reference, monitor, specialist and showcase functions remain discoverable", () => {
  assert.match(shell, /More functions/);
  assert.match(shell, /navigationGroups/);
  for (const mode of ["understand", "observe", "operate", "showcase"]) {
    assert.match(shell, new RegExp(`"${mode}"`));
  }

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

test("public navigation can be suppressed inside Command and protected brand navigation stays client-side", () => {
  assert.match(header, /showNavigation\?: boolean/);
  assert.match(header, /showNavigation = true/);
  assert.match(header, /\{showNavigation \? \(/);
  assert.match(header, /<Link to=\{brandHref as never\}/);
  assert.doesNotMatch(header, /<a href=\{brandHref\}/);
});

test("Command Centre uses client navigation for protected workspace actions", () => {
  assert.match(commandCentre, /import \{ createFileRoute, Link \}/);
  assert.match(commandCentre, /const WorkLink/);
  assert.match(commandCentre, /to="\/command\/planning"/);
  assert.match(commandCentre, /ERP Reports →/);
  assert.doesNotMatch(commandCentre, /<a\b/);
});

test("protected navigation is client-side while the bridge remains a temporary compatibility guard", () => {
  assert.match(bridge, /document\.addEventListener\("click", handleClick\)/);
  assert.match(bridge, /destination\.pathname\.startsWith\("\/command\/"\)/);
  assert.match(bridge, /event\.preventDefault\(\)/);
  assert.match(bridge, /navigate\(\{ to: to as never \}\)/);
  assert.match(decisionInbox, /to=\{text\(item, "route"\) as never\}/);
  assert.doesNotMatch(decisionInbox, /href=\{text\(item, "route"\)\}/);
  assert.match(controlTower, /to=\{report\.route as never\}/);
  assert.doesNotMatch(controlTower, /href=\{report\.route\}/);
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

test("management intelligence remains a compatibility redirect", () => {
  assert.match(managementIntelligence, /createFileRoute\("\/command\/management-intelligence"\)/);
  assert.match(managementIntelligence, /redirect\(\{ to: "\/command" \}\)/);
});

test("IBPE Phase 1 workspace is a nested read-only Control Tower consumer", () => {
  assert.match(ibpeWorkspaceRoute, /createFileRoute\("\/command\/control-tower\/ibpe-operating-workspace"\)/);
  assert.match(ibpeWorkspaceRoute, /getAllErpSuiteReports/);
  assert.match(ibpeWorkspaceRoute, /buildIbpeOperatingWorkspace/);
  assert.match(ibpeWorkspaceRoute, /IBPE Operating Workspace/);

  assert.match(ibpeOperatingWorkspace, /mode: "read-only" as const/);
  assert.match(ibpeOperatingWorkspace, /source: "canonical-erp-report-pack" as const/);
  assert.match(ibpeOperatingWorkspace, /canonicalWriteEnabled: false/);
  assert.match(ibpeOperatingWorkspace, /autonomousLearningEnabled: false/);
  assert.match(ibpeOperatingWorkspace, /autonomousProcurementEnabled: false/);
  assert.match(ibpeOperatingWorkspace, /autonomousPlanningWritesEnabled: false/);
  assert.doesNotMatch(ibpeOperatingWorkspace, /insert into/i);
  assert.doesNotMatch(ibpeOperatingWorkspace, /update\s+\w+/i);
  assert.doesNotMatch(ibpeOperatingWorkspace, /delete from/i);
});
