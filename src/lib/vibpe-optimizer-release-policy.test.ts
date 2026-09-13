import assert from "node:assert/strict";
import test from "node:test";
import {
  hasExactReleaseLineage,
  isReleaseGovernanceReady,
  isReleaseMathAndCashReady,
} from "./vibpe-optimizer-release-policy.ts";

test("release math gate rejects infeasible blocked and error runs", () => {
  for (const status of ["infeasible", "blocked", "error"]) {
    assert.equal(isReleaseMathAndCashReady({ optimizationStatus: status, cashGuardrailStatus: "feasible", governance: null }), false);
  }
});

test("release math gate requires feasible cash for feasible or optimal runs", () => {
  assert.equal(isReleaseMathAndCashReady({ optimizationStatus: "feasible", cashGuardrailStatus: "feasible", governance: null }), true);
  assert.equal(isReleaseMathAndCashReady({ optimizationStatus: "optimal", cashGuardrailStatus: "feasible", governance: null }), true);
  assert.equal(isReleaseMathAndCashReady({ optimizationStatus: "feasible", cashGuardrailStatus: "not-evaluated", governance: null }), false);
  assert.equal(isReleaseMathAndCashReady({ optimizationStatus: "optimal", cashGuardrailStatus: null, governance: null }), false);
});

test("release governance requires all advisory-only boundary flags", () => {
  assert.equal(isReleaseGovernanceReady({ advisoryOnly: true, mayCreateTransactions: false, humanApprovalRequiredForBusinessAction: true }), true);
  assert.equal(isReleaseGovernanceReady(null), false);
  assert.equal(isReleaseGovernanceReady({ advisoryOnly: true, mayCreateTransactions: true, humanApprovalRequiredForBusinessAction: true }), false);
  assert.equal(isReleaseGovernanceReady({ advisoryOnly: true, mayCreateTransactions: false }), false);
});

test("exact lineage rejects stale IBPE packet or optimizer parent", () => {
  const sha = "cefef388dcdd8416d212bcef2b0337f4fff62675";
  const packet = "ADV-CURRENT";
  assert.equal(hasExactReleaseLineage({ deployedSourceSha: sha, ibpeSourceSha: sha, packetSourceSha: sha, packetId: packet, runParentPacketId: packet }), true);
  assert.equal(hasExactReleaseLineage({ deployedSourceSha: sha, ibpeSourceSha: "a8e9e9b9ddb2e27dad53c8c0a3e4a5c7e73253c1", packetSourceSha: sha, packetId: packet, runParentPacketId: packet }), false);
  assert.equal(hasExactReleaseLineage({ deployedSourceSha: sha, ibpeSourceSha: sha, packetSourceSha: "12a0f29abae43aac322603ca1388b5de75b87e32", packetId: packet, runParentPacketId: packet }), false);
  assert.equal(hasExactReleaseLineage({ deployedSourceSha: sha, ibpeSourceSha: sha, packetSourceSha: sha, packetId: packet, runParentPacketId: "ADV-OLD" }), false);
});

test("exact lineage fails closed when any provenance evidence is missing", () => {
  assert.equal(hasExactReleaseLineage({ deployedSourceSha: null, ibpeSourceSha: "abcdef1", packetSourceSha: "abcdef1", packetId: "ADV", runParentPacketId: "ADV" }), false);
  assert.equal(hasExactReleaseLineage({ deployedSourceSha: "abcdef1", ibpeSourceSha: null, packetSourceSha: "abcdef1", packetId: "ADV", runParentPacketId: "ADV" }), false);
  assert.equal(hasExactReleaseLineage({ deployedSourceSha: "abcdef1", ibpeSourceSha: "abcdef1", packetSourceSha: null, packetId: "ADV", runParentPacketId: "ADV" }), false);
});
