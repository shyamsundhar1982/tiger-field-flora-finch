import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { requireBusinessActor } from "@/lib/business-actor";

const classificationSchema = z.enum([
  "KNOWN_FACT",
  "CALCULATED_RESULT",
  "MANAGEMENT_ASSUMPTION",
  "WARNING",
  "RECOMMENDATION",
  "UNKNOWN",
]);

const actionSchema = z.object({
  title: z.string().min(3).max(180),
  classification: classificationSchema,
  issue: z.string().max(1000).default(""),
  impact: z.string().max(1000).default(""),
  evidence: z.string().max(1500).default(""),
  owner: z.string().max(160).default(""),
  dueDate: z.string().max(20).optional(),
  recommendedAction: z.string().max(1000).default(""),
  escalation: z.string().max(1000).default(""),
});

const decisionSchema = z.object({
  title: z.string().min(3).max(180),
  decision: z.string().min(3).max(1500),
  evidence: z.string().max(1500).default(""),
});

const updatePreviewSchema = z.object({
  input: z.string().min(3).max(6000),
});

const proposalIdSchema = z.object({
  proposalId: z.string().min(8).max(100),
  note: z.string().max(1000).optional(),
});

export type IbpeUpdateDomain =
  | "orders"
  | "cash"
  | "procurement"
  | "inventory"
  | "production"
  | "engineering"
  | "customer"
  | "compliance"
  | "risk"
  | "decision"
  | "action"
  | "unknown";

function classifyDomain(input: string): IbpeUpdateDomain {
  const q = input.toLowerCase();
  const rules: Array<[IbpeUpdateDomain, RegExp]> = [
    ["orders", /order|demand|sales|customer commitment|confirmed units?/],
    ["cash", /cash|collection|receivable|payment|expense|expenditure|funding|finance/],
    ["procurement", /supplier|purchase order|\bpo\b|procure|lead time|quotation|rfq/],
    ["inventory", /inventory|stock|quarantine|receipt|warehouse|msl|safety stock|reorder/],
    ["production", /production|job card|traveller|work centre|capacity|manufactur|quality hold/],
    ["engineering", /engineering|bom|drawing|revision|configuration|cad|fea/],
    ["customer", /customer|investor|dealer|distributor/],
    ["compliance", /compliance|gst|tax|legal|regulatory|audit/],
    ["risk", /risk|warning|blocker|delay|issue|exception/],
    ["decision", /decision|approve|approval|reject|authorize|authorise/],
    ["action", /action|follow up|owner|due date|task/],
  ];
  return rules.find(([, pattern]) => pattern.test(q))?.[0] ?? "unknown";
}

function extractEvidence(input: string) {
  const refs = input.match(/(?:https?:\/\/\S+|(?:PO|SO|JC|TRV|INV|RFQ|BOM|DRG|DOC)-[A-Za-z0-9._/-]+)/gi) ?? [];
  return [...new Set(refs)].slice(0, 20);
}

function extractAmbiguity(input: string, domain: IbpeUpdateDomain) {
  const ambiguity: string[] = [];
  if (domain === "unknown") ambiguity.push("Business domain could not be determined.");
  if (!/\b\d+(?:\.\d+)?\b/.test(input) && /quantity|units?|amount|price|cost|stock|cash|payment|collection/i.test(input)) {
    ambiguity.push("A numeric value appears material but is not explicit.");
  }
  if (!/(today|tomorrow|yesterday|\b20\d{2}-\d{2}-\d{2}\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\bM\d{1,2}\b)/i.test(input)
      && /due|delivery|receive|payment|collection|effective|month|date/i.test(input)) {
    ambiguity.push("Timing/date is referenced but not explicit.");
  }
  return ambiguity;
}

function proposedEffect(domain: IbpeUpdateDomain) {
  if (domain === "action") return { adapter: "ibpe-management-action", protectedDomain: false };
  if (domain === "decision") return { adapter: "ibpe-decision", protectedDomain: false };
  return {
    adapter: null,
    protectedDomain: ["orders", "cash", "procurement", "inventory", "production", "engineering"].includes(domain),
  };
}

async function writeAudit(
  entityType: string,
  entityId: string,
  action: string,
  actor: { userId: string; role: string },
  payload: unknown,
  sourceReference?: string,
) {
  const sql = await getSql();
  await sql.query(
    `insert into vyndi_audit_events
      (id,entity_type,entity_id,action,actor_user_id,actor_role,source_reference,payload_json)
     values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
    [
      `AUD-${crypto.randomUUID()}`,
      entityType,
      entityId,
      action,
      actor.userId,
      actor.role,
      sourceReference ?? null,
      JSON.stringify(payload ?? {}),
    ],
  );
}

export const saveIbpeReportSnapshot = createServerFn({ method: "POST" })
  .validator((input: {
    schemaVersion: string;
    evidenceCutoff: string;
    source: "canonical-erp-report-pack";
    payload: unknown;
  }) => input)
  .handler(async ({ data }) => {
    assertSameSiteRequest();
    const actor = await requireBusinessActor("edit");
    if (data.source !== "canonical-erp-report-pack") throw new Error("IBPE snapshot source is not governed.");
    const id = `IBPE-SNAPSHOT-${crypto.randomUUID()}`;
    const sql = await getSql();
    await sql.query(
      `insert into vyndi_ibpe_report_snapshots
       (id,schema_version,evidence_cutoff,source,payload_json,created_by,created_by_role)
       values ($1,$2,$3::timestamptz,$4,$5::jsonb,$6,$7)`,
      [id, data.schemaVersion, data.evidenceCutoff, data.source, JSON.stringify(data.payload), actor.userId, actor.role],
    );
    await writeAudit("ibpe_report_snapshot", id, "created", actor, {
      schemaVersion: data.schemaVersion,
      evidenceCutoff: data.evidenceCutoff,
      source: data.source,
    });
    return { ok: true, id };
  });

export const createIbpeManagementAction = createServerFn({ method: "POST" })
  .validator(actionSchema)
  .handler(async ({ data }) => {
    assertSameSiteRequest();
    const actor = await requireBusinessActor("edit");
    const id = `IBPE-ACTION-${crypto.randomUUID()}`;
    const sql = await getSql();
    await sql.query(
      `insert into vyndi_ibpe_management_actions
       (id,title,classification,issue,impact,evidence,owner,due_date,recommended_action,escalation,created_by,created_by_role,updated_by,updated_by_role)
       values ($1,$2,$3,$4,$5,$6,$7,$8::date,$9,$10,$11,$12,$11,$12)`,
      [
        id,
        data.title,
        data.classification,
        data.issue,
        data.impact,
        data.evidence,
        data.owner,
        data.dueDate || null,
        data.recommendedAction,
        data.escalation,
        actor.userId,
        actor.role,
      ],
    );
    await writeAudit("ibpe_management_action", id, "created", actor, data);
    return { ok: true, id };
  });

export const createIbpeDecision = createServerFn({ method: "POST" })
  .validator(decisionSchema)
  .handler(async ({ data }) => {
    assertSameSiteRequest();
    const actor = await requireBusinessActor("edit");
    const id = `IBPE-DECISION-${crypto.randomUUID()}`;
    const sql = await getSql();
    await sql.query(
      `insert into vyndi_ibpe_decisions
       (id,title,decision,evidence,created_by,created_by_role)
       values ($1,$2,$3,$4,$5,$6)`,
      [id, data.title, data.decision, data.evidence, actor.userId, actor.role],
    );
    await writeAudit("ibpe_decision", id, "proposed", actor, data);
    return { ok: true, id };
  });

export const previewIbpeBusinessUpdate = createServerFn({ method: "POST" })
  .validator(updatePreviewSchema)
  .handler(async ({ data }) => {
    assertSameSiteRequest();
    const actor = await requireBusinessActor("edit");
    const domain = classifyDomain(data.input);
    const evidence = extractEvidence(data.input);
    const ambiguity = extractAmbiguity(data.input, domain);
    const effect = proposedEffect(domain);
    const interpretation = {
      domain,
      summary: data.input.trim(),
      classification: ambiguity.length ? "UNKNOWN" : "KNOWN_FACT",
      proposedEffect: effect,
      directCanonicalWritePermitted: false,
      confirmationRequired: true,
    };
    const id = `IBPE-UPDATE-${crypto.randomUUID()}`;
    const sql = await getSql();
    await sql.query(
      `insert into vyndi_ibpe_business_update_proposals
       (id,raw_input,domain,interpretation_json,evidence_json,ambiguity_json,impact_json,created_by,created_by_role)
       values ($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9)`,
      [
        id,
        data.input,
        domain,
        JSON.stringify(interpretation),
        JSON.stringify(evidence),
        JSON.stringify(ambiguity),
        JSON.stringify({ protectedDomain: effect.protectedDomain, adapter: effect.adapter }),
        actor.userId,
        actor.role,
      ],
    );
    await writeAudit("ibpe_business_update", id, "previewed", actor, interpretation);
    return { ok: true, proposalId: id, interpretation, evidence, ambiguity };
  });

export const confirmIbpeBusinessUpdate = createServerFn({ method: "POST" })
  .validator(proposalIdSchema)
  .handler(async ({ data }) => {
    assertSameSiteRequest();
    const actor = await requireBusinessActor("approve");
    const sql = await getSql();
    const result = await sql.query(
      `update vyndi_ibpe_business_update_proposals
       set status='confirmed', confirmation_note=$2, confirmed_by=$3, confirmed_by_role=$4, confirmed_at=now()
       where id=$1 and status='previewed'
       returning id,domain,interpretation_json,impact_json`,
      [data.proposalId, data.note ?? null, actor.userId, actor.role],
    );
    if (!result.rows.length) throw new Error("Business Update proposal is not available for confirmation.");
    await writeAudit("ibpe_business_update", data.proposalId, "confirmed", actor, result.rows[0]);
    return { ok: true, proposal: result.rows[0] };
  });

export const applyConfirmedIbpeBusinessUpdate = createServerFn({ method: "POST" })
  .validator(proposalIdSchema)
  .handler(async ({ data }) => {
    assertSameSiteRequest();
    const actor = await requireBusinessActor("approve");
    const sql = await getSql();
    const current = await sql.query(
      `select id,domain,raw_input,interpretation_json,impact_json,status
       from vyndi_ibpe_business_update_proposals where id=$1`,
      [data.proposalId],
    );
    if (!current.rows.length) throw new Error("Business Update proposal not found.");
    const proposal = current.rows[0] as {
      id: string;
      domain: IbpeUpdateDomain;
      raw_input: string;
      interpretation_json: Record<string, unknown>;
      impact_json: { adapter?: string | null; protectedDomain?: boolean };
      status: string;
    };
    if (proposal.status !== "confirmed") throw new Error("Business Update must be confirmed before application.");

    if (proposal.domain === "action") {
      const actionId = `IBPE-ACTION-${crypto.randomUUID()}`;
      await sql.query(
        `insert into vyndi_ibpe_management_actions
         (id,title,classification,issue,impact,evidence,owner,recommended_action,escalation,created_by,created_by_role,updated_by,updated_by_role)
         values ($1,$2,'KNOWN_FACT',$3,'','','',$3,'',$4,$5,$4,$5)`,
        [actionId, proposal.raw_input.slice(0, 180), proposal.raw_input, actor.userId, actor.role],
      );
      await sql.query(
        `update vyndi_ibpe_business_update_proposals set status='applied',applied_at=now() where id=$1`,
        [proposal.id],
      );
      await writeAudit("ibpe_management_action", actionId, "created_from_confirmed_update", actor, { proposalId: proposal.id });
      await writeAudit("ibpe_business_update", proposal.id, "applied", actor, { adapter: "ibpe-management-action", entityId: actionId });
      return { ok: true, applied: true, adapter: "ibpe-management-action", entityId: actionId };
    }

    if (proposal.domain === "decision") {
      const decisionId = `IBPE-DECISION-${crypto.randomUUID()}`;
      await sql.query(
        `insert into vyndi_ibpe_decisions
         (id,title,decision,evidence,created_by,created_by_role)
         values ($1,$2,$3,'',$4,$5)`,
        [decisionId, proposal.raw_input.slice(0, 180), proposal.raw_input, actor.userId, actor.role],
      );
      await sql.query(
        `update vyndi_ibpe_business_update_proposals set status='applied',applied_at=now() where id=$1`,
        [proposal.id],
      );
      await writeAudit("ibpe_decision", decisionId, "proposed_from_confirmed_update", actor, { proposalId: proposal.id });
      await writeAudit("ibpe_business_update", proposal.id, "applied", actor, { adapter: "ibpe-decision", entityId: decisionId });
      return { ok: true, applied: true, adapter: "ibpe-decision", entityId: decisionId };
    }

    await sql.query(
      `update vyndi_ibpe_business_update_proposals set status='blocked' where id=$1`,
      [proposal.id],
    );
    await writeAudit("ibpe_business_update", proposal.id, "blocked", actor, {
      reason: "No registered canonical transaction adapter for this protected domain.",
      domain: proposal.domain,
    });
    return {
      ok: true,
      applied: false,
      blocked: true,
      reason: "Protected business truth must be changed through its existing canonical authority page/API; IBPE will not bypass that boundary.",
      authorityDomain: proposal.domain,
    };
  });

export const listIbpeGovernanceRecords = createServerFn({ method: "GET" }).handler(async () => {
  assertSameSiteRequest();
  await requireBusinessActor("view");
  const sql = await getSql();
  const [actions, decisions, proposals, snapshots] = await Promise.all([
    sql.query(`select * from vyndi_ibpe_management_actions order by updated_at desc limit 100`),
    sql.query(`select * from vyndi_ibpe_decisions order by updated_at desc limit 100`),
    sql.query(`select * from vyndi_ibpe_business_update_proposals order by created_at desc limit 100`),
    sql.query(`select id,schema_version,evidence_cutoff,source,created_by_role,created_at from vyndi_ibpe_report_snapshots order by created_at desc limit 30`),
  ]);
  return {
    actions: actions.rows,
    decisions: decisions.rows,
    proposals: proposals.rows,
    snapshots: snapshots.rows,
  };
});
