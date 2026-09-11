/**
 * Target checks shared by the Playwright capture scripts.
 *
 * Both run Chromium with `--no-sandbox` as root and take their URL and output
 * path from argv, so unchecked they will render `file:///root/.grok/auth.json`
 * into a PNG the agent can read, and write it anywhere.
 */
import { resolve, sep } from "node:path";

const LOOPBACK_HOSTNAMES = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/** http/https loopback only, else exit 1. `BROWSER_ALLOW_EXTERNAL_HOST=1` opts out. */
export function checkedUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    fail(`not a valid URL: ${url}`);
  }
  // Rules out file:, data:, chrome:, view-source:.
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    fail(`only http/https URLs are allowed, got ${parsed.protocol} in ${url}`);
  }
  if (!LOOPBACK_HOSTNAMES.has(parsed.hostname) && process.env.BROWSER_ALLOW_EXTERNAL_HOST !== "1") {
    fail(
      `${parsed.hostname} is not a loopback host; these scripts screenshot the ` +
        `local dev server. Set BROWSER_ALLOW_EXTERNAL_HOST=1 to override.`,
    );
  }
  return url;
}

function portableAllowedDir(dir) {
  // App Builder uses /workspace on Linux.  On Windows that POSIX sentinel is not
  // a meaningful parent of the checkout, so bind it to the actual checkout root
  // instead of rejecting every valid output path.  Other allow-list entries are
  // still resolved normally and no arbitrary directory is added.
  if (process.platform === "win32" && dir === "/workspace") return resolve(process.cwd());
  return resolve(dir);
}

/** Absolute `target` if it is strictly inside `allowedDirs`, else exit 1. */
export function checkedOutputPath(target, allowedDirs, label = "screenshot") {
  // Resolve first so `..` cannot slip past the prefix check. Resolve the allow
  // roots too so separators/case produced by the platform path library match.
  const abs = resolve(target);
  const roots = allowedDirs.map(portableAllowedDir);
  const allowed = roots.some((dir) => abs.startsWith(dir.endsWith(sep) ? dir : dir + sep));
  if (!allowed) {
    fail(`${label} path must be under ${roots.join(" or ")}, got ${abs}`);
  }
  return abs;
}

function fail(message) {
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
}
