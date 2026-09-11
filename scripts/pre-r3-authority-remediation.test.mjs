import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const productMigration = readFileSync(new URL("../migrations/0049_canonical_product_authority.sql", import.meta.url), "utf8");
const productAuthority = readFileSync(new URL("../src/lib/product-authority.ts", import.meta.url), "utf8");
const engineeringMigration = readFileSync(new URL("../migrations/0050_engineering_revision_authority.sql", import.meta.url), "utf8");
const engineeringAuthority = readFileSync(new URL("../src/lib/engineering-authority.ts", import.meta.url), "utf8");
const qualityMigration = readFileSync(new URL("../migrations/0051_quality_lineage_authority.sql", import.meta.url), "utf8");
const qualityAuthority = readFileSync(new URL("../src/lib/quality-authority.ts", import.meta.url), "utf8");
const peopleOfficeMigration = readFileSync(new URL("../migrations/0052_people_office_authority.sql", import.meta.url), "utf8");
const peopleOfficeAuthority = readFileSync(new URL("../src/lib/people-office-authority.ts", import.meta.url), "utf8");
const dispatchMigration = readFileSync(new URL("../migrations/0053_dispatch_operations_authority.sql", import.meta.url), "utf8");
const dispatchAuthority = readFileSync(new URL("../src/lib/dispatch-authority.ts", import.meta.url), "utf8");
const shipmentAuthority = readFileSync(new URL("../src/lib/shipment-authority.ts", import.meta.url), "utf8");
const models = readFileSync(new URL("../src/lib/data/models.ts", import.meta.url), "utf8");

const currentVariantIds = [...models.matchAll(/\{id:"([^"]+)"/g)].map((match) => match[1]);
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// G1 — Product master authority.
test("G1 persists only the three canonical VYNDI product family identities", () => {
  for (const [family, alias] of [["longitude", "core"], ["latitude", "pro"], ["altitude", "apex"]]) {
    assert.match(productMigration, new RegExp(`'${family}'[^\\n]+ '${alias}'`));
  }
  assert.match(productMigration, /VINDY Longitude/);
  assert.match(productMigration, /VINDY Latitude/);
  assert.match(productMigration, /VINDY Altitude/);
  assert.match(productMigration, /compatibility alias for legacy code only/i);
});

test("G1 preserves every current order-facing variant identifier in canonical persistence", () => {
  assert.equal(currentVariantIds.length, 10, "Unexpected model catalogue size; update the canonical cutover intentionally.");
  for (const id of currentVariantIds) {
    assert.match(productMigration, new RegExp(`'${escapeRegExp(id)}'`), `Missing canonical variant ${id}`);
  }
  assert.match(productMigration, /compatibility_variant_id text not null unique/);
  assert.match(productAuthority, /resolveCanonicalProductVariant/);
  assert.match(productAuthority, /v\.variant_id=.*or v\.compatibility_variant_id=/s);
});

test("G1 exposes canonical business identity while legacy tier lookup stays server-side", () => {
  assert.match(productAuthority, /listCanonicalProductCatalog/);
  assert.match(productAuthority, /resolveCanonicalFamilyByCompatibilityTier/);
  assert.match(productAuthority, /implementation alias rather than the\s+\* user-facing business identity/s);
  assert.doesNotMatch(productAuthority, /familyName:\s*"core"|familyName:\s*"pro"|familyName:\s*"apex"/);
});

// G2 — Engineering revision / ECR authority.
test("G2 persists Engineering baselines with governed release lifecycle", () => {
  assert.match(engineeringMigration, /create table if not exists vyndi_engineering_baselines/);
  assert.match(engineeringMigration, /status text not null default 'draft' check \(status in \('draft','pending_approval','released','superseded'\)\)/);
  assert.match(engineeringMigration, /record_revision integer not null default 1/);
  assert.match(engineeringMigration, /ENG-LATITUDE-C3/);
  assert.match(engineeringMigration, /ENG-LONGITUDE-A2/);
  assert.match(engineeringMigration, /ENG-ALTITUDE-C2/);
  assert.match(engineeringMigration, /ENGINEERING_BASELINE_CUTOVER/);
});

test("G2 persists ECRs with product, BOM and downstream-impact references", () => {
  assert.match(engineeringMigration, /create table if not exists vyndi_engineering_change_requests/);
  assert.match(engineeringMigration, /from_baseline_id text references vyndi_engineering_baselines/);
  assert.match(engineeringMigration, /target_bom_revision text/);
  assert.match(engineeringMigration, /affected_skus jsonb/);
  assert.match(engineeringMigration, /implemented_baseline_id text references vyndi_engineering_baselines/);
  assert.match(engineeringAuthority, /createEngineeringChange/);
  assert.match(engineeringAuthority, /transitionEngineeringChange/);
});

test("G2 enforces actor-attributed approval and released-baseline implementation", () => {
  assert.match(engineeringAuthority, /requirePermission\(approvalDecision \? "approve" : "edit"\)/);
  assert.match(engineeringAuthority, /Implemented ECR requires the released Engineering baseline/);
  assert.match(engineeringAuthority, /status='released'/);
  assert.match(engineeringAuthority, /ECR_STATUS_CHANGED/);
  assert.match(engineeringAuthority, /ENGINEERING_BASELINE_STATUS_CHANGED/);
  assert.match(engineeringAuthority, /actor_user_id,actor_role/);
});

// G3 — Quality lineage authority.
test("G3 persists inspection, NCR, CAPA and serialized release evidence", () => {
  assert.match(qualityMigration, /create table if not exists vyndi_quality_inspections/);
  assert.match(qualityMigration, /create table if not exists vyndi_quality_ncrs/);
  assert.match(qualityMigration, /create table if not exists vyndi_quality_capas/);
  assert.match(qualityMigration, /create table if not exists vyndi_quality_releases/);
  assert.match(qualityMigration, /traveller_id text references epr_travellers/);
  assert.match(qualityMigration, /job_card_id text references epr_production_job_cards/);
  assert.match(qualityMigration, /goods_receipt_id text references vyndi_goods_receipts/);
  assert.match(qualityMigration, /create or replace view vyndi_quality_lineage/);
});

test("G3 does not promote static Quality sample data to canonical evidence", () => {
  assert.match(qualityMigration, /static\/demo quality arrays are deliberately NOT promoted/i);
  assert.doesNotMatch(qualityMigration, /QUALITY_CHECKS|NCRS|WARRANTY_CASES/);
});

test("G3 derives traveller lineage and enforces passing final inspection before release", () => {
  assert.match(qualityAuthority, /resolveQualityLineage/);
  assert.match(qualityAuthority, /t\.job_card_id as "jobCardId"/);
  assert.match(qualityAuthority, /c\.sales_order_id as "salesOrderId"/);
  assert.match(qualityAuthority, /Quality release requires at least one passing final inspection/);
  assert.match(qualityAuthority, /Quality release is blocked by an open NCR\/CAPA chain/);
  assert.match(qualityAuthority, /'G10-QUALITY'/);
  assert.match(qualityAuthority, /QUALITY_RELEASE_DECIDED/);
});

test("G3 quality decisions preserve actor and audit evidence", () => {
  for (const action of [
    "QUALITY_INSPECTION_RECORDED",
    "QUALITY_NCR_CREATED",
    "QUALITY_NCR_STATUS_CHANGED",
    "QUALITY_CAPA_CREATED",
    "QUALITY_CAPA_STATUS_CHANGED",
    "QUALITY_RELEASE_DECIDED",
  ]) assert.match(qualityAuthority, new RegExp(action));
  assert.match(qualityAuthority, /actor_user_id,actor_role/);
  assert.match(qualityAuthority, /requirePermission\("approve"\)/);
});

// G4 — People & Office authority.
test("G4 persists People, payroll/office/services and office-asset source records", () => {
  assert.match(peopleOfficeMigration, /create table if not exists vyndi_people_records/);
  assert.match(peopleOfficeMigration, /create table if not exists vyndi_people_office_cost_items/);
  assert.match(peopleOfficeMigration, /cost_group text not null check \(cost_group in \('payroll','office','statutory','outsourcing'\)\)/);
  assert.match(peopleOfficeMigration, /create table if not exists vyndi_people_office_assets/);
});

test("G4 migrates old planning templates only as zero-value drafts", () => {
  assert.match(peopleOfficeMigration, /zero-value planning templates are seeded as drafts/i);
  assert.match(peopleOfficeMigration, /'people-founder-management','payroll'.+1,0,1,36,0,1,'draft'/s);
  assert.match(peopleOfficeMigration, /'computers','Computers','IT','office_admin',0,0,1,60,100,'draft'/);
  assert.doesNotMatch(peopleOfficeMigration, /CUTOVER:DEFAULT_PEOPLE_OFFICE_LEDGER'\s*,\s*'system:migration'\)\s*;\s*update.+approved/is);
});

test("G4 exposes only approved source records to the Finance downstream feed", () => {
  assert.match(peopleOfficeMigration, /create or replace view vyndi_people_office_finance_feed/);
  assert.match(peopleOfficeMigration, /c\.lifecycle_status='approved'/);
  assert.match(peopleOfficeMigration, /a\.lifecycle_status='approved'/);
  assert.match(peopleOfficeMigration, /Finance downstream feed\. Only approved People & Office source records contribute/i);
  assert.match(peopleOfficeAuthority, /getPeopleOfficeFinanceFeed/);
});

test("G4 makes server authority auditable and approval-gated", () => {
  assert.match(peopleOfficeAuthority, /savePeopleRecordDraft/);
  assert.match(peopleOfficeAuthority, /savePeopleOfficeCostDraft/);
  assert.match(peopleOfficeAuthority, /savePeopleOfficeAssetDraft/);
  assert.match(peopleOfficeAuthority, /transitionPeopleOfficeCost/);
  assert.match(peopleOfficeAuthority, /transitionPeopleOfficeAsset/);
  assert.match(peopleOfficeAuthority, /transitionPeopleRecord/);
  assert.match(peopleOfficeAuthority, /PEOPLE_OFFICE_COST_STATUS_CHANGED/);
  assert.match(peopleOfficeAuthority, /PEOPLE_RECORD_STATUS_CHANGED/);
  assert.match(peopleOfficeAuthority, /PEOPLE_OFFICE_ASSET_STATUS_CHANGED/);
  assert.match(peopleOfficeAuthority, /canPerform\(role, permission\)/);
});

// G5 — Dispatch ownership.
test("G5 makes shipment execution explicitly Operations-owned without moving Finance invoices", () => {
  assert.match(dispatchMigration, /owner_workspace text not null default 'operations'/);
  assert.match(dispatchMigration, /check \(owner_workspace='operations'\)/);
  assert.match(dispatchMigration, /Canonical Operations\/Fulfilment dispatch authority/);
  assert.match(dispatchMigration, /Finance consumes posted shipment evidence but does not own shipment execution/);
  assert.match(dispatchMigration, /create or replace view vyndi_dispatch_register/);
  assert.match(dispatchMigration, /i\.id as invoice_id/);
});

test("G5 requires current Production completion and serialized Quality release before dispatch", () => {
  assert.match(dispatchMigration, /sales_order_revision=v_order_revision/);
  assert.match(dispatchMigration, /v_job_status is distinct from 'complete'/);
  assert.match(dispatchMigration, /from vyndi_quality_releases q/);
  assert.match(dispatchMigration, /q\.decision='released'/);
  assert.match(dispatchMigration, /Dispatch is blocked: only % serialized unit\(s\) have current Quality release evidence/);
  assert.match(dispatchMigration, /'G12-DISPATCH','pass'/);
});

test("G5 has one canonical shipment writer implementation with backward-compatible aliases", () => {
  assert.match(dispatchAuthority, /export const postDispatch/);
  assert.match(dispatchAuthority, /export const reverseDispatch/);
  assert.match(dispatchAuthority, /ownerWorkspace: "operations"/);
  assert.match(shipmentAuthority, /export const postShipment = postDispatch/);
  assert.match(shipmentAuthority, /export const reverseShipment = reverseDispatch/);
  assert.doesNotMatch(shipmentAuthority, /select post_vyndi_shipment\(\$1,\$2,\$3,\$4,\$5,\$6,\$7\)/);
  assert.match(shipmentAuthority, /export const issueInvoice/);
  assert.match(shipmentAuthority, /export const postCollection/);
});
