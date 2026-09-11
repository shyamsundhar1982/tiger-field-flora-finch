import { createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { getCommandRole } from "@/lib/command-access";
import { getSql } from "@/lib/db";
import { canPerform } from "@/lib/page-access";

export const VAYU_SHASTR_SOURCE_ID = "VIBPE-SRC-VAYU-SHASTR-DRIVE";
export const VAYU_SHASTR_ROOT_FOLDER_ID = "1QDwLydKu5tQthElxTGCT4BO2AP5xXkKS";

const EXCLUDED_FOLDER_IDS = new Set([
  "12D8SfbcnX9y5E9oOa614SE7BUYBbRQEK", // google client secret for shyamsundhar1982
]);

const SECRET_NAME_PATTERN = /client\s*secret|credential|password|private\s*key|api\s*key|oauth\s*token|access\s*token|refresh\s*token/i;
const LOW_AUTHORITY_PATTERN = /\b(draft|rough|sample|copy|old|preliminary|iteration|rev\s*0)\b/i;
const CONTROLLED_REFERENCE_PATH = /(^|\/)(FINAL DOSSIER|VAYU_MASTER_ENGINEERING_PACKAGE_REV1)(\/|$)/i;
const FOLDER_MIME = "application/vnd.google-apps.folder";
const DOC_MIME = "application/vnd.google-apps.document";
const SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const TEXT_MIMES = new Set([
  "text/plain",
  "text/html",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/xml",
  "text/xml",
]);

type DriveItem = {
  id: string;
  name: string;
  mimeType?: string;
  modifiedTime?: string;
  version?: string;
  webViewLink?: string;
  size?: string;
};

type IndexedItem = DriveItem & {
  path: string;
  folderPath: string;
  knowledgeTier: "controlled-reference" | "reference" | "legacy-working";
};

function hash(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function inferDomain(path: string) {
  const p = path.toLowerCase();
  if (/toray|laminate|layup|composite|ply|material/.test(p)) return "materials";
  if (/tansam|tancam|incubat/.test(p)) return "incubation";
  if (/rfq|supplier|procure/.test(p)) return "procurement";
  if (/presentation|pitch|investor/.test(p)) return "venture";
  if (/geometry|engineering|cad|fea|cfd|frame|fork|dossier|iso 4210/.test(p)) return "engineering";
  if (/manufactur|prototype|oem|tooling/.test(p)) return "manufacturing";
  return "venture";
}

function inferKnowledgeTier(path: string) {
  if (LOW_AUTHORITY_PATTERN.test(path) || /VELOXIS ARCHITECTURE ITERATIONS/i.test(path)) return "legacy-working" as const;
  if (CONTROLLED_REFERENCE_PATH.test(path)) return "controlled-reference" as const;
  return "reference" as const;
}

function chunkText(text: string, maxChunks = 120) {
  const cleaned = text.replace(/\r/g, "").trim();
  if (!cleaned) return [];
  const paragraphs = cleaned
    .split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part.length >= 24);
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if ((current + " " + paragraph).length > 1200 && current) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = current ? current + " " + paragraph : paragraph;
    }
    if (chunks.length >= maxChunks) break;
  }
  if (current && chunks.length < maxChunks) chunks.push(current);
  return chunks;
}

function claimClassForChunk(text: string, tier: IndexedItem["knowledgeTier"]) {
  if (/unresolved|pending|not verified|not yet|tbd|to be confirmed/i.test(text)) return "unresolved_item" as const;
  if (/assum|proposal|proposed|target|concept/i.test(text) || tier === "legacy-working") return "assumption" as const;
  if (/decision|approved|selected|frozen|released/i.test(text)) return "decision" as const;
  return "verified_fact" as const;
}

async function googleAccessToken() {
  if (process.env.GOOGLE_DRIVE_ACCESS_TOKEN) return process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) throw new Error("Google Drive knowledge sync is not configured.");
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
  if (!response.ok) throw new Error(`Google Drive content request failed (${response.status}).`);
  return response.text();
}

async function listChildren(folderId: string, token: string): Promise<DriveItem[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const fields = encodeURIComponent("nextPageToken,files(id,name,mimeType,modifiedTime,version,webViewLink,size)");
  let pageToken: string | undefined;
  const all: DriveItem[] = [];
  do {
    const suffix = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
    const data = await driveJson(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=1000&orderBy=folder,name${suffix}`,
      token,
    ) as { files?: DriveItem[]; nextPageToken?: string };
    all.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken && all.length < 1000);
  return all;
}

async function crawlDrive(token: string, maxFiles = 600) {
  const files: IndexedItem[] = [];
  const skipped: Array<{ id: string; path: string; reason: string }> = [];
  const walk = async (folderId: string, folderPath: string, depth: number): Promise<void> => {
    if (depth > 8 || files.length >= maxFiles) return;
    const children = await listChildren(folderId, token);
    for (const item of children) {
      const path = folderPath ? `${folderPath}/${item.name}` : item.name;
      if (item.mimeType === FOLDER_MIME) {
        if (EXCLUDED_FOLDER_IDS.has(item.id) || SECRET_NAME_PATTERN.test(item.name)) {
          skipped.push({ id: item.id, path, reason: "secret-folder-excluded" });
          continue;
        }
        await walk(item.id, path, depth + 1);
        continue;
      }
      if (SECRET_NAME_PATTERN.test(item.name)) {
        skipped.push({ id: item.id, path, reason: "secret-name-excluded" });
        continue;
      }
      files.push({
        ...item,
        path,
        folderPath,
        knowledgeTier: inferKnowledgeTier(path),
      });
      if (files.length >= maxFiles) break;
    }
  };
  await walk(VAYU_SHASTR_ROOT_FOLDER_ID, "VAYU SHASTR", 0);
  return { files, skipped };
}

async function readText(item: IndexedItem, token: string) {
  const mime = item.mimeType ?? "";
  if (mime === DOC_MIME) {
    return driveText(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(item.id)}/export?mimeType=text%2Fplain`, token);
  }
  if (mime === SHEET_MIME) {
    try {
      return await driveText(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(item.id)}/export?mimeType=text%2Fcsv`, token);
    } catch {
      return null;
    }
  }
  if (TEXT_MIMES.has(mime) || mime === "image/svg+xml") {
    const raw = await driveText(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(item.id)}?alt=media`, token);
    return mime === "text/html" ? stripHtml(raw) : raw;
  }
  return null;
}

async function persistDocument(item: IndexedItem, text: string | null, role: string) {
  const sql = await getSql();
  const normalized = (text ?? "").trim();
  const contentHash = hash(normalized || JSON.stringify({
    id: item.id,
    name: item.name,
    path: item.path,
    modifiedTime: item.modifiedTime,
    version: item.version,
    mimeType: item.mimeType,
  }));
  const existing = await sql<{ id: string }>`
    select id from vibpe_knowledge_documents
    where source_id = ${VAYU_SHASTR_SOURCE_ID}
      and external_id = ${item.id}
      and content_hash = ${contentHash}
    limit 1
  `;
  if (existing.length) return { idempotent: true, documentId: existing[0].id, indexedClaims: 0 };

  const documentId = crypto.randomUUID();
  const metadata = {
    provider: "google-drive",
    path: item.path,
    folderPath: item.folderPath,
    mimeType: item.mimeType,
    modifiedTime: item.modifiedTime,
    size: item.size,
    knowledgeTier: item.knowledgeTier,
    binaryMetadataOnly: !normalized,
  };
  await sql`
    insert into vibpe_knowledge_documents
      (id, source_id, external_id, external_url, title, review_date, source_revision, content_hash, metadata_json)
    values
      (${documentId}, ${VAYU_SHASTR_SOURCE_ID}, ${item.id}, ${item.webViewLink ?? null}, ${item.name},
       null, ${item.version ?? item.modifiedTime ?? null}, ${contentHash}, ${JSON.stringify(metadata)}::jsonb)
  `;

  let indexedClaims = 0;
  if (normalized) {
    const domain = inferDomain(item.path);
    const chunks = chunkText(normalized);
    for (const [index, chunk] of chunks.entries()) {
      const claimClass = claimClassForChunk(chunk, item.knowledgeTier);
      const authority = claimClass === "unresolved_item" || claimClass === "assumption" ? "unresolved" : "advisory";
      const confidence = item.knowledgeTier === "controlled-reference" ? 0.88 : item.knowledgeTier === "legacy-working" ? 0.45 : 0.68;
      await sql`
        insert into vibpe_knowledge_claims
          (id, document_id, domain, claim_class, subject_key, claim_text, authority, confidence, source_locator)
        values
          (${crypto.randomUUID()}, ${documentId}, ${domain}, ${claimClass}, null, ${chunk}, ${authority},
           ${confidence}, ${item.path + "#chunk-" + (index + 1)})
      `;
      indexedClaims += 1;
    }
  }

  await sql`
    update vibpe_knowledge_documents
    set superseded_at = now()
    where source_id = ${VAYU_SHASTR_SOURCE_ID}
      and external_id = ${item.id}
      and id <> ${documentId}
      and superseded_at is null
  `;
  await sql`
    insert into vyndi_audit_events
      (id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,payload_json)
    values
      (${crypto.randomUUID()},'vibpe_knowledge_document',${documentId},1,'knowledge_ingest',
       ${"command:" + role},${role},${"GOOGLE-DRIVE:" + item.id},
       ${JSON.stringify({ sourceId: VAYU_SHASTR_SOURCE_ID, path: item.path, knowledgeTier: item.knowledgeTier, indexedClaims })}::jsonb)
  `;
  return { idempotent: false, documentId, indexedClaims };
}

export async function syncVayuShastrDrive(role: string) {
  const token = await googleAccessToken();
  const crawl = await crawlDrive(token);
  let textIndexed = 0;
  let metadataOnly = 0;
  let newDocuments = 0;
  let claims = 0;

  for (const item of crawl.files) {
    let text: string | null = null;
    try {
      text = await readText(item, token);
    } catch {
      text = null;
    }
    const outcome = await persistDocument(item, text, role);
    if (!outcome.idempotent) newDocuments += 1;
    claims += outcome.indexedClaims;
    if (text?.trim()) textIndexed += 1;
    else metadataOnly += 1;
  }

  const sql = await getSql();
  await sql`
    update vibpe_knowledge_sources
    set last_ingested_at = now(), updated_at = now()
    where id = ${VAYU_SHASTR_SOURCE_ID}
  `;
  await sql`
    insert into vyndi_audit_events
      (id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,payload_json)
    values
      (${crypto.randomUUID()},'vibpe_knowledge_source',${VAYU_SHASTR_SOURCE_ID},1,'knowledge_source_refresh',
       ${"command:" + role},${role},${"GOOGLE-DRIVE-FOLDER:" + VAYU_SHASTR_ROOT_FOLDER_ID},
       ${JSON.stringify({
         scanned: crawl.files.length,
         excluded: crawl.skipped.length,
         excludedPaths: crawl.skipped.map((item) => item.path),
         newDocuments,
         textIndexed,
         metadataOnly,
         claims,
       })}::jsonb)
  `;

  return {
    ok: true,
    scanned: crawl.files.length,
    excluded: crawl.skipped.length,
    newDocuments,
    textIndexed,
    metadataOnly,
    claims,
  };
}

export async function refreshVayuShastrDriveIfStale(role: string, maxAgeHours = 12) {
  const sql = await getSql();
  const rows = await sql<{ last_ingested_at: string | null }>`
    select last_ingested_at::text from vibpe_knowledge_sources where id = ${VAYU_SHASTR_SOURCE_ID} limit 1
  `;
  const last = rows[0]?.last_ingested_at ? Date.parse(rows[0].last_ingested_at) : 0;
  if (last && Date.now() - last < maxAgeHours * 60 * 60 * 1000) {
    return { ok: true, skipped: true, reason: "fresh" as const };
  }
  return { ...(await syncVayuShastrDrive(role)), skipped: false };
}

export const refreshVayuShastrDrive = createServerFn({ method: "POST" }).handler(async () => {
  assertSameSiteRequest();
  const role = await getCommandRole();
  if (!role || !canPerform(role, "edit")) throw new Error("Knowledge refresh permission denied.");
  return syncVayuShastrDrive(role);
});

export const listVayuShastrKnowledge = createServerFn({ method: "GET" }).handler(async () => {
  assertSameSiteRequest();
  const role = await getCommandRole();
  if (!role || !canPerform(role, "view")) throw new Error("Knowledge access denied.");
  const sql = await getSql();
  return sql<{
    document_id: string;
    title: string;
    external_url: string | null;
    source_revision: string | null;
    ingested_at: string;
    claim_count: number;
    unresolved_count: number;
    path: string | null;
    knowledge_tier: string | null;
    binary_metadata_only: string | null;
  }>`
    select
      d.id as document_id,
      d.title,
      d.external_url,
      d.source_revision,
      d.ingested_at::text,
      count(c.id)::int as claim_count,
      count(c.id) filter (where c.authority='unresolved')::int as unresolved_count,
      d.metadata_json->>'path' as path,
      d.metadata_json->>'knowledgeTier' as knowledge_tier,
      d.metadata_json->>'binaryMetadataOnly' as binary_metadata_only
    from vibpe_knowledge_documents d
    left join vibpe_knowledge_claims c on c.document_id=d.id
    where d.source_id=${VAYU_SHASTR_SOURCE_ID}
      and d.superseded_at is null
    group by d.id
    order by
      case d.metadata_json->>'knowledgeTier'
        when 'controlled-reference' then 0
        when 'reference' then 1
        else 2
      end,
      d.metadata_json->>'path',
      d.title
    limit 500
  `;
});
