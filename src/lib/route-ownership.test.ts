import test from "node:test";
import assert from "node:assert/strict";
import { ERP_FLOW, getErpFlowStep } from "./erp-flow.ts";
import { getRouteOwnership, PUBLIC_REFERENCE_ROUTES, ROUTE_FILE_EXCLUSIONS, routeOwnership, routeRegistry, validateRouteOwnership } from "./page-metadata.ts";

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
  assert.equal(getRouteOwnership("/command/inventory")?.canonicalRoute, "/command/inventory-truth");
  assert.equal(getRouteOwnership("/command/inventory-ledgers/:ledger")?.mutability, "read-only");
  assert.equal(routeRegistry["/command/inventory-truth"].mode, "observe");
});

test("ERP flow covers nested inventory ledger routes", () => {
  const match = getErpFlowStep("/command/inventory-ledgers/movements");
  assert.ok(match);
  assert.equal(match.step, ERP_FLOW[3]);
  assert.equal(match.step.id, "inventory");
});

test("public and compatibility route contracts remain registered", () => {
  assert.deepEqual(PUBLIC_REFERENCE_ROUTES, ["/", "/range", "/range/$tier", "/fit-calculator", "/inventory"]);
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
