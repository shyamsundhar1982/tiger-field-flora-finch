import { createServerFn } from "@tanstack/react-start";
import { optionalAuthMiddleware } from "@/lib/auth/middleware";
import { requireBusinessActor } from "@/lib/business-actor";
import { getSql } from "@/lib/db";
import { tryGovernanceDataAnswer } from "@/lib/vibpe-governance-queries";

export const askVibpeGovernanceCopilot = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator((input: { question: string }) => ({ question: String(input.question ?? "").trim().slice(0, 1800) }))
  .handler(async ({ data, context }) => {
    if (!data.question) return { handled: false as const };
    await requireBusinessActor(
      "view",
      context.userId ? { userId: context.userId, email: context.userEmail } : undefined,
    );
    const sql = await getSql();
    const answer = await tryGovernanceDataAnswer(sql, data.question);
    if (!answer) return { handled: false as const };
    return { handled: true as const, answer };
  });
