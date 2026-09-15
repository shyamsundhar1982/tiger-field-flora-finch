import { createFileRoute } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";
import { listQualityAuthority } from "@/lib/quality-authority";
import { listIsoQualityCompliance } from "@/lib/iso-quality-compliance";

type Row = Record<string, unknown>;
const text = (row: Row, ...keys: string[]) => {
  for (const key of keys) if (row[key] != null) return String(row[key]);
  return "";
};
const num = (row: Row, ...keys: string[]) => {
  for (const key of keys) if (row[key] != null) return Number(row[key]) || 0;
  return 0;
};

export const Route = createFileRoute("/command/quality")({
  loader: async () => {
    const [quality, iso] = await Promise.all([listQualityAuthority(), listIsoQualityCompliance()]);
    return { quality, iso };
  },
  component: Quality,
});

function StatusPill({ value }: { value: string }) {
  const positive = ["current", "pass", "approved", "ready_for_dual_approval", "released", "active"].includes(value);
  const warning = value.includes("watch") || value.includes("conditional") || value.includes("pending");
  return (
    <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${positive ? "border-green/30 text-green" : warning ? "border-accent/30 text-accent" : "border-border text-muted"}`}>
      {value.replaceAll("_", " ") || "—"}
    </span>
  );
}

function Quality() {
  const { quality, iso } = Route.useLoaderData();
  const inspections = quality.inspections as Row[];
  const ncrs = quality.ncrs as Row[];
  const capas = quality.capas as Row[];
  const releases = quality.releases as Row[];
  const standards = iso.standards as Row[];
  const testMethods = iso.testMethods as Row[];
  const equipment = iso.equipment as Row[];
  const testRuns = iso.testRuns as Row[];
  const releaseStatus = iso.releaseStatus as Row[];

  const openNcr = ncrs.filter((row) => !["closed", "rejected"].includes(text(row, "status"))).length;
  const openCapa = capas.filter((row) => !["closed", "rejected"].includes(text(row, "status"))).length;
  const released = releases.filter((row) => text(row, "decision", "status") === "released").length;
  const passedIsoTests = testRuns.filter((row) => text(row, "result") === "pass").length;
  const completedIsoTests = testRuns.filter((row) => text(row, "result") !== "scheduled").length;
  const today = new Date().toISOString().slice(0, 10);
  const expiredCalibration = equipment.filter((row) => {
    const required = row.calibration_required === true || row.calibrationRequired === true;
    const status = text(row, "status");
    const due = text(row, "calibration_due_on", "calibrationDueOn");
    return required && status === "active" && (!due || due < today);
  }).length;
  const readyProducts = releaseStatus.filter((row) => ["approved", "ready_for_dual_approval"].includes(text(row, "release_status", "releaseStatus"))).length;

  return (
    <div className="space-y-6">
      <header className="border-b border-border pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">Quality · ISO compliance · governed release authority</p>
        <h1 className="mt-1 font-display text-4xl text-accent">Quality & Product Compliance</h1>
        <p className="mt-2 max-w-5xl text-sm leading-6 text-muted">
          Canonical inspection, NCR/CAPA and serialized release evidence is now joined to an ISO standards register, ISO 4210 verification plans, calibration control and engineering-revision product conformity.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Kpi label="ISO standards" value={String(standards.length)} hint="Version-controlled register" />
        <Kpi label="ISO tests passed" value={`${passedIsoTests}/${completedIsoTests}`} hint="Recorded physical verification" tone={completedIsoTests && passedIsoTests === completedIsoTests ? "ok" : "warn"} />
        <Kpi label="Calibration blocks" value={String(expiredCalibration)} hint="Active equipment overdue/missing" tone={expiredCalibration ? "warn" : "ok"} />
        <Kpi label="Open NCR" value={String(openNcr)} hint="Containment / CAPA" tone={openNcr ? "warn" : "ok"} />
        <Kpi label="Open CAPA" value={String(openCapa)} hint="Effectiveness pending" tone={openCapa ? "warn" : "ok"} />
        <Kpi label="ISO release ready" value={String(readyProducts)} hint={`${released} serialized Quality releases`} tone={readyProducts ? "ok" : "warn"} />
      </div>

      <Panel title="ISO Standards Register" kicker="Controlled edition · lifecycle · source">
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {standards.map((row) => (
            <div key={text(row, "id")} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-accent">{text(row, "standard_code", "standardCode")}</p>
                  <p className="text-xs text-muted">Edition {text(row, "edition")} · {text(row, "domain").replaceAll("_", " ")}</p>
                </div>
                <StatusPill value={text(row, "lifecycle_status", "lifecycleStatus")} />
              </div>
              <p className="mt-3 text-sm leading-5 text-muted">{text(row, "scope_summary", "scopeSummary")}</p>
              <div className="mt-3 space-y-1 text-xs text-subtle">
                <p>Controlled copy: {text(row, "controlled_copy_ref", "controlledCopyRef") || "Not linked yet"}</p>
                {text(row, "amendment_watch_ref", "amendmentWatchRef") ? <p>Watch: {text(row, "amendment_watch_ref", "amendmentWatchRef")}</p> : null}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-5 text-muted">
          VYNDI stores internal requirement IDs, clause references, acceptance-document references and evidence. The licensed controlled ISO copy remains authoritative; proprietary ISO requirement text and acceptance tables are not replicated in the application.
        </p>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="ISO 4210 Frame & Fork Verification" kicker="Part 6 · controlled method catalogue">
          <div className="grid gap-2 sm:grid-cols-2">
            {testMethods.map((row) => (
              <div key={text(row, "id")} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs font-semibold text-accent">{text(row, "id")}</span>
                  <StatusPill value={row.active === false ? "inactive" : "active"} />
                </div>
                <p className="mt-2 text-sm font-semibold">{text(row, "internal_method_name", "internalMethodName")}</p>
                <p className="mt-1 text-xs leading-5 text-muted">{text(row, "scope_summary", "scopeSummary")}</p>
                <p className="mt-2 text-[11px] text-subtle">Method authority: {text(row, "controlled_method_ref", "controlledMethodRef")}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Measurement & Laboratory Control" kicker="ISO 10012 · ISO/IEC 17025 evidence">
          {equipment.length ? (
            <div className="space-y-2">
              {equipment.slice(0, 12).map((row) => {
                const due = text(row, "calibration_due_on", "calibrationDueOn");
                const required = row.calibration_required === true || row.calibrationRequired === true;
                const valid = !required || (text(row, "status") === "active" && Boolean(due) && due >= today);
                return (
                  <div key={text(row, "id")} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-semibold text-accent">{text(row, "id")} · {text(row, "equipment_type", "equipmentType")}</p>
                      <p className="text-xs text-muted">Serial {text(row, "serial_number", "serialNumber") || "—"} · due {due || "not recorded"}</p>
                    </div>
                    <StatusPill value={valid ? "current" : "calibration blocked"} />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted">No controlled measurement equipment has been registered yet. Physical ISO test execution will block if required calibration evidence is missing or expired.</p>
          )}
        </Panel>
      </div>

      <Panel title="Product Conformity & Production Release" kicker="Engineering revision · verification completeness · dual approval">
        {releaseStatus.length ? (
          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {releaseStatus.map((row) => (
              <div key={`${text(row, "family_code", "familyCode")}-${text(row, "variant_id", "variantId")}-${text(row, "engineering_revision", "engineeringRevision")}`} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-accent">{text(row, "family_code", "familyCode").toUpperCase()} · Rev {text(row, "engineering_revision", "engineeringRevision")}</p>
                    <p className="text-xs text-muted">ITP {text(row, "itp_id", "itpId") || "not approved"}</p>
                  </div>
                  <StatusPill value={text(row, "release_status", "releaseStatus")} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md border border-border p-2"><p className="text-subtle">Evidence</p><p className="mt-1 font-semibold text-accent">{num(row, "evidence_completeness_pct", "evidenceCompletenessPct").toFixed(0)}%</p></div>
                  <div className="rounded-md border border-border p-2"><p className="text-subtle">Mandatory pass</p><p className="mt-1 font-semibold text-accent">{num(row, "passed_test_count", "passedTestCount")}/{num(row, "mandatory_test_count", "mandatoryTestCount")}</p></div>
                  <div className="rounded-md border border-border p-2"><p className="text-subtle">Open NCR/CAPA</p><p className="mt-1 font-semibold text-accent">{num(row, "open_ncr_count", "openNcrCount")}/{num(row, "open_capa_count", "openCapaCount")}</p></div>
                  <div className="rounded-md border border-border p-2"><p className="text-subtle">Calibration exceptions</p><p className="mt-1 font-semibold text-accent">{num(row, "invalid_calibration_count", "invalidCalibrationCount")}</p></div>
                </div>
                <p className="mt-3 text-[11px] leading-4 text-muted">Engineering approval: {text(row, "engineering_approval_ref", "engineeringApprovalRef") || "pending"} · Quality approval: {text(row, "quality_approval_ref", "qualityApprovalRef") || "pending"}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Released engineering baselines will appear here with live ISO verification readiness as approved ITPs and test evidence are recorded.</p>
        )}
      </Panel>

      <Panel title="Inspection Register" kicker="Incoming · in-process · final">
        {inspections.length ? (
          <div className="grid gap-2 lg:grid-cols-2">
            {inspections.map((row) => (
              <div key={text(row, "id")} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-mono text-xs text-accent">{text(row, "id")}</span>
                  <StatusPill value={text(row, "result")} />
                </div>
                <p className="mt-2 text-sm">{text(row, "inspection_stage", "inspectionStage")} · {text(row, "inspection_type", "inspectionType")}</p>
                <p className="mt-1 text-xs text-muted">JC {text(row, "job_card_id", "jobCardId") || "—"} · TRV {text(row, "traveller_id", "travellerId") || "—"} · SKU {text(row, "sku") || "—"}</p>
                <p className="mt-1 text-xs text-muted">Disposition {text(row, "disposition")} · defects {num(row, "defect_quantity", "defectQuantity")}/{num(row, "sample_size", "sampleSize")}</p>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted">No canonical inspection record has been posted yet.</p>}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="NCR / CAPA Register" kicker="Non-conformance control">
          {ncrs.length ? <div className="space-y-2">{ncrs.map((row) => <div key={text(row,"id")} className="rounded-lg border border-border p-3"><div className="flex justify-between gap-3"><span className="font-semibold text-accent">{text(row,"id")}</span><span className="text-xs uppercase text-muted">{text(row,"severity")} · {text(row,"status")}</span></div><p className="mt-2 text-sm">{text(row,"description")}</p></div>)}</div> : <p className="text-sm text-muted">No NCR recorded.</p>}
          {capas.length ? <p className="mt-3 text-xs text-muted">CAPA records: {capas.length} · open {openCapa}</p> : null}
        </Panel>
        <Panel title="Serialized Release Register" kicker="Current production release evidence">
          {releases.length ? <div className="space-y-2">{releases.map((row) => <div key={text(row,"id")} className="rounded-lg border border-border p-3"><div className="flex justify-between gap-3"><span className="font-mono text-xs text-accent">{text(row,"id")}</span><StatusPill value={text(row,"decision","status")} /></div><p className="mt-2 text-xs text-muted">Traveller {text(row,"traveller_id","travellerId") || "—"} · serial {text(row,"serial_number","serialNumber") || "—"}</p></div>)}</div> : <p className="text-sm text-muted">No serialized Quality release recorded.</p>}
        </Panel>
      </div>

      <p className="text-xs text-muted">
        Canonical authority: <code>vyndi_quality_*</code>, <code>vyndi_iso_*</code> and governed projection <code>vyndi_vibpe_iso_release_status</code>. Product release remains an explicit approval action; VIBPE may report readiness but cannot authorize release automatically.
      </p>
    </div>
  );
}
