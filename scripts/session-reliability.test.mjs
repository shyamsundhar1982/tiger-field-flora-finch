import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [authServer, authRoute, verifier, errorComponent, acceptance] = await Promise.all([
  readFile(new URL("../src/lib/auth/server.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/api/auth/$.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/auth/verify.server.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/error-component.tsx", import.meta.url), "utf8"),
  readFile(new URL("./stage-d-browser-acceptance.mjs", import.meta.url), "utf8"),
]);

test("Better Auth session lookups use request-safe PostgreSQL transport", () => {
  assert.match(authServer, /requestSafePostgresDialect\(postgresTransport\.connectionString\)/);
  assert.doesNotMatch(authServer, /new Pool\(/);
});

test("session failures expose transport evidence without credential values", () => {
  assert.match(authRoute, /handleAuthRequest\(request\)/);
  assert.match(verifier, /logSessionLookupFailure\(request, error\)/);
  assert.match(authServer, /sessionCookiePresent:/);
  assert.match(authServer, /databaseTransport:/);
  assert.match(authServer, /secretSource:/);
  assert.match(authServer, /failureCategory: authFailureCategory\(error\)/);
  assert.doesNotMatch(authServer, /cookieHeader\s*[,}]/);
});

test("genuine unauthenticated failures return to the protected URL through login", () => {
  assert.match(errorComponent, /error\.message === "Unauthorized"/);
  assert.match(errorComponent, /\/login\?returnTo=\$\{encodeURIComponent\(returnTo\)\}/);
  assert.doesNotMatch(errorComponent, /error\.message === "Failed to get session"/);
});

test("production acceptance crosses the cookie cache twice across the release chain", () => {
  assert.match(acceptance, /STAGE_D_SESSION_CACHE_BOUNDARY_WAIT_MS \|\| 65_000/);
  assert.match(acceptance, /round <= 2/);
  for (const route of [
    "/command",
    "/command/inventory",
    "/command/procurement-planning",
    "/command/production",
    "/command/qa-verification",
    "/command/operations",
    "/command/financial-cockpit",
    "/command/ibpe-operating-workspace",
    "/command/ibpe-operating-workspace/optimizer",
  ]) {
    assert.match(acceptance, new RegExp(`"${route}"`));
  }
  assert.match(acceptance, /Failed to get session/);
});
