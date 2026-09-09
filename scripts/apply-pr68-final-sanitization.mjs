import { readFileSync, writeFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const write = (path, value) => writeFileSync(path, value, "utf8");

function replaceOnce(path, before, after) {
  const source = read(path);
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${path}: expected source fragment not found`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`${path}: expected source fragment is not unique`);
  }
  write(path, source.slice(0, first) + after + source.slice(first + before.length));
}

function removeOnce(path, fragment) {
  replaceOnce(path, fragment, "");
}

function assertContains(path, fragment) {
  if (!read(path).includes(fragment)) throw new Error(`${path}: expected invariant missing: ${fragment}`);
}

function assertNotContains(path, fragment) {
  if (read(path).includes(fragment)) throw new Error(`${path}: forbidden invariant still present: ${fragment}`);
}

// 1) Canonical Supply & Production navigation: no visible compatibility Release route.
removeOnce(
  "src/components/command-shell-v2.tsx",
  '  { to: "/command/production-jobcards", label: "Release" },\n',
);
removeOnce(
  "src/components/command-shell-v2.tsx",
  '  "/command/ops",\n',
);
replaceOnce(
  "src/components/command-shell-v2.tsx",
  '  "/command/management-intelligence",\n  "/command/production-jobcards",\n]);',
  '  "/command/management-intelligence",\n  "/command/production-jobcards",\n  "/command/ops",\n]);',
);

// 2) Legacy Ops becomes an invisible bookmark alias only.
write(
  "src/routes/command/ops.tsx",
  'import { createFileRoute, redirect } from "@tanstack/react-router";\n\n/** Compatibility route: legacy Ops is consolidated into canonical Supply & Production. */\nexport const Route = createFileRoute("/command/ops")({\n  beforeLoad: () => {\n    throw redirect({ to: "/command/operations" });\n  },\n  component: () => null,\n});\n',
);

// 3) Active operational links point straight to canonical Production.
replaceOnce(
  "src/routes/command/epr-live.tsx",
  'to="/command/production-jobcards" className="font-semibold text-accent">Production Job Cards</Link>',
  'to="/command/production" className="font-semibold text-accent">Production</Link>',
);
replaceOnce(
  "src/routes/command/inventory-truth.tsx",
  'to="/command/production-jobcards" className="rounded-lg border border-border px-3 py-2 font-semibold text-muted hover:border-accent hover:text-accent">Production job cards →</Link>',
  'to="/command/production" className="rounded-lg border border-border px-3 py-2 font-semibold text-muted hover:border-accent hover:text-accent">Production →</Link>',
);
replaceOnce(
  "src/routes/command/control-tower.tsx",
  '      route: "/command/production-jobcards",',
  '      route: "/command/production",',
);
removeOnce(
  "src/lib/erp-flow.ts",
  '      "/command/production-jobcards",\n',
);
removeOnce(
  "src/lib/erp-flow.ts",
  '      "/command/management-intelligence",\n',
);
replaceOnce(
  "src/components/ibpe-workspace-projection.tsx",
  '{ routes:["/command/operations","/command/procurement","/command/procurement-planning","/command/purchase-execution","/command/receiving","/command/inventory","/command/production","/command/production-jobcards","/command/manufacturing","/command/quality"], label:"Supply & Production", domains:["supply","inventory","procurement","capacity"] },',
  '{ routes:["/command/operations","/command/procurement","/command/procurement-planning","/command/purchase-execution","/command/receiving","/command/inventory","/command/production","/command/manufacturing","/command/quality"], label:"Supply & Production", domains:["supply","inventory","procurement","capacity"] },',
);
replaceOnce(
  "src/components/ibpe-workspace-projection.tsx",
  '{ routes:["/command","/command/control-tower","/command/decision-inbox","/command/founder-command","/command/management-intelligence","/command/decision-engine"], label:"Command", domains:["planning","demand","supply","inventory","procurement","capacity","finance","funding","governance"] },',
  '{ routes:["/command","/command/control-tower","/command/decision-inbox","/command/founder-command","/command/decision-engine"], label:"Command", domains:["planning","demand","supply","inventory","procurement","capacity","finance","funding","governance"] },',
);

// 4) Dynamic protected links use TanStack client navigation instead of document reloads.
replaceOnce(
  "src/routes/command/decision-inbox.tsx",
  'import { createFileRoute } from "@tanstack/react-router";',
  'import { createFileRoute, Link } from "@tanstack/react-router";',
);
replaceOnce(
  "src/routes/command/decision-inbox.tsx",
  '                    <a\n                      href={text(item, "route")}\n                      className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-xs font-semibold text-fg hover:border-accent hover:text-accent"\n                    >\n                      Open workspace <ArrowRight className="size-4" />\n                    </a>',
  '                    <Link\n                      to={text(item, "route") as never}\n                      className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-xs font-semibold text-fg hover:border-accent hover:text-accent"\n                    >\n                      Open workspace <ArrowRight className="size-4" />\n                    </Link>',
);
replaceOnce(
  "src/routes/command/control-tower.tsx",
  'import { createFileRoute } from "@tanstack/react-router";',
  'import { createFileRoute, Link } from "@tanstack/react-router";',
);
replaceOnce(
  "src/routes/command/control-tower.tsx",
  '        <a href={report.route} className="text-xs font-semibold text-accent hover:underline" onClick={(event) => event.stopPropagation()}>\n          Open authority <ExternalLink className="ml-1 inline size-3" />\n        </a>',
  '        <Link to={report.route as never} className="text-xs font-semibold text-accent hover:underline" onClick={(event) => event.stopPropagation()}>\n          Open authority <ExternalLink className="ml-1 inline size-3" />\n        </Link>',
);
replaceOnce(
  "src/routes/command/control-tower.tsx",
  '              return <a key={report.key} href={report.route} className="flex items-center justify-between rounded-lg border border-border bg-bg/40 px-4 py-3 text-sm hover:border-accent/35">\n                <span><span className="font-medium text-fg">{report.label}</span><span className="ml-2 text-muted">{count} exception{count === 1 ? "" : "s"}</span></span>\n                <span className="text-xs font-semibold text-accent">Resolve →</span>\n              </a>;',
  '              return <Link key={report.key} to={report.route as never} className="flex items-center justify-between rounded-lg border border-border bg-bg/40 px-4 py-3 text-sm hover:border-accent/35">\n                <span><span className="font-medium text-fg">{report.label}</span><span className="ml-2 text-muted">{count} exception{count === 1 ? "" : "s"}</span></span>\n                <span className="text-xs font-semibold text-accent">Resolve →</span>\n              </Link>;',
);

// 5) Legacy Inventory catalogue cannot re-enter the old shared login path.
replaceOnce(
  "src/routes/inventory.tsx",
  '    if (!access) throw redirect({ to: "/command-login" });',
  '    if (!access) throw redirect({ to: "/login", search: { returnTo: "/inventory" } });',
);
removeOnce(
  "src/routes/command/inventory-legacy.tsx",
  '      <div className="flex justify-end">\n        <a href="/inventory" className="text-xs text-subtle hover:text-accent">\n          Open legacy public component reference →\n        </a>\n      </div>\n',
);
replaceOnce(
  "src/components/inventory-workspace-nav.tsx",
  '        <Link to="/command/inventory-ledgers" className="hover:text-accent">\n          Ledger control\n        </Link>',
  '        <Link to="/command/inventory-ledgers/components" className="hover:text-accent">\n          Components ledger\n        </Link>',
);

// 6) Child Command pages do not carry a second legacy authentication policy.
replaceOnce(
  "src/routes/command/bom-inventory-mapping.tsx",
  'import { createFileRoute, redirect } from "@tanstack/react-router";',
  'import { createFileRoute } from "@tanstack/react-router";',
);
removeOnce(
  "src/routes/command/bom-inventory-mapping.tsx",
  'import { getCommandAccess, getCommandRole } from "@/lib/command-access";\n',
);
removeOnce(
  "src/routes/command/bom-inventory-mapping.tsx",
  'import { canAccessRoute } from "@/lib/page-access";\n',
);
replaceOnce(
  "src/routes/command/bom-inventory-mapping.tsx",
  'export const Route=createFileRoute("/command/bom-inventory-mapping")({beforeLoad:async()=>{if(!await getCommandAccess())throw redirect({to:"/command-login"});const role=await getCommandRole();if(!canAccessRoute(role,"/command/bom-inventory-mapping"))throw redirect({to:"/command"});},component:BomInventoryMappingPage});',
  'export const Route = createFileRoute("/command/bom-inventory-mapping")({ component: BomInventoryMappingPage });',
);

// 7) Route metadata retains bookmark aliases but hides them from navigation consumers.
for (const [route, block, replacement] of [
  [
    "/command/management-intelligence",
    '  "/command/management-intelligence": meta(\n    "/command/management-intelligence",\n    "Management Intelligence",\n    "observe",\n    "command",\n    "founder",\n    "keep",\n    "Command",\n  ),',
    '  "/command/management-intelligence": meta(\n    "/command/management-intelligence",\n    "Management Intelligence",\n    "observe",\n    "command",\n    "founder",\n    "keep",\n    "Command",\n    { navHidden: true },\n  ),',
  ],
  [
    "/command/production-jobcards",
    '  "/command/production-jobcards": meta(\n    "/command/production-jobcards",\n    "Production Job Cards",\n    "operate",\n    "manufacturing",\n    "operations",\n    "keep",\n    "Operate",\n  ),',
    '  "/command/production-jobcards": meta(\n    "/command/production-jobcards",\n    "Production Job Cards (compatibility)",\n    "operate",\n    "manufacturing",\n    "operations",\n    "review",\n    "Operate",\n    { navHidden: true },\n  ),',
  ],
  [
    "/command/ops",
    '  "/command/ops": meta(\n    "/command/ops",\n    "Ops (legacy)",\n    "operate",\n    "procurement",\n    "operations",\n    "review",\n    "Operate",\n  ),',
    '  "/command/ops": meta(\n    "/command/ops",\n    "Ops (compatibility)",\n    "operate",\n    "procurement",\n    "operations",\n    "review",\n    "Operate",\n    { navHidden: true },\n  ),',
  ],
]) {
  replaceOnce("src/lib/page-metadata.ts", block, replacement);
  console.log(`[metadata] hid ${route}`);
}
for (const route of ["phase-4", "phase-5", "phase-6", "phase-6a"]) {
  const path = `/command/${route}`;
  const source = read("src/lib/page-metadata.ts");
  const marker = `  "${path}": meta(`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`src/lib/page-metadata.ts: missing ${path}`);
  const end = source.indexOf("\n  ),", start);
  if (end < 0) throw new Error(`src/lib/page-metadata.ts: malformed ${path}`);
  const block = source.slice(start, end + 5);
  if (block.includes("navHidden")) continue;
  const patched = block.replace("\n  ),", "\n    { navHidden: true },\n  ),");
  write("src/lib/page-metadata.ts", source.slice(0, start) + patched + source.slice(end + 5));
}

// 8) Commercial validates server-function contracts before touching collections.
write(
  "src/lib/commercial-response-contract.ts",
  'export function requireArrayResponse<T>(value: unknown, message: string): T[] {\n  if (!Array.isArray(value)) throw new Error(message);\n  return value as T[];\n}\n\nexport function requireRecordResponse<T extends object>(value: unknown, message: string): T {\n  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);\n  return value as T;\n}\n',
);
write(
  "src/lib/commercial-response-contract.test.ts",
  'import assert from "node:assert/strict";\nimport test from "node:test";\nimport { requireArrayResponse, requireRecordResponse } from "./commercial-response-contract.ts";\n\ntest("commercial array contract accepts only arrays", () => {\n  const rows = [{ id: "SO-1" }];\n  assert.equal(requireArrayResponse(rows, "bad"), rows);\n  for (const value of [null, {}, "orders", 1, true]) {\n    assert.throws(() => requireArrayResponse(value, "invalid orders"), /invalid orders/);\n  }\n});\n\ntest("commercial record contract rejects null, arrays and primitives", () => {\n  const record = { 1: { units: 1 } };\n  assert.equal(requireRecordResponse(record, "bad"), record);\n  for (const value of [null, [], "actuals", 1, false]) {\n    assert.throws(() => requireRecordResponse(value, "invalid actuals"), /invalid actuals/);\n  }\n});\n',
);
replaceOnce(
  "src/routes/command/sales.tsx",
  'import { Kpi, Panel } from "@/components/kpi";\n',
  'import { Kpi, Panel } from "@/components/kpi";\nimport { requireArrayResponse, requireRecordResponse } from "@/lib/commercial-response-contract";\n',
);
replaceOnce(
  "src/routes/command/sales.tsx",
  '    setOrders(orderRows);\n    setOrderEdits(Object.fromEntries(orderRows.map((order) => [order.id, { ...order, configuration: { ...(order.configuration ?? {}) } }])));\n    setWriteReadiness(readiness);\n    const compact: Record<number, { units?: number | null; revenue?: number | null }> = {};\n    Object.entries(actualRows).forEach(([month, value]) => {',
  '    const safeOrderRows = requireArrayResponse<SalesOrder>(\n      orderRows,\n      "Commercial order register returned an invalid response. No order data was accepted.",\n    );\n    const safeActualRows = requireRecordResponse<Record<number, { units?: number | null; revenue?: number | null }>>(\n      actualRows,\n      "Commercial actuals register returned an invalid response. No actuals data was accepted.",\n    );\n    const safeReadiness = requireRecordResponse<WriteReadiness>(\n      readiness,\n      "Commercial write-readiness response is invalid. Transactions remain disabled.",\n    );\n    setOrders(safeOrderRows);\n    setOrderEdits(Object.fromEntries(safeOrderRows.map((order) => [order.id, { ...order, configuration: { ...(order.configuration ?? {}) } }])));\n    setWriteReadiness(safeReadiness);\n    const compact: Record<number, { units?: number | null; revenue?: number | null }> = {};\n    Object.entries(safeActualRows).forEach(([month, value]) => {',
);

// 9) Permanent CI route invariant gate. The navigation bridge remains one compatibility cycle only.
write(
  "scripts/check-route-invariants.mjs",
  'import assert from "node:assert/strict";\nimport { readFileSync } from "node:fs";\n\nconst read = (path) => readFileSync(path, "utf8");\nconst active = [\n  "src/routes/command/control-tower.tsx",\n  "src/routes/command/epr-live.tsx",\n  "src/routes/command/inventory-truth.tsx",\n  "src/lib/erp-flow.ts",\n  "src/components/ibpe-workspace-projection.tsx",\n];\nfor (const path of active) {\n  const source = read(path);\n  assert.doesNotMatch(source, /["\\\x27]\\/command\\/production-jobcards["\\\x27]/, `${path}: active workflow must use canonical /command/production`);\n  assert.doesNotMatch(source, /["\\\x27]\\/command\\/management-intelligence["\\\x27]/, `${path}: compatibility Management Intelligence must not remain in active workflow metadata`);\n}\n\nconst shell = read("src/components/command-shell-v2.tsx");\nassert.doesNotMatch(shell, /to:\\s*["\\\x27]\\/command\\/production-jobcards["\\\x27]/, "Supply tabs must not expose compatibility Production Job Cards");\nassert.match(shell, /["\\\x27]\\/command\\/production-jobcards["\\\x27]/, "compatibility alias should remain hidden in LEGACY_ROUTES");\nassert.match(shell, /["\\\x27]\\/command\\/ops["\\\x27]/, "legacy Ops alias should remain hidden in LEGACY_ROUTES");\n\nconst decisionInbox = read("src/routes/command/decision-inbox.tsx");\nassert.doesNotMatch(decisionInbox, /href=\\{text\\(item, ["\\\x27]route["\\\x27]\\)\\}/, "Decision Inbox must use client navigation");\nassert.match(decisionInbox, /to=\\{text\\(item, ["\\\x27]route["\\\x27]\\) as never\\}/);\n\nconst controlTower = read("src/routes/command/control-tower.tsx");\nassert.doesNotMatch(controlTower, /href=\\{report\\.route\\}/, "Control Tower authority links must use client navigation");\nassert.match(controlTower, /to=\\{report\\.route as never\\}/);\n\nconst inventory = read("src/routes/inventory.tsx");\nassert.doesNotMatch(inventory, /["\\\x27]\\/command-login["\\\x27]/, "legacy catalogue must not redirect to legacy Command login");\nassert.match(inventory, /returnTo:\\s*["\\\x27]\\/inventory["\\\x27]/);\n\nconst inventoryLegacy = read("src/routes/command/inventory-legacy.tsx");\nassert.doesNotMatch(inventoryLegacy, /href=["\\\x27]\\/inventory["\\\x27]/, "legacy inventory directory must not expose the standalone catalogue in normal workflow");\n\nconst inventoryNav = read("src/components/inventory-workspace-nav.tsx");\nassert.doesNotMatch(inventoryNav, /to=["\\\x27]\\/command\\/inventory-ledgers["\\\x27]/, "ledger breadcrumb must not bounce to Master Inventory");\nassert.match(inventoryNav, /to=["\\\x27]\\/command\\/inventory-ledgers\\/components["\\\x27]/);\n\nconst bomMapping = read("src/routes/command/bom-inventory-mapping.tsx");\nassert.doesNotMatch(bomMapping, /["\\\x27]\\/command-login["\\\x27]/, "nested Command child must inherit canonical parent auth policy");\n\nfor (const [route, target] of [["phase-4", "/command/sales"], ["phase-5", "/command/engineering"], ["phase-6", "/command/operations"], ["phase-6a", "/command/epr-execution"], ["management-intelligence", "/command"]]) {\n  const source = read(`src/routes/command/${route}.tsx`);\n  assert.match(source, new RegExp(`redirect\\(\\{ to: ["\\\\x27]${target.replaceAll("/", "\\\\/")}["\\\\x27] \\}\\)`), `${route} must remain a compatibility redirect`);\n}\n\nconst ops = read("src/routes/command/ops.tsx");\nassert.match(ops, /redirect\\(\\{ to: ["\\\x27]\\/command\\/operations["\\\x27] \\}\\)/);\nconsole.log("Route invariants PASS");\n',
);

const packagePath = "package.json";
const pkg = JSON.parse(read(packagePath));
pkg.scripts["check:routes"] = "node scripts/check-route-invariants.mjs";
if (!pkg.scripts.test.includes("src/lib/commercial-response-contract.test.ts")) {
  pkg.scripts.test = pkg.scripts.test.replace(
    "src/lib/auth/gate-identity.test.ts",
    "src/lib/auth/gate-identity.test.ts src/lib/commercial-response-contract.test.ts",
  );
}
write(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

replaceOnce(
  ".github/workflows/ci.yml",
  '      - name: Authentication invariant gate\n        run: npm run check:auth -- --ci\n\n      - name: Generate route tree and typecheck',
  '      - name: Authentication invariant gate\n        run: npm run check:auth -- --ci\n\n      - name: Route invariant gate\n        run: npm run check:routes\n\n      - name: Generate route tree and typecheck',
);

replaceOnce(
  "scripts/navigation-routing-regression.test.mjs",
  'test("remaining legacy protected anchors are bridged into TanStack navigation", () => {\n  assert.match(bridge, /document\\.addEventListener\\("click", handleClick\\)/);\n  assert.match(bridge, /destination\\.pathname\\.startsWith\\("\\/command\\/"\\)/);\n  assert.match(bridge, /event\\.preventDefault\\(\\)/);\n  assert.match(bridge, /navigate\\(\\{ to: to as never \\}\\)/);\n  // Action Inbox still contains one legacy dynamic anchor; the bridge is the\n  // compatibility guard until that specialist page is migrated individually.\n  assert.match(decisionInbox, /href=\\{text\\(item, "route"\\)\\}/);\n});',
  'test("protected navigation is client-side while the bridge remains a temporary compatibility guard", () => {\n  assert.match(bridge, /document\\.addEventListener\\("click", handleClick\\)/);\n  assert.match(bridge, /destination\\.pathname\\.startsWith\\("\\/command\\/"\\)/);\n  assert.match(bridge, /event\\.preventDefault\\(\\)/);\n  assert.match(bridge, /navigate\\(\\{ to: to as never \\}\\)/);\n  assert.match(decisionInbox, /to=\\{text\\(item, "route"\\) as never\\}/);\n  assert.doesNotMatch(decisionInbox, /href=\\{text\\(item, "route"\\)\\}/);\n  assert.match(controlTower, /to=\\{report\\.route as never\\}/);\n  assert.doesNotMatch(controlTower, /href=\\{report\\.route\\}/);\n});',
);

// Final source-level invariants before expensive CI starts.
assertNotContains("src/routes/inventory.tsx", '"/command-login"');
assertNotContains("src/routes/command/bom-inventory-mapping.tsx", '"/command-login"');
assertNotContains("src/routes/command/control-tower.tsx", '"/command/production-jobcards"');
assertNotContains("src/routes/command/epr-live.tsx", '"/command/production-jobcards"');
assertNotContains("src/routes/command/inventory-truth.tsx", '"/command/production-jobcards"');
assertNotContains("src/lib/erp-flow.ts", '"/command/production-jobcards"');
assertNotContains("src/components/ibpe-workspace-projection.tsx", '"/command/production-jobcards"');
assertContains("src/routes/command/production-jobcards.tsx", 'redirect({ to: "/command/production" })');
assertContains("src/routes/command/ops.tsx", 'redirect({ to: "/command/operations" })');
console.log("PR #68 final sanitation applied successfully.");
