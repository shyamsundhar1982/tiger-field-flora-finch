import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const login = read("src/routes/login.tsx");
const signup = read("src/routes/signup.tsx");
const commandRoute = read("src/routes/command/route.tsx");
const commandAccess = read("src/lib/command-access.ts");
const shell = read("src/components/command-shell-v2.tsx");
const siteHeader = read("src/components/site-header.tsx");
const authApiRoute = read("src/routes/api/auth/$.ts");
const salesEngine = read("src/lib/finance/sales-engine.ts");
const ibpeBrand = read("src/lib/ibpe-brand.ts");
const ibpeProjection = read("src/components/ibpe-workspace-projection.tsx");
const authServer = read("src/lib/auth/server.ts");

test("canonical login preserves the requested protected workspace", () => {
  assert.match(login, /returnTo\?: string/);
  assert.match(login, /safeReturnTo/);
  assert.match(login, /const destination = safeReturnTo\(search\.returnTo\)/);
  assert.match(commandRoute, /search: \{ returnTo: location\.pathname \}/);
});

test("login defers browser Better Auth client loading for Worker SSR", () => {
  assert.doesNotMatch(login, /^import .*authClient.*@\/lib\/auth\/client/m);
  assert.match(login, /await import\("@\/lib\/auth\/client"\)/);
});

test("signup honors Better Auth autoSignIn false contract", () => {
  assert.match(authServer, /autoSignIn: false/);
  assert.match(signup, /to: "\/login"/);
  assert.match(signup, /created: true/);
  assert.match(signup, /email: normalizedEmail/);
  assert.doesNotMatch(signup, /navigate\(\{ to: "\/command" \}\)/);
});

test("individual identity never inherits a legacy shared-password role", () => {
  const start = commandAccess.indexOf("export const getCommandAuthorization");
  const end = commandAccess.indexOf("export const getCommandIdentity");
  const roleAuthority = commandAccess.slice(start, end);
  assert.match(roleAuthority, /resolveCommandAuthorization/);
  assert.match(commandAccess, /\?\? "viewer"/);
  assert.doesNotMatch(roleAuthority, /getLegacyRole\(\).*\?\? "viewer"/s);
});

test("Command route uses production-safe scalar auth contracts and cannot redirect its landing page to itself", () => {
  assert.match(commandRoute, /const access = await getCommandAccess\(\)/);
  assert.match(commandRoute, /const role = await getCommandRole\(\)/);
  assert.doesNotMatch(commandRoute, /getCommandAuthorization\(\)/);
  assert.match(commandRoute, /const routePath = normalizeCommandPath\(location\.pathname\)/);
  assert.match(commandRoute, /if \(routePath === "\/command"\) return/);
  assert.match(commandRoute, /normalizeCommandPath\(preferredTarget\) === routePath \? "\/command" : preferredTarget/);
});

test("public Command entry always routes through canonical credential sign in", () => {
  assert.doesNotMatch(siteHeader, /\{ to: "\/command", label: "Command" \}/);
  assert.match(siteHeader, /const COMMAND_RETURN_TO = "\/command"/);
  assert.match(siteHeader, /to="\/login"/);
  assert.match(siteHeader, /search=\{\{ returnTo: COMMAND_RETURN_TO \}\}/);
});

test("Better Auth API re-wraps handler responses with mutable headers before TanStack cookie finalization", () => {
  assert.match(authApiRoute, /async function handleAuthRequest\(request: Request\): Promise<Response>/);
  assert.match(authApiRoute, /const response = await auth\.handler\(request\)/);
  assert.match(authApiRoute, /return new Response\(response\.body,/);
  assert.match(authApiRoute, /headers: new Headers\(response\.headers\)/);
  assert.match(authApiRoute, /GET: \(\{ request \}\) => handleAuthRequest\(request\)/);
  assert.match(authApiRoute, /POST: \(\{ request \}\) => handleAuthRequest\(request\)/);
});

test("command logout clears legacy compatibility and canonical individual session", () => {
  assert.match(shell, /await lockCommand\(\)\.catch/);
  assert.match(shell, /await signOut\("\/login"\)/);
  assert.doesNotMatch(shell, /navigate\(\{ to: "\/command-login" \}\)/);
});

test("Commercial engine cannot crash when a serialized order payload is not iterable", () => {
  assert.match(salesEngine, /const safeOrders = Array\.isArray\(orders\) \? orders : \[\]/);
  assert.match(salesEngine, /for \(const order of safeOrders\)/);
  assert.match(salesEngine, /const safeRows = Array\.isArray\(rows\) \? rows : \[\]/);
});

test("VIBPE 2.0 is shown without renaming the governed IBPE 1.3 core", () => {
  assert.match(ibpeBrand, /VIBPE_COPILOT_VERSION = "2\.0"/);
  assert.match(ibpeBrand, /IBPE_CORE_LABEL = "IBPE Core 1\.3"/);
  assert.match(ibpeProjection, /VIBPE_COPILOT_LABEL/);
  assert.match(ibpeProjection, /IBPE_CORE_LABEL/);
  assert.doesNotMatch(ibpeProjection, />IBPE 1\.3 ·/);
});
