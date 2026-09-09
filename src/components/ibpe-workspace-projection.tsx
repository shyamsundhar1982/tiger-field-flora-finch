import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { IBPE_ENGINE_VERSION, getIbpeReadiness, getLatestIbpeRun, runGovernedIbpe, type IbpeReadiness, type IbpeRun } from "@/lib/ibpe-authority";
import { IBPE_CORE_LABEL, VIBPE_COPILOT_LABEL } from "@/lib/ibpe-brand";

const workspaceDomains: Array<{ routes:string[]; label:string; domains:string[] }> = [
  { routes:["/command/planning","/command/finance-assumptions","/command/scenarios"], label:"Planning", domains:["planning","demand","funding"] },
  { routes:["/command/engineering","/command/product","/command/bom","/command/bom-control"], label:"Engineering", domains:["governance","supply"] },
  { routes:["/command/operations","/command/procurement","/command/procurement-planning","/command/purchase-execution","/command/receiving","/command/inventory","/command/production","/command/production-jobcards","/command/manufacturing","/command/quality"], label:"Supply & Production", domains:["supply","inventory","procurement","capacity"] },
  { routes:["/command/sales","/command/gtm","/command/market-survey"], label:"Commercial", domains:["demand","planning"] },
  { routes:["/command/financial-cockpit","/command/finance","/command/cash","/command/payables","/command/receivables","/command/balance-sheet","/command/funding","/command/actuals"], label:"Finance", domains:["finance","funding","procurement"] },
  { routes:["/command/governance","/command/master-data","/command/bom-inventory-mapping","/command/risk","/command/legal","/command/qa-verification","/command/actions"], label:"Governance", domains:["governance","planning","supply"] },
  { routes:["/command","/command/control-tower","/command/decision-inbox","/command/founder-command","/command/management-intelligence","/command/decision-engine"], label:"Command", domains:["planning","demand","supply","inventory","procurement","capacity","finance","funding","governance"] },
];

function workspace(pathname:string) {
  return workspaceDomains.find((entry) => entry.routes.some((route) => route === "/command" ? pathname === route : pathname === route || pathname.startsWith(`${route}/`))) ?? workspaceDomains[6];
}

function isUsableRun(value: unknown): value is IbpeRun {
  if (!value || typeof value !== "object") return false;
  const run = value as Partial<IbpeRun>;
  const result = run.result as IbpeRun["result"] | undefined;
  return run.engineVersion === IBPE_ENGINE_VERSION
    && typeof run.approvedPlanRevision === "number"
    && typeof run.inputHash === "string"
    && typeof run.sourceSha === "string"
    && !!result
    && typeof result === "object"
    && !!result.summary
    && typeof result.summary.businessHealthScore === "number"
    && Array.isArray(result.findings);
}

function isUsableReadiness(value: unknown): value is IbpeReadiness {
  if (!value || typeof value !== "object") return false;
  const readiness = value as Partial<IbpeReadiness>;
  if (typeof readiness.ready !== "boolean" || !Array.isArray(readiness.checks) || !readiness.counts || typeof readiness.counts !== "object") return false;
  return readiness.checks.every((check) => !!check
    && typeof check === "object"
    && typeof check.ready === "boolean"
    && typeof check.label === "string"
    && typeof check.actionTo === "string");
}

function readinessStatus(readiness: IbpeReadiness) {
  if (readiness.ready) return "Ready to create governed IBPE baseline";
  const labels = readiness.checks.filter((check) => !check.ready).map((check) => check.label);
  return `Setup required: ${labels.join(" · ")}`;
}

export function IbpeWorkspaceProjection() {
  const { pathname } = useLocation();
  const current = workspace(pathname);
  const [run,setRun] = useState<IbpeRun|null>(null);
  const [readiness,setReadiness] = useState<IbpeReadiness|null>(null);
  const [status,setStatus] = useState("Loading IBPE decision packet…");
  const [busy,setBusy] = useState(false);

  useEffect(() => {
    let live=true;
    void Promise.all([getLatestIbpeRun(),getIbpeReadiness()])
      .then(([value,nextReadiness]) => {
        if (!live) return;
        if (!isUsableReadiness(nextReadiness)) {
          setReadiness(null);
          if (isUsableRun(value)) setRun(value); else setRun(null);
          setStatus("IBPE readiness response unavailable. Refresh or retry; the workspace remains usable.");
          return;
        }
        setReadiness(nextReadiness);
        if (value == null) {
          setRun(null);
          setStatus(readinessStatus(nextReadiness));
          return;
        }
        if (!isUsableRun(value)) {
          setRun(null);
          setStatus("Stored IBPE run uses an older or incomplete schema; create a new governed run.");
          return;
        }
        setRun(value);
        setStatus("Persisted governed run loaded");
      })
      .catch((e) => {
        if (!live) return;
        setRun(null);
        setReadiness(null);
        setStatus(e instanceof Error ? e.message : "IBPE unavailable");
      });
    return()=>{live=false;};
  },[]);

  const findings = useMemo(() => {
    if (!run || !Array.isArray(run.result?.findings)) return [];
    const domains = Array.isArray(current?.domains) ? current.domains : [];
    return run.result.findings
      .filter((finding) => finding && typeof finding.domain === "string" && domains.includes(finding.domain))
      .slice(0,3);
  }, [run,current]);

  const blockerActions = useMemo(() => {
    if (!readiness || readiness.ready) return [];
    const seen = new Set<string>();
    return readiness.checks.filter((check) => !check.ready && !seen.has(check.actionTo) && seen.add(check.actionTo));
  }, [readiness]);

  async function execute() {
    setBusy(true);
    setStatus("Checking governed IBPE readiness…");
    try {
      const nextReadiness=await getIbpeReadiness();
      if (!isUsableReadiness(nextReadiness)) throw new Error("IBPE readiness response unavailable. Refresh and retry.");
      setReadiness(nextReadiness);
      if (!nextReadiness.ready) {
        setRun(null);
        setStatus(readinessStatus(nextReadiness));
        return;
      }
      setStatus("Building governed database snapshot…");
      await runGovernedIbpe();
      const latest=await getLatestIbpeRun();
      if (isUsableRun(latest)) {
        setRun(latest);
        setStatus("Governed IBPE run persisted");
      } else {
        setRun(null);
        setStatus("IBPE run completed but returned an incomplete decision packet.");
      }
    } catch(e) {
      setRun(null);
      setStatus(e instanceof Error?e.message:"IBPE run failed");
    } finally {
      setBusy(false);
    }
  }

  return <div className="border-b border-border bg-surface/50 px-4 py-2 text-xs">
    <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-3 gap-y-1">
      <span className="font-semibold text-fg">{VIBPE_COPILOT_LABEL} · {IBPE_CORE_LABEL} · {current?.label ?? "Command"}</span>
      {run ? <>
        <span className="text-muted">R{run.approvedPlanRevision} · {run.inputHash.slice(0,8)} · {run.sourceSha.slice(0,7)}</span>
        <span className="text-muted">Health {run.result.summary.businessHealthScore}/100</span>
        <span className="text-muted">{findings.length > 0 ? findings.map((f)=>f.title).filter(Boolean).join(" · ") : "No workspace findings"}</span>
      </> : <span className={readiness && !readiness.ready ? "text-warn" : "text-muted"}>{status}</span>}
      {!run && blockerActions.map((check)=><Link key={check.actionTo} to={check.actionTo as never} className="font-semibold text-accent hover:underline">Fix {check.label} →</Link>)}
      <button type="button" disabled={busy} onClick={()=>void execute()} className="ml-auto font-semibold text-accent disabled:opacity-50">{busy?"Checking…":"Run governed IBPE"}</button>
      {run ? <span className="w-full text-[10px] text-subtle">{status} · Advisory only — decisions require authorised action in the owning transaction workspace.</span> : readiness && !readiness.ready ? <span className="w-full text-[10px] text-subtle">The engine is authorised. Complete the highlighted governed prerequisites before a baseline can be persisted.</span> : null}
    </div>
  </div>;
}
