import assert from "node:assert/strict";
import test from "node:test";
import {
  hasExactReleaseLineage,
  isReleaseGovernanceReady,
  isReleaseMathAndCashReady,
} from "./vibpe-optimizer-release-policy.ts";

test("release math/cash gate fails closed", () => {
  for (const status of ["infeasible", "blocked", "error"]) {
    assert.equal(isReleaseMathAndCashReady(status, "feasible"), false);
  }
  assert.equal(isReleaseMathAndCashReady("feasible", "not-evaluated"), false);
  assert.equal(isReleaseMathAndCashReady("optimal", null), false);
  assert.equal(isReleaseMathAndCashReady("feasible", "feasible"), true);
  assert.equal(isReleaseMathAndCashReady("optimal", "feasible"), true);
});

test("release governance requires the advisory-only boundary", () => {
  assert.equal(isReleaseGovernanceReady({ advisoryOnly: true, mayCreateTransactions: false, humanApprovalRequiredForBusinessAction: true }), true);
  assert.equal(isReleaseGovernanceReady(null), false);
  assert.equal(isReleaseGovernanceReady({ advisoryOnly: true, mayCreateTransactions: true, humanApprovalRequiredForBusinessAction: true }), false);
  assert.equal(isReleaseGovernanceReady({ advisoryOnly: true, mayCreateTransactions: false }), false);
});

test("exact release lineage rejects stale source or parent packet", () => {
  const sha = "9e05e4a3f62f1811e293a42676e11b50a00631ed";
  const packetId = "ADV-CURRENT";
  assert.equal(hasExactReleaseLineage({ deployedSourceSha: sha, ibpeSourceSha: sha, packetSourceSha: sha, packetId, runParentPacketId: packetId }), true);
  assert.equal(hasExactReleaseLineage({ deployedSourceSha: sha, ibpeSourceSha: "a8e9e9b9ddb2e27dad53c8c0a3e4a5c7e73253c1", packetSourceSha: sha, packetId, runParentPacketId: packetId }), false);
  assert.equal(hasExactReleaseLineage({ deployedSourceSha: sha, ibpeSourceSha: sha, packetSourceSha: "12a0f29abae43aac322603ca1388b5de75b87e32", packetId, runParentPacketId: packetId }), false);
  assert.equal(hasExactReleaseLineage({ deployedSourceSha: sha, ibpeSourceSha: sha, packetSourceSha: sha, packetId, runParentPacketId: "ADV-OLD" }), false);
});

test("exact release lineage fails when provenance is missing", () => {
  assert.equal(hasExactReleaseLineage({ deployedSourceSha: null, ibpeSourceSha: "abcdef1", packetSourceSha: "abcdef1", packetId: "ADV", runParentPacketId: "ADV" }), false);
  assert.equal(hasExactReleaseLineage({ deployedSourceSha: "abcdef1", ibpeSourceSha: null, packetSourceSha: "abcdef1", packetId: "ADV", runParentPacketId: "ADV" }), false);
  assert.equal(hasExactReleaseLineage({ deployedSourceSha: "abcdef1", ibpeSourceSha: "abcdef1", packetSourceSha: null, packetId: "ADV", runParentPacketId: "ADV" }), false);
});
