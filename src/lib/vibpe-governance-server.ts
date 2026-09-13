import { createServerFn } from "@tanstack/react-start";
import { optionalAuthMiddleware } from "@/lib/auth/middleware";
import { requireBusinessActor } from "@/lib/business-actor";
import { getSql } from "@/lib/db";
import { tryGovernanceDataAnswer } from "@/lib/vibpe-governance-queries";
import { tryVibpeLiveSpecialistAnswer } from "@/lib/vibpe-live-specialist-queries";
import { tryVibpeOperationalControlAudit } from "@/lib/vibpe-operational-control-audit";
import { tryVibpeOperationalControlCompletion } from "@/lib/vibpe-operational-control-completion";
import { tryVibpePriorityOperationalControl } from "@/lib/vibpe-operational-control-priority";
import { answerGovernedOptimizerExecutionRequest } from "@/lib/vibpe-optimizer-copilot";

function normalizeQuestion(question: string) {
  return question
    .replaceAll("\u2019", "'")
    .replaceAll("\u2018", "'")
    .replace(/\s+/g, " ")
    .trim();
}

function isExactOperationalControlQuestion(question: string) {
  const q = normalizeQuestion(question).toLowerCase();
  const governedObject = /\b(job[- ]?cards?|sales\s+orders?|confirmed\s+orders?|bom|skus?|stock|inventory|reservations?|atp|purchase\s+orders?|draft\s+pos?|suppliers?|grn|goods\s+receipts?|quality\s+ratings?|delivery\s+ratings?|routing|work\s+centres?|capacity|capacity\s+standards?|capable[- ]to[- ]promise|ctp)\b/.test(q);
  const exactControl = /\b(which|what|how many|are any|does every|do all|can every|is current|exact|missing|without|no\b|duplicate|duplicated|approved|unapproved|reconcile|match|linked|trace|greater|negative|zero|obsolete|cancelled|superseded|receipt|due|rating|authority|overloaded|loaded|persisted|provisional|sufficient|lifecycle|physical|reserved|solve|blocker)\b/.test(q);
  return governedObject && exactControl;
}

function exactControlFallback(question: string) {
  return [
    "Exact operational-control answer: NOT VERIFIED — specialist reconciliation is required.",
    `The question “${question}” asks for an exact governed-record control check. No exact specialist handler matched, so VIBPE will not substitute a planning summary, traceability lookup, knowledge-pack excerpt, or generic recommendation.`,
    "Controlled next action: run the check against the owning live ledger(s) and return PASS/FAIL/UNKNOWN with the exact exception rows and source authority. Until that handler is implemented, this result must not be treated as evidence that the control passed.",
  ].join("\n\n");
}

export const askVibpeGovernanceCopilot = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator((input: { question: string }) => ({
    question: String(input.question ?? "").trim().slice(0, 1800),
  }))
  .handler(async ({ data, context }) => {
    if (!data.question) return { handled: false as const };

    await requireBusinessActor(
      "view",
      context.userId ? { userId: context.userId, email: context.userEmail } : undefined,
    );

    const sql = await getSql();
    const question = normalizeQuestion(data.question);

    const priorityAnswer = await tryVibpePriorityOperationalControl(sql, question);
    if (priorityAnswer) return { handled: true as const, answer: priorityAnswer };

    const completionAnswer = await tryVibpeOperationalControlCompletion(sql, question);
    if (completionAnswer) return { handled: true as const, answer: completionAnswer };

    const operationalAuditAnswer = await tryVibpeOperationalControlAudit(sql, question);
    if (operationalAuditAnswer) return { handled: true as const, answer: operationalAuditAnswer };

    const specialistAnswer = await tryVibpeLiveSpecialistAnswer(sql, question);
    if (specialistAnswer) return { handled: true as const, answer: specialistAnswer };

    const governanceAnswer = await tryGovernanceDataAnswer(sql, data.question);
    if (governanceAnswer) return { handled: true as const, answer: governanceAnswer };

    if (isExactOperationalControlQuestion(question)) {
      return { handled: true as const, answer: exactControlFallback(question) };
    }

    const optimizerAnswer = await answerGovernedOptimizerExecutionRequest(sql, question);
    if (optimizerAnswer) return { handled: true as const, answer: optimizerAnswer };

    return { handled: false as const };
  });
