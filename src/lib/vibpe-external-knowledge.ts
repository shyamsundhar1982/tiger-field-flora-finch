export type VibpeKnowledgeClass = "governed-internal" | "scenario-assumption" | "external-reference" | "model-inference";

export type VibpeKnowledgeEvidence = {
  class: VibpeKnowledgeClass;
  source: string;
  observedAt?: string;
  citation?: string;
  value: unknown;
};

export function canGovernBusinessTruth(evidence: VibpeKnowledgeEvidence) {
  return evidence.class === "governed-internal";
}

export function externalKnowledgeGuard(evidence: VibpeKnowledgeEvidence) {
  if (evidence.class === "external-reference" || evidence.class === "model-inference") {
    return {
      governing: false,
      advisoryOnly: true,
      reason: "External references and model inference cannot overwrite controlled VYNDI master or transaction truth.",
    } as const;
  }
  return { governing: evidence.class === "governed-internal", advisoryOnly: evidence.class !== "governed-internal" } as const;
}
