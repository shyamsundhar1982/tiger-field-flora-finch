import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createServer } from "vite";
import { VIBPE_QA_CASES } from "./vibpe-copilot-qa-cases.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(repoRoot, "src");
const reportDir = process.env.VIBPE_QA_REPORT_DIR
  ? path.resolve(repoRoot, process.env.VIBPE_QA_REPORT_DIR)
  : path.join(repoRoot, "artifacts", "vibpe-qa");

const server = await createServer({
  root: repoRoot,
  configFile: false,
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
  resolve: { alias: { "@": srcRoot } },
});

function baseline() {
  return {
    demand: [
      { id: "M1-aluminium", productId: "aluminium", period: 1, planQty: 1, forecastQty: 1, committedQty: 1, actualQty: 0, residualForecastQty: 0, weightedPipelineQty: 0, remainingDemandQty: 1, expectedTotalQty: 1, confidence: 1, varianceToPlanQty: 0, varianceToPlanPct: 0 },
    ],
    mrp: [],
    inventoryHealth: [],
    supply: [
      { period: 1, sku: "FRAME-M", plannedRequirementQty: 2, committedRequirementQty: 2, demandBasis: "committed", grossRequirementQty: 2, reservedCoverageQty: 0, unreservedRequirementQty: 2, confirmedReceiptsQty: 0, committedFreeStockStartQty: 0, committedFreeStockEndQty: 0, committedFulfillmentShortageQty: 2, targetBufferQty: 0, plannedFreeStockStartQty: 0, plannedFreeStockEndQty: 0, recommendedPurchaseQty: 2, orderByPeriod: 1, recommendationIsLate: true, purchaseCostLakh: 0.1 },
      { period: 1, sku: "GROUPSET", plannedRequirementQty: 1, committedRequirementQty: 1, demandBasis: "committed", grossRequirementQty: 1, reservedCoverageQty: 0, unreservedRequirementQty: 1, confirmedReceiptsQty: 0, committedFreeStockStartQty: 0, committedFreeStockEndQty: 0, committedFulfillmentShortageQty: 1, targetBufferQty: 0, plannedFreeStockStartQty: 0, plannedFreeStockEndQty: 0, recommendedPurchaseQty: 1, orderByPeriod: 1, recommendationIsLate: true, purchaseCostLakh: 0.08 },
    ],
    capacity: [
      { id: "assembly", period: 1, requiredUnits: 1, availableCapacityUnits: 0, shortfallUnits: 1 },
    ],
    cash: [
      { period: 1, selectedInflowsLakh: 0, selectedOutflowsLakh: 0, incrementalProcurementLakh: 0.18, closingCashLakh: -4.6, freeLiquidityLakh: -4.6, closingCashAfterRecommendationsLakh: -4.7, freeLiquidityAfterRecommendationsLakh: -4.7 },
      { period: 2, selectedInflowsLakh: 0, selectedOutflowsLakh: 0, incrementalProcurementLakh: 0, closingCashLakh: -1.2, freeLiquidityLakh: -1.2, closingCashAfterRecommendationsLakh: -1.2, freeLiquidityAfterRecommendationsLakh: -1.2 },
    ],
    funding: {
      firstBaseLiquidityBreachPeriod: 1,
      firstLiquidityBreachAfterRecommendationsPeriod: 1,
      fundingActionPeriod: 1,
      minimumBaseFreeLiquidityLakh: -4.6,
      minimumFreeLiquidityAfterRecommendationsLakh: -4.7,
      incrementalFundingNeedLakh: 4.7,
    },
    findings: [
      { id: "funding:m1", severity: "critical", domain: "funding", title: "Free liquidity below operating reserve", problem: "Liquidity is negative.", businessImpact: "Plan is funding dependent.", recommendedAction: "Start funding/cost/pace action by M1.", evidence: [] },
      { id: "procurement:frame", severity: "high", domain: "procurement", title: "Committed supply shortfall", problem: "FRAME-M is short.", businessImpact: "Confirmed demand is blocked.", recommendedAction: "Review exact shortage and approve replenishment in Procurement.", evidence: [] },
    ],
    decisions: [],
    summary: {
      horizonMonths: 36,
      expectedUnits: 258,
      committedOpenUnits: 1,
      totalRecommendedProcurementLakh: 0.18,
      fulfillmentShortageSkuMonths: 2,
      capacityShortfallMonths: 1,
      minimumFreeLiquidityLakh: -4.6,
      minimumFreeLiquidityAfterRecommendationsLakh: -4.7,
      businessHealthScore: 53,
      findingCounts: { critical: 1, high: 1, medium: 0, low: 0 },
    },
  };
}

function makeFixtureSql(financeAssumptions) {
  const normalize = (sql) => String(sql).replace(/\s+/g, " ").trim().toLowerCase();
  const query = async (sql) => {
    const q = normalize(sql);

    if (q.includes("from vyndi_cash_authority ca")) {
      return [{ plan_month: 2, closing_cash_lakh: 5, source_reference: "BANK-LEDGER-M2", verified: true, updated_at: "2026-09-14T18:00:00.000Z" }];
    }
    if (q.includes("result_json->'cash' as cash_json")) {
      return [{ id: "IBPE-QA-R7", approved_plan_revision: 7, created_at: "2026-09-14T17:00:00.000Z", input_hash: "abcdef1234567890", cash_json: baseline().cash }];
    }
    if (q.includes("with committed as") && q.includes("from vyndi_report_procurement_net_requirement r")) {
      return [
        { sku: "FRAME-M", physical_qty: 0, committed_reserved_qty: 0, atp_qty: 0, open_po_qty: 2, committed_requirement: 2, net_committed_shortage: 2 },
        { sku: "GROUPSET", physical_qty: 1, committed_reserved_qty: 1, atp_qty: 0, open_po_qty: 0, committed_requirement: 1, net_committed_shortage: 1 },
      ];
    }
    if (q.includes("from vyndi_sales_orders o") && q.includes("epr_travellers") && q.includes("shortage_qty")) {
      return [
        { sales_order_id: "SO-QA-001", job_card_id: "JC-QA-001", job_card_status: "released", shortage_qty: 3, traveller_count: 0 },
      ];
    }
    if (q.includes("from vyndi_plan_revisions") && q.includes("finance_json")) {
      return [{ id: "PLAN-QA", revision: 7, scenario: "base", draw_standby: false, finance_json: financeAssumptions }];
    }
    if (q.includes("from vyndi_monthly_transaction_actuals") && q.includes("order by plan_month desc")) {
      return [
        { plan_month: 15, revenue: 3.2, units: 3, receivables: 0.8 },
        { plan_month: 14, revenue: 1.4, units: 1, receivables: 0.3 },
      ];
    }
    if (q.includes("with current_orders as") && q.includes("committed_component_units")) {
      return [{ confirmed_orders: 1, confirmed_units: 1, active_job_cards: 1, committed_component_units: 3, committed_skus: 2, net_committed_shortage: 3, open_po_qty: 2, capacity_shortfall_months: 1, latest_run_id: "IBPE-QA-R7" }];
    }
    if (q.includes("select requirement_month,sku,committed_requirement,net_committed_shortage") && q.includes("from vyndi_committed_procurement_requirements")) {
      return [
        { requirement_month: 1, sku: "FRAME-M", committed_requirement: 2, net_committed_shortage: 2 },
        { requirement_month: 1, sku: "GROUPSET", committed_requirement: 1, net_committed_shortage: 1 },
      ];
    }
    if (q.includes("select count(*)::int as confirmed_orders") && q.includes("from vyndi_sales_orders")) {
      return [{ confirmed_orders: 1, confirmed_units: 1 }];
    }
    if (q.includes("i.name as item_name") && q.includes("from vyndi_committed_procurement_requirements p")) {
      return [
        { requirement_month: 1, sku: "FRAME-M", item_name: "Frame", committed_requirement: 2, reserved_quantity: 0, physical_quantity: 0, available_to_promise: 0, net_committed_shortage: 2, open_po_qty: 2 },
        { requirement_month: 1, sku: "GROUPSET", item_name: "Groupset", committed_requirement: 1, reserved_quantity: 1, physical_quantity: 1, available_to_promise: 0, net_committed_shortage: 1, open_po_qty: 0 },
      ];
    }

    return [];
  };

  const sql = async () => [];
  sql.query = query;
  return sql;
}

function proposalFor(testCase, audit) {
  const byPack = {
    "cash-ledger-reconciliation": ["src/lib/vibpe-qa-governed-queries.ts", "src/lib/vibpe-copilot-2.ts"],
    "procurement-recommendations": ["src/lib/vibpe-operational-queries.ts", "src/lib/vibpe-copilot-2.ts"],
    "demand-commitment-feasibility": ["src/lib/vibpe-operational-queries.ts", "src/lib/vibpe-copilot-2.ts"],
    inventory: ["src/lib/vibpe-qa-governed-queries.ts", "src/lib/vibpe-copilot-2.ts"],
    "job-card-traveller": ["src/lib/vibpe-qa-governed-queries.ts", "src/lib/vibpe-copilot-2.ts"],
    liquidity: ["src/lib/vibpe-copilot-2.ts", "src/lib/vibpe-qa-governed-queries.ts"],
    funding: ["src/lib/vibpe-copilot-2.ts"],
    "actual-vs-plan": ["src/lib/vibpe-qa-governed-queries.ts", "src/lib/vibpe-copilot-2.ts"],
  };
  return {
    summary: `Tighten governed VIBPE answer contract for ${testCase.pack}: ${audit.assessment.defectClasses.join(", ")}.`,
    kind: "code",
    files: byPack[testCase.pack],
    requiresMutation: false,
    sandbox: true,
  };
}

function markdownReport(meta, audits) {
  const lines = [
    "# VIBPE Co-Pilot autonomous QA audit",
    "",
    `Generated: ${meta.generatedAt}`,
    `Cases: ${meta.total} · PASS ${meta.passed} · FAIL ${meta.failed}`,
    "",
  ];
  for (const audit of audits) {
    lines.push(
      `## ${audit.caseId} · ${audit.pack} · ${audit.assessment.pass ? "PASS" : "FAIL"}`,
      "",
      `**Question:** ${audit.question}`,
      "",
      `**Expected criteria:** ${audit.expected}`,
      "",
      `**Defect class:** ${audit.assessment.defectClasses.length ? audit.assessment.defectClasses.join(", ") : "none"}`,
      "",
      "**Raw answer:**",
      "",
      audit.rawAnswer,
      "",
      `**Proposed correction:** ${audit.proposal?.summary ?? "none"}`,
      "",
      `**Changed files:** ${audit.changedFiles.length ? audit.changedFiles.join(", ") : "none in audit-only CI cycle"}`,
      "",
      `**Test results:** ${audit.testResults.join("; ") || "not recorded"}`,
      "",
      "**Before response:**",
      "",
      audit.beforeAnswer ?? audit.rawAnswer,
      "",
      "**After response:**",
      "",
      audit.afterAnswer ?? audit.rawAnswer,
      "",
      "### Dimension results",
      "",
      ...audit.assessment.dimensions.map((item) => `- ${item.dimension}: ${item.pass ? "PASS" : `FAIL — ${item.reasons.join("; ")}`}`),
      "",
    );
  }
  return lines.join("\n");
}

try {
  const [{ runVibpeCopilot2 }, qa, finance] = await Promise.all([
    server.ssrLoadModule("/src/lib/vibpe-copilot-2.ts"),
    server.ssrLoadModule("/src/lib/vibpe-copilot-qa.ts"),
    server.ssrLoadModule("/src/lib/finance/model.ts"),
  ]);
  const sql = makeFixtureSql(finance.DEFAULT_FINANCE_ASSUMPTIONS);
  const governedBaseline = baseline();
  const audits = [];

  for (const testCase of VIBPE_QA_CASES) {
    const cycles = await qa.runVibpeQaCycle({
      testCase,
      maxCycles: 1,
      ask: async (question) => {
        const result = await runVibpeCopilot2(sql, question, governedBaseline, { sessionKey: `qa:${testCase.id}` });
        return String(result.answer ?? "");
      },
      propose: async (audit) => proposalFor(testCase, audit),
    });
    const audit = cycles.at(-1);
    audit.testResults = [`real runVibpeCopilot2 governed-fixture execution: ${audit.assessment.pass ? "PASS" : "FAIL"}`];
    audits.push(audit);
  }

  const failed = audits.filter((audit) => !audit.assessment.pass);
  const meta = {
    generatedAt: new Date().toISOString(),
    total: audits.length,
    passed: audits.length - failed.length,
    failed: failed.length,
    guardrails: {
      transactionalBusinessDataAutoMutation: false,
      automaticProcurementCommitment: false,
      automaticFundingCommitment: false,
      automaticCustomerPromise: false,
      mutationsRequireGovernedFixtureOrSandbox: true,
    },
  };
  await mkdir(reportDir, { recursive: true });
  const stamp = meta.generatedAt.replace(/[:.]/g, "-");
  const jsonPath = path.join(reportDir, `vibpe-qa-${stamp}.json`);
  const mdPath = path.join(reportDir, `vibpe-qa-${stamp}.md`);
  await writeFile(jsonPath, JSON.stringify({ ...meta, audits }, null, 2) + "\n");
  await writeFile(mdPath, markdownReport(meta, audits) + "\n");

  console.log(`[vibpe-qa] ${meta.passed}/${meta.total} passed`);
  console.log(`[vibpe-qa] JSON ${path.relative(repoRoot, jsonPath)}`);
  console.log(`[vibpe-qa] Markdown ${path.relative(repoRoot, mdPath)}`);
  for (const audit of failed) {
    console.error(`[vibpe-qa] FAIL ${audit.caseId}: ${audit.assessment.defectClasses.join(", ")}`);
    for (const dimension of audit.assessment.dimensions.filter((item) => !item.pass)) {
      console.error(`  - ${dimension.dimension}: ${dimension.reasons.join("; ")}`);
    }
  }
  if (failed.length) process.exitCode = 1;
} finally {
  await server.close();
}
