import { createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { getCommandRole } from "@/lib/command-access";
import { getSql } from "@/lib/db";
import { canPerform } from "@/lib/page-access";
import {
  authorityForWeeklyReviewClaim,
  claimClasses,
  type VibpeClaimClass,
} from "@/lib/vibpe-knowledge-authority";

export const WEEKLY_REVIEW_SOURCE_ID = "VIBPE-SRC-WEEKLY-REVIEWS";
export const WEEKLY_REVIEW_FOLDER_ID = "1_2Py8ORHfR2zyhT4S-nUL0PYihK87T12";

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

function inferReviewDate(title: string) {
  return title.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
}

function classifyLine(section: string, line: string): VibpeClaimClass {
  const s = section.toLowerCase();
  const l = line.toLowerCase();
  if (s.includes("next three priorities") || s.includes("priorities")) return "priority";
  if (s.includes("blockers")) return l.includes("decision") ? "decision" : "blocker";
  if (s.includes("material changes")) return "material_change";
  if (/unresolved|unverified|pending|not yet|no newly verified|remain(s)? unresolved/.test(l)) return "unresolved_item";
  if (/assum|target|planned|proposal/.test(l)) return "assumption";
  return "verified_fact";
}

export function extractWeeklyReviewClaims(content: string) {
  const claims: Array<z.infer<typeof claimSchema>> = [];
  let section = "Executive status";
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[A-Z][A-Z0-9 /&—-]{3,}$/.test(line) || /^#{1,4}\s+/.test(line)) {
      section = line.replace(/^#+\s*/, "");
      continue;
    }
    if (/^(VYNDI WEEKLY STATUS REVIEW|Overall status:|Document type:|Knowledge role:|Review date:|Authority:|Domains:)/i.test(line)) {
      continue;
    }
    if (line.length < 12) continue;
    const claimClass = classifyLine(section, line);
    claims.push({
      domain: /engineering|design|clearance|geometry|fork|frame|cad/i.test(line)
        ? "engineering"
        : /prototype|manufactur|oem|tooling|laminate/i.test(line)
          ? "manufacturing"
          : /incubat|tansam|tancam/i.test(line)
            ? "incubation"
            : /launch/i.test(line)
              ? "launch"
              : /vibpe|ibpe|erp|system|deployment/i.test(line)
                ? "operations"
                : "venture",
      claimClass,
      claimText: line,
      confidence: claimClass === "verified_fact" ? 0.75 : 0.6,
      sourceLocator: section,
    });
  }
  return claims.slice(0, 250);
}

async function persistReview(data: z.infer<typeof ingestSchema>, role: string) {
  const sql = await getSql();
  const contentHash = hashContent(data.content);
  const existing = await sql<{ id: string }>`
    select id from vibpe_knowledge_documents
    where source_id = ${WEEKLY_REVIEW_SOURCE_ID}
      and external_id = ${data.externalId}
      and content_hash = ${contentHash}
    limit 1
  `;
  if (existing.length) return { ok: true, idempotent: true, documentId: existing[0].id, contentHash };

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
         ${JSON.stringify({ sourceId: WEEKLY_REVIEW_SOURCE_ID, externalId: data.externalId, title: data.title, contentHash, claimCount: data.claims.length })}::jsonb)
    `;
  });
  return { ok: true, idempotent: false, documentId, contentHash };
}

async function googleAccessToken() {
  if (process.env.GOOGLE_DRIVE_ACCESS_TOKEN) return process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google Drive knowledge sync is not configured.");
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new Error(`Google OAuth refresh failed (${response.status}).`);
  const json = await response.json() as { access_token?: string };
  if (!json.access_token) throw new Error("Google OAuth refresh did not return an access token.");
  return json.access_token;
}

async function driveJson(url: string, token: string) {
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Google Drive request failed (${response.status}).`);
  return response.json();
}

async function driveText(url: string, token: string) {
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Google Drive export failed (${response.status}).`);
  return response.text();
}

export const ingestVibpeWeeklyReview = createServerFn({ method: "POST" })
  .validator(ingestSchema)
  .handler(async ({ data }) => {
    assertSameSiteRequest();
    const role = await getCommandRole();
    if (!role || !canPerform(role, "edit")) throw new Error("Knowledge ingestion permission denied.");
    return persistReview(data, role);
  });

export const refreshVibpeWeeklyReviewsFromDrive = createServerFn({ method: "POST" }).handler(async () => {
  assertSameSiteRequest();
  const role = await getCommandRole();
  if (!role || !canPerform(role, "edit")) throw new Error("Knowledge refresh permission denied.");

  const token = await googleAccessToken();
  const q = encodeURIComponent(`'${WEEKLY_REVIEW_FOLDER_ID}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.document'`);
  const fields = encodeURIComponent("files(id,name,modifiedTime,version,webViewLink)");
  const result = await driveJson(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=modifiedTime%20desc`, token) as {
    files?: Array<{ id: string; name: string; modifiedTime?: string; version?: string; webViewLink?: string }>;
  };

  const outcomes = [];
  for (const file of result.files ?? []) {
    const text = await driveText(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/export?mimeType=text%2Fplain`,
      token,
    );
    const data = ingestSchema.parse({
      externalId: file.id,
      externalUrl: file.webViewLink,
      title: file.name,
      reviewDate: inferReviewDate(file.name),
      sourceRevision: file.version ?? file.modifiedTime,
      content: text,
      claims: extractWeeklyReviewClaims(text),
      metadata: { modifiedTime: file.modifiedTime, provider: "google-drive" },
    });
    outcomes.push(await persistReview(data, role));
  }
  return { ok: true, scanned: result.files?.length ?? 0, outcomes };
});

export const listVibpeWeeklyReviewKnowledge = createServerFn({ method: "GET" }).handler(async () => {
  assertSameSiteRequest();
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view")) throw new Error("Knowledge access denied.");
  const sql = await getSql();
  return sql<{
    document_id: string; title: string; review_date: string | null; source_revision: string | null;
    external_url: string | null; ingested_at: string; claim_count: number; unresolved_count: number;
  }>`
    select d.id as document_id, d.title, d.review_date::text, d.source_revision, d.external_url,
           d.ingested_at::text, count(c.id)::int as claim_count,
           count(c.id) filter (where c.authority = 'unresolved')::int as unresolved_count
    from vibpe_knowledge_documents d
    left join vibpe_knowledge_claims c on c.document_id = d.id
    where d.source_id = ${WEEKLY_REVIEW_SOURCE_ID} and d.superseded_at is null
    group by d.id
    order by d.review_date desc nulls last, d.ingested_at desc
  `;
});
