import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const searchSource = fs.readFileSync(new URL("../src/lib/traceability-search.ts", import.meta.url), "utf8");
const centreSource = fs.readFileSync(new URL("../src/components/traceability-document-centre.tsx", import.meta.url), "utf8");
const copilotSource = fs.readFileSync(new URL("../src/components/ibpe-copilot.tsx", import.meta.url), "utf8");
const routeSource = fs.readFileSync(new URL("../src/routes/command/route.tsx", import.meta.url), "utf8");

test("traceability search recognizes canonical record types and vernacular aliases", () => {
  for (const token of [
    "commercial_order",
    "job_card",
    "material_requisition",
    "traveller",
    "purchase_order",
    "grn",
    "quality_release",
    "dispatch",
    "invoice",
    "collection",
  ]) assert.match(searchSource, new RegExp(`\\b${token}\\b`));

  for (const phrase of ["job\\s*sheet", "material\\s*requisition", "goods\\s*receipt", "oda", "panniyacha", "done\\s+ah"]) {
    assert.match(searchSource, new RegExp(phrase));
  }
  assert.match(searchSource, /partial|searchTerms|identifierLike/);
});

test("traceability search remains permission-aware and server-side", () => {
  assert.match(searchSource, /requireBusinessActor\("view"/);
  assert.match(searchSource, /canAccessRoute/);
  assert.match(searchSource, /ilike any\(\$1::text\[\]\)/i);
  assert.match(searchSource, /limit \$2/i);
});

test("landscape centre exposes direct controlled printing without horizontal table scrolling", () => {
  assert.match(centreSource, /Traceability & Print Centre/);
  assert.match(centreSource, /max-w-\[1680px\]/);
  assert.match(centreSource, /grid-cols-\[1\.15fr_1\.05fr_1\.2fr/);
  assert.doesNotMatch(centreSource, /overflow-x-auto/);
  assert.match(centreSource, /getTraceabilityPrintRecord/);
  assert.match(centreSource, /printControlledDocument/);
  assert.match(centreSource, /End-to-End Digital Thread/);
});

test("VIBPE Co-Pilot routes traceability language through the same search engine", () => {
  assert.match(copilotSource, /askTraceabilityCopilot/);
  assert.match(copilotSource, /vyndi:traceability-search/);
  assert.match(copilotSource, /Vernacular traceability/);
  assert.match(copilotSource, /Open Traceability & Print/);
  assert.match(routeSource, /TraceabilityDocumentCentre/);
});
