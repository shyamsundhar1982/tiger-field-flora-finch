import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("brand source defines the required legal-to-product hierarchy", async () => {
  const brand = await source("src/lib/brand.ts");
  for (const label of ["VĀYÚ SHASTR PVT. LTD.", "VYNDI OS", "VIBPE Co-Pilot 2.0", "VYNDI"]) {
    assert.match(brand, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(brand, /VYNDI_BRAND_HIERARCHY\.join\(" → "\)/);
});

test("official Vāyú logo reaches shell, sidebar, mobile, login, loading, and favicon", async () => {
  const [lockup, shell, login, router, root] = await Promise.all([
    source("src/components/brand-lockup.tsx"),
    source("src/components/command-shell-v2.tsx"),
    source("src/routes/login.tsx"),
    source("src/router.tsx"),
    source("src/routes/__root.tsx"),
  ]);
  assert.match(lockup, /VAYU_LOGO_PATH/);
  assert.match(shell, /<BrandLockup compact/);
  assert.match(shell, /<VayuMark decorative className="size-8"/);
  assert.match(login, /vy-login__intro-mark/);
  assert.match(login, /vy-login__boot-ring/);
  assert.match(router, /defaultPendingComponent: BrandLoadingState/);
  assert.match(root, /href: "\/brand\/vayu-official\.svg"/);
});

test("PWA and printable outputs use the VYNDI OS identity", async () => {
  const [site, controlledPrint, controlledDocument, copilotPrint, productionPrint] = await Promise.all([
    source("src/lib/og/site.json"),
    source("src/lib/controlled-print.ts"),
    source("src/lib/controlled-document.ts"),
    source("src/components/ibpe-copilot.tsx"),
    source("src/routes/command/production.tsx"),
  ]);
  assert.equal(JSON.parse(site).title, "VYNDI OS");
  for (const printSource of [controlledPrint, controlledDocument, copilotPrint, productionPrint]) {
    assert.match(printSource, /vyndiPrintBrandMarkup/);
  }
});

test("active presentation surfaces contain no superseded VéLOXIS or VINDY labels", async () => {
  const paths = [
    "src/components/command-shell-v2.tsx",
    "src/components/site-header.tsx",
    "src/routes/login.tsx",
    "src/routes/command-login.tsx",
    "src/routes/command/demo-company.tsx",
    "src/routes/command/investor-pitch.tsx",
    "src/routes/command/market-survey.tsx",
    "src/routes/command/platform-walkthrough.tsx",
  ];
  for (const path of paths) {
    const content = await source(path);
    assert.doesNotMatch(content, /VéLOXIS|\bVINDY\b/, path);
  }
});
