import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Fragment, useState } from "react";
import { Kpi, Panel } from "@/components/kpi";
import {
  listPeopleOfficeAuthority,
  savePeopleOfficeAssetDraft,
  savePeopleOfficeCostDraft,
  savePeopleRecordDraft,
  transitionPeopleOfficeAsset,
  transitionPeopleOfficeCost,
  transitionPeopleRecord,
} from "@/lib/people-office-authority";

type Row = Record<string, unknown>;
type LedgerKind = "person" | "cost" | "asset";
type LifecycleStatus = "draft" | "pending_approval" | "approved" | "superseded";

const text = (row: Row, ...keys: string[]) => {
  for (const key of keys) if (row[key] != null) return String(row[key]);
  return "";
};
const num = (row: Row, ...keys: string[]) => {
  for (const key of keys) if (row[key] != null) return Number(row[key]) || 0;
  return 0;
};
const money = (value: number) => `₹${value.toFixed(2)}L`;
const inputClass = "control mt-1.5 w-full";
const statusOf = (row: Row) => text(row, "lifecycle_status", "lifecycleStatus") as LifecycleStatus;
const sourceOf = (row: Row) => text(row, "source_ref", "sourceReference") || "UI:PEOPLE_OFFICE";
const nullableMonth = (value: string) => (value.trim() ? Number(value) : null);
const displayDate = (value: string) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-IN");
};

interface PersonForm {
  id: string;
  displayName: string;
  functionName: string;
  roleTitle: string;
  engagementType: "employee" | "contractor" | "consultant" | "planned_role";
  startMonth: string;
  endMonth: string;
  sourceReference: string;
  notes: string;
}

interface CostForm {
  id: string;
  costGroup: "payroll" | "office" | "statutory" | "outsourcing";
  personId: string;
  name: string;
  stage: string;
  quantity: string;
  monthlyUnitCostLakh: string;
  startMonth: string;
  endMonth: string;
  oneTimeCostLakh: string;
  oneTimeMonth: string;
  sourceReference: string;
  notes: string;
}

interface AssetForm {
  id: string;
  name: string;
  category: string;
  assetClass: "office_admin" | "office_consumable";
  costLakh: string;
  monthlyCostLakh: string;
  purchaseMonth: string;
  usefulLifeMonths: string;
  allocationPct: string;
  sourceReference: string;
  notes: string;
}

export const Route = createFileRoute("/command/people-office")({
  loader: () => listPeopleOfficeAuthority(),
  component: PeopleOffice,
});

function PeopleOffice() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const people = data.people as Row[];
  const costs = data.costs as Row[];
  const assets = data.assets as Row[];
  const financeFeed = data.financeFeed as Row[];
  const auditEvents = data.auditEvents as Row[];
  const approvedCosts = costs.filter((row) => statusOf(row) === "approved");
  const approvedAssets = assets.filter((row) => statusOf(row) === "approved");
  const feedOpex = financeFeed.reduce(
    (sum, row) => sum + num(row, "operating_expense_lakh", "operatingExpenseLakh"),
    0,
  );
  const reconciliationFlags = auditEvents.filter(
    (row) =>
      text(row, "entityType", "entity_type") === "people_office_reconciliation" ||
      text(row, "reason").includes("REVIEW REQUIRED"),
  );

  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [editingKind, setEditingKind] = useState<LedgerKind | null>(null);
  const [editingId, setEditingId] = useState("");
  const [personForm, setPersonForm] = useState<PersonForm | null>(null);
  const [costForm, setCostForm] = useState<CostForm | null>(null);
  const [assetForm, setAssetForm] = useState<AssetForm | null>(null);

  function clearEditor() {
    setEditingKind(null);
    setEditingId("");
    setPersonForm(null);
    setCostForm(null);
    setAssetForm(null);
  }

  function beginPersonEdit(row: Row) {
    setEditingKind("person");
    setEditingId(text(row, "id"));
    setPersonForm({
      id: text(row, "id"),
      displayName: text(row, "display_name", "displayName"),
      functionName: text(row, "function_name", "functionName"),
      roleTitle: text(row, "role_title", "roleTitle"),
      engagementType: (text(row, "engagement_type", "engagementType") || "planned_role") as PersonForm["engagementType"],
      startMonth: text(row, "start_month", "startMonth"),
      endMonth: text(row, "end_month", "endMonth"),
      sourceReference: sourceOf(row),
      notes: text(row, "notes"),
    });
  }

  function beginCostEdit(row: Row) {
    setEditingKind("cost");
    setEditingId(text(row, "id"));
    setCostForm({
      id: text(row, "id"),
      costGroup: (text(row, "cost_group", "costGroup") || "office") as CostForm["costGroup"],
      personId: text(row, "person_id", "personId"),
      name: text(row, "name"),
      stage: text(row, "stage"),
      quantity: text(row, "quantity") || "0",
      monthlyUnitCostLakh: text(row, "monthly_unit_cost_lakh", "monthlyUnitCostLakh") || "0",
      startMonth: text(row, "start_month", "startMonth") || "1",
      endMonth: text(row, "end_month", "endMonth") || "36",
      oneTimeCostLakh: text(row, "one_time_cost_lakh", "oneTimeCostLakh") || "0",
      oneTimeMonth: text(row, "one_time_month", "oneTimeMonth") || "1",
      sourceReference: sourceOf(row),
      notes: text(row, "notes"),
    });
  }

  function beginAssetEdit(row: Row) {
    setEditingKind("asset");
    setEditingId(text(row, "id"));
    setAssetForm({
      id: text(row, "id"),
      name: text(row, "name"),
      category: text(row, "category"),
      assetClass: (text(row, "asset_class", "assetClass") || "office_admin") as AssetForm["assetClass"],
      costLakh: text(row, "cost_lakh", "costLakh") || "0",
      monthlyCostLakh: text(row, "monthly_cost_lakh", "monthlyCostLakh") || "0",
      purchaseMonth: text(row, "purchase_month", "purchaseMonth") || "1",
      usefulLifeMonths: text(row, "useful_life_months", "usefulLifeMonths") || "60",
      allocationPct: text(row, "allocation_pct", "allocationPct") || "100",
      sourceReference: sourceOf(row),
      notes: text(row, "notes"),
    });
  }

  async function runMutation(id: string, work: () => Promise<unknown>, success: string) {
    setBusyId(id);
    setMessage("");
    try {
      await work();
      clearEditor();
      setMessage(success);
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The People & Office change could not be saved.");
    } finally {
      setBusyId("");
    }
  }

  async function savePerson() {
    if (!personForm) return;
    await runMutation(
      personForm.id,
      () =>
        savePeopleRecordDraft({
          data: {
            id: personForm.id,
            displayName: personForm.displayName,
            functionName: personForm.functionName,
            roleTitle: personForm.roleTitle,
            engagementType: personForm.engagementType,
            startMonth: nullableMonth(personForm.startMonth),
            endMonth: nullableMonth(personForm.endMonth),
            sourceReference: personForm.sourceReference,
            notes: personForm.notes,
          },
        }),
      "People draft saved and appended to the audit trail.",
    );
  }

  async function saveCost() {
    if (!costForm) return;
    await runMutation(
      costForm.id,
      () =>
        savePeopleOfficeCostDraft({
          data: {
            id: costForm.id,
            costGroup: costForm.costGroup,
            personId: costForm.personId || null,
            name: costForm.name,
            stage: costForm.stage,
            quantity: Number(costForm.quantity),
            monthlyUnitCostLakh: Number(costForm.monthlyUnitCostLakh),
            startMonth: Number(costForm.startMonth),
            endMonth: Number(costForm.endMonth),
            oneTimeCostLakh: Number(costForm.oneTimeCostLakh),
            oneTimeMonth: Number(costForm.oneTimeMonth),
            sourceReference: costForm.sourceReference,
            notes: costForm.notes,
          },
        }),
      "Cost draft saved and appended to the audit trail.",
    );
  }

  async function saveAsset() {
    if (!assetForm) return;
    await runMutation(
      assetForm.id,
      () =>
        savePeopleOfficeAssetDraft({
          data: {
            id: assetForm.id,
            name: assetForm.name,
            category: assetForm.category,
            assetClass: assetForm.assetClass,
            costLakh: Number(assetForm.costLakh),
            monthlyCostLakh: Number(assetForm.monthlyCostLakh),
            purchaseMonth: Number(assetForm.purchaseMonth),
            usefulLifeMonths: Number(assetForm.usefulLifeMonths),
            allocationPct: Number(assetForm.allocationPct),
            sourceReference: assetForm.sourceReference,
            notes: assetForm.notes,
          },
        }),
      "Asset draft saved and appended to the audit trail.",
    );
  }

  async function transition(kind: LedgerKind, row: Row, toStatus: LifecycleStatus) {
    const id = text(row, "id");
    const note = window.prompt(
      `${toStatus.replaceAll("_", " ")} ${text(row, "name", "display_name", "displayName") || id}: enter rationale / evidence note`,
    );
    if (!note?.trim()) return;
    const data = { id, toStatus, sourceReference: sourceOf(row), note: note.trim() };
    await runMutation(
      id,
      () => {
        if (kind === "person") return transitionPeopleRecord({ data });
        if (kind === "cost") return transitionPeopleOfficeCost({ data });
        return transitionPeopleOfficeAsset({ data });
      },
      `Lifecycle changed to ${toStatus.replaceAll("_", " ")} and audited.`,
    );
  }

  function lifecycleControls(kind: LedgerKind, row: Row, onEdit: () => void) {
    const id = text(row, "id");
    const status = statusOf(row);
    const busy = busyId === id;
    return (
      <div className="flex min-w-[170px] flex-wrap gap-1.5">
        {status === "draft" ? (
          <>
            <button type="button" disabled={busy} onClick={onEdit} className="rounded border border-border px-2 py-1 font-semibold hover:border-accent hover:text-accent disabled:opacity-40">
              Edit
            </button>
            <button type="button" disabled={busy} onClick={() => void transition(kind, row, "pending_approval")} className="rounded border border-accent px-2 py-1 font-semibold text-accent disabled:opacity-40">
              Submit
            </button>
          </>
        ) : null}
        {status === "pending_approval" ? (
          <>
            <button type="button" disabled={busy} onClick={() => void transition(kind, row, "draft")} className="rounded border border-border px-2 py-1 font-semibold disabled:opacity-40">
              Return
            </button>
            <button type="button" disabled={busy} onClick={() => void transition(kind, row, "approved")} className="rounded border border-green px-2 py-1 font-semibold text-green disabled:opacity-40">
              Approve
            </button>
          </>
        ) : null}
        {status === "approved" ? (
          <button type="button" disabled={busy} onClick={() => void transition(kind, row, "superseded")} className="rounded border border-warn px-2 py-1 font-semibold text-warn disabled:opacity-40">
            Supersede
          </button>
        ) : null}
        {status === "superseded" ? <span className="px-2 py-1 text-subtle">Closed</span> : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="border-b border-border pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">
          People & Office · operating administration · canonical authority
        </p>
        <h1 className="mt-1 font-display text-4xl text-accent">People & Office</h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">
          Edit draft source records here, submit them for approval, and approve only after evidence
          review. Every save and lifecycle transition is appended to the shared audit trail. Finance
          consumes approved records only.
        </p>
        <div className="mt-3 flex gap-3 text-sm font-semibold">
          <Link to="/command/financial-cockpit" className="text-accent">Downstream Finance →</Link>
          <Link to="/command/governance" className="text-accent">Governance →</Link>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi label="People records" value={String(people.length)} hint="Editable while draft" />
        <Kpi label="Approved cost items" value={String(approvedCosts.length)} hint={`${costs.length} total`} />
        <Kpi label="Approved assets" value={String(approvedAssets.length)} hint={`${assets.length} total`} />
        <Kpi label="Approved 36M feed" value={money(feedOpex)} hint="Finance-consumable OPEX" tone={financeFeed.length ? "ok" : "warn"} />
      </div>

      {message ? (
        <div role="status" className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
          {message}
        </div>
      ) : null}

      {reconciliationFlags.length ? (
        <div className="rounded-xl border border-warn/60 bg-surface p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-warn">Workbook reconciliation review required</p>
          <p className="mt-2 text-sm text-muted">
            Imported workbook values remain drafts. S3/S4 payroll and outsourcing decompositions contain source mismatches; review the audit evidence before approval.
          </p>
        </div>
      ) : null}

      <Panel title="Operating administration registers" kicker="Draft → submit → approve → supersede · expand only the register you need">
        <div className="space-y-3">
          <details className="rounded-xl border border-border p-3">
            <summary className="cursor-pointer font-semibold text-accent">People Register ({people.length})</summary>
            <p className="mt-2 text-xs text-muted">Identity · function · role · engagement lifecycle · evidence source</p>
            {people.length ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[950px] table-auto text-left text-xs">
                  <thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle">
                    <tr><th className="px-2 py-2">Person / role</th><th className="px-2 py-2">Function</th><th className="px-2 py-2">Engagement</th><th className="px-2 py-2">Timing</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Controls</th></tr>
                  </thead>
                  <tbody>
                    {people.map((row) => {
                      const id = text(row, "id");
                      const editing = editingKind === "person" && editingId === id && personForm;
                      return (
                        <Fragment key={id}>
                          <tr className="border-t border-border/70">
                            <td className="px-2 py-2"><p className="font-semibold">{text(row, "display_name", "displayName")}</p><p className="text-[10px] text-muted">{text(row, "role_title", "roleTitle")}</p></td>
                            <td className="px-2 py-2">{text(row, "function_name", "functionName")}</td>
                            <td className="px-2 py-2">{text(row, "engagement_type", "engagementType")}</td>
                            <td className="px-2 py-2 text-muted">M{text(row, "start_month", "startMonth") || "—"} → M{text(row, "end_month", "endMonth") || "—"}</td>
                            <td className="px-2 py-2 font-semibold uppercase">{statusOf(row)}</td>
                            <td className="px-2 py-2">{lifecycleControls("person", row, () => beginPersonEdit(row))}</td>
                          </tr>
                          {editing ? (
                            <tr className="border-t border-border/70 bg-surface/60">
                              <td colSpan={6} className="p-4">
                                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                                  <label className="text-xs font-medium text-muted">Display name<input className={inputClass} value={personForm.displayName} onChange={(e) => setPersonForm({ ...personForm, displayName: e.target.value })} /></label>
                                  <label className="text-xs font-medium text-muted">Function<input className={inputClass} value={personForm.functionName} onChange={(e) => setPersonForm({ ...personForm, functionName: e.target.value })} /></label>
                                  <label className="text-xs font-medium text-muted">Role title<input className={inputClass} value={personForm.roleTitle} onChange={(e) => setPersonForm({ ...personForm, roleTitle: e.target.value })} /></label>
                                  <label className="text-xs font-medium text-muted">Engagement<select className={inputClass} value={personForm.engagementType} onChange={(e) => setPersonForm({ ...personForm, engagementType: e.target.value as PersonForm["engagementType"] })}><option value="planned_role">Planned role</option><option value="employee">Employee</option><option value="contractor">Contractor</option><option value="consultant">Consultant</option></select></label>
                                  <label className="text-xs font-medium text-muted">Start month<input className={inputClass} type="number" min="1" max="36" value={personForm.startMonth} onChange={(e) => setPersonForm({ ...personForm, startMonth: e.target.value })} /></label>
                                  <label className="text-xs font-medium text-muted">End month<input className={inputClass} type="number" min="1" max="36" value={personForm.endMonth} onChange={(e) => setPersonForm({ ...personForm, endMonth: e.target.value })} /></label>
                                  <label className="text-xs font-medium text-muted md:col-span-2">Source / evidence<input className={inputClass} value={personForm.sourceReference} onChange={(e) => setPersonForm({ ...personForm, sourceReference: e.target.value })} /></label>
                                  <label className="text-xs font-medium text-muted md:col-span-2 lg:col-span-4">Notes<textarea className={inputClass} rows={2} value={personForm.notes} onChange={(e) => setPersonForm({ ...personForm, notes: e.target.value })} /></label>
                                </div>
                                <div className="mt-3 flex gap-2"><button type="button" disabled={busyId === id} onClick={() => void savePerson()} className="rounded bg-accent px-3 py-2 font-semibold text-bg disabled:opacity-40">Save draft</button><button type="button" onClick={clearEditor} className="rounded border border-border px-3 py-2 font-semibold">Cancel</button></div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className="mt-3 text-sm text-muted">No People record has been created yet.</p>}
          </details>

          <details className="rounded-xl border border-border p-3">
            <summary className="cursor-pointer font-semibold text-accent">Office Assets Register ({assets.length})</summary>
            <p className="mt-2 text-xs text-muted">Zero-valued catalogue rows remain registered. Workbook proposals stay draft until invoice/evidence review and approval.</p>
            {assets.length ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[1050px] table-auto text-left text-xs">
                  <thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle"><tr><th className="px-2 py-2">Asset</th><th className="px-2 py-2">Category</th><th className="px-2 py-2">Class</th><th className="px-2 py-2 text-right">Cost</th><th className="px-2 py-2 text-right">Monthly</th><th className="px-2 py-2">Purchase / life</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Controls</th></tr></thead>
                  <tbody>
                    {assets.map((row) => {
                      const id = text(row, "id");
                      const editing = editingKind === "asset" && editingId === id && assetForm;
                      return (
                        <Fragment key={id}>
                          <tr className="border-t border-border/70">
                            <td className="px-2 py-2 font-semibold">{text(row, "name")}</td><td className="px-2 py-2">{text(row, "category")}</td><td className="px-2 py-2 text-muted">{text(row, "asset_class", "assetClass")}</td><td className="px-2 py-2 text-right">{money(num(row, "cost_lakh", "costLakh"))}</td><td className="px-2 py-2 text-right">{money(num(row, "monthly_cost_lakh", "monthlyCostLakh"))}</td><td className="px-2 py-2 text-muted">M{text(row, "purchase_month", "purchaseMonth")} · {text(row, "useful_life_months", "usefulLifeMonths")}m</td><td className="px-2 py-2 font-semibold uppercase">{statusOf(row)}</td><td className="px-2 py-2">{lifecycleControls("asset", row, () => beginAssetEdit(row))}</td>
                          </tr>
                          {editing ? (
                            <tr className="border-t border-border/70 bg-surface/60"><td colSpan={8} className="p-4">
                              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                                <label className="text-xs font-medium text-muted">Asset<input className={inputClass} value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} /></label>
                                <label className="text-xs font-medium text-muted">Category<input className={inputClass} value={assetForm.category} onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value })} /></label>
                                <label className="text-xs font-medium text-muted">Class<select className={inputClass} value={assetForm.assetClass} onChange={(e) => setAssetForm({ ...assetForm, assetClass: e.target.value as AssetForm["assetClass"] })}><option value="office_admin">Office / admin</option><option value="office_consumable">Office consumable</option></select></label>
                                <label className="text-xs font-medium text-muted">Cost ₹L<input className={inputClass} type="number" min="0" step="0.01" value={assetForm.costLakh} onChange={(e) => setAssetForm({ ...assetForm, costLakh: e.target.value })} /></label>
                                <label className="text-xs font-medium text-muted">Monthly cost ₹L<input className={inputClass} type="number" min="0" step="0.01" value={assetForm.monthlyCostLakh} onChange={(e) => setAssetForm({ ...assetForm, monthlyCostLakh: e.target.value })} /></label>
                                <label className="text-xs font-medium text-muted">Purchase month<input className={inputClass} type="number" min="1" max="36" value={assetForm.purchaseMonth} onChange={(e) => setAssetForm({ ...assetForm, purchaseMonth: e.target.value })} /></label>
                                <label className="text-xs font-medium text-muted">Useful life months<input className={inputClass} type="number" min="1" value={assetForm.usefulLifeMonths} onChange={(e) => setAssetForm({ ...assetForm, usefulLifeMonths: e.target.value })} /></label>
                                <label className="text-xs font-medium text-muted">Allocation %<input className={inputClass} type="number" min="0" max="100" step="0.01" value={assetForm.allocationPct} onChange={(e) => setAssetForm({ ...assetForm, allocationPct: e.target.value })} /></label>
                                <label className="text-xs font-medium text-muted md:col-span-2">Source / evidence<input className={inputClass} value={assetForm.sourceReference} onChange={(e) => setAssetForm({ ...assetForm, sourceReference: e.target.value })} /></label>
                                <label className="text-xs font-medium text-muted md:col-span-2">Notes<textarea className={inputClass} rows={2} value={assetForm.notes} onChange={(e) => setAssetForm({ ...assetForm, notes: e.target.value })} /></label>
                              </div>
                              <div className="mt-3 flex gap-2"><button type="button" disabled={busyId === id} onClick={() => void saveAsset()} className="rounded bg-accent px-3 py-2 font-semibold text-bg disabled:opacity-40">Save draft</button><button type="button" onClick={clearEditor} className="rounded border border-border px-3 py-2 font-semibold">Cancel</button></div>
                            </td></tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className="mt-3 text-sm text-muted">No Office asset has been recorded.</p>}
          </details>

          <details className="rounded-xl border border-border p-3" open>
            <summary className="cursor-pointer font-semibold text-accent">People & Office Cost Register ({costs.length})</summary>
            <p className="mt-2 text-xs text-muted">Edit drafts here. Only approved source records feed Finance.</p>
            {costs.length ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[1150px] table-auto text-left text-xs">
                  <thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle"><tr><th className="px-2 py-2">Item</th><th className="px-2 py-2">Group</th><th className="px-2 py-2">Stage</th><th className="px-2 py-2 text-right">Qty</th><th className="px-2 py-2 text-right">Monthly / unit</th><th className="px-2 py-2">Period</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Controls</th></tr></thead>
                  <tbody>
                    {costs.map((row) => {
                      const id = text(row, "id");
                      const editing = editingKind === "cost" && editingId === id && costForm;
                      const review = text(row, "notes").startsWith("REVIEW REQUIRED:");
                      return (
                        <Fragment key={id}>
                          <tr className={`border-t border-border/70 ${review ? "bg-warn/5" : ""}`}>
                            <td className="px-2 py-2"><p className="font-semibold">{text(row, "name")}</p>{review ? <p className="mt-1 text-[10px] font-semibold text-warn">REVIEW REQUIRED</p> : null}</td><td className="px-2 py-2">{text(row, "cost_group", "costGroup")}</td><td className="px-2 py-2 text-muted">{text(row, "stage")}</td><td className="px-2 py-2 text-right">{num(row, "quantity")}</td><td className="px-2 py-2 text-right">{money(num(row, "monthly_unit_cost_lakh", "monthlyUnitCostLakh"))}</td><td className="px-2 py-2 text-muted">M{text(row, "start_month", "startMonth")}–M{text(row, "end_month", "endMonth")}</td><td className="px-2 py-2 font-semibold uppercase">{statusOf(row)}</td><td className="px-2 py-2">{lifecycleControls("cost", row, () => beginCostEdit(row))}</td>
                          </tr>
                          {editing ? (
                            <tr className="border-t border-border/70 bg-surface/60"><td colSpan={8} className="p-4">
                              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                                <label className="text-xs font-medium text-muted">Item<input className={inputClass} value={costForm.name} onChange={(e) => setCostForm({ ...costForm, name: e.target.value })} /></label>
                                <label className="text-xs font-medium text-muted">Group<select className={inputClass} value={costForm.costGroup} onChange={(e) => setCostForm({ ...costForm, costGroup: e.target.value as CostForm["costGroup"] })}><option value="payroll">Payroll</option><option value="office">Office</option><option value="statutory">Statutory</option><option value="outsourcing">Outsourcing</option></select></label>
                                <label className="text-xs font-medium text-muted">Stage<input className={inputClass} value={costForm.stage} onChange={(e) => setCostForm({ ...costForm, stage: e.target.value })} /></label>
                                <label className="text-xs font-medium text-muted">Linked person<select className={inputClass} value={costForm.personId} onChange={(e) => setCostForm({ ...costForm, personId: e.target.value })}><option value="">None / pooled cost</option>{people.filter((person) => ["draft", "pending_approval", "approved"].includes(statusOf(person))).map((person) => <option key={text(person, "id")} value={text(person, "id")}>{text(person, "display_name", "displayName")}</option>)}</select></label>
                                <label className="text-xs font-medium text-muted">Quantity<input className={inputClass} type="number" min="0" step="0.01" value={costForm.quantity} onChange={(e) => setCostForm({ ...costForm, quantity: e.target.value })} /></label>
                                <label className="text-xs font-medium text-muted">Monthly / unit ₹L<input className={inputClass} type="number" min="0" step="0.01" value={costForm.monthlyUnitCostLakh} onChange={(e) => setCostForm({ ...costForm, monthlyUnitCostLakh: e.target.value })} /></label>
                                <label className="text-xs font-medium text-muted">Start month<input className={inputClass} type="number" min="1" max="36" value={costForm.startMonth} onChange={(e) => setCostForm({ ...costForm, startMonth: e.target.value })} /></label>
                                <label className="text-xs font-medium text-muted">End month<input className={inputClass} type="number" min="1" max="36" value={costForm.endMonth} onChange={(e) => setCostForm({ ...costForm, endMonth: e.target.value })} /></label>
                                <label className="text-xs font-medium text-muted">One-time cost ₹L<input className={inputClass} type="number" min="0" step="0.01" value={costForm.oneTimeCostLakh} onChange={(e) => setCostForm({ ...costForm, oneTimeCostLakh: e.target.value })} /></label>
                                <label className="text-xs font-medium text-muted">One-time month<input className={inputClass} type="number" min="1" max="36" value={costForm.oneTimeMonth} onChange={(e) => setCostForm({ ...costForm, oneTimeMonth: e.target.value })} /></label>
                                <label className="text-xs font-medium text-muted md:col-span-2">Source / evidence<input className={inputClass} value={costForm.sourceReference} onChange={(e) => setCostForm({ ...costForm, sourceReference: e.target.value })} /></label>
                                <label className="text-xs font-medium text-muted md:col-span-2 lg:col-span-4">Notes<textarea className={inputClass} rows={2} value={costForm.notes} onChange={(e) => setCostForm({ ...costForm, notes: e.target.value })} /></label>
                              </div>
                              <div className="mt-3 flex gap-2"><button type="button" disabled={busyId === id} onClick={() => void saveCost()} className="rounded bg-accent px-3 py-2 font-semibold text-bg disabled:opacity-40">Save draft</button><button type="button" onClick={clearEditor} className="rounded border border-border px-3 py-2 font-semibold">Cancel</button></div>
                            </td></tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className="mt-3 text-sm text-muted">No People & Office cost item has been recorded.</p>}
          </details>

          <details className="rounded-xl border border-border p-3">
            <summary className="cursor-pointer font-semibold text-accent">Approved Finance Feed ({financeFeed.length})</summary>
            <p className="mt-2 text-xs text-muted">Read-only downstream consumption; drafts and pending approvals never contribute.</p>
            {financeFeed.length ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {financeFeed.map((row) => <div key={text(row, "plan_month", "planMonth")} className="rounded-lg border border-border p-3"><p className="text-xs font-semibold text-accent">M{text(row, "plan_month", "planMonth")}</p><p className="mt-2 text-sm">OPEX {money(num(row, "operating_expense_lakh", "operatingExpenseLakh"))}</p><p className="text-xs text-muted">CAPEX {money(num(row, "office_capex_lakh", "officeCapexLakh"))}</p></div>)}
              </div>
            ) : <p className="mt-3 text-sm text-muted">No approved source record currently feeds Finance.</p>}
          </details>

          <details className="rounded-xl border border-border p-3" open={reconciliationFlags.length > 0}>
            <summary className="cursor-pointer font-semibold text-accent">Audit Evidence ({auditEvents.length})</summary>
            <p className="mt-2 text-xs text-muted">Append-only saves, approvals, supersession events and workbook reconciliation findings.</p>
            {auditEvents.length ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[1050px] text-left text-xs">
                  <thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle"><tr><th className="px-2 py-2">Time</th><th className="px-2 py-2">Action</th><th className="px-2 py-2">Entity</th><th className="px-2 py-2">State</th><th className="px-2 py-2">Actor</th><th className="px-2 py-2">Evidence / reason</th></tr></thead>
                  <tbody>{auditEvents.map((event) => <tr key={text(event, "id")} className="border-t border-border/70"><td className="px-2 py-2 text-muted">{displayDate(text(event, "createdAt", "created_at"))}</td><td className="px-2 py-2 font-semibold">{text(event, "action")}</td><td className="px-2 py-2"><p>{text(event, "entityType", "entity_type")}</p><p className="font-mono text-[10px] text-subtle">{text(event, "entityId", "entity_id")}</p></td><td className="px-2 py-2">{text(event, "previousState", "previous_state") || "—"} → {text(event, "newState", "new_state") || "—"}</td><td className="px-2 py-2 text-muted">{text(event, "actorRole", "actor_role")}</td><td className="max-w-xl px-2 py-2"><p className="break-all text-[10px] text-subtle">{text(event, "sourceReference", "source_reference")}</p><p className={text(event, "reason").includes("REVIEW REQUIRED") || text(event, "entityType", "entity_type") === "people_office_reconciliation" ? "mt-1 font-semibold text-warn" : "mt-1 text-muted"}>{text(event, "reason") || "Recorded audit evidence"}</p></td></tr>)}</tbody>
                </table>
              </div>
            ) : <p className="mt-3 text-sm text-muted">No People & Office audit event has been recorded yet.</p>}
          </details>
        </div>
      </Panel>

      <p className="text-xs text-muted">Canonical authority: <code>vyndi_people_records</code>, <code>vyndi_people_office_cost_items</code>, <code>vyndi_people_office_assets</code>, <code>vyndi_people_office_finance_feed</code> and append-only <code>vyndi_audit_events</code>.</p>
    </div>
  );
}
