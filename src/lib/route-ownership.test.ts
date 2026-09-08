import test from "node:test";
import assert from "node:assert/strict";
import { ERP_FLOW, getErpFlowStep } from "./erp-flow.ts";
import {
  getRouteOwnership,
  navigationGroups,
  PUBLIC_REFERENCE_ROUTES,
  ROUTE_FILE_EXCLUSIONS,
  routeOwnership,
  routeRegistry,
  validateRouteOwnership,
} from "./page-metadata.ts";
import { canAccessRoute } from "./page-access.ts";

test("route ownership metadata is internally complete", () => {
  assert.deepEqual(validateRouteOwnership(), []);
  for (const route of Object.keys(routeOwnership)) {
    const ownership = getRouteOwnership(route);
    assert.ok(ownership);
    assert.ok(["operational", "planning", "reference", "showcase"].includes(ownership.source));
    assert.ok(["read-only", "editable"].includes(ownership.mutability));
  }
});

test("canonical inventory and compatibility boundaries remain explicit", () => {
  assert.equal(getRouteOwnership("/inventory")?.source, "reference");
  assert.equal(getRouteOwnership("/inventory")?.compatibility, true);
  assert.equal(getRouteOwnership("/command/inventory")?.canonicalRoute, "/command/inventory");
  assert.equal(getRouteOwnership("/command/inventory")?.mutability, "editable");
  assert.equal(getRouteOwnership("/command/inventory-ledgers/:ledger")?.mutability, "editable");
  assert.equal(routeRegistry["/command/inventory-truth"].adminOnly, true);
});

test("ERP flow covers nested inventory ledger routes", () => {
  const match = getErpFlowStep("/command/inventory-ledgers/components");
  assert.ok(match);
  assert.equal(match.step, ERP_FLOW[3]);
  assert.equal(match.step.id, "inventory");
});

test("nested inventory ledger pages inherit the parent access policy", () => {
  assert.equal(canAccessRoute("operations", "/command/inventory-ledgers/components"), true);
  assert.equal(canAccessRoute("operations", "/command/inventory-ledgers/stores-tools"), true);
  assert.equal(canAccessRoute("viewer", "/command/inventory-ledgers/components"), false);
  assert.equal(canAccessRoute("operations", "/command/inventory-legacy"), false);
  assert.equal(canAccessRoute("admin", "/command/inventory-legacy"), true);
});

test("normal navigation exposes one inventory workspace and hides legacy pages", () => {
  const inventoryRoutes = Object.values(navigationGroups)
    .flat()
    .filter((page) => page.domain === "inventory")
    .map((page) => page.route);
  assert.deepEqual(inventoryRoutes, ["/command/inventory"]);
  assert.equal(routeRegistry["/inventory"].navHidden, true);
  assert.equal(routeRegistry["/command/inventory-ledgers"].navHidden, true);
});

test("closed-loop transaction surfaces stay inside their canonical workspaces", () => {
  assert.equal(getRouteOwnership("/command/purchase-execution")?.source, "operational");
  assert.equal(getRouteOwnership("/command/receiving")?.canonicalRoute, "/command/receiving");
  assert.equal(getRouteOwnership("/command/payables")?.source, "operational");
  assert.equal(getRouteOwnership("/command/receivables")?.source, "operational");
  assert.equal(getRouteOwnership("/command/decision-inbox")?.mutability, "read-only");

  assert.equal(canAccessRoute("operations", "/command/purchase-execution"), true);
  assert.equal(canAccessRoute("operations", "/command/receiving"), true);
  assert.equal(canAccessRoute("operations", "/command/payables"), false);
  assert.equal(canAccessRoute("finance", "/command/payables"), true);
  assert.equal(canAccessRoute("finance", "/command/receivables"), true);
  assert.equal(canAccessRoute("viewer", "/command/purchase-execution"), false);
  assert.equal(canAccessRoute("viewer", "/command/decision-inbox"), true);
});

test("public and compatibility route contracts remain registered", () => {
  assert.deepEqual(PUBLIC_REFERENCE_ROUTES, [
    "/",
    "/range",
    "/range/$tier",
    "/fit-calculator",
    "/inventory",
  ]);
  assert.equal(getRouteOwnership("/inventory")?.compatibility, true);
  assert.equal(ROUTE_FILE_EXCLUSIONS.has("/command/inventory-ledgers/$ledger"), true);
});

test("external business review is a registered read-only showcase route", () => {
  const route = routeRegistry["/command/investor-pitch-external"];
  assert.equal(route?.label, "External Business Review");
  assert.equal(route?.mode, "showcase");
  assert.equal(route?.group, "Showcase");
  assert.equal(getRouteOwnership(route.route)?.source, "showcase");
  assert.equal(getRouteOwnership(route.route)?.mutability, "read-only");
});
