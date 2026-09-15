import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const migration = await readFile(join(root, "migrations/0075_iso_quality_compliance.sql"), "utf8");
const service = await readFile(join(root, "src/lib/iso-quality-compliance.ts"), "utf8");
const route = await readFile(join(root, "src/routes/command/quality.tsx"), "utf8");

test("ISO v1 registers the controlled standard set without embedding proprietary acceptance tables", () => {
  for (const standard of ["ISO 4210-2", "ISO 4210-3", "ISO 4210-6", "ISO 9001", "ISO 10012", "ISO/IEC 17025"]) {
    assert.match(migration, new RegExp(standard.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(migration, /Full copyrighted ISO text is not stored here/);
  assert.match(migration, /acceptance_ref text not null/);
  assert.match(migration, /controlled_method_ref text not null/);
});

test("ISO 4210 frame and fork verification catalogue is present", () => {
  for (const methodId of ["FR-IMP-01", "FR-IMP-02", "FR-FAT-01", "FR-FAT-02", "FR-FAT-03", "FR-BRK-01", "FK-STR-01", "FK-STR-02", "FK-IMP-01", "FK-FAT-01", "FK-BRK-01", "FK-STM-01"]) {
    assert.match(migration, new RegExp(methodId));
  }
});

test("calibration validity is a hard ISO test-execution gate", () => {
  assert.match(service, /ISO test blocked: calibration expired or missing/);
  assert.match(service, /calibration_due_on::text/);
  assert.match(service, /calibration_valid_at_test/);
  assert.match(service, /Physical ISO test execution requires measurement\/test equipment evidence/);
});

test("failed ISO verification is linked into canonical NCR authority", () => {
  assert.match(migration, /ncr_id text references vyndi_quality_ncrs/);
  assert.match(migration, /check \(result <> 'fail' or ncr_id is not null\)/);
  assert.match(service, /Failed ISO test must be linked to an NCR/);
});

test("product release requires complete evidence and dual Engineering/Quality approval", () => {
  assert.match(service, /Mandatory ISO verification evidence is incomplete/);
  assert.match(service, /ISO verification has open NCR evidence/);
  assert.match(service, /ISO verification has open CAPA evidence/);
  assert.match(service, /both Engineering and Quality approval references/);
  assert.match(migration, /decision <> 'approved' or \(engineering_approval_ref is not null and quality_approval_ref is not null\)/);
});

test("VIBPE gets a governed read-only ISO release readiness projection", () => {
  assert.match(migration, /create or replace view vyndi_vibpe_iso_release_status/);
  assert.match(migration, /ready_for_dual_approval/);
  assert.match(route, /vyndi_vibpe_iso_release_status/);
  assert.match(route, /VIBPE may report readiness but cannot authorize release automatically/);
});

test("Quality UI adds ISO compliance without root-shell coupling", () => {
  assert.match(route, /listIsoQualityCompliance/);
  assert.match(route, /ISO Standards Register/);
  assert.match(route, /ISO 4210 Frame & Fork Verification/);
  assert.match(route, /Product Conformity & Production Release/);
  assert.doesNotMatch(service, /__root/);
});
