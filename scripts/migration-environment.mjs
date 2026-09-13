const truthy = new Set(["1", "true", "yes", "on"]);
const falsy = new Set(["0", "false", "no", "off"]);

const value = (env, key) => (typeof env?.[key] === "string" ? env[key].trim() : "");

/**
 * Decide whether this process is authorized to mutate the configured database
 * through deploy-time migrations.
 *
 * Production deploys on the canonical `main` branch are allowed automatically.
 * Preview/branch builds fail closed even when they accidentally inherit the
 * production DATABASE_URL. Unknown/local contexts require the explicit
 * VYNDI_ALLOW_DB_MIGRATIONS=1 override so a developer cannot migrate production
 * merely by having DATABASE_URL in their shell.
 */
export function migrationEnvironmentDecision(env = process.env) {
  const override = value(env, "VYNDI_ALLOW_DB_MIGRATIONS").toLowerCase();
  if (truthy.has(override)) {
    return { allowed: true, reason: "explicit VYNDI_ALLOW_DB_MIGRATIONS override" };
  }
  if (falsy.has(override)) {
    return { allowed: false, reason: "explicit VYNDI_ALLOW_DB_MIGRATIONS deny" };
  }

  const workersBranch = value(env, "WORKERS_CI_BRANCH");
  if (value(env, "WORKERS_CI") === "1" || workersBranch) {
    return workersBranch === "main"
      ? { allowed: true, reason: "Cloudflare Workers production main build" }
      : { allowed: false, reason: `Cloudflare Workers non-production branch ${workersBranch || "unknown"}` };
  }

  const vercelEnvironment = value(env, "VERCEL_ENV");
  const vercelBranch = value(env, "VERCEL_GIT_COMMIT_REF");
  if (value(env, "VERCEL") === "1" || vercelEnvironment || vercelBranch) {
    return vercelEnvironment === "production" && vercelBranch === "main"
      ? { allowed: true, reason: "Vercel production main deployment" }
      : {
          allowed: false,
          reason: `Vercel ${vercelEnvironment || "unknown"} deployment on ${vercelBranch || "unknown"}`,
        };
  }

  const pagesBranch = value(env, "CF_PAGES_BRANCH");
  if (value(env, "CF_PAGES") === "1" || pagesBranch) {
    return pagesBranch === "main"
      ? { allowed: true, reason: "Cloudflare Pages production main build" }
      : { allowed: false, reason: `Cloudflare Pages non-production branch ${pagesBranch || "unknown"}` };
  }

  return {
    allowed: false,
    reason: "unrecognized deployment context; deliberate migrations require VYNDI_ALLOW_DB_MIGRATIONS=1",
  };
}
