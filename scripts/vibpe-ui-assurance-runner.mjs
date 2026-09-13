import { chromium } from "playwright";
import { existsSync } from "node:fs";

const baseUrl = String(process.env.VIBPE_UI_BASE_URL ?? "").replace(/\/$/, "");
const storageState = process.env.VIBPE_UI_STORAGE_STATE;
const target = process.env.VIBPE_UI_TARGET || "cloudflare-production";

if (!baseUrl) {
  console.error("VIBPE_UI_BASE_URL is required, e.g. https://<worker>.workers.dev");
  process.exit(2);
}
if (storageState && !existsSync(storageState)) {
  console.error(`VIBPE_UI_STORAGE_STATE not found: ${storageState}`);
  process.exit(2);
}

const checks = [
  ["UI-AUTH-SESSION", "/command", "Authenticated Command navigation persists"],
  ["UI-SALES-LOAD", "/command/sales", "Demand & Orders renders"],
  ["UI-PRODUCT-LOAD", "/command/product", "Product authority renders"],
  ["UI-ENGINEERING-LOAD", "/command/engineering", "Engineering authority renders"],
  ["UI-BOM-LOAD", "/command/bom-control", "BOM Control renders"],
  ["UI-INVENTORY-LOAD", "/command/inventory", "Inventory renders"],
  ["UI-PROCUREMENT-LOAD", "/command/procurement-planning", "Procurement Planning renders"],
  ["UI-PRODUCTION-LOAD", "/command/production", "Production renders"],
  ["UI-QUALITY-LOAD", "/command/quality", "Quality renders"],
  ["UI-PEOPLE-OFFICE-LOAD", "/command/people-office", "People & Office renders"],
  ["UI-DISPATCH-VISIBILITY", "/command/operations", "Operations dispatch visibility renders"],
  ["UI-ACTION-INBOX", "/command/actions", "Business Action Inbox renders"],
  ["UI-CONTROL-TOWER", "/command/control-tower", "Control Tower renders"],
  ["UI-VIBPE-WORKSPACE", "/command/ibpe-operating-workspace", "VIBPE Operating Workspace renders"],
  ["UI-VIBPE-AUTHORITY", "/command/ibpe-operating-workspace/authority", "Advanced Planning Authority renders"],
  ["UI-VIBPE-OPTIMIZER", "/command/ibpe-operating-workspace/optimizer", "Governed Optimizer renders"],
  ["UI-VIBPE-OUTPUTS", "/command/ibpe-operating-workspace/outputs", "Outputs & Evidence renders"],
  ["UI-VIBPE-ASSURANCE", "/command/ibpe-operating-workspace/assurance", "VIBPE Assurance renders"],
  ["UI-VIBPE-RELEASE", "/command/ibpe-operating-workspace/release", "Release Readiness renders"],
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext(storageState ? { storageState } : {});
const page = await context.newPage();
const results = [];

async function record(payload) {
  return page.evaluate(async (body) => {
    const response = await fetch("/api/vibpe/ui-assurance", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  }, payload);
}

async function checkRoute(capabilityId, routePath, label) {
  let passed = false;
  let observedResult = "";
  const evidence = {};
  try {
    const response = await page.goto(`${baseUrl}${routePath}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(400);
    const finalUrl = page.url();
    const bodyText = (await page.locator("body").innerText().catch(() => "")).slice(0, 3000);
    const loginLike = /\/login(?:[/?#]|$)/i.test(finalUrl) || /sign in|log in/i.test(bodyText.slice(0, 700));
    const errorLike = /something went wrong|application error|internal server error/i.test(bodyText);
    passed = Boolean(response?.ok()) && !loginLike && !errorLike;
    observedResult = passed
      ? `${label}: rendered at ${new URL(finalUrl).pathname}`
      : `${label}: status=${response?.status() ?? "none"}, final=${finalUrl}, loginLike=${loginLike}, errorLike=${errorLike}`;
    Object.assign(evidence, { httpStatus: response?.status() ?? null, finalUrl, loginLike, errorLike });
  } catch (error) {
    observedResult = `${label}: ${error instanceof Error ? error.message : String(error)}`;
    evidence.error = observedResult;
  }
  const payload = { capabilityId, target, passed, observedResult, routePath, evidence };
  const posted = await record(payload).catch((error) => ({ status: 0, body: { error: String(error) } }));
  results.push({ ...payload, evidencePostStatus: posted.status });
}

try {
  await page.goto(`${baseUrl}/command`, { waitUntil: "domcontentloaded", timeout: 30000 });
  for (const check of checks) await checkRoute(...check);

  await page.goto(`${baseUrl}/command/actions`, { waitUntil: "domcontentloaded", timeout: 30000 });
  const lifecycleButtons = await page.getByRole("button", { name: /^(start|complete)$/i }).count().catch(() => 0);
  const duplicateLifecycle = lifecycleButtons > 1;
  const lifecyclePayload = {
    capabilityId: "UI-ACTION-LIFECYCLE",
    target,
    passed: !duplicateLifecycle,
    observedResult: duplicateLifecycle
      ? `Found ${lifecycleButtons} simultaneous Start/Complete controls; expected at most one eligible lifecycle path.`
      : `Lifecycle control multiplicity acceptable (${lifecycleButtons} visible Start/Complete control).`,
    routePath: "/command/actions",
    evidence: { lifecycleButtons },
  };
  const lifecyclePost = await record(lifecyclePayload).catch((error) => ({ status: 0, body: { error: String(error) } }));
  results.push({ ...lifecyclePayload, evidencePostStatus: lifecyclePost.status });

  const failures = results.filter((result) => !result.passed);
  console.log(JSON.stringify({ target, baseUrl, checked: results.length, failures: failures.length, results }, null, 2));
  process.exitCode = failures.length ? 1 : 0;
} finally {
  await browser.close();
}
