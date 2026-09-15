export type VibpeQaPack =
  | "cash-ledger-reconciliation"
  | "procurement-recommendations"
  | "demand-commitment-feasibility"
  | "inventory"
  | "job-card-traveller"
  | "liquidity"
  | "funding"
  | "actual-vs-plan";

export type VibpeQaDimension =
  | "correctness"
  | "completeness"
  | "provenance"
  | "ledger-vs-plan-semantics"
  | "freshness"
  | "repetition"
  | "actionability";

export type VibpeQaCriteria = {
  mustInclude?: string[];
  anyOf?: string[][];
  mustNotInclude?: string[];
  provenanceTerms?: string[];
  truthClassTerms?: string[];
  freshnessTerms?: string[];
  actionTerms?: string[];
  requireAdvisoryBoundary?: boolean;
};

export type VibpeQaCase = {
  id: string;
  pack: VibpeQaPack;
  question: string;
  expected: string;
  criteria: VibpeQaCriteria;
};

export type VibpeQaDimensionResult = {
  dimension: VibpeQaDimension;
  pass: boolean;
  reasons: string[];
};

export type VibpeQaAssessment = {
  pass: boolean;
  defectClasses: VibpeQaDimension[];
  dimensions: VibpeQaDimensionResult[];
};

export type VibpeQaCorrectionProposal = {
  summary: string;
  kind: "code" | "config" | "fixture";
  files: string[];
  requiresMutation: boolean;
  sandbox: boolean;
  forbiddenBusinessEffects?: string[];
};

export type VibpeQaCycleAudit = {
  cycle: number;
  caseId: string;
  pack: VibpeQaPack;
  question: string;
  expected: string;
  rawAnswer: string;
  assessment: VibpeQaAssessment;
  proposal?: VibpeQaCorrectionProposal;
  changedFiles: string[];
  testResults: string[];
  beforeAnswer?: string;
  afterAnswer?: string;
};

const SAFE_PATHS = [
  /^src\/lib\/ibpe-copilot\.ts$/,
  /^src\/lib\/vibpe-[^/]+\.ts$/,
  /^scripts\/vibpe-[^/]+\.(?:mjs|ts)$/,
  /^docs\/VIBPE-[^/]+\.md$/,
  /^\.github\/workflows\/vibpe-copilot-2\.yml$/,
];

const FORBIDDEN_PATHS = [
  /^migrations\//,
  /^src\/routes\/(?!.*vibpe)/,
  /^src\/lib\/(?:sales|procurement|inventory|production|finance|actuals-authority)/,
];

const FORBIDDEN_EFFECTS = [
  /transaction(?:al)?\s+business\s+data/i,
  /(?:create|approve|issue|commit).*purchase\s+order/i,
  /(?:commit|approve).*funding/i,
  /customer\s+promise/i,
  /production\s+release/i,
];

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
const has = (answer: string, term: string) => normalize(answer).includes(normalize(term));

function repeatedSentenceReasons(answer: string) {
  const sentences = answer
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => normalize(part).replace(/[^a-z0-9₹.-]+/g, " ").trim())
    .filter((part) => part.length >= 28);
  const counts = new Map<string, number>();
  for (const sentence of sentences) counts.set(sentence, (counts.get(sentence) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([sentence, count]) => `Repeated ${count}×: ${sentence.slice(0, 120)}`);
}

function dimension(dimension: VibpeQaDimension, reasons: string[]): VibpeQaDimensionResult {
  return { dimension, pass: reasons.length === 0, reasons };
}

export function assessVibpeAnswer(testCase: VibpeQaCase, answer: string): VibpeQaAssessment {
  const c = testCase.criteria;
  const correctness: string[] = [];
  const completeness: string[] = [];
  const provenance: string[] = [];
  const semantics: string[] = [];
  const freshness: string[] = [];
  const actionability: string[] = [];

  for (const term of c.mustInclude ?? []) {
    if (!has(answer, term)) correctness.push(`Missing required term: ${term}`);
  }
  for (const group of c.anyOf ?? []) {
    if (!group.some((term) => has(answer, term))) completeness.push(`Missing one-of: ${group.join(" | ")}`);
  }
  for (const term of c.mustNotInclude ?? []) {
    if (has(answer, term)) correctness.push(`Forbidden term present: ${term}`);
  }
  if ((c.provenanceTerms ?? []).length && !(c.provenanceTerms ?? []).some((term) => has(answer, term))) {
    provenance.push(`Missing provenance marker: ${(c.provenanceTerms ?? []).join(" | ")}`);
  }
  if ((c.truthClassTerms ?? []).length && !(c.truthClassTerms ?? []).some((term) => has(answer, term))) {
    semantics.push(`Missing truth-class distinction: ${(c.truthClassTerms ?? []).join(" | ")}`);
  }
  if ((c.freshnessTerms ?? []).length && !(c.freshnessTerms ?? []).some((term) => has(answer, term))) {
    freshness.push(`Missing freshness/snapshot marker: ${(c.freshnessTerms ?? []).join(" | ")}`);
  }
  if ((c.actionTerms ?? []).length && !(c.actionTerms ?? []).some((term) => has(answer, term))) {
    actionability.push(`Missing controlled next action: ${(c.actionTerms ?? []).join(" | ")}`);
  }
  if (c.requireAdvisoryBoundary && !/(advisory|does not create|remain(?:s)? controlled|human confirmation|human approval|owning workspace|cannot .*automatically)/i.test(answer)) {
    actionability.push("Missing advisory/human-authority boundary.");
  }

  const dimensions = [
    dimension("correctness", correctness),
    dimension("completeness", completeness),
    dimension("provenance", provenance),
    dimension("ledger-vs-plan-semantics", semantics),
    dimension("freshness", freshness),
    dimension("repetition", repeatedSentenceReasons(answer)),
    dimension("actionability", actionability),
  ];
  const defectClasses = dimensions.filter((item) => !item.pass).map((item) => item.dimension);
  return { pass: defectClasses.length === 0, defectClasses, dimensions };
}

export function validateVibpeCorrectionProposal(proposal: VibpeQaCorrectionProposal) {
  if (!proposal.files.length) throw new Error("Correction proposal must name at least one file.");
  for (const path of proposal.files) {
    if (FORBIDDEN_PATHS.some((pattern) => pattern.test(path)) || !SAFE_PATHS.some((pattern) => pattern.test(path))) {
      throw new Error(`VIBPE QA correction scope violation: ${path}`);
    }
  }
  if (proposal.requiresMutation && !proposal.sandbox) {
    throw new Error("Any QA mutation requires a governed test fixture or sandbox.");
  }
  const effectText = [proposal.summary, ...(proposal.forbiddenBusinessEffects ?? [])].join(" ");
  for (const pattern of FORBIDDEN_EFFECTS) {
    if (pattern.test(effectText)) throw new Error(`Forbidden autonomous business effect: ${pattern}`);
  }
  return proposal;
}

export async function runVibpeQaCycle(input: {
  testCase: VibpeQaCase;
  ask: (question: string) => Promise<string>;
  propose?: (audit: VibpeQaCycleAudit) => Promise<VibpeQaCorrectionProposal | undefined>;
  apply?: (proposal: VibpeQaCorrectionProposal, audit: VibpeQaCycleAudit) => Promise<{ changedFiles: string[]; testResults: string[] }>;
  maxCycles?: number;
}) {
  const audits: VibpeQaCycleAudit[] = [];
  const maxCycles = Math.max(1, Math.min(input.maxCycles ?? 3, 5));
  let beforeAnswer: string | undefined;

  for (let cycle = 1; cycle <= maxCycles; cycle += 1) {
    const rawAnswer = await input.ask(input.testCase.question);
    beforeAnswer ??= rawAnswer;
    const assessment = assessVibpeAnswer(input.testCase, rawAnswer);
    const audit: VibpeQaCycleAudit = {
      cycle,
      caseId: input.testCase.id,
      pack: input.testCase.pack,
      question: input.testCase.question,
      expected: input.testCase.expected,
      rawAnswer,
      assessment,
      changedFiles: [],
      testResults: [],
      beforeAnswer,
      afterAnswer: rawAnswer,
    };
    audits.push(audit);
    if (assessment.pass || !input.propose) return audits;

    const proposal = await input.propose(audit);
    if (!proposal) return audits;
    audit.proposal = validateVibpeCorrectionProposal(proposal);
    if (!input.apply) return audits;

    const applied = await input.apply(audit.proposal, audit);
    audit.changedFiles = applied.changedFiles;
    audit.testResults = applied.testResults;
  }
  return audits;
}