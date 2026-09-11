export const claimClasses = [
  "verified_fact",
  "unresolved_item",
  "assumption",
  "decision",
  "blocker",
  "priority",
  "material_change",
] as const;

export type VibpeClaimClass = (typeof claimClasses)[number];
export type VibpeAuthority = "authoritative" | "advisory" | "unresolved";

export function authorityForWeeklyReviewClaim(claimClass: VibpeClaimClass): VibpeAuthority {
  if (claimClass === "unresolved_item" || claimClass === "assumption" || claimClass === "blocker") {
    return "unresolved";
  }
  return "advisory";
}

export function masterKnowledgeWins(
  master: { id: string; value: string; status?: string } | null | undefined,
  reviewClaim: { claimText: string; authority: VibpeAuthority },
) {
  if (master) {
    return {
      value: master.value,
      source: "governed-internal" as const,
      overriddenReviewClaim: reviewClaim.claimText,
    };
  }
  return {
    value: reviewClaim.claimText,
    source: reviewClaim.authority === "unresolved"
      ? "scenario-assumption" as const
      : "external-reference" as const,
  };
}
