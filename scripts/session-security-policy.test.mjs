import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  SESSION_COOKIE_CACHE_MAX_AGE_SECONDS,
  SESSION_EXPIRES_IN_SECONDS,
  SESSION_UPDATE_AGE_SECONDS,
  VYNDI_SESSION_POLICY,
} from "../src/lib/auth/session-policy.ts";

const authServer = readFileSync(new URL("../src/lib/auth/server.ts", import.meta.url), "utf8");

test("VYNDI sessions expire within 24 hours and refresh no more than hourly", () => {
  assert.equal(SESSION_EXPIRES_IN_SECONDS, 86_400);
  assert.equal(SESSION_UPDATE_AGE_SECONDS, 3_600);
  assert.equal(VYNDI_SESSION_POLICY.expiresIn, 86_400);
  assert.equal(VYNDI_SESSION_POLICY.updateAge, 3_600);
});

test("revoked-session cookie cache exposure is bounded to one minute", () => {
  assert.equal(SESSION_COOKIE_CACHE_MAX_AGE_SECONDS, 60);
  assert.deepEqual(VYNDI_SESSION_POLICY.cookieCache, { enabled: true, maxAge: 60 });
});

test("Better Auth server consumes the centralized policy and revokes sessions on password reset", () => {
  assert.match(authServer, /session:\s*VYNDI_SESSION_POLICY/);
  assert.match(authServer, /revokeSessionsOnPasswordReset:\s*true/);
  assert.match(authServer, /autoSignIn:\s*false/);
});
