import { useEffect, useMemo, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { getLatestIbpeRun, runGovernedIbpe, type IbpeRun } from "@/lib/ibpe-authority";

const workspaceDomains: Array<{ routes:string[]; label:string; domains:string[] }> = [
  { routes:["/command/planning","/command/finance-assumptions","/command/scenarios"], label:"Planning", domains:["planning","demand","funding"] },
  { routes:["/command/engineering","/command/product","/command/bom","/command/bom-control"], label:"Engineering", domains:["governance","supply"] },
  { routes:["/command/operations","/command/procurement","/command/inventory","/command/production","/command/manufacturing","/command/quality"], label:"Supply & Production", domains:["supply","inventory","procurement","capacity"] },
  { routes:["/command/sales","/command/gtm","/command/market-survey"], label:"Commercial", domains:["demand","planning"] },
  { routes:["/command/financial-cockpit","/command/finance","/command/cash","/command/balance-sheet","/command/funding","/command/actuals"], label:"Finance", domains:["finance","funding","procurement"] },
  { routes:["/command/governance","/command/risk","/command/legal","/command/qa-verification","/command/actions"], label:"Governance", domains:["governance","planning"] },
  { routes:["/command","/command/control-tower","/command/founder-command","/command/management-intelligence","/command/decision-engine"], label:"Command", domains:["planning","demand","supply","inventory","procurement","capacity","finance","funding","governance"] },
];

function workspace(pathname:string) {
  return workspaceDomains.find((entry) => entry.routes.some((route) => route === "/command" ? pathname === route : pathname === route || pathname.startsWith(`${route}/`))) ?? workspaceDomains[6];
}

export function IbpeWorkspaceProjection() {
  const { pathname } = useLocation();
  const current = workspace(pathname);
  const [run,setRun] = useState<IbpeRun|null>(null);
  const [status,setStatus] = useState("Loading IBPE decision packet…");
  const [busy,setBusy] = useState(false);
  useEffect(() => { let live=true; void getLatestIbpeRun().then((value)=>{ if(live){setRun(value);setStatus(value?"Persisted governed run loaded":"No governed IBPE run yet");} }).catch((e)=>live&&setStatus(e instanceof Error?e.message:"IBPE unavailable")); return()=>{live=false;}; },[]);
  const findings = useMemo(() => (run?.result.findings ?? []).filter((finding) => current.domains.includes(finding.domain)).slice(0,3), [run,current]);
  async function execute() {
    setBusy(true); setStatus("Building governed database snapshot…");
    try { await runGovernedIbpe(); const latest=await getLatestIbpeRun(); setRun(latest); setStatus("Governed IBPE run persisted"); }
    catch(e){ setStatus(e instanceof Error?e.message:"IBPE run failed"); }
    finally { setBusy(false); }
  }
  return <div className="border-b border-border bg-surface/50 px-4 py-2 text-xs">
    <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-3 gap-y-1">
      <span className="font-semibold text-fg">IBPE · {current.label}</span>
      {run ? <><span className="text-muted">R{run.approvedPlanRevision} · {run.inputHash.slice(0,8)} · {run.sourceSha.slice(0,7)}</span><span className="text-muted">Health {run.result.summary.businessHealthScore}/100</span><span className="text-muted">{findings.length ? findings.map((f)=>f.title).join(" · ") : "No workspace findings"}</span></> : <span className="text-muted">{status}</span>}
      <button type="button" disabled={busy} onClick={()=>void execute()} className="ml-auto font-semibold text-accent disabled:opacity-50">{busy?"Running…":"Run governed IBPE"}</button>
      {run ? <span className="w-full text-[10px] text-subtle">{status} · Advisory only — decisions require authorised action in the owning transaction workspace.</span> : null}
    </div>
  </div>;
}