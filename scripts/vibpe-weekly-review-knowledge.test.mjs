import assert from "node:assert/strict";
import test from "node:test";
import {
  authorityForWeeklyReviewClaim,
  masterKnowledgeWins,
} from "../src/lib/vibpe-knowledge-authority.ts";

test("weekly unresolved claims never become authoritative", () => {
  for (const claimClass of ["unresolved_item", "assumption", "blocker"]) {
    assert.equal(authorityForWeeklyReviewClaim(claimClass), "unresolved");
  }
  for (const claimClass of ["verified_fact", "decision", "priority", "material_change"]) {
    assert.equal(authorityForWeeklyReviewClaim(claimClass), "advisory");
  }
});

test("governed master knowledge overrides conflicting weekly review claims", () => {
  const result = masterKnowledgeWins(
    { id: "engineering.t47i", value: "T47i, 85.5 mm shell width", status: "confirmed" },
    { claimText: "T47 68 mm shell", authority: "advisory" },
  );
  assert.equal(result.source, "governed-internal");
  assert.equal(result.value, "T47i, 85.5 mm shell width");
  assert.equal(result.overriddenReviewClaim, "T47 68 mm shell");
});

test("review-only knowledge remains advisory or assumption context", () => {
  assert.equal(
    masterKnowledgeWins(null, { claimText: "Prototype date target", authority: "advisory" }).source,
    "external-reference",
  );
  assert.equal(
    masterKnowledgeWins(null, { claimText: "700x40 clearance unresolved", authority: "unresolved" }).source,
    "scenario-assumption",
  );
});
