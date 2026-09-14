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
const ROUTE_GOTO_TIMEOUT_MS = {
  "/command": 30_000,
  "/command/actuals": 30_000,
  "/command/ibpe-operating-workspace/assurance": 90_000,
};
const ROUTE_BODY_TIMEOUT_MS = {
  "/command": 20_000,
  "/command/actuals": 20_000,
  "/command/ibpe-operating-workspace/assurance": 60_000,
};

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
    // context. Assurance intentionally has a larger navigation/body budget because
    // it aggregates governed evidence across multiple backend authorities. The
    // exception is explicit and timed so a green gate cannot conceal a slow route.
    for (const route of routes) {
      console.log(`[stage-d-browser] ${viewport.name}: protected route ${route}`);
      const routePage = await context.newPage();
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
        // Fail fast on pageerrors so a desktop Assurance exception cannot hide
        // behind later persistence/logout work and a late end-of-viewport assert.
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

    // Brief settle after the heavy Assurance probe so the single Worker process
    // can finish any leftover SSR / DB work before the next full document.
    await page.waitForTimeout(2_000);

    // Verify the authenticated browser session survives a second top-level
    // document request in the SAME page and browser context. The cache-busting
    // query forces SSR + Better Auth + role authorization to execute again while
    // avoiding the local Vite/workerd same-URL reload cache path, which can hang
    // despite all application requests being quiescent. This remains a full
    // document replacement, not a TanStack client-router transition.
    //
    // Post-Assurance first persistence hop uses a 90s recovery budget; the
    // second (cache-busted) hop is judged by document outcome, not only the
    // Playwright Response handle (which can be null under Vite /@react-refresh).
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

      // Second hop is a cache-busted full document reload. After the heavy Assurance
      // route, Vite/workerd can still be serving /@react-refresh and the goto
      // response object may be null even when the document lands correctly. Prefer
      // document outcome (URL + body) over the Playwright Response handle, and retry
      // once if the navigation handle is missing or non-OK.
      const persistenceUrl = `${baseURL}/command?stage_d_session_probe=${Date.now()}`;
      await page.waitForTimeout(1_000);
      let secondResponse = null;
      let secondError = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          secondResponse = await persistenceProbe.goto(persistenceUrl, {
            waitUntil: "domcontentloaded",
            timeout: 45_000,
          });
          if (secondResponse?.ok()) break;
          // Null or non-OK response: still accept if the document is the authenticated Command shell.
          await waitForSubstantiveBody(persistenceProbe, 20_000);
          if (!/\/login(?:\?|$)|\/command-login/.test(persistenceProbe.url())) break;
          secondError = new Error(
            `${viewport.name} persistence hop ${attempt} returned HTTP ${secondResponse?.status() ?? "none"} at ${persistenceProbe.url()}`,
          );
        } catch (error) {
          secondError = error;
          if (attempt === 2) throw error;
          console.error(`[stage-d-browser] ${viewport.name}: persistence hop retry after`, String(error?.message || error));
          await page.waitForTimeout(2_000);
        }
      }
      if (secondResponse && !secondResponse.ok()) {
        // Document may still be valid; only hard-fail if we are not on Command with body.
        const landed = !/\/login(?:\?|$)|\/command-login/.test(persistenceProbe.url());
        if (!landed) {
          throw secondError ?? new Error(`${viewport.name} persistence document returned HTTP ${secondResponse.status()}`);
        }
        console.error(
          `[stage-d-browser] ${viewport.name}: persistence hop HTTP ${secondResponse.status()} but document landed on ${persistenceProbe.url()}`,
        );
      } else if (!secondResponse) {
        await waitForSubstantiveBody(persistenceProbe, 20_000);
        assert.doesNotMatch(
          persistenceProbe.url(),
          /\/login(?:\?|$)|\/command-login/,
          `${viewport.name} persistence document returned HTTP none and did not land on Command (url=${persistenceProbe.url()})`,
        );
        console.error(
          `[stage-d-browser] ${viewport.name}: persistence hop response handle was null; document outcome accepted at ${persistenceProbe.url()}`,
        );
      }
      await waitForSubstantiveBody(persistenceProbe);
      assert.doesNotMatch(persistenceProbe.url(), /\/login(?:\?|$)|\/command-login/, `${viewport.name} lost its authenticated session on second document navigation`);
      const reloadedText = await persistenceProbe.locator("body").innerText();
      assert.doesNotMatch(reloadedText, /Something went wrong|Cannot read properties of undefined|Internal Server Error/i, `${viewport.name} second document rendered a fatal error`);
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

console.log("[stage-d-browser] individual auth, responsive protected routes, persistence and logout acceptance passed");
