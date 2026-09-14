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

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));

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

    for (const route of routes) {
      await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle", timeout: 30_000 });
      assert.doesNotMatch(page.url(), /\/login(?:\?|$)|\/command-login/, `${viewport.name} ${route} lost authenticated access`);
      const body = page.locator("body");
      await body.waitFor({ state: "visible" });
      const text = await body.innerText();
      assert.doesNotMatch(text, /Something went wrong|Cannot read properties of undefined|Internal Server Error/i, `${viewport.name} ${route} rendered a fatal error`);
      assert.ok(text.trim().length > 40, `${viewport.name} ${route} rendered insufficient content`);

      const geometry = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      const overflow = Math.max(geometry.scrollWidth, geometry.bodyScrollWidth) - geometry.innerWidth;
      assert.ok(overflow <= 4, `${viewport.name} ${route} has ${overflow}px page-level horizontal overflow`);
    }

    // Verify the authenticated browser session survives a full protected-route
    // reload; this is distinct from client-side SPA navigation.
    await page.reload({ waitUntil: "networkidle" });
    assert.doesNotMatch(page.url(), /\/login(?:\?|$)|\/command-login/, `${viewport.name} lost its authenticated session on reload`);

    // Exercise server-side revocation once. After logout, the protected route
    // must no longer be reachable in the same browser context.
    if (viewport.name === "desktop-landscape") {
      await page.getByRole("button", { name: /Log out/i }).click();
      await page.waitForURL(/\/login(?:\?|$)/, { timeout: 30_000 });
      await page.goto(`${baseURL}/command`, { waitUntil: "domcontentloaded" });
      await page.waitForURL(/\/login\?returnTo=%2Fcommand/, { timeout: 30_000 });
    }

    assert.deepEqual(pageErrors, [], `${viewport.name} emitted browser page errors: ${pageErrors.join(" | ")}`);
    await context.close();
  }
} finally {
  await browser.close();
}

console.log("[stage-d-browser] individual auth, responsive protected routes, persistence and logout acceptance passed");
