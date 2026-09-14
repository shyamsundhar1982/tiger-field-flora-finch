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

async function waitForSubstantiveBody(page) {
  await page.locator("body").waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForFunction(
    () => (document.body?.innerText || "").trim().length > 40,
    undefined,
    { timeout: 20_000 },
  );
}

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of viewports) {
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
    // context. This tests direct protected entry while avoiding overlapping
    // TanStack client-router navigations from a previously mounted live page.
    for (const route of routes) {
      const routePage = await context.newPage();
      observePage(routePage);
      try {
        await routePage.goto(`${baseURL}${route}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await waitForSubstantiveBody(routePage);
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

    // Verify the authenticated browser session survives a full protected-route
    // reload; this is distinct from client-side SPA navigation.
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
    await waitForSubstantiveBody(page);
    assert.doesNotMatch(page.url(), /\/login(?:\?|$)|\/command-login/, `${viewport.name} lost its authenticated session on reload`);

    // Exercise server-side revocation once. After logout, probe the revoked
    // session from a fresh page in the SAME context. This preserves the cleared
    // cookie state while avoiding a race with the logout page's own navigation.
    if (viewport.name === "desktop-landscape") {
      await page.getByRole("button", { name: /Log out/i }).click();
      await page.waitForURL(/\/login(?:\?|$)/, { timeout: 30_000 });
      const revokedProbe = await context.newPage();
      observePage(revokedProbe);
      await revokedProbe.goto(`${baseURL}/command`, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await revokedProbe.waitForURL(/\/login\?returnTo=%2Fcommand/, { timeout: 30_000 });
      await revokedProbe.close();
    }

    assert.deepEqual(pageErrors, [], `${viewport.name} emitted browser page errors: ${pageErrors.join(" | ")}`);
    await context.close();
  }
} finally {
  await browser.close();
}

console.log("[stage-d-browser] individual auth, responsive protected routes, persistence and logout acceptance passed");
