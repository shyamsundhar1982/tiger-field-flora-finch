import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const shellEntry = read("src/components/command-shell.tsx");
const shell = read("src/components/command-shell-v2.tsx");
const workflow = read("src/lib/operating-workflow.ts");
const lineage = read("src/lib/operating-lineage.ts");
const bridge = read("src/components/protected-navigation-bridge.tsx");
const header = read("src/components/site-header.tsx");
const metadata = read("src/lib/page-metadata.ts");
const commandCentre = read("src/routes/command/index.tsx");
const operations = read("src/routes/command/operations.tsx");
const peopleOffice = read("src/routes/command/people-office.tsx");
const commercial = read("src/routes/command/sales.tsx");
const decisionInbox = read("src/routes/command/decision-inbox.tsx");
const controlTower = read("src/routes/command/control-tower.tsx");
const managementIntelligence = read("src/routes/command/management-intelligence.tsx");
const ibpeWorkspaceRoute = read("src/routes/command/ibpe-operating-workspace.tsx");
const ibpeOperatingWorkspace = read("src/lib/ibpe-operating-workspace.ts");

test("command workspace exposes one canonical primary navigation layer", () => {
  assert.match(shellEntry, /export \{ CommandShell \} from "\.\/command-shell-v2"/);
  assert.match(shell, /<SiteHeader showNavigation=\{false\} brandHref="\/command" \/>/);
  assert.match(shell, /Operating workspaces/);
  assert.match(shell, /7 owners/);
  assert.match(shell, /from "@\/lib\/operating-workflow"/);
  assert.match(shell, /ClientLink/);
  assert.doesNotMatch(shell, /NavigationView/);
  assert.doesNotMatch(shell, /COMMAND_TABS/);
});

test("secondary reference, monitor, specialist and showcase functions remain discoverable", () => {
  assert.match(shell, /More functions/);
  assert.match(shell, /navigationGroups/);
  for (const mode of ["understand", "observe", "operate", "showcase"])
    assert.match(shell, new RegExp(`"${mode}"`));

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
  ]) assert.match(metadata, new RegExp(route.replaceAll("/", "\\/")));
});

test("public navigation can be suppressed inside Command and protected brand navigation stays client-side", () => {
  assert.match(header, /showNavigation\?: boolean/);
  assert.match(header, /showNavigation = true/);
  assert.match(header, /\{showNavigation \? \(/);
  assert.match(header, /<Link to=\{brandHref as never\}/);
  assert.doesNotMatch(header, /<a href=\{brandHref\}/);
});

test("protected navigation is client-side while the bridge remains a compatibility guard", () => {
  assert.match(bridge, /document\.addEventListener\("click", handleClick\)/);
  assert.match(bridge, /destination\.pathname\.startsWith\("\/command\/"\)/);
  assert.match(bridge, /event\.preventDefault\(\)/);
  assert.match(bridge, /navigate\(\{ to: to as never \}\)/);
  assert.match(decisionInbox, /to=\{text\(item, "route"\) as never\}/);
  assert.doesNotMatch(decisionInbox, /href=\{text\(item, "route"\)\}/);
  assert.match(controlTower, /to=\{report\.route as never\}/);
  assert.doesNotMatch(controlTower, /href=\{report\.route\}/);
});

test("Control Tower remains the registered read-only ERP reporting console", () => {
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

test("IBPE Phase 1 workspace stays advisory and read-only", () => {
  assert.match(ibpeWorkspaceRoute, /createFileRoute\("\/command\/ibpe-operating-workspace"\)/);
  assert.match(ibpeWorkspaceRoute, /getAllErpSuiteReports/);
  assert.match(ibpeWorkspaceRoute, /buildIbpeOperatingWorkspace/);
  assert.match(ibpeOperatingWorkspace, /mode: "read-only" as const/);
  assert.match(ibpeOperatingWorkspace, /canonicalWriteEnabled: false/);
  assert.match(ibpeOperatingWorkspace, /autonomousLearningEnabled: false/);
  assert.match(ibpeOperatingWorkspace, /autonomousProcurementEnabled: false/);
  assert.match(ibpeOperatingWorkspace, /autonomousPlanningWritesEnabled: false/);
  assert.doesNotMatch(ibpeOperatingWorkspace, /insert into/i);
  assert.doesNotMatch(ibpeOperatingWorkspace, /delete from/i);
});

test("G1: one operating-workflow contract owns the primary taxonomy", () => {
  for (const label of [
    "Command",
    "Plan & Sales",
    "Product & Engineering",
    "Operations",
    "People & Office",
    "Finance & Governance",
    "Admin",
  ]) assert.match(shell + workflow, new RegExp(label.replace(/[&]/g, "\\&")));

  assert.match(workflow, /export const PLAN_SALES_TABS/);
  assert.match(workflow, /export const ENGINEERING_TABS/);
  assert.match(workflow, /export const OPERATIONS_TABS/);
  assert.match(workflow, /export const FINANCE_GOVERNANCE_TABS/);
  assert.match(workflow, /export const ADMIN_TABS/);
  assert.match(shell, /FINANCE_GOVERNANCE_TABS/);
  assert.doesNotMatch(shell, /const FINANCE_TABS/);
  assert.doesNotMatch(shell, /const GOVERNANCE_TABS/);
});

test("G2: workflow rail exposes the complete persisted-business journey on relevant pages", () => {
  for (const label of [
    "Plan",
    "Demand / Order",
    "Engineering / BOM",
    "Material Check",
    "Procurement",
    "Receiving",
    "Job Card",
    "Traveller",
    "Production",
    "Quality",
    "Shipment",
    "Invoice",
    "Collection",
  ]) assert.match(workflow, new RegExp(label.replace("/", "\\/")));

  for (const route of [
    "/command/planning",
    "/command/sales",
    "/command/engineering",
    "/command/operations",
    "/command/procurement-planning",
    "/command/purchase-execution",
    "/command/receiving",
    "/command/inventory",
    "/command/production",
    "/command/quality",
    "/command/receivables",
  ]) assert.match(workflow, new RegExp(route.replaceAll("/", "\\/")));

  assert.match(shell, /aria-label="End-to-end operating workflow"/);
  assert.match(shell, /WORKFLOW_VISIBLE_ROUTES/);
  assert.match(shell, /activeWorkflowStage/);
  assert.match(shell, /Follow the business object · write only in the owning workspace/);
});

test("G3: Operations is the actual execution hub, not only a renamed sidebar entry", () => {
  assert.match(operations, /Operations · demand to quality execution/);
  assert.match(operations, /<h1[^>]*>Operations<\/h1>/);
  assert.doesNotMatch(operations, /<h1[^>]*>Supply & Production<\/h1>/);
  assert.match(workflow, /label: "Requirements"/);
  assert.match(workflow, /label: "Purchase"/);
  assert.match(workflow, /label: "Receiving"/);
  assert.match(workflow, /label: "Build & Genealogy"/);
  assert.match(operations, /Today's operating exceptions/);
  assert.match(operations, /Order-to-cash lineage/);
  assert.match(operations, /Operating controls/);
  assert.match(operations, /table-auto/);
  assert.doesNotMatch(operations, /min-w-\[(?:9|1[0-9])\d{2}px\]/);
});

test("G4: lineage joins persisted order, production, procurement, receiving, genealogy, Quality and order-to-cash evidence", () => {
  assert.match(lineage, /createServerFn\(\{ method: "GET" \}\)/);
  assert.match(lineage, /jc\.sales_order_revision=o\.revision/);
  assert.match(lineage, /vyndi_live_job_card_requirements/);
  assert.match(lineage, /vyndi_purchase_orders/);
  assert.match(lineage, /vyndi_goods_receipts/);
  assert.match(lineage, /epr_travellers/);
  assert.match(lineage, /vyndi_shipments/);
  assert.match(lineage, /vyndi_invoices/);
  assert.match(lineage, /vyndi_collections/);
  assert.match(operations, /listQualityAuthority/);
  assert.match(operations, /Quality evidence is loaded from/);
  assert.doesNotMatch(lineage, /insert into/i);
  assert.doesNotMatch(lineage, /delete from/i);
  assert.doesNotMatch(lineage, /update\s+(?:vyndi_|epr_)/i);
});

test("G5: People & Office is first-class, compact and Finance is downstream", () => {
  assert.match(peopleOffice, /People & Office · operating administration/);
  assert.match(peopleOffice, /Finance consumes the approved cost model downstream/);
  assert.match(peopleOffice, /Downstream Finance/);
  assert.doesNotMatch(peopleOffice, /Finance · operating ledgers/);
  assert.match(peopleOffice, /Collapsed by default · expand only the register you need/);
  assert.match(peopleOffice, /<details/);
  assert.match(peopleOffice, /table-auto/);
  assert.doesNotMatch(peopleOffice, /min-w-\[1100px\]/);
  assert.match(workflow, /const PEOPLE_CONTEXT = new Set<string>\(\[PEOPLE_HOME\]\)/);
  const financeTabs = workflow.slice(workflow.indexOf("FINANCE_GOVERNANCE_TABS"), workflow.indexOf("ADMIN_TABS"));
  assert.doesNotMatch(financeTabs, /people-office/);
});

test("G6: Finance and Governance share one internal navigation contract", () => {
  const financeGovernance = workflow.slice(workflow.indexOf("FINANCE_GOVERNANCE_TABS"), workflow.indexOf("ADMIN_TABS"));
  for (const label of ["Finance Overview", "Cash", "Payables", "Receivables", "Balance Sheet", "CA Audit", "Approvals", "Risk", "Legal & IP", "Audit & Actions"])
    assert.match(financeGovernance, new RegExp(label.replace(/[&]/g, "\\&")));
  assert.match(shell, /routes=\{FINANCE_GOVERNANCE_TABS\}/);
  assert.match(shell, /context=\{FINANCE_GOVERNANCE_CONTEXT\}/);
});

test("G7: Command leads with today's operational control and demotes program governance", () => {
  assert.match(commandCentre, /Command · today’s operating control/);
  assert.match(commandCentre, /Today’s control room/);
  assert.match(commandCentre, /Exceptions now/);
  assert.match(commandCentre, /Fulfillment workflow/);
  assert.match(commandCentre, /getDecisionInboxData/);
  assert.match(commandCentre, /getOperatingLineage/);
  assert.match(commandCentre, /Program \/ founder governance/);
  assert.match(commandCentre, /secondary to day-to-day operating control/);
  assert.match(commandCentre, /<details/);
});

test("G8: high-volume touched lists are compact and progressively disclosed", () => {
  assert.match(commercial, /compact register · expand only to revise/);
  assert.match(commercial, /<table className="w-full table-auto text-left text-xs">/);
  assert.match(commercial, /Revise order \/ configuration/);
  assert.match(operations, /compact register/);
  assert.match(peopleOffice, /expand/);
  assert.doesNotMatch(commandCentre, /min-w-\[52rem\]/);
});

test("G9: Command tools and legacy routes stay discoverable without competing as primary owners", () => {
  for (const label of ["Action Inbox", "ERP Reports", "VIBPE Workspace"])
    assert.match(workflow, new RegExp(label));
  assert.match(shell, /Command tools/);
  for (const route of [
    "/command/phase-4",
    "/command/phase-5",
    "/command/phase-6",
    "/command/phase-6a",
    "/command/management-intelligence",
    "/command/production-jobcards",
    "/command/ops",
  ]) assert.match(workflow, new RegExp(route.replaceAll("/", "\\/")));
  assert.match(shell, /LEGACY_ROUTES/);
});
