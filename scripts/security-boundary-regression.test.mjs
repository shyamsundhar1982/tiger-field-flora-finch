import assert from "node:assert/strict";
import test from "node:test";
import { AUTH_TRUSTED_ORIGINS, CLOUDFLARE_PRODUCTION_ORIGIN } from "../src/lib/auth/runtime-config.ts";
import { canPerform, hasPermission } from "../src/lib/page-access.ts";

test("auth trusted origins never permit an unrestricted wildcard or remote plain HTTP origin", () => {
  assert.ok(AUTH_TRUSTED_ORIGINS.includes(CLOUDFLARE_PRODUCTION_ORIGIN));
  assert.ok(!AUTH_TRUSTED_ORIGINS.includes("*"));
  assert.ok(!AUTH_TRUSTED_ORIGINS.includes("https://*"));
  for (const origin of AUTH_TRUSTED_ORIGINS) {
    if (origin.startsWith("http://")) {
      assert.match(origin, /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/);
    } else {
      assert.match(origin, /^https:\/\//);
    }
  }
});

test("unauthenticated and viewer identities cannot mutate or approve", () => {
  for (const role of [null, "viewer"]) {
    assert.equal(canPerform(role, "edit"), false);
    assert.equal(canPerform(role, "approve"), false);
    assert.equal(canPerform(role, "admin"), false);
  }
});

test("management cannot self-escalate into approval or administration", () => {
  assert.equal(hasPermission("management", "view"), true);
  assert.equal(hasPermission("management", "edit"), true);
  assert.equal(hasPermission("management", "approve"), false);
  assert.equal(hasPermission("management", "admin"), false);
});

test("functional approvers cannot gain administrator permission", () => {
  for (const role of ["finance", "operations", "engineering", "qa", "compliance"]) {
    assert.equal(hasPermission(role, "approve"), true);
    assert.equal(hasPermission(role, "admin"), false);
  }
  assert.equal(hasPermission("admin", "admin"), true);
});
