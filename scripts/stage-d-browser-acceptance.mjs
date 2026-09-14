import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseURL = process.env.STAGE_D_BASE_URL || "http://127.0.0.1:8080";
const email = process.env.STAGE_D_USER_EMAIL;
const password = process.env.STAGE_D_USER_PASSWORD;
if (!email) throw new Error("STAGE_D_USER_EMAIL is required for Stage D browser acceptance.");
if (!password) throw new Error("STAGE_D_USER_PASSWORD is required for Stage D browser acceptance.");

const viewports = [
  { name: "desktop-landscape", width: 1440, height: 900 },
  { name: "tablet-landscape", width: 1180, height: 820 },
  { name: "mobile", width: 390, height: 844 },
];
const routes = [
  "/command",
  "/command/actuals",
  "/command/ibpe-operating-workspace/assurance",
];
const heavyRoutes = new Set(["/command/ibpe-operating-workspace/assurance"]);

async function waitForSubstantiveBody(page, timeout = 20_000) {
  await page.locator("body").waitFor({ state: "visible", timeout });
  await page.waitForFunction(
    () => (document.body?.innerText || "").trim().length > 40,
    undefined,
    { timeout },
  );
}

async function waitForMutationQuiescence(page, pendingRequests, { timeoutMs = 20_000, quietMs = 1_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let quietSince = null;

  while (Date.now() < deadline) {
    const pendingMutations = [...pendingRequests].filter((request) =>
      ["POST", "PUT", "PATCH", "DELETE"].includes(request.method()),
    );

    if (pendingMutations.length === 0) {
      quietSince ??= Date.now();
      if (Date.now() - quietSince >= quietMs) return;
    } else {
      quietSince = null;
    }

    await page.waitForTimeout(100);
  }

  const pendingMutations = [...pendingRequests]
    .filter((request) => ["POST", "PUT", "PATCH", "DELETE"].includes(request.method()))
    .map((request) => ({
      method: request.method(),
      type: request.resourceType(),
      path: new URL(request.url()).pathname,
    }));
  throw new Error(`Background mutations did not settle before document replacement: ${JSON.stringify(pendingMutations)}`);
}

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of viewports) {
    console.log(`[stage-d-browser] ${viewport.name}: individual login`);
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: "reduce",
    });
    const pageErrors = [];
    const observePage = (observedPage) => {
      observedPage.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));
    };

    const page = await context.newPage();
    observePage(page);

    // Use VYNDI's real individual Better Auth path. The account is disposable
    // and exists only in this job's ephemeral PostgreSQL service.
    await page.goto(`${baseURL}/login?returnTo=%2Fcommand`, { waitUntil: "networkidle" });
    await page.getByLabel(/Authorised Email/i).fill(email);
    await page.getByLabel(/^Password$/i).fill(password);
    const submit = page.getByRole("button", { name: /Authorize · Enter Command/i });
    await submit.click();

    try {
      await page.waitForURL(/\/command(?:\/|$)/, { timeout: 30_000 });
    } catch (error) {
      const alert = page.getByRole("alert");
      const alertText = (await alert.count()) ? (await alert.first().innerText()).trim() : "<no login error rendered>";
      const cookieNames = (await context.cookies()).map(({ name }) => name);
      const bearerPresent = await page.evaluate(() => Boolean(window.sessionStorage.getItem("grok-auth.bearer-token"))).catch(() => false);
      throw new Error(
        `${viewport.name} individual login did not reach Command; url=${page.url()}; alert=${alertText}; cookieNames=${JSON.stringify(cookieNames)}; bearerPresent=${bearerPresent}`,
        { cause: error },
      );
    }

    const authenticatedCookieNames = (await context.cookies()).map(({ name }) => name);
    const bearerPresent = await page.evaluate(() => Boolean(window.sessionStorage.getItem("grok-auth.bearer-token"))).catch(() => false);
    assert.ok(
      authenticatedCookieNames.some((name) => name.includes("grok-auth") || name.includes("better-auth")) || bearerPresent,
      `${viewport.name} reached Command without observable Better Auth session transport`,
    );

    // Probe each protected route from a fresh page in the same authenticated
    // context. Assurance intentionally has a larger navigation budget because it
    // aggregates governed evidence across multiple backend authorities. All
    // other routes retain the normal 30-second acceptance budget.
    for (const route of routes) {
      console.log(`[stage-d-browser] ${viewport.name}: protected route ${route}`);
      const routePage = await context.newPage();
      observePage(routePage);
      const heavy = heavyRoutes.has(route);
      try {
        await routePage.goto(`${baseURL}${route}`, {
          waitUntil: "domcontentloaded",
          timeout: heavy ? 90_000 : 30_000,
        });
        await waitForSubstantiveBody(routePage, heavy ? 60_000 : 20_000);
        assert.doesNotMatch(routePage.url(), /\/login(?:\?|$)|\/command-login/, `${viewport.name} ${route} lost authenticated access`);
        const text = await routePage.locator("body").innerText();
        assert.doesNotMatch(text, /Something went wrong|Cannot read properties of undefined|Internal Server Error/i, `${viewport.name} ${route} rendered a fatal error`);
        assert.ok(text.trim().length > 40, `${viewport.name} ${route} rendered insufficient content`);

        const geometry = await routePage.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          bodyScrollWidth: document.body.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        const overflow = Math.max(geometry.scrollWidth, geometry.bodyScrollWidth) - geometry.innerWidth;
        assert.ok(overflow <= 4, `${viewport.name} ${route} has ${overflow}px page-level horizontal overflow`);
      } finally {
        await routePage.close();
      }
    }

    // Verify the authenticated browser session survives a second top-level
    // document request in the SAME page and browser context. The cache-busting
    // query forces SSR + Better Auth + role authorization to execute again while
    // avoiding the local Vite/workerd same-URL reload cache path, which can hang
    // despite all application requests being quiescent. This remains a full
    // document replacement, not a TanStack client-router transition.
    const persistenceProbe = await context.newPage();
    observePage(persistenceProbe);
    const pendingRequests = new Set();
    persistenceProbe.on("request", (request) => pendingRequests.add(request));
    persistenceProbe.on("requestfinished", (request) => pendingRequests.delete(request));
    persistenceProbe.on("requestfailed", (request) => pendingRequests.delete(request));
    try {
      console.log(`[stage-d-browser] ${viewport.name}: session persistence`);
      await persistenceProbe.goto(`${baseURL}/command`, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await waitForSubstantiveBody(persistenceProbe);
      assert.doesNotMatch(persistenceProbe.url(), /\/login(?:\?|$)|\/command-login/, `${viewport.name} lost its authenticated session before document replacement`);
      await waitForMutationQuiescence(persistenceProbe, pendingRequests);

      const persistenceUrl = `${baseURL}/command?stage_d_session_probe=${Date.now()}`;
      const response = await persistenceProbe.goto(persistenceUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
      assert.ok(response?.ok(), `${viewport.name} persistence document returned HTTP ${response?.status() ?? "none"}`);
      await waitForSubstantiveBody(persistenceProbe);
      assert.doesNotMatch(persistenceProbe.url(), /\/login(?:\?|$)|\/command-login/, `${viewport.name} lost its authenticated session on second document navigation`);
      const reloadedText = await persistenceProbe.locator("body").innerText();
      assert.doesNotMatch(reloadedText, /Something went wrong|Cannot read properties of undefined|Internal Server Error/i, `${viewport.name} second document rendered a fatal error`);
    } catch (error) {
      console.error("[stage-d-browser] persistence failure", {
        viewport: viewport.name,
        pending: [...pendingRequests].map((request) => ({
          method: request.method(),
          type: request.resourceType(),
          path: new URL(request.url()).pathname,
        })),
        pageErrors,
      });
      throw error;
    } finally {
      await persistenceProbe.close().catch(() => {});
    }

    // Exercise server-side revocation once. Use a fresh authenticated page for
    // logout, then probe the revoked session from another page in the SAME
    // context. This preserves shared cookie state and avoids stale-page races.
    if (viewport.name === "desktop-landscape") {
      console.log(`[stage-d-browser] ${viewport.name}: logout and revocation`);
      const logoutPage = await context.newPage();
      observePage(logoutPage);
      try {
        await logoutPage.goto(`${baseURL}/command`, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await waitForSubstantiveBody(logoutPage);
        assert.doesNotMatch(logoutPage.url(), /\/login(?:\?|$)|\/command-login/, `${viewport.name} was not authenticated before logout`);
        await logoutPage.getByRole("button", { name: /Log out/i }).click();
        await logoutPage.waitForURL(/\/login(?:\?|$)/, { timeout: 30_000 });
      } finally {
        await logoutPage.close().catch(() => {});
      }

      const revokedProbe = await context.newPage();
      observePage(revokedProbe);
      try {
        await revokedProbe.goto(`${baseURL}/command`, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await revokedProbe.waitForURL(/\/login\?returnTo=%2Fcommand/, { timeout: 30_000 });
      } finally {
        await revokedProbe.close().catch(() => {});
      }
    }

    assert.deepEqual(pageErrors, [], `${viewport.name} emitted browser page errors: ${pageErrors.join(" | ")}`);
    await context.close();
  }
} finally {
  await browser.close();
}

console.log("[stage-d-browser] individual auth, responsive protected routes, persistence and logout acceptance passed");
