import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTH_ALLOWED_HOSTS,
  AUTH_TRUSTED_ORIGINS,
  CLOUDFLARE_PRODUCTION_ORIGIN,
  resolveAuthBaseURL,
  resolveAuthSecret,
} from "./runtime-config.ts";

test("Cloudflare and the exact Vercel production hostname are allowed", () => {
  assert.ok(AUTH_ALLOWED_HOSTS.includes("tiger-field-flora-finch.shyamsundhar1982.workers.dev"));
  assert.ok(AUTH_ALLOWED_HOSTS.includes("tiger-field-flora-finch.vercel.app"));
  assert.ok(AUTH_TRUSTED_ORIGINS.includes("https://tiger-field-flora-finch.vercel.app"));
});

test("auth base URL resolves dynamically with Cloudflare as the safe fallback", () => {
  assert.deepEqual(resolveAuthBaseURL(undefined), {
    allowedHosts: [...AUTH_ALLOWED_HOSTS],
    fallback: CLOUDFLARE_PRODUCTION_ORIGIN,
    protocol: "auto",
  });
  assert.equal(resolveAuthBaseURL("https://example.test").fallback, "https://example.test");
});

test("database-backed authentication refuses an unstable process-local secret", () => {
  assert.throws(
    () =>
      resolveAuthSecret({
        configuredSecret: undefined,
        databaseUrl: "postgres://configured",
        authDisabled: false,
        previewSecret: () => "unstable-preview-secret",
      }),
    /BETTER_AUTH_SECRET is required/,
  );
});

test("preview fallback remains available without a production database", () => {
  assert.equal(
    resolveAuthSecret({
      configuredSecret: undefined,
      databaseUrl: undefined,
      authDisabled: false,
      previewSecret: () => "preview-secret",
    }),
    "preview-secret",
  );
});
