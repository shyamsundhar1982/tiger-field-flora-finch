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
  "/command/inventory",
  "/command/engineering",
  "/command/operations",
  "/command/actuals",
  "/command/ibpe-operating-workspace/assurance",
];
const ROUTE_GOTO_TIMEOUT_MS = {
  "/command": 30_000,
  "/command/inventory": 30_000,
  "/command/engineering": 30_000,
  "/command/operations": 30_000,
  "/command/actuals": 30_000,
  "/command/ibpe-operating-workspace/assurance": 90_000,
};
const ROUTE_BODY_TIMEOUT_MS = {
  "/command": 20_000,
  "/command/inventory": 20_000,
  "/command/engineering": 20_000,
  "/command/operations": 20_000,
  "/command/actuals": 20_000,
  "/command/ibpe-operating-workspace/assurance": 60_000,
};
const REQUIRED_FULL_VIEW_ROUTES = new Set(["/command/inventory", "/command/engineering"]);

async function waitForSubstantiveBody(page, timeout = 20_000) {
  await page.locator("body").waitFor({ state: "visible", timeout });
  await page.waitForFunction(
    () => (document.body?.innerText || "").trim().length > 40,
    undefined,
    { timeout },
  );
}

async function assertFullViewRegisters(page, viewportName, route, timeout = 20_000) {
  const registers = page.locator("[data-full-view-table]");
  if (REQUIRED_FULL_VIEW_ROUTES.has(route)) {
    await registers.first().waitFor({ state: "visible", timeout });
  }
  const count = await registers.count();
  if (REQUIRED_FULL_VIEW_ROUTES.has(route)) {
    assert.ok(count > 0, `${viewportName} ${route} rendered no full-view register`);
  }

  for (let index = 0; index < count; index += 1) {
    const register = registers.nth(index);
    const geometry = await register.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        id: element.getAttribute("data-full-view-table") || "full-view-register",
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        overflowX: style.overflowX,
      };
    });
    if (geometry.clientWidth === 0) continue;
    const overflow = geometry.scrollWidth - geometry.clientWidth;
    assert.ok(
      overflow <= 4,
      `${viewportName} ${route} full-view register ${geometry.id} has ${overflow}px internal horizontal overflow`,
    );
    assert.doesNotMatch(
      geometry.overflowX,
      /auto|scroll/i,
      `${viewportName} ${route} full-view register ${geometry.id} exposes a horizontal scrolling surface`,
    );
  }
}

async function captureTextNodes(page) {
  return page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node = walker.nextNode();
    while (node) {
      const text = String(node.textContent || "").replace(/\s+/g, " ").trim();
      if (text) nodes.push(text);
      node = walker.nextNode();
    }
    return nodes;
  });
}

async function diagnoseHydrationMismatch(browser, context, viewport, route, hydratedPage) {
  const hydratedNodes = await captureTextNodes(hydratedPage).catch(() => []);
  const storageState = await context.storageState();
  const serverContext = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    reducedMotion: "reduce",
    javaScriptEnabled: false,
    storageState,
  });
  try {
    const serverPage = await serverContext.newPage();
    const response = await serverPage.goto(`${baseURL}${route}`, {
      waitUntil: "domcontentloaded",
      timeout: ROUTE_GOTO_TIMEOUT_MS[route] ?? 30_000,
    });
    await serverPage.locator("body").waitFor({ state: "visible", timeout: 20_000 });
    const serverNodes = await captureTextNodes(serverPage);
    const max = Math.max(serverNodes.length, hydratedNodes.length);
    const differences = [];
    for (let index = 0; index < max && differences.length < 12; index += 1) {
      if (serverNodes[index] === hydratedNodes[index]) continue;
      differences.push({
        index,
        server: serverNodes[index] ?? "<missing>",
        hydrated: hydratedNodes[index] ?? "<missing>",
      });
    }
    console.error(`[stage-d-browser] hydration text diagnostic for ${viewport.name} ${route}`, {
      serverUrl: serverPage.url(),
      serverHttp: response?.status() ?? null,
      serverTextNodes: serverNodes.length,
      hydratedTextNodes: hydratedNodes.length,
      differences,
    });
  } catch (error) {
    console.error(`[stage-d-browser] hydration diagnostic failed for ${viewport.name} ${route}`, String(error));
  } finally {
    await serverContext.close().catch(() => {});
  }
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
      console.log(`[stage-d-browser] ${viewport.name}: protected route ${route}`);
      const routePage = await context.newPage();
      const routeErrorStart = pageErrors.length;
      observePage(routePage);
      const gotoTimeout = ROUTE_GOTO_TIMEOUT_MS[route] ?? 30_000;
      const bodyTimeout = ROUTE_BODY_TIMEOUT_MS[route] ?? 20_000;
      const navigationStartedAt = Date.now();
      try {
        await routePage.goto(`${baseURL}${route}`, {
          waitUntil: "domcontentloaded",
          timeout: gotoTimeout,
        });
        console.log(
          `[stage-d-browser] ${viewport.name}: ${route} DOMContentLoaded in ${Date.now() - navigationStartedAt}ms`,
        );
        await waitForSubstantiveBody(routePage, bodyTimeout);
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
        if (overflow > 4) {
          const overflowDiagnostics = await routePage.evaluate(() => {
            const viewportWidth = window.innerWidth;
            return [...document.querySelectorAll("*")]
              .map((el) => {
                const rect = el.getBoundingClientRect();
                return {
                  tag: el.tagName,
                  className: typeof el.className === "string" ? el.className.slice(0, 180) : "",
                  text: (el.textContent || "").trim().slice(0, 120),
                  left: Math.round(rect.left),
                  right: Math.round(rect.right),
                  width: Math.round(rect.width),
                };
              })
              .filter((item) => item.right > viewportWidth + 4 || item.left < -4)
              .slice(0, 20);
          });
          console.error(`[stage-d-browser] overflow diagnostics for ${viewport.name} ${route}`, overflowDiagnostics);
        }
        assert.ok(overflow <= 4, `${viewport.name} ${route} has ${overflow}px page-level horizontal overflow`);
        await assertFullViewRegisters(routePage, viewport.name, route, bodyTimeout);

        const routeErrors = pageErrors.slice(routeErrorStart);
        if (routeErrors.some((message) => message.includes("React error #418"))) {
          await diagnoseHydrationMismatch(browser, context, viewport, route, routePage);
        }
        if (pageErrors.length) {
          console.error(`[stage-d-browser] pageerrors after ${viewport.name} ${route}`, pageErrors);
        }
        assert.deepEqual(
          pageErrors,
          [],
          `${viewport.name} ${route} emitted browser page errors: ${pageErrors.join(" | ")}`,
        );
      } catch (error) {
        console.error(
          `[stage-d-browser] ${viewport.name}: ${route} failed after ${Date.now() - navigationStartedAt}ms`,
          { pageErrors },
        );
        throw error;
      } finally {
        await routePage.close();
      }
    }

    await page.waitForTimeout(2_000);

    const persistenceProbe = await context.newPage();
    observePage(persistenceProbe);
    const pendingRequests = new Set();
    persistenceProbe.on("request", (request) => pendingRequests.add(request));
    persistenceProbe.on("requestfinished", (request) => pendingRequests.delete(request));
    persistenceProbe.on("requestfailed", (request) => pendingRequests.delete(request));
    try {
      console.log(`[stage-d-browser] ${viewport.name}: session persistence`);
      const firstPersistenceStartedAt = Date.now();
      await persistenceProbe.goto(`${baseURL}/command`, {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
      });
      console.log(
        `[stage-d-browser] ${viewport.name}: post-heavy /command DOMContentLoaded in ${Date.now() - firstPersistenceStartedAt}ms`,
      );
      await waitForSubstantiveBody(persistenceProbe, 40_000);
      assert.doesNotMatch(persistenceProbe.url(), /\/login(?:\?|$)|\/command-login/, `${viewport.name} lost its authenticated session before document replacement`);
      await waitForMutationQuiescence(persistenceProbe, pendingRequests);

      const persistenceUrl = `${baseURL}/command?stage_d_session_probe=${Date.now()}`;
      const secondProbe = await context.newPage();
      observePage(secondProbe);
      try {
        const secondStartedAt = Date.now();
        const secondResponse = await secondProbe.goto(persistenceUrl, {
          waitUntil: "domcontentloaded",
          timeout: 60_000,
        });
        console.log(
          `[stage-d-browser] ${viewport.name}: cache-busted /command DOMContentLoaded in ${Date.now() - secondStartedAt}ms (HTTP ${secondResponse?.status() ?? "none"})`,
        );
        await waitForSubstantiveBody(secondProbe, 30_000);
        assert.doesNotMatch(
          secondProbe.url(),
          /\/login(?:\?|$)|\/command-login/,
          `${viewport.name} lost its authenticated session on second document navigation`,
        );
        if (secondResponse && !secondResponse.ok()) {
          throw new Error(
            `${viewport.name} persistence document returned HTTP ${secondResponse.status()} at ${secondProbe.url()}`,
          );
        }
        const reloadedText = await secondProbe.locator("body").innerText();
        assert.doesNotMatch(
          reloadedText,
          /Something went wrong|Cannot read properties of undefined|Internal Server Error/i,
          `${viewport.name} second document rendered a fatal error`,
        );
        assert.ok(reloadedText.trim().length > 40, `${viewport.name} second document rendered insufficient content`);
      } finally {
        await secondProbe.close().catch(() => {});
      }
      if (pageErrors.length) {
        console.error(`[stage-d-browser] pageerrors after ${viewport.name} persistence`, pageErrors);
      }
      assert.deepEqual(
        pageErrors,
        [],
        `${viewport.name} persistence emitted browser page errors: ${pageErrors.join(" | ")}`,
      );
    } catch (error) {
      const pending = [...pendingRequests].map((request) => ({
        method: request.method(),
        type: request.resourceType(),
        path: new URL(request.url()).pathname,
      }));
      console.error("[stage-d-browser] persistence failure", {
        viewport: viewport.name,
        url: persistenceProbe.url(),
        pending,
        pageErrors,
      });
      throw error;
    } finally {
      await persistenceProbe.close().catch(() => {});
    }

    if (viewport.name === "desktop-landscape") {
      console.log(`[stage-d-browser] ${viewport.name}: logout and revocation`);
      const logoutPage = await context.newPage();
      observePage(logoutPage);
      try {
        await logoutPage.goto(`${baseURL}/command`, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await waitForSubstantiveBody(logoutPage);
        assert.doesNotMatch(logoutPage.url(), /\/login(?:\?|$)|\/command-login/, `${viewport.name} was not authenticated before logout`);
        const logoutButton = logoutPage.getByRole("button", { name: /Log out/i });
        const logoutCount = await logoutButton.count();
        assert.ok(logoutCount > 0, `${viewport.name} Log out control not found before revocation (count=${logoutCount})`);
        await logoutButton.click();
        try {
          await logoutPage.waitForURL(/\/login(?:\?|$)/, { timeout: 30_000 });
        } catch (error) {
          const alert = logoutPage.getByRole("alert");
          const alertText = (await alert.count()) ? (await alert.first().innerText()).trim() : "<no alert>";
          throw new Error(
            `${viewport.name} logout did not reach /login; url=${logoutPage.url()}; alert=${alertText}`,
            { cause: error },
          );
        }
      } finally {
        await logoutPage.close().catch(() => {});
      }

      const revokedProbe = await context.newPage();
      observePage(revokedProbe);
      try {
        await revokedProbe.goto(`${baseURL}/command`, { waitUntil: "domcontentloaded", timeout: 30_000 });
        try {
          await revokedProbe.waitForURL(/\/login\?returnTo=%2Fcommand/, { timeout: 30_000 });
        } catch (error) {
          throw new Error(
            `${viewport.name} revoked session still reached protected Command; url=${revokedProbe.url()}`,
            { cause: error },
          );
        }
      } finally {
        await revokedProbe.close().catch(() => {});
      }
    }

    if (pageErrors.length) {
      console.error(`[stage-d-browser] residual pageerrors at end of ${viewport.name}`, pageErrors);
    }
    assert.deepEqual(pageErrors, [], `${viewport.name} emitted browser page errors: ${pageErrors.join(" | ")}`);
    await context.close();
  }
} finally {
  await browser.close();
}

console.log("[stage-d-browser] individual auth, full-view responsive routes, persistence and logout acceptance passed");
