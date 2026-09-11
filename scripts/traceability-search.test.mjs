import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const searchSource = fs.readFileSync(new URL("../src/lib/traceability-search.ts", import.meta.url), "utf8");
const centreSource = fs.readFileSync(new URL("../src/components/traceability-document-centre-v2.tsx", import.meta.url), "utf8");
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

  for (const phrase of [
    "job\\s*sheet",
    "material\\s*requisition",
    "goods\\s*receipt",
    "oda",
    "panniyacha",
    "done\\s+ah",
  ]) {
    assert.ok(searchSource.includes(phrase), `missing traceability alias: ${phrase}`);
  }
  assert.match(searchSource, /partial|searchTerms|identifierLike/);
});

test("traceability search remains permission-aware and server-side", () => {
  assert.match(searchSource, /requireBusinessActor\("view"/);
  assert.match(searchSource, /canAccessRoute/);
  assert.match(searchSource, /ilike any\(\$1::text\[\]\)/i);
  assert.match(searchSource, /limit \$2/i);
});

test("direct Traceability Centre accepts ordinary free text without weakening Co-Pilot intent gating", () => {
  assert.match(centreSource, /DIRECT_SEARCH_SENTINEL/);
  assert.match(centreSource, /interpretTraceabilityQuery\(trimmed\)/);
  assert.match(centreSource, /interpretation\.recognized \? trimmed/);
  assert.match(centreSource, /searchTraceability\(\{ data: \{ query: serverQuery, limit: 60 \} \}\)/);
  for (const example of ["C3 cycles", "Longitude", "HB-AL-420", "061E6697", "782055", "C3 cycles oda pending PO"]) {
    assert.ok(centreSource.includes(example), `missing direct-search regression example: ${example}`);
  }
  assert.match(searchSource, /if \(!interpretation\.recognized\) return/);
  assert.match(copilotSource, /askTraceabilityCopilot/);
});

test("traceability supplier lookups use canonical supplier joins and controlled error states", () => {
  assert.match(searchSource, /left join vyndi_suppliers s on s\.id=p\.supplier_id/);
  assert.match(searchSource, /coalesce\(s\.name,p\.supplier_id,'Supplier not assigned'\)/);
  assert.doesNotMatch(searchSource, /coalesce\(p\.supplier_name,p\.supplier_id\)/);
  assert.match(searchSource, /\(p\.quantity\*p\.unit_price_inr\) as order_value_inr/);
  assert.match(searchSource, /select g\.\*,p\.job_card_id,p\.sku,coalesce\(s\.name,p\.supplier_id,'Supplier not assigned'\) as supplier_name/);
  assert.match(centreSource, /Traceability query failed\. The governed record search could not be completed\./);
  assert.match(centreSource, /No controlled records found for this search and filter combination\./);
  assert.match(centreSource, /No search result has been presented as audit evidence\./);
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

test("VIBPE Co-Pilot routes traceability language through the same governed search engine", () => {
  assert.match(copilotSource, /askTraceabilityCopilot/);
  assert.match(copilotSource, /vyndi:traceability-search/);
  assert.match(copilotSource, /Vernacular traceability/);
  assert.match(copilotSource, /Open Traceability & Print/);
  assert.match(routeSource, /TraceabilityDocumentCentreV2/);
});
