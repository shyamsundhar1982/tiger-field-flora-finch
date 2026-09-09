import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";
import { LEGAL_CONTROLS } from "@/lib/data/legal-control";
import { QA_CHECKS } from "@/lib/data/qa-verification";
import { accountingTotals, buildAccountingModel } from "@/lib/finance/accounting";
import { checkFinanceIntegrity } from "@/lib/finance/integrity";
import { buildModelWithInputs } from "@/lib/finance/model";
import { lakh } from "@/lib/format";
import { useVeloxis } from "@/lib/store";

export const Route = createFileRoute("/command/ca-audit")({ component: CAAudit });

type ControlState = "pass" | "verify" | "blocked";
type LiveControl = {
  id: string;
  title: string;
  state: ControlState;
  evidence: string;
  action: string;
};

const STATUTORY_GAPS = [
  "Invoice-level output/input tax ledgers and eligible ITC evidence",
  "Bank reconciliation against posted receipts and payments",
  "Payroll and TDS ledgers / return evidence",
  "Fixed-asset register and depreciation evidence",
  "Loan schedules, interest and principal accounting where debt is used",
  "CA reconciliation of opening balances, AR, AP, inventory and funding evidence",
];

const statusLabel = (state: ControlState) => state === "pass" ? "PASS" : state === "blocked" ? "BLOCKED" : "VERIFY";
const statusClass = (state: ControlState) => state === "pass" ? "text-ok" : state === "blocked" ? "text-danger" : "text-accent";

function CAAudit() {
  const scenario = useVeloxis((state) => state.scenario);
  const drawStandby = useVeloxis((state) => state.drawStandby);
  const finance = useVeloxis((state) => state.finance);
  const accounting = useVeloxis((state) => state.accounting);

  const planning = useMemo(
    () => buildModelWithInputs(scenario, drawStandby, finance),
    [scenario, drawStandby, finance],
  );
  const rows = useMemo(
    () => buildAccountingModel(planning, accounting),
    [planning, accounting],
  );
  const totals = useMemo(() => accountingTotals(rows), [rows]);
  const integrity = useMemo(() => checkFinanceIntegrity(rows), [rows]);

  const fundingEvents = planning.filter((row) => row.funding > 0);
  const explicitlyClassifiedFunding = fundingEvents.filter(
    (row) => accounting.fundingTypeByMonth?.[row.m] !== undefined,
  ).length;
  const allFundingClassified = fundingEvents.length === explicitlyClassifiedFunding;
  const horizonOk = planning.length === 36 && rows.length === 36;
  const taxReviewed = accounting.taxRatePct > 0;
  const gstReviewed = accounting.gstRatePct > 0;
  const liquidityTrough = rows.reduce(
    (minimum, row) => Math.min(minimum, row.closingCash),
    Number.POSITIVE_INFINITY,
  );
  const liquidityOk = Number.isFinite(liquidityTrough) && liquidityTrough >= 0;
  const collectionDays = accounting.collectionDays ?? accounting.collectionMonths * 30;
  const supplierDays = accounting.supplierPaymentDays ?? accounting.supplierCreditMonths * 30;
  const modelInternallyConsistent = integrity.balanced && integrity.cashReconciled && integrity.finite && integrity.statementsPresent;

  const controls: LiveControl[] = [
    {
      id: "CA-01",
      title: "Accounting model integrity",
      state: modelInternallyConsistent ? "pass" : "blocked",
      evidence: `Balance error ${lakh(integrity.maxBalanceError)} · cash reconciliation error ${lakh(integrity.maxCashError)}.`,
      action: modelInternallyConsistent ? "No model-integrity exception detected." : "Correct the shared accounting model before relying on finance outputs.",
    },
    {
      id: "CA-02",
      title: "36-month model horizon",
      state: horizonOk ? "pass" : "blocked",
      evidence: `${planning.length} planning rows · ${rows.length} accounting rows.`,
      action: horizonOk ? "Canonical planning and accounting horizons agree." : "Restore the complete M1-M36 planning horizon.",
    },
    {
      id: "CA-03",
      title: "Tax treatment entered",
      state: taxReviewed ? "pass" : "blocked",
      evidence: `Configured management tax rate: ${accounting.taxRatePct}%.`,
      action: taxReviewed ? "CA must still validate applicability and taxable base." : "Enter the CA-reviewed applicable tax treatment; no rate is invented by VYNDI.",
    },
    {
      id: "CA-04",
      title: "GST treatment entered",
      state: gstReviewed ? "pass" : "blocked",
      evidence: `Configured GST rate: ${accounting.gstRatePct}% · settlement lag ${accounting.gstSettlementMonths} month(s).`,
      action: gstReviewed ? "Reconcile output tax, input credit and actual return evidence before filing." : "Enter CA-reviewed GST treatment; the current zero default must not be treated as statutory approval.",
    },
    {
      id: "CA-05",
      title: "Funding classification",
      state: allFundingClassified ? "pass" : "verify",
      evidence: `${explicitlyClassifiedFunding}/${fundingEvents.length} funding event(s) explicitly classified. Unclassified events display as equity in planning only.`,
      action: allFundingClassified ? "Reconcile classification to legal evidence." : "Classify every event explicitly as equity, debt or grant and reconcile supporting documents.",
    },
    {
      id: "CA-06",
      title: "Liquidity",
      state: liquidityOk ? "pass" : "blocked",
      evidence: `Lowest modeled closing cash: ${lakh(Number.isFinite(liquidityTrough) ? liquidityTrough : 0)}. Collections ${collectionDays} days · supplier payments ${supplierDays} days.`,
      action: liquidityOk ? "Maintain the approved cash buffer and monitor actual collections/payments." : "Funding or timing action is required before the modeled cash trough.",
    },
    {
      id: "CA-07",
      title: "Opening balances and accounting policies",
      state: "verify",
      evidence: `AR ${lakh(accounting.openingReceivablesLakh)} · AP ${lakh(accounting.openingPayablesLakh)} · fixed assets ${lakh(accounting.openingFixedAssetsLakh)} · depreciation ${accounting.depreciationMonths} months.`,
      action: "CA must verify opening records, useful lives and depreciation policy against source evidence.",
    },
    {
      id: "CA-08",
      title: "Statutory ledger completeness",
      state: "blocked",
      evidence: `${STATUTORY_GAPS.length} statutory/reconciliation capability groups remain outside the management model.`,
      action: "Keep statutory books, GST/tax filing and certified external reporting in the appointed CA-approved system.",
    },
    {
      id: "CA-09",
      title: "Approved multi-user accounting record",
      state: "blocked",
      evidence: "Planning/accounting assumptions are persisted as browser-side planning state rather than approved accounting actuals.",
      action: "Reconcile and approve source records outside the browser draft cache before external or statutory reliance.",
    },
  ];

  const blockers = controls.filter((control) => control.state === "blocked");
  const verify = controls.filter((control) => control.state === "verify");
  const managementModelReady = modelInternallyConsistent && horizonOk;
  const statutoryReady = blockers.length === 0 && verify.length === 0;
  const financeChecks = QA_CHECKS.filter((check) => check.domain === "finance" || check.domain === "legal");
  const caControls = LEGAL_CONTROLS.filter((control) => control.domain === "CA/GST" || control.domain === "Corporate" || control.domain === "Commercial");

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Finance / governance · live launch gate</p>
        <h1 className="mt-1 font-display text-4xl">CA Verification / Launch Readiness</h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">
          This page evaluates the live management-accounting model; it does not own a second finance model. It is a software and management-control gate, not a statutory audit, tax opinion, certificate or filing.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
          <Link to="/command/finance-assumptions" className="text-accent">Edit accounting assumptions →</Link>
          <Link to="/command/balance-sheet" className="text-accent">Financial statements →</Link>
          <Link to="/command/cash" className="text-accent">Cash →</Link>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Kpi label="Management model" value={managementModelReady ? "READY" : "BLOCKED"} hint="Integrity + 36-month horizon" tone={managementModelReady ? "ok" : "danger"} />
        <Kpi label="Statutory use" value={statutoryReady ? "READY" : "NO-GO"} hint="Requires CA closure of every live control" tone={statutoryReady ? "ok" : "danger"} />
        <Kpi label="Live blockers" value={String(blockers.length)} hint={`${verify.length} item(s) require verification`} tone={blockers.length ? "danger" : verify.length ? "warn" : "ok"} />
        <Kpi label="Cash trough" value={lakh(Number.isFinite(liquidityTrough) ? liquidityTrough : 0)} hint={liquidityOk ? "Non-negative model cash" : "Funding action required"} tone={liquidityOk ? "ok" : "danger"} />
        <Kpi label="Funding classified" value={`${explicitlyClassifiedFunding}/${fundingEvents.length}`} hint="Explicit legal classification" tone={allFundingClassified ? "ok" : "warn"} />
        <Kpi label="36-mo net profit" value={lakh(totals.netProfit, 0)} hint="Management projection only" />
      </div>

      <Panel title="Live CA launch controls" kicker="Calculated from the canonical finance model">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle">
              <tr><th className="px-3 py-3">ID</th><th className="px-3 py-3">Control</th><th className="px-3 py-3">State</th><th className="px-3 py-3">Live evidence</th><th className="px-3 py-3">Required action</th></tr>
            </thead>
            <tbody>{controls.map((control) => (
              <tr key={control.id} className="border-t border-border align-top">
                <td className="px-3 py-3 font-semibold text-accent">{control.id}</td>
                <td className="px-3 py-3 font-medium">{control.title}</td>
                <td className={`px-3 py-3 font-semibold ${statusClass(control.state)}`}>{statusLabel(control.state)}</td>
                <td className="px-3 py-3 text-muted">{control.evidence}</td>
                <td className="px-3 py-3 text-muted">{control.action}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Mandatory statutory gaps" kicker="Explicit external-use blocker">
          <div className="space-y-2">{STATUTORY_GAPS.map((gap, index) => (
            <div key={gap} className="flex gap-3 rounded-lg border border-border bg-surface p-3 text-sm">
              <span className="font-semibold text-danger">{String(index + 1).padStart(2, "0")}</span>
              <span className="text-muted">{gap}</span>
            </div>
          ))}</div>
        </Panel>
        <Panel title="Go / no-go rule" kicker="Launch authority boundary">
          <div className="space-y-3 text-sm leading-6">
            <div className="rounded-lg border border-border bg-surface p-4">
              <p className="font-semibold text-fg">Controlled internal management use</p>
              <p className="mt-1 text-muted">Code/model readiness can pass here, but production use still requires deployment plus an authenticated smoke test covering order → production → inventory → shipment/receivable and PO → GRN → match/payment.</p>
            </div>
            <div className="rounded-lg border border-danger/40 bg-danger/5 p-4">
              <p className="font-semibold text-danger">Statutory / certified external use: NO-GO</p>
              <p className="mt-1 text-muted">Do not use VYNDI as the statutory book, GST/tax filing source, lender certification source or investor-certified projection pack while CA-08/CA-09 and any other live blockers remain open.</p>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Existing QA & legal evidence" kicker="Supporting controls · not a substitute for the live gate">
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-2">{financeChecks.map((check) => (
            <div key={check.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
              <div className="flex items-center justify-between gap-3"><span className="font-medium">{check.id} · {check.title}</span><span className="text-xs text-subtle">{check.status.toUpperCase()}</span></div>
              <p className="mt-1 text-xs leading-5 text-muted">{check.evidence}</p>
            </div>
          ))}</div>
          <div className="space-y-2">{caControls.map((control) => (
            <div key={control.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
              <p className="font-medium">{control.id} · {control.title}</p>
              <p className="mt-1 text-xs leading-5 text-muted">{control.evidence}</p>
            </div>
          ))}</div>
        </div>
      </Panel>

      <Panel title="Professional reliance boundary" kicker="Required disclosure">
        <p className="text-sm leading-6 text-muted">
          External reliance requires the appointed Chartered Accountant to inspect source records and applicable law. VYNDI may calculate management projections and surface control gaps; it does not issue an audit opinion, tax opinion, certificate or statutory filing.
        </p>
      </Panel>
    </div>
  );
}
