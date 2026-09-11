import assert from "node:assert/strict";
import test from "node:test";
import {
  authorityForVayuDriveChunk,
  classifyVayuDrivePath,
  isExcludedVayuDriveEntry,
} from "../src/lib/vibpe-vayu-drive-policy.ts";

test("Vayu Drive excludes secret and credential paths", () => {
  assert.equal(
    isExcludedVayuDriveEntry({ id: "12D8SfbcnX9y5E9oOa614SE7BUYBbRQEK", name: "google client secret for shyamsundhar1982" }),
    true,
  );
  assert.equal(isExcludedVayuDriveEntry({ id: "safe", name: "OAuth refresh token backup.txt" }), true);
  assert.equal(isExcludedVayuDriveEntry({ id: "safe", name: "Final Master Geometry.html" }), false);
});

test("Vayu Drive ranks controlled engineering references without granting master authority", () => {
  assert.equal(
    classifyVayuDrivePath("VAYU SHASTR/FINAL DOSSIER/VEDM-301 Rev 5.3.8.html"),
    "controlled-reference",
  );
  assert.equal(
    classifyVayuDrivePath("VAYU SHASTR/VAYU_MASTER_ENGINEERING_PACKAGE_REV1/Geometry.html"),
    "controlled-reference",
  );
  assert.equal(
    classifyVayuDrivePath("VAYU SHASTR/VELOXIS ARCHITECTURE ITERATIONS/Rev 5.2.svg"),
    "legacy-working",
  );
  assert.equal(classifyVayuDrivePath("VAYU SHASTR/TORAY COMMUNICATIONS AND SUPPLIER DOCUMENTAIONS/Material.html"), "reference");

  const controlled = authorityForVayuDriveChunk(
    "The selected interface is T47i 85.5 mm and is approved for the current design.",
    "controlled-reference",
  );
  assert.equal(controlled.claimClass, "decision");
  assert.equal(controlled.authority, "advisory");
});

test("Vayu Drive unresolved and legacy content cannot become authoritative", () => {
  assert.deepEqual(
    authorityForVayuDriveChunk("Fork clearance remains unresolved and is to be confirmed.", "controlled-reference"),
    { claimClass: "unresolved_item", authority: "unresolved" },
  );
  assert.deepEqual(
    authorityForVayuDriveChunk("Concept geometry for exploration.", "legacy-working"),
    { claimClass: "assumption", authority: "unresolved" },
  );
});
