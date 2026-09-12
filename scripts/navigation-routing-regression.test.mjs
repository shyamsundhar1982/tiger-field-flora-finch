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
const ibpeProjection = read("src/components/ibpe-workspace-projection.tsx");

test("command workspace exposes one canonical primary navigation layer", () => {
  assert.match(shellEntry, /export \{ CommandShell \} from "\.\/command-shell-v2"/);
  assert.match(shell, /<SiteHeader showNavigation=\{false\} brandHref="\/command" \/>/);
  assert.match(shell, /Operating workspaces/);
  assert.match(shell, /from "@\/lib\/operating-workflow"/);
  assert.match(shell, /WORKSPACE_NAVIGATION/);
  assert.match(shell, /ClientLink/);
  assert.doesNotMatch(shell, /NavigationView/);
  assert.doesNotMatch(shell, /COMMAND_TABS/);
});

test("secondary functions inherit workspace ownership instead of a global mode bucket", () => {
  assert.doesNotMatch(shell, /More functions/);
  assert.doesNotMatch(shell, /navigationGroups/);
  assert.doesNotMatch(shell, /MODE_LABEL/);
  assert.doesNotMatch(shell, /PageMode/);
  assert.match(shell, /const sections = WORKSPACE_NAVIGATION\[item\.id\]/);
  assert.match(shell, /sections\.map\(\(section\)/);

  for (const route of [
    "/command/market-survey",
    "/command/procurement",
    "/command/manufacturing",
    "/command/actuals",
    "/command/finance-assumptions",
    "/command/finance-control",
    "/command/epr-workflow",
    "/command/epr-execution",
    "/command/epr-live",
    "/command/qa-verification",
    "/command/legal-control",
    "/command/classification",
  ]) assert.match(workflow, new RegExp(route.replaceAll("/", "\\/")));
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

test("G1: one operating-workflow contract owns the primary taxonomy and nesting", () => {
  for (const label of [
    "Command",
    "Plan & Commercial",
    "Product & Engineering",
    "Supply & Operations",
    "People & Office",
    "Finance",
    "Governance & Assurance",
    "Admin",
  ]) assert.match(shell + workflow, new RegExp(label.replace(/[&]/g, "\\&")));

  assert.match(workflow, /export const WORKSPACE_NAVIGATION/);
  assert.match(workflow, /export const PLAN_SALES_TABS/);
  assert.match(workflow, /export const ENGINEERING_TABS/);
  assert.match(workflow, /export const OPERATIONS_TABS/);
  assert.match(workflow, /export const FINANCE_TABS/);
  assert.match(workflow, /export const GOVERNANCE_TABS/);
  assert.match(workflow, /export const FINANCE_GOVERNANCE_TABS/);
  assert.match(workflow, /@deprecated Prefer FINANCE_TABS \+ GOVERNANCE_TABS/);
  assert.match(workflow, /export const ADMIN_TABS/);
  assert.match(shell, /FINANCE_TABS/);
  assert.match(shell, /GOVERNANCE_TABS/);
  assert.doesNotMatch(shell, /FINANCE_GOVERNANCE_TABS/);
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
    "Dispatch",
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

  assert.match(shell, /WorkspaceTabs role=\{role\} routes=\{PLAN_SALES_TABS\}/);
  assert.match(shell, /WorkspaceTabs role=\{role\} routes=\{ENGINEERING_TABS\}/);
  assert.match(shell, /WorkspaceTabs role=\{role\} routes=\{OPERATIONS_TABS\}/);
  assert.match(shell, /WorkspaceTabs role=\{role\} routes=\{FINANCE_TABS\}/);
  assert.match(shell, /WorkspaceTabs role=\{role\} routes=\{GOVERNANCE_TABS\}/);
});

test("G3: Supply & Operations follows the execution sequence and does not front-load Dispatch", () => {
  assert.match(operations, /Operations · demand to quality execution/);
  assert.match(operations, /<h1[^>]*>Operations<\/h1>/);
  assert.doesNotMatch(operations, /<h1[^>]*>Supply & Production<\/h1>/);
  assert.match(workflow, /label: "Overview"/);
  assert.match(workflow, /label: "Inventory"/);
  assert.match(workflow, /label: "Requirements"/);
  assert.match(workflow, /label: "Purchase"/);
  assert.match(workflow, /label: "Receiving"/);
  assert.match(workflow, /label: "Build"/);
  assert.match(workflow, /label: "Quality"/);
  assert.doesNotMatch(workflow, /label: "Overview & Dispatch"/);
  assert.match(workflow, /id: "dispatch"[\s\S]*label: "Dispatch"/);
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
  assert.match(peopleOffice, /Finance\s+consumes approved records only/);
  assert.match(peopleOffice, /Downstream Finance/);
  assert.doesNotMatch(peopleOffice, /Finance · operating ledgers/);
  assert.match(peopleOffice, /Draft → submit → approve → supersede · expand only the register you need/);
  assert.match(peopleOffice, /transitionPeopleRecord/);
  assert.match(peopleOffice, /transitionPeopleOfficeCost/);
  assert.match(peopleOffice, /transitionPeopleOfficeAsset/);
  assert.match(peopleOffice, /<details/);
  assert.match(peopleOffice, /table-auto/);
  assert.doesNotMatch(peopleOffice, /min-w-\[1100px\]/);
  assert.match(workflow, /PEOPLE_CONTEXT = new Set<string>\(workspaceRoutes\("people-office"\)\)/);
  assert.match(workflow, /"people-office": \[/);
  const financeTabs = workflow.slice(workflow.indexOf("FINANCE_TABS"), workflow.indexOf("GOVERNANCE_TABS"));
  assert.doesNotMatch(financeTabs, /people-office/);
});

test("G6: Finance and Governance & Assurance have separate internal navigation contracts", () => {
  const finance = workflow.slice(workflow.indexOf("FINANCE_TABS"), workflow.indexOf("GOVERNANCE_TABS"));
  for (const label of ["Overview", "Cash", "Payables", "Receivables", "Balance Sheet"])
    assert.match(finance, new RegExp(label));
  assert.doesNotMatch(finance, /Approvals|Risk|Legal & IP|Audit & Actions|CA Audit/);

  const governance = workflow.slice(workflow.indexOf("GOVERNANCE_TABS"), workflow.indexOf("ADMIN_TABS"));
  for (const label of ["Approvals", "Risk", "Legal & IP", "Audit & Actions", "CA Audit"])
    assert.match(governance, new RegExp(label.replace(/[&]/g, "\\&")));
  assert.doesNotMatch(governance, /Payables|Receivables|Balance Sheet/);

  assert.match(shell, /routes=\{FINANCE_TABS\}/);
  assert.match(shell, /label="Finance workspace"/);
  assert.match(shell, /routes=\{GOVERNANCE_TABS\}/);
  assert.match(shell, /label="Governance and Assurance workspace"/);
  assert.match(workflow, /FINANCE_GOVERNANCE_TABS/);
  assert.match(workflow, /FINANCE_GOVERNANCE_CONTEXT/);
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

test("G9: Command tools are nested under Command while legacy routes remain compatibility-only", () => {
  for (const label of ["Action Inbox", "Control Tower", "VIBPE Workspace", "VIBPE Assurance"])
    assert.match(workflow, new RegExp(label));
  assert.match(workflow, /command: \[/);
  assert.match(shell, /WORKSPACE_NAVIGATION/);
  assert.doesNotMatch(shell, /Command tools/);
  assert.doesNotMatch(shell, /LEGACY_ROUTES/);
  for (const route of [
    "/command/phase-4",
    "/command/phase-5",
    "/command/phase-6",
    "/command/phase-6a",
    "/command/management-intelligence",
    "/command/production-jobcards",
    "/command/ops",
  ]) assert.match(workflow, new RegExp(route.replaceAll("/", "\\/")));
});

test("G10: route ownership follows business parent rather than historical context", () => {
  const planNavigation = workflow.slice(workflow.indexOf('"plan-sales": ['), workflow.indexOf("engineering: ["));
  assert.match(planNavigation, /market-survey/);
  assert.doesNotMatch(planNavigation, /finance-assumptions/);

  const financeNavigation = workflow.slice(workflow.indexOf("finance: ["), workflow.indexOf("governance: ["));
  assert.match(financeNavigation, /finance-assumptions/);
  assert.match(financeNavigation, /finance-control/);

  const governanceNavigation = workflow.slice(workflow.indexOf("governance: ["), workflow.indexOf("admin: ["));
  for (const route of ["epr-workflow", "epr-execution", "epr-live", "qa-verification", "legal-control"])
    assert.match(governanceNavigation, new RegExp(route));

  const operationsNavigation = workflow.slice(workflow.indexOf("operations: ["), workflow.indexOf('"people-office": ['));
  assert.match(operationsNavigation, /actuals/);
});

test("G11: VIBPE projects the same canonical workspace ownership as the shell", () => {
  assert.match(ibpeProjection, /workspaceForRoute/);
  assert.match(ibpeProjection, /Record<CanonicalWorkspaceId/);
  assert.match(ibpeProjection, /"people-office": \{ label: "People & Office"/);
  assert.match(ibpeProjection, /governance: \{ label: "Governance & Assurance"/);
  assert.doesNotMatch(ibpeProjection, /routes:\s*\[/);
  assert.doesNotMatch(ibpeProjection, /workspaceDomains\.find/);
});
