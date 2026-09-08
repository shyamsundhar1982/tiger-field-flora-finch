import { createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { requireBusinessActor } from "@/lib/business-actor";
import { evaluateScenario, type IbpeScenarioRequest } from "@/lib/ibpe-scenario-lab";
import type { IntegratedPlanningResult } from "@/lib/integrated-business-planning-engine";

export type IbpeCopilotRequest = {
  question: string;
  scenario?: IbpeScenarioRequest;
};

export type IbpeCopilotResponse = {
  ok: boolean;
  answer?: string;
  error?: string;
  lineage?: {
    governedRunId: string;
    approvedPlanRevision: number;
    inputHash: string;
    sourceSha: string;
  };
  scenarioId?: string;
  advisoryOnly: true;
};

type LatestRunRow = {
  id: string;
  approved_plan_revision: number | string;
  input_hash: string;
  source_sha: string;
  result_json: IntegratedPlanningResult;
};

function sanitizeQuestion(value: unknown) {
  return String(value ?? "").trim().slice(0, 1800);
}

function compactResult(result: IntegratedPlanningResult) {
  const supply = [...result.supply]
    .filter((row) => row.committedFulfillmentShortageQty > 0 || row.recommendedPurchaseQty > 0)
    .sort((a, b) =>
      b.committedFulfillmentShortageQty - a.committedFulfillmentShortageQty ||
      (b.purchaseCostLakh ?? 0) - (a.purchaseCostLakh ?? 0),
    )
    .slice(0, 14);

  const capacity = [...result.capacity]
    .filter((row) => row.shortfallUnits > 0)
    .sort((a, b) => b.shortfallUnits - a.shortfallUnits)
    .slice(0, 10);

  const cash = [...result.cash]
    .sort((a, b) => a.freeLiquidityAfterRecommendationsLakh - b.freeLiquidityAfterRecommendationsLakh)
    .slice(0, 8);

  return {
    summary: result.summary,
    funding: result.funding,
    findings: result.findings.slice(0, 12),
    decisions: result.decisions.slice(0, 10),
    supply,
    capacity,
    lowestLiquidityMonths: cash,
  };
}

function systemPrompt() {
  return [
    "You are VYNDI IBPE Copilot for Vayu Shastr Private Limited.",
    "You are an advisory exploration agent sitting on top of a deterministic Integrated Business Planning Engine.",
    "The deterministic IBPE packet is the authority for quantities, cash, MRP, ATP/MSL, capacity, funding and scenario deltas. Never invent or recompute numbers outside the supplied packet.",
    "Always distinguish plan, forecast, committed and actual truth. A scenario is hypothetical forecast analysis and must never be described as an approved plan or actual transaction.",
    "You may recommend actions, trade-offs and questions to investigate, but you must never claim that you created a purchase order, reservation, job card, accounting posting, funding draw, approval or plan revision.",
    "When data is insufficient, say exactly what is missing.",
    "Prefer concise executive reasoning with: Assessment; Main drivers; Feasible options; Recommended controlled next action; Evidence.",
    "Use month labels like M1..M36 and lakh units exactly as supplied. Mention the governed plan revision/input hash when it materially supports provenance.",
  ].join(" ");
}

async function latestRun() {
  const sql = await getSql();
  const rows = await sql.query<LatestRunRow>(
    `select id,approved_plan_revision,input_hash,source_sha,result_json
       from vyndi_ibpe_runs where status='complete' order by created_at desc limit 1`,
  );
  if (!rows[0]) throw new Error("No governed IBPE run exists. Run governed IBPE first.");
  return { sql, row: rows[0] };
}

export const askIbpeCopilot = createServerFn({ method: "POST" })
  .validator((input: IbpeCopilotRequest) => ({
    question: sanitizeQuestion(input.question),
    scenario: input.scenario,
  }))
  .handler(async ({ data }): Promise<IbpeCopilotResponse> => {
    const actor = await requireBusinessActor("view");
    if (!data.question) return { ok: false, error: "Ask a question first.", advisoryOnly: true };

    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "AI assistance is unavailable in this environment.", advisoryOnly: true };

    const { sql, row } = await latestRun();
    let result = row.result_json;
    let scenarioContext: unknown = null;
    let scenarioId: string | undefined;

    if (data.scenario) {
      const packet = await evaluateScenario(sql, data.scenario);
      result = packet.result;
      scenarioId = packet.scenario.id;
      scenarioContext = {
        scenario: packet.scenario,
        comparisonVsGovernedBaseline: packet.comparison,
      };
    }

    const context = {
      lineage: {
        governedRunId: row.id,
        approvedPlanRevision: Number(row.approved_plan_revision),
        inputHash: row.input_hash,
        sourceSha: row.source_sha,
      },
      scenario: scenarioContext,
      ibpe: compactResult(result),
    };

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.2,
        max_tokens: 900,
        messages: [
          { role: "system", content: systemPrompt() },
          {
            role: "user",
            content: `Question: ${data.question}\n\nGoverned IBPE context:\n${JSON.stringify(context)}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      return { ok: false, error: `AI service error ${response.status}.`, advisoryOnly: true };
    }

    const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const answer = body.choices?.[0]?.message?.content?.trim() ?? "";
    if (!answer) return { ok: false, error: "AI returned no analysis.", advisoryOnly: true };

    const questionHash = createHash("sha256").update(data.question).digest("hex");
    await sql.query(
      `insert into vyndi_audit_events
        (id,entity_type,entity_id,entity_revision,action,actor_user_id,actor_role,source_reference,payload_json)
       values ($1,'ibpe_copilot',$2,$3,'explored',$4,$5,$6,$7::jsonb)`,
      [
        `AUD-IBPE-AI-${crypto.randomUUID()}`,
        row.id,
        Number(row.approved_plan_revision),
        actor.userId,
        actor.role,
        `IBPE:${row.input_hash.slice(0,12)}`,
        JSON.stringify({ questionHash, scenarioId: scenarioId ?? null, answerChars: answer.length }),
      ],
    );

    return {
      ok: true,
      answer,
      lineage: {
        governedRunId: row.id,
        approvedPlanRevision: Number(row.approved_plan_revision),
        inputHash: row.input_hash,
        sourceSha: row.source_sha,
      },
      scenarioId,
      advisoryOnly: true,
    };
  });
