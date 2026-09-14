import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseURL = process.env.STAGE_D_BASE_URL || "http://127.0.0.1:8080";
const password = process.env.COMMAND_PASSWORD;
if (!password) throw new Error("COMMAND_PASSWORD is required for Stage D browser acceptance.");

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

function redactSetCookie(raw) {
  const pieces = raw.split(";").map((part) => part.trim()).filter(Boolean);
  const pair = pieces.shift() || "";
  const equals = pair.indexOf("=");
  const name = equals >= 0 ? pair.slice(0, equals).trim() : pair.trim();
  return [name || "<unnamed-cookie>", ...pieces].join("; ");
}

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();
    const pageErrors = [];
    const setCookieTrace = [];
    let captureLoginCookies = false;
    page.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));
    page.on("response", async (response) => {
      if (!captureLoginCookies) return;
      try {
        const headers = await response.headersArray();
        const cookies = headers
          .filter((header) => header.name.toLowerCase() === "set-cookie")
          .map((header) => redactSetCookie(header.value));
        if (cookies.length) {
          setCookieTrace.push({ url: response.url(), status: response.status(), cookies });
        }
      } catch {
        // Diagnostics must never make the acceptance test itself fail.
      }
    });

    // Wait for Vite/React hydration before editing controlled form fields. If
    // values are written at DOMContentLoaded, hydration can legitimately replace
    // the DOM value while React state is still empty, leaving Submit disabled.
    await page.goto(`${baseURL}/command-login`, { waitUntil: "networkidle" });
    const username = page.getByLabel(/Email or legacy username/i);
    const passwordField = page.getByLabel(/^Password$/i);
    const submit = page.getByRole("button", { name: /Use legacy Command access/i });
    await username.fill("admin");
    await passwordField.fill(password);
    await page.waitForFunction(() => {
      const button = document.querySelector('button[type="submit"]');
      return button instanceof HTMLButtonElement && !button.disabled;
    });
    captureLoginCookies = true;
    await submit.click();

    // Give the server function + client redirect a bounded interval, then expose
    // actionable diagnostics if the protected route was not reached. Only cookie
    // names/attributes are logged; no cookie values or credentials are emitted.
    try {
      await page.waitForURL(/\/command(?:\/|$)/, { timeout: 20_000 });
    } catch (error) {
      const alert = page.getByRole("alert");
      const alertText = (await alert.count()) ? (await alert.first().innerText()).trim() : "<no login error rendered>";
      const cookies = (await context.cookies()).map(({ name, domain, path, secure, httpOnly, sameSite }) => ({
        name,
        domain,
        path,
        secure,
        httpOnly,
        sameSite,
      }));
      throw new Error(
        `${viewport.name} legacy login did not persist; url=${page.url()}; alert=${alertText}; cookies=${JSON.stringify(cookies)}; setCookieTrace=${JSON.stringify(setCookieTrace)}`,
        { cause: error },
      );
    } finally {
      captureLoginCookies = false;
    }

    for (const route of routes) {
      await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle", timeout: 30_000 });
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

    // The server-owned legacy cookie must survive a reload. This verifies the
    // persistence boundary independently for every accepted viewport.
    await page.reload({ waitUntil: "networkidle" });
    assert.doesNotMatch(page.url(), /\/login(?:\?|$)|\/command-login/, `${viewport.name} lost its authenticated session on reload`);

    // Exercise logout revocation once on the desktop path. After the logout the
    // protected Command route must redirect back to the canonical login screen.
    if (viewport.name === "desktop-landscape") {
      await page.getByRole("button", { name: /Log out/i }).click();
      await page.waitForURL(/\/login(?:\?|$)/, { timeout: 20_000 });
      await page.goto(`${baseURL}/command`, { waitUntil: "domcontentloaded" });
      await page.waitForURL(/\/login\?returnTo=%2Fcommand/, { timeout: 20_000 });
    }

    assert.deepEqual(pageErrors, [], `${viewport.name} emitted browser page errors: ${pageErrors.join(" | ")}`);
    await context.close();
  }
} finally {
  await browser.close();
}

console.log("[stage-d-browser] responsive protected-route, persistence and logout acceptance passed");
