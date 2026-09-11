export const VAYU_SHASTR_SECRET_FOLDER_IDS = new Set([
  "12D8SfbcnX9y5E9oOa614SE7BUYBbRQEK",
]);

export const VAYU_SHASTR_SECRET_NAME_PATTERN =
  /client\s*secret|credential|password|private\s*key|api\s*key|oauth\s*token|access\s*token|refresh\s*token/i;

const LOW_AUTHORITY_PATTERN = /\b(draft|rough|sample|copy|old|preliminary|iteration|rev\s*0)\b/i;
const CONTROLLED_REFERENCE_PATH = /(^|\/)(FINAL DOSSIER|VAYU_MASTER_ENGINEERING_PACKAGE_REV1)(\/|$)/i;

export type VayuDriveKnowledgeTier = "controlled-reference" | "reference" | "legacy-working";

export function isExcludedVayuDriveEntry(input: { id: string; name: string }) {
  return VAYU_SHASTR_SECRET_FOLDER_IDS.has(input.id) || VAYU_SHASTR_SECRET_NAME_PATTERN.test(input.name);
}

export function classifyVayuDrivePath(path: string): VayuDriveKnowledgeTier {
  if (LOW_AUTHORITY_PATTERN.test(path) || /VELOXIS ARCHITECTURE ITERATIONS/i.test(path)) return "legacy-working";
  if (CONTROLLED_REFERENCE_PATH.test(path)) return "controlled-reference";
  return "reference";
}

export function authorityForVayuDriveChunk(text: string, tier: VayuDriveKnowledgeTier) {
  if (/unresolved|pending|not verified|not yet|tbd|to be confirmed/i.test(text)) {
    return { claimClass: "unresolved_item" as const, authority: "unresolved" as const };
  }
  if (/assum|proposal|proposed|target|concept/i.test(text) || tier === "legacy-working") {
    return { claimClass: "assumption" as const, authority: "unresolved" as const };
  }
  if (/decision|approved|selected|frozen|released/i.test(text)) {
    return { claimClass: "decision" as const, authority: "advisory" as const };
  }
  return { claimClass: "verified_fact" as const, authority: "advisory" as const };
}
