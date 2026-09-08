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
  mode?: "ai" | "deterministic";
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
  engine_version: string;
  approved_plan_revision: number | string;
  input_hash: string;
  source_sha: string;
  result_json: IntegratedPlanningResult;
};

const STAGE2_ENGINE_VERSION = "VYNDI-IBPE-1.1.0";

function sanitizeQuestion(value: unknown) {
  return String(value ?? "").trim().slice(0, 1800);
}

function money(value: number) {
  return `₹${Number(value || 0).toFixed(1)}L`;
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

function deterministicAnswer(question: string, result: IntegratedPlanningResult, scenarioLabel?: string) {
  const q = question.toLowerCase();
  const prefix = scenarioLabel ? `Scenario: ${scenarioLabel}. ` : "Governed baseline. ";
  const findings = result.findings;
  const relevant = (domains: string[]) => findings.filter((finding) => domains.includes(finding.domain)).slice(0, 4);
  const lines: string[] = [];

  if (/cash|fund|liquid|budget|runway|money|finance/.test(q)) {
    const low = [...result.cash].sort((a, b) => a.freeLiquidityAfterRecommendationsLakh - b.freeLiquidityAfterRecommendationsLakh)[0];
    lines.push(
      `Assessment: ${prefix}minimum free liquidity after recommended procurement is ${money(result.summary.minimumFreeLiquidityAfterRecommendationsLakh)}${low ? `, with the lowest modelled month at M${low.period}` : ""}. Incremental funding need is ${money(result.funding.incrementalFundingNeedLakh)}.`,
      `Main drivers: recommended procurement totals ${money(result.summary.totalRecommendedProcurementLakh)}; the first post-recommendation liquidity breach is ${result.funding.firstLiquidityBreachAfterRecommendationsPeriod ? `M${result.funding.firstLiquidityBreachAfterRecommendationsPeriod}` : "not present in the 36-month horizon"}.`,
    );
    const items = relevant(["finance", "funding", "procurement"]);
    if (items.length) lines.push(`Controlled actions: ${items.map((item) => item.recommendedAction).join(" ")}`);
  } else if (/material|inventory|stock|purchase|procure|mrp|supplier|shortage|atp|msl/.test(q)) {
    const rows = [...result.supply]
      .filter((row) => row.committedFulfillmentShortageQty > 0 || row.recommendedPurchaseQty > 0)
      .sort((a, b) => b.committedFulfillmentShortageQty - a.committedFulfillmentShortageQty)
      .slice(0, 5);
    lines.push(
      `Assessment: ${prefix}${result.summary.fulfillmentShortageSkuMonths} SKU-months have committed-supply shortages and recommended procurement totals ${money(result.summary.totalRecommendedProcurementLakh)}.`,
    );
    if (rows.length) {
      lines.push(`Priority material rows: ${rows.map((row) => `${row.sku} M${row.period}: shortage ${row.committedFulfillmentShortageQty.toFixed(1)}, recommended buy ${row.recommendedPurchaseQty.toFixed(1)}${row.purchaseCostLakh == null ? "" : ` (${money(row.purchaseCostLakh)})`}`).join("; ")}.`);
    }
    const items = relevant(["inventory", "supply", "procurement"]);
    if (items.length) lines.push(`Controlled actions: ${items.map((item) => item.recommendedAction).join(" ")}`);
  } else if (/capacity|production|manufactur|work centre|bottleneck|outsourc/.test(q)) {
    const rows = [...result.capacity].filter((row) => row.shortfallUnits > 0).sort((a, b) => b.shortfallUnits - a.shortfallUnits).slice(0, 5);
    lines.push(`Assessment: ${prefix}${result.summary.capacityShortfallMonths} capacity shortfall months are flagged in the active horizon.`);
    if (rows.length) lines.push(`Largest shortfalls: ${rows.map((row) => `${row.id} M${row.period}: ${row.shortfallUnits.toFixed(1)} units`).join("; ")}.`);
    const items = relevant(["capacity", "planning"]);
    if (items.length) lines.push(`Controlled actions: ${items.map((item) => item.recommendedAction).join(" ")}`);
  } else {
    lines.push(
      `Assessment: ${prefix}business health is ${result.summary.businessHealthScore}/100 across ${result.summary.expectedUnits.toFixed(0)} expected units. Recommended procurement is ${money(result.summary.totalRecommendedProcurementLakh)} and minimum free liquidity after recommendations is ${money(result.summary.minimumFreeLiquidityAfterRecommendationsLakh)}.`,
      `Exceptions: ${result.summary.findingCounts.critical} critical, ${result.summary.findingCounts.high} high, ${result.summary.findingCounts.medium} medium and ${result.summary.findingCounts.low} low findings.`,
    );
    if (findings.length) lines.push(`Highest-priority issues: ${findings.slice(0, 4).map((item) => `${item.title} — ${item.recommendedAction}`).join(" ")}`);
  }

  lines.push("Evidence: deterministic VYNDI IBPE decision packet. This is advisory analysis only; approvals and transactions remain in their owning workspaces.");
  return lines.join("\n\n");
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
    `select id,engine_version,approved_plan_revision,input_hash,source_sha,result_json
       from vyndi_ibpe_runs where status='complete' order by created_at desc limit 1`,
  );
  const row = rows[0];
  if (!row) throw new Error("No governed IBPE run exists. Run governed IBPE first.");
  if (row.engine_version !== STAGE2_ENGINE_VERSION) {
    throw new Error("Latest governed IBPE run predates Stage 2 payment-lag parity. Run governed IBPE once before using Copilot.");
  }
  return { sql, row };
}

export const askIbpeCopilot = createServerFn({ method: "POST" })
  .validator((input: IbpeCopilotRequest) => ({
    question: sanitizeQuestion(input.question),
    scenario: input.scenario,
  }))
  .handler(async ({ data }): Promise<IbpeCopilotResponse> => {
    const actor = await requireBusinessActor("view");
    if (!data.question) return { ok: false, error: "Ask a question first.", advisoryOnly: true };

    const { sql, row } = await latestRun();
    let result = row.result_json;
    let scenarioContext: unknown = null;
    let scenarioId: string | undefined;
    let scenarioLabel: string | undefined;

    if (data.scenario) {
      const packet = await evaluateScenario(sql, data.scenario);
      result = packet.result;
      scenarioId = packet.scenario.id;
      scenarioLabel = packet.scenario.label;
      scenarioContext = {
        scenario: packet.scenario,
        comparisonVsGovernedBaseline: packet.comparison,
      };
    }

    const lineage = {
      governedRunId: row.id,
      approvedPlanRevision: Number(row.approved_plan_revision),
      inputHash: row.input_hash,
      sourceSha: row.source_sha,
    };

    let answer = deterministicAnswer(data.question, result, scenarioLabel);
    let mode: "ai" | "deterministic" = "deterministic";
    const apiKey = process.env.XAI_API_KEY;

    if (apiKey) {
      const context = {
        lineage,
        scenario: scenarioContext,
        ibpe: compactResult(result),
      };
      try {
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
        if (response.ok) {
          const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
          const aiAnswer = body.choices?.[0]?.message?.content?.trim() ?? "";
          if (aiAnswer) {
            answer = aiAnswer;
            mode = "ai";
          }
        }
      } catch {
        // Deterministic IBPE explanation remains available if the external AI service fails.
      }
    }

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
        JSON.stringify({ questionHash, scenarioId: scenarioId ?? null, mode, answerChars: answer.length }),
      ],
    );

    return {
      ok: true,
      answer,
      mode,
      lineage,
      scenarioId,
      advisoryOnly: true,
    };
  });
