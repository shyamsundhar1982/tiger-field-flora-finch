import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const baseURL = process.env.STAGE_D_BASE_URL || "http://127.0.0.1:8080";
const email = process.env.STAGE_D_USER_EMAIL;
const password = process.env.STAGE_D_USER_PASSWORD;

if (!email) throw new Error("STAGE_D_USER_EMAIL is required for Stage D responsive geometry acceptance.");
if (!password) throw new Error("STAGE_D_USER_PASSWORD is required for Stage D responsive geometry acceptance.");

const artifactsDir = "/tmp/vyndi-stage-d-artifacts";
fs.mkdirSync(artifactsDir, { recursive: true });

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

async function waitForSubstantiveBody(page, timeout) {
  await page.locator("body").waitFor({ state: "visible", timeout });
  await page.waitForFunction(
    () => (document.body?.innerText || "").trim().length > 40,
    undefined,
    { timeout },
  );
}

function safeArtifactName(value) {
  return value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

async function collectResponsiveGeometry(page) {
  return page.evaluate(() => {
    const tolerance = 1;
    const viewportWidth = window.innerWidth;
    const root = document.documentElement;
    const body = document.body;

    const describe = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        tag: element.tagName,
        id: element.id || "",
        className: typeof element.className === "string" ? element.className.slice(0, 180) : "",
        text: (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        overflowPx: Math.max(0, element.scrollWidth - element.clientWidth),
      };
    };

    const pageScrollWidth = Math.max(root?.scrollWidth || 0, body?.scrollWidth || 0);
    const pageOverflowPx = Math.max(0, pageScrollWidth - viewportWidth);

    const pageOverflowOffenders = [...document.querySelectorAll("body *")]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { element, rect };
      })
      .filter(({ rect }) => rect.right > viewportWidth + tolerance || rect.left < -tolerance)
      .map(({ element }) => describe(element))
      .slice(0, 20);

    const tableLikeElements = [...document.querySelectorAll('table, [role="table"]')];
    const tableOverflow = [];

    for (const table of tableLikeElements) {
      let current = table.parentElement;
      let overflowContainer = null;

      while (current && current !== body && current !== root) {
        const style = getComputedStyle(current);
        const horizontalOverflow = current.scrollWidth - current.clientWidth;
        const declaredScrollable = style.overflowX === "auto" || style.overflowX === "scroll";

        if (horizontalOverflow > tolerance && declaredScrollable) {
          overflowContainer = current;
          break;
        }
        current = current.parentElement;
      }

      if (!overflowContainer) {
        const tableRect = table.getBoundingClientRect();
        const parentRect = table.parentElement?.getBoundingClientRect();
        if (parentRect && tableRect.width - parentRect.width > tolerance) {
          overflowContainer = table.parentElement;
        }
      }

      if (overflowContainer) {
        tableOverflow.push({
          table: describe(table),
          container: describe(overflowContainer),
        });
      }
    }

    const explicitHorizontalScrollContainers = [...document.querySelectorAll("body *")]
      .filter((element) => {
        const className = typeof element.className === "string" ? element.className : "";
        if (!/(^|\s)overflow-x-(auto|scroll)(\s|$)/.test(className)) return false;
        if (element.scrollWidth - element.clientWidth <= tolerance) return false;
        return Boolean(element.querySelector('table, [role="table"]'));
      })
      .map((element) => describe(element))
      .slice(0, 20);

    const main = document.querySelector("main");
    const mainRect = main?.getBoundingClientRect();
    const mainOutOfBounds = mainRect
      ? mainRect.left < -tolerance || mainRect.right > viewportWidth + tolerance
      : false;

    return {
      viewportWidth,
      pageScrollWidth,
      pageOverflowPx,
      pageOverflowOffenders,
      tableOverflow,
      explicitHorizontalScrollContainers,
      main: main ? describe(main) : null,
      mainOutOfBounds,
    };
  });
}

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of viewports) {
    console.log(`[stage-d-responsive] ${viewport.name}: login`);
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: "reduce",
    });

    const pageErrors = [];
    const observePage = (page) => {
      page.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));
    };

    const loginPage = await context.newPage();
    observePage(loginPage);
    try {
      await loginPage.goto(`${baseURL}/login?returnTo=%2Fcommand`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await loginPage.getByLabel(/Authorised Email/i).fill(email);
      await loginPage.getByLabel(/^Password$/i).fill(password);
      await loginPage.getByRole("button", { name: /Authorize · Enter Command/i }).click();
      await loginPage.waitForURL(/\/command(?:\/|$)/, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await waitForSubstantiveBody(loginPage, 20_000);
      assert.doesNotMatch(
        loginPage.url(),
        /\/login(?:\?|$)|\/command-login/,
        `${viewport.name} login did not establish protected access`,
      );
    } finally {
      await loginPage.close().catch(() => {});
    }

    for (const route of routes) {
      const routePage = await context.newPage();
      observePage(routePage);
      const artifactBase = `${safeArtifactName(viewport.name)}-${safeArtifactName(route)}`;
      const startedAt = Date.now();

      try {
        console.log(`[stage-d-responsive] ${viewport.name}: ${route}`);
        await routePage.goto(`${baseURL}${route}`, {
          waitUntil: "domcontentloaded",
          timeout: ROUTE_GOTO_TIMEOUT_MS[route] ?? 30_000,
        });
        await waitForSubstantiveBody(routePage, ROUTE_BODY_TIMEOUT_MS[route] ?? 20_000);

        assert.doesNotMatch(
          routePage.url(),
          /\/login(?:\?|$)|\/command-login/,
          `${viewport.name} ${route} lost authenticated access`,
        );

        const text = await routePage.locator("body").innerText();
        assert.doesNotMatch(
          text,
          /Something went wrong|Cannot read properties of undefined|Internal Server Error/i,
          `${viewport.name} ${route} rendered a fatal error`,
        );

        const geometry = await collectResponsiveGeometry(routePage);
        console.log(
          `[stage-d-responsive] ${viewport.name}: ${route} ready in ${Date.now() - startedAt}ms; pageOverflow=${geometry.pageOverflowPx}px; tableOverflow=${geometry.tableOverflow.length}`,
        );

        if (geometry.pageOverflowPx > 1) {
          console.error(
            `[stage-d-responsive] page overflow diagnostics for ${viewport.name} ${route}`,
            geometry.pageOverflowOffenders,
          );
        }
        if (geometry.tableOverflow.length) {
          console.error(
            `[stage-d-responsive] nested table overflow diagnostics for ${viewport.name} ${route}`,
            geometry.tableOverflow,
          );
        }
        if (geometry.explicitHorizontalScrollContainers.length) {
          console.error(
            `[stage-d-responsive] explicit horizontal table scrollers for ${viewport.name} ${route}`,
            geometry.explicitHorizontalScrollContainers,
          );
        }

        assert.ok(
          geometry.pageOverflowPx <= 1,
          `${viewport.name} ${route} has ${geometry.pageOverflowPx}px page-level horizontal overflow (maximum accepted: 1px)`,
        );
        assert.equal(
          geometry.tableOverflow.length,
          0,
          `${viewport.name} ${route} contains ${geometry.tableOverflow.length} nested table region(s) requiring horizontal scrolling`,
        );
        assert.equal(
          geometry.explicitHorizontalScrollContainers.length,
          0,
          `${viewport.name} ${route} contains explicit horizontally scrolling table container(s)`,
        );
        assert.equal(
          geometry.mainOutOfBounds,
          false,
          `${viewport.name} ${route} main workspace extends outside the viewport`,
        );

        assert.deepEqual(
          pageErrors,
          [],
          `${viewport.name} ${route} emitted browser page errors: ${pageErrors.join(" | ")}`,
        );
      } catch (error) {
        const screenshotPath = path.join(artifactsDir, `${artifactBase}.png`);
        await routePage.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
        console.error(`[stage-d-responsive] ${viewport.name} ${route} failed`, {
          url: routePage.url(),
          elapsedMs: Date.now() - startedAt,
          pageErrors,
          screenshotPath,
        });
        throw error;
      } finally {
        await routePage.close().catch(() => {});
      }
    }

    assert.deepEqual(
      pageErrors,
      [],
      `${viewport.name} emitted browser page errors: ${pageErrors.join(" | ")}`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}

console.log("[stage-d-responsive] responsive geometry and nested-table acceptance passed");
