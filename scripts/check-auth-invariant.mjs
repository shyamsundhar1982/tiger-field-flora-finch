#!/usr/bin/env node
/**
 * Authentication invariant checker.
 *
 * Local mode compares a running dev server's resolved `VITE_AUTH_ENABLED` with
 * the next build. CI mode cannot probe a dev server, so it validates the
 * build-side VYNDI auth contract instead: sign-in must resolve enabled and the
 * canonical Better Auth route, login route and copied auth schema must exist.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { APP_ENV_ROUTE } from "./app-env-plugin.mjs";
import { isMainModule, mergeAppEnv, projectRoot, readAppEnv } from "./with-app-env.mjs";

const DEFAULT_DEV_URL = "http://127.0.0.1:8080";

/** The predicate `src/lib/auth/{client,server}.ts` apply to the flag. */
export function authEnabledFromEnvValue(value) {
  return value !== "false";
}

/**
 * Compare the two resolved values. `null` means "could not observe" — reported
 * as indeterminate rather than as agreement.
 */
export function compareAuthInvariant({ devAuthEnabled, buildAuthEnabled }) {
  const label = (value) => (value ? "on" : "off");
  if (devAuthEnabled === null || devAuthEnabled === undefined) {
    return {
      status: "indeterminate",
      message: "[auth-invariant] could not read the dev server's resolved VITE_AUTH_ENABLED",
    };
  }
  if (devAuthEnabled === buildAuthEnabled) {
    return {
      status: "ok",
      message: `[auth-invariant] dev and build agree: sign-in ${label(devAuthEnabled)}`,
    };
  }
  return {
    status: "diverged",
    message:
      `[auth-invariant] dev server has sign-in ${label(devAuthEnabled)} but the next ` +
      `build has it ${label(buildAuthEnabled)}. Start the app with \`npm run dev\` — ` +
      "invoking vite directly skips scripts/with-app-env.mjs, so the dev server and " +
      "the built output resolve .grok/app-env.json differently.",
  };
}

/**
 * Ask the dev server which env it resolved. Anything but a JSON object from
 * `/__app-env` (no server, a built-output preview, an older workspace without
 * the plugin) is "could not observe".
 */
export async function probeDevAuthEnabled(devUrl, fetchImpl = fetch) {
  let env;
  try {
    const response = await fetchImpl(new URL(APP_ENV_ROUTE, devUrl).href);
    if (!response.ok) return null;
    env = JSON.parse(await response.text());
  } catch {
    return null;
  }
  if (env === null || typeof env !== "object") return null;
  return authEnabledFromEnvValue(env.VITE_AUTH_ENABLED);
}

/** The smoke-verdict warnings for a comparison: a real divergence only. */
export function authInvariantWarnings(result) {
  return result.status === "diverged" ? [result.message] : [];
}

/** What `vite build` / `vite preview` will resolve, via the same wrapper. */
export function buildAuthEnabled(root = projectRoot(), processEnv = process.env) {
  const env = mergeAppEnv(readAppEnv(root), processEnv);
  return authEnabledFromEnvValue(env.VITE_AUTH_ENABLED);
}

/**
 * Headless CI cannot query a running dev server. Instead enforce the production
 * VYNDI build contract so auth cannot silently be disabled or partially wired.
 */
export function checkCiAuthInvariant(root = projectRoot(), processEnv = process.env) {
  const requiredPaths = [
    "src/routes/login.tsx",
    "src/routes/api/auth/$.ts",
    "migrations/0001_auth.sql",
  ];
  const missing = requiredPaths.filter((relativePath) => !existsSync(join(root, relativePath)));
  if (!buildAuthEnabled(root, processEnv)) {
    return {
      status: "diverged",
      message: "[auth-invariant] CI build resolves VITE_AUTH_ENABLED=false; VYNDI production auth must remain enabled.",
    };
  }
  if (missing.length) {
    return {
      status: "diverged",
      message: `[auth-invariant] canonical auth wiring is incomplete: missing ${missing.join(", ")}`,
    };
  }
  return {
    status: "ok",
    message: "[auth-invariant] CI auth contract OK: sign-in enabled, canonical route/API/schema present",
  };
}

async function main(argv) {
  if (argv.includes("--ci")) {
    const result = checkCiAuthInvariant();
    const output = result.status === "ok" ? console.log : console.error;
    output(result.message);
    process.exit(result.status === "ok" ? 0 : 1);
  }

  const devUrlFlag = argv.indexOf("--dev-url");
  const devUrl = devUrlFlag === -1 ? DEFAULT_DEV_URL : argv[devUrlFlag + 1];
  const result = compareAuthInvariant({
    devAuthEnabled: await probeDevAuthEnabled(devUrl),
    buildAuthEnabled: buildAuthEnabled(),
  });
  if (result.status === "ok") {
    console.log(result.message);
    process.exit(0);
  }
  console.error(result.message);
  process.exit(result.status === "diverged" ? 1 : 2);
}

if (isMainModule(import.meta.url)) {
  await main(process.argv.slice(2));
}
