import { createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { getCommandRole } from "@/lib/command-access";
import { getSql } from "@/lib/db";
import { canPerform } from "@/lib/page-access";

export const WEEKLY_REVIEW_SOURCE_ID = "VIBPE-SRC-WEEKLY-REVIEWS";

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
    source: reviewClaim.authority === "unresolved" ? "scenario-assumption" as const : "external-reference" as const,
  };
}

const claimSchema = z.object({
  domain: z.string().min(1).max(80),
  claimClass: z.enum(claimClasses),
  subjectKey: z.string().max(160).optional(),
  claimText: z.string().min(1).max(4000),
  confidence: z.number().min(0).max(1).default(0.5),
  conflictsWith: z.string().max(200).optional(),
  sourceLocator: z.string().max(500).optional(),
});

const ingestSchema = z.object({
  externalId: z.string().min(1).max(300),
  externalUrl: z.string().url().optional(),
  title: z.string().min(1).max(300),
  reviewDate: z.string().date().optional(),
  sourceRevision: z.string().max(300).optional(),
  content: z.string().min(1),
  claims: z.array(claimSchema).max(250),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function hashContent(content: string) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export const ingestVibpeWeeklyReview = createServerFn({ method: "POST" })
  .validator(ingestSchema)
  .handler(async ({ data }) => {
    assertSameSiteRequest();
    const role = await getCommandRole();
    if (!role || !canPerform(role, "edit")) {
      throw new Error("Knowledge ingestion permission denied.");
    }

    const sql = await getSql();
    const contentHash = hashContent(data.content);
    const existing = await sql<{ id: string }>`
      select id from vibpe_knowledge_documents
      where source_id = ${WEEKLY_REVIEW_SOURCE_ID}
        and external_id = ${data.externalId}
        and content_hash = ${contentHash}
      limit 1
    `;

    if (existing.length) {
      return { ok: true, idempotent: true, documentId: existing[0].id };
    }

    const documentId = crypto.randomUUID();
    const actorUserId = `command:${role}`;

    await sql.begin(async (tx) => {
      await tx`
        update vibpe_knowledge_documents
        set superseded_at = now()
        where source_id = ${WEEKLY_REVIEW_SOURCE_ID}
          and external_id = ${data.externalId}
          and superseded_at is null
      `;

      await tx`
        insert into vibpe_knowledge_documents
          (id, source_id, external_id, external_url, title, review_date, source_revision, content_hash, metadata_json)
        values
          (${documentId}, ${WEEKLY_REVIEW_SOURCE_ID}, ${data.externalId}, ${data.externalUrl ?? null},
           ${data.title}, ${data.reviewDate ?? null}, ${data.sourceRevision ?? null}, ${contentHash},
           ${JSON.stringify(data.metadata ?? {})}::jsonb)
      `;

      for (const claim of data.claims) {
        await tx`
          insert into vibpe_knowledge_claims
            (id, document_id, domain, claim_class, subject_key, claim_text, authority, confidence, conflicts_with, source_locator)
          values
            (${crypto.randomUUID()}, ${documentId}, ${claim.domain}, ${claim.claimClass},
             ${claim.subjectKey ?? null}, ${claim.claimText},
             ${authorityForWeeklyReviewClaim(claim.claimClass)}, ${claim.confidence},
             ${claim.conflictsWith ?? null}, ${claim.sourceLocator ?? null})
        `;
      }

      await tx`
        update vibpe_knowledge_sources
        set last_ingested_at = now(), updated_at = now()
        where id = ${WEEKLY_REVIEW_SOURCE_ID}
      `;

      await tx`
        insert into vyndi_audit_events
          (id, entity_type, entity_id, entity_revision, action, actor_user_id, actor_role, payload_json)
        values
          (${crypto.randomUUID()}, 'vibpe_knowledge_document', ${documentId}, 1, 'knowledge_ingest',
           ${actorUserId}, ${role},
           ${JSON.stringify({
             sourceId: WEEKLY_REVIEW_SOURCE_ID,
             externalId: data.externalId,
             title: data.title,
             contentHash,
             claimCount: data.claims.length,
           })}::jsonb)
      `;
    });

    return { ok: true, idempotent: false, documentId, contentHash };
  });

export const listVibpeWeeklyReviewKnowledge = createServerFn({ method: "GET" }).handler(async () => {
  assertSameSiteRequest();
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view")) {
    throw new Error("Knowledge access denied.");
  }
  const sql = await getSql();
  return sql<{
    document_id: string;
    title: string;
    review_date: string | null;
    source_revision: string | null;
    external_url: string | null;
    ingested_at: string;
    claim_count: number;
    unresolved_count: number;
  }>`
    select
      d.id as document_id,
      d.title,
      d.review_date::text,
      d.source_revision,
      d.external_url,
      d.ingested_at::text,
      count(c.id)::int as claim_count,
      count(c.id) filter (where c.authority = 'unresolved')::int as unresolved_count
    from vibpe_knowledge_documents d
    left join vibpe_knowledge_claims c on c.document_id = d.id
    where d.source_id = ${WEEKLY_REVIEW_SOURCE_ID}
      and d.superseded_at is null
    group by d.id
    order by d.review_date desc nulls last, d.ingested_at desc
  `;
});
