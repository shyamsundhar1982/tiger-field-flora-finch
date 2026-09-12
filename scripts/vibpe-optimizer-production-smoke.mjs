#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";

const baseUrl = String(process.env.VIBPE_UI_BASE_URL ?? "").replace(/\/$/, "");
const storageState = process.env.VIBPE_UI_STORAGE_STATE;
const execute = process.env.VIBPE_EXECUTE_OPTIMIZER === "1";
const evidencePath = resolve(process.env.VIBPE_OPTIMIZER_EVIDENCE_PATH ?? ".grok/evidence/vibpe-optimizer-production.json");

if (!baseUrl) {
  console.error("VIBPE_UI_BASE_URL is required, e.g. https://tiger-field-flora-finch.<account>.workers.dev");
  process.exit(2);
}
if (!storageState) {
  console.error("VIBPE_UI_STORAGE_STATE is required for protected optimizer verification.");
  process.exit(2);
}

const evidence = {
  checkedAt: new Date().toISOString(),
  baseUrl,
  executeRequested: execute,
  releaseMarker: null,
  optimizerHealth: null,
  operatorSurface: { rendered: false, gateText: null },
  execution: null,
  pass: false,
  failures: [],
};

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();

  const markerResponse = await page.request.get(`${baseUrl}/api/runtime/release-marker`);
  evidence.releaseMarker = {
    status: markerResponse.status(),
    body: await markerResponse.json().catch(() => null),
  };
  if (!markerResponse.ok()) evidence.failures.push(`release marker returned ${markerResponse.status()}`);

  const healthResponse = await page.request.get(`${baseUrl}/api/runtime/optimizer-health`);
  const healthBody = await healthResponse.json().catch(() => null);
  evidence.optimizerHealth = { status: healthResponse.status(), body: healthBody };
  if (!healthResponse.ok()) evidence.failures.push(`optimizer health returned ${healthResponse.status()}`);
  if (healthBody?.productionReady !== true) evidence.failures.push("optimizer productionReady is not true");
  if (healthBody?.transportSource !== "hyperdrive") evidence.failures.push(`optimizer transport is ${healthBody?.transportSource ?? "unknown"}, not hyperdrive`);
  if (healthBody?.migration0071Applied !== true) evidence.failures.push("migration 0071 is not recorded as applied");
  if (healthBody?.persistenceFunctionPresent !== true) evidence.failures.push("v2 optimizer persistence function is missing");

  await page.goto(`${baseUrl}/command/ibpe-operating-workspace/optimizer`, { waitUntil: "networkidle" });
  const title = page.getByRole("heading", { name: "Advanced Planning Optimizer" });
  await title.waitFor({ state: "visible" });
  evidence.operatorSurface.rendered = true;
  evidence.operatorSurface.gateText = await page.locator("text=Execution gate").locator("..").innerText().catch(() => null);

  const runButton = page.getByRole("button", { name: "Run governed HiGHS optimization" });
  if (execute) {
    if (await runButton.isDisabled()) {
      evidence.failures.push("governed optimizer button is disabled; preparation gate is not READY");
    } else {
      await runButton.click();
      const persisted = page.getByText(/Persisted OPT-/);
      await persisted.waitFor({ state: "visible", timeout: 120000 });
      evidence.execution = { message: await persisted.textContent() };
    }
  } else {
    evidence.execution = { skipped: true, reason: "Set VIBPE_EXECUTE_OPTIMIZER=1 for an explicit governed production execution." };
  }

  evidence.pass = evidence.failures.length === 0;
} catch (error) {
  evidence.failures.push(error instanceof Error ? error.message : String(error));
  evidence.pass = false;
} finally {
  await browser.close();
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(evidence, null, 2));
}

process.exit(evidence.pass ? 0 : 1);
