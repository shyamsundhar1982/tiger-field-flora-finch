import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const hasQuotedRoute = (source, route) => source.includes(`"${route}"`) || source.includes(`'${route}'`);

const activeWorkflowFiles = [
  "src/routes/command/control-tower.tsx",
  "src/routes/command/epr-live.tsx",
  "src/routes/command/inventory-truth.tsx",
  "src/lib/erp-flow.ts",
  "src/components/ibpe-workspace-projection.tsx",
];

for (const path of activeWorkflowFiles) {
  const source = read(path);
  assert.equal(hasQuotedRoute(source, "/command/production-jobcards"), false, `${path}: active workflow must use canonical /command/production`);
  assert.equal(hasQuotedRoute(source, "/command/management-intelligence"), false, `${path}: compatibility Management Intelligence must not remain in active workflow metadata`);
}

const shell = read("src/components/command-shell-v2.tsx");
const operatingWorkflow = read("src/lib/operating-workflow.ts");
assert.equal(shell.includes('{ to: "/command/production-jobcards", label: "Release" }'), false);
assert.equal(hasQuotedRoute(shell, "/command/production-jobcards"), false, "compatibility aliases must not be embedded in the active shell");
assert.ok(hasQuotedRoute(operatingWorkflow, "/command/production-jobcards"), "job-card alias must remain registered as hidden compatibility");
assert.ok(hasQuotedRoute(operatingWorkflow, "/command/ops"), "Ops alias must remain registered as hidden compatibility");
assert.ok(operatingWorkflow.includes("LEGACY_ROUTES"), "compatibility aliases must be owned by the canonical workflow contract");

const decisionInbox = read("src/routes/command/decision-inbox.tsx");
assert.equal(decisionInbox.includes('href={text(item, "route")}'), false);
assert.ok(decisionInbox.includes('to={text(item, "route") as never}'));

const controlTower = read("src/routes/command/control-tower.tsx");
assert.equal(controlTower.includes("href={report.route}"), false);
assert.ok(controlTower.includes("to={report.route as never}"));

const inventory = read("src/routes/inventory.tsx");
assert.equal(hasQuotedRoute(inventory, "/command-login"), false);
assert.ok(inventory.includes('search: { returnTo: "/inventory" }'));

const inventoryLegacy = read("src/routes/command/inventory-legacy.tsx");
assert.equal(inventoryLegacy.includes('href="/inventory"'), false);

const inventoryNav = read("src/components/inventory-workspace-nav.tsx");
assert.equal(inventoryNav.includes('to="/command/inventory-ledgers"'), false);
assert.ok(inventoryNav.includes('to="/command/inventory-ledgers/$ledger"'));
assert.ok(inventoryNav.includes('params={{ ledger: "components" }}'));
assert.ok(inventoryNav.includes('search={{ sku: undefined }}'));

const bomMapping = read("src/routes/command/bom-inventory-mapping.tsx");
assert.equal(hasQuotedRoute(bomMapping, "/command-login"), false);

const aliases = [
  ["phase-4", "/command/sales"],
  ["phase-5", "/command/engineering"],
  ["phase-6", "/command/operations"],
  ["phase-6a", "/command/epr-execution"],
  ["management-intelligence", "/command"],
  ["production-jobcards", "/command/production"],
  ["ops", "/command/operations"],
];
for (const [route, target] of aliases) {
  const source = read(`src/routes/command/${route}.tsx`);
  assert.ok(source.includes(`redirect({ to: "${target}" })`), `${route} must remain a compatibility redirect`);
}

const metadata = read("src/lib/page-metadata.ts");
const routeBlock = (route) => {
  const marker = `"${route}": meta(`;
  const start = metadata.indexOf(marker);
  assert.ok(start >= 0, `${route}: metadata block missing`);
  const end = metadata.indexOf("\n  ),", start);
  assert.ok(end >= 0, `${route}: metadata block malformed`);
  return metadata.slice(start, end + 5);
};
for (const route of [
  "/command/phase-4",
  "/command/phase-5",
  "/command/phase-6",
  "/command/phase-6a",
  "/command/management-intelligence",
  "/command/production-jobcards",
  "/command/ops",
]) {
  assert.ok(routeBlock(route).includes("navHidden: true"), `${route}: compatibility route must stay hidden`);
}

console.log("Route invariants PASS");