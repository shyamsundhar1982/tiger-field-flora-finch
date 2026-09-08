import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Kpi, Panel } from "@/components/kpi";
import { getProcurementPlanningReport, setProcurementSkuAction, type ReconciledRequirementRow } from "@/lib/procurement-authority";
import {
  approveProcurementPrice,
  getProcurementCostAuthorityReport,
  saveProcurementPriceDraft,
  type ProcurementCostAuthorityRow,
  type ProcurementPriceRecord,
} from "@/lib/procurement-cost-authority";

export const Route=createFileRoute("/command/procurement-planning")({
  loader:async()=>({
    ...(await getProcurementPlanningReport()),
    costAuthority:await getProcurementCostAuthorityReport(),
  }),
  component:ProcurementPlanning,
});
const lakh=(n:number)=>`₹${Number(n).toFixed(1)}L`;
const inr=(n?:number)=>n==null?"—":`₹${Number(n).toLocaleString("en-IN",{maximumFractionDigits:2})}`;

type CostDraft={priceType:"planning"|"supplier";supplierId:string;unitPrice:string;evidence:string};
const EMPTY_COST_DRAFT:CostDraft={priceType:"planning",supplierId:"",unitPrice:"",evidence:""};

function authorityLabel(value:ProcurementCostAuthorityRow["costAuthority"]){
  if(value==="EPR-FIFO-ACTUAL")return "FIFO actual";
  if(value==="APPROVED-PURCHASE-ORDER")return "Approved PO";
  if(value==="APPROVED-SUPPLIER-PRICE")return "Supplier price";
  if(value==="APPROVED-PLANNING-PROCUREMENT-PRICE")return "Planning price";
  return "Missing";
}

function ProcurementPlanning(){
  const data=Route.useLoaderData();
  const router=useRouter();
  const [busy,setBusy]=useState<string|null>(null);
  const [message,setMessage]=useState("");
  const [costDrafts,setCostDrafts]=useState<Record<string,CostDraft>>({});
  const net=data.requirements.reduce((s,r)=>s+r.netRequirement,0);
  const committed=data.requirements.reduce((s,r)=>s+r.committedRequirement,0);
  const exceptions=data.unprojectedCommitments.length+data.planningMappingIssues.length;

  function costDraft(sku:string){return costDrafts[sku]??EMPTY_COST_DRAFT;}
  function updateCostDraft(sku:string,patch:Partial<CostDraft>){
    setCostDrafts((current)=>({...current,[sku]:{...(current[sku]??EMPTY_COST_DRAFT),...patch}}));
  }
  async function action(row:ReconciledRequirementRow,actionType:"rfq"|"approval"|"po"){
    const key=`${row.requirementMonth}-${row.sku}-${actionType}`;setBusy(key);setMessage("");
    try{
      await setProcurementSkuAction({data:{requirementMonth:row.requirementMonth,sku:row.sku,unit:row.unit,actionType,quantity:row.netRequirement,status:"in_progress",demandBasis:row.demandBasis,note:`Raised from reconciled ${row.demandBasis} requirement for M${row.requirementMonth}.`}});
      setMessage(`${row.sku} M${row.requirementMonth}: ${actionType.toUpperCase()} in progress for ${row.netRequirement.toFixed(2)} ${row.unit}.`);
    }catch(e){setMessage(e instanceof Error?e.message:"Unable to update procurement action.");}finally{setBusy(null);}
  }
  async function saveCost(row:ProcurementCostAuthorityRow){
    const draft=costDraft(row.sku);const unitPrice=Number(draft.unitPrice);const key=`cost-${row.sku}`;setBusy(key);setMessage("");
    if(!Number.isFinite(unitPrice)||unitPrice<=0){setMessage(`${row.sku}: enter a positive INR procurement price.`);setBusy(null);return;}
    if(!draft.evidence.trim()){setMessage(`${row.sku}: source evidence is required.`);setBusy(null);return;}
    if(draft.priceType==="supplier"&&!draft.supplierId){setMessage(`${row.sku}: select an approved supplier.`);setBusy(null);return;}
    try{
      await saveProcurementPriceDraft({data:{
        sku:row.sku,
        supplierId:draft.priceType==="supplier"?draft.supplierId:null,
        priceType:draft.priceType,
        unit:row.unit,
        unitPriceInr:unitPrice,
        currency:"INR",
        effectiveFrom:new Date().toISOString().slice(0,10),
        sourceReference:draft.evidence.trim(),
        notes:"Entered from Procurement Planning cost authority.",
      }});
      setMessage(`${row.sku}: governed ${draft.priceType} price saved as DRAFT. A different authorised user must approve it before IBPE can use it.`);
      setCostDrafts((current)=>({...current,[row.sku]:EMPTY_COST_DRAFT}));
      await router.invalidate();
    }catch(e){setMessage(e instanceof Error?e.message:"Unable to save procurement price draft.");}finally{setBusy(null);}
  }
  async function approveCost(price:ProcurementPriceRecord){
    const key=`approve-cost-${price.id}`;setBusy(key);setMessage("");
    try{
      await approveProcurementPrice({data:{id:price.id,sourceReference:`Procurement Planning approval of ${price.sourceReference}`}});
      setMessage(`${price.sku}: ${price.priceType} price approved and eligible for governed IBPE valuation.`);
      await router.invalidate();
    }catch(e){setMessage(e instanceof Error?e.message:"Unable to approve procurement price.");}finally{setBusy(null);}
  }

  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] uppercase tracking-[0.22em] text-green">Plan + commitments · reconciled supply signal</p><h1 className="mt-2 text-4xl font-bold text-accent">Procurement Planning</h1><p className="mt-3 max-w-4xl text-sm leading-6 text-muted">One requirement view reconciles the 36-month family plan with exact confirmed-order demand, physical FIFO stock, reservations, MSL and authorised open POs. Procurement valuation is governed separately: catalogue/reference prices never become purchase cost unless a controlled price is approved.</p></div><div className="flex flex-wrap gap-2"><Link to="/command/purchase-execution" className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-bg">Execute purchase</Link><Link to="/command/inventory" className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-muted hover:text-accent">Master Inventory</Link><Link to="/command/sales" className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-muted hover:text-accent">Commercial</Link></div></header>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Kpi label="Plan procurement" value={lakh(data.summary.totalProcurementLakh)} hint="36M finance baseline"/><Kpi label="Committed demand" value={`${committed.toFixed(0)} units`} hint="Exact released job cards"/><Kpi label="Net SKU requirement" value={`${net.toFixed(0)} units`} hint="After stock + PO + MSL"/><Kpi label="Control exceptions" value={String(exceptions)} hint="Mapping / projection blockers" tone={exceptions?"danger":"ok"}/><Kpi label="Planning horizon" value="36 mo" hint="M1 → M36"/></div>
    {message?<div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">{message}</div>:null}
    {exceptions?<Panel title="Needs attention" kicker="Resolve before treating the material promise as reliable"><div className="space-y-3">{data.planningMappingIssues.map((issue)=><div key={issue} className="rounded-lg border border-warn/30 bg-warn/5 p-3 text-sm text-warn">{issue}</div>)}{data.unprojectedCommitments.map((o)=><div key={o.id} className="rounded-lg border border-warn/30 bg-warn/5 p-3"><p className="text-sm font-semibold text-fg">{o.id} · {o.variant_name??o.variant_id??"Variant missing"}</p><p className="mt-1 text-xs text-muted">Confirmed M{Number(o.plan_month)} · {Number(o.units)} units. Production projection is missing, stale or unreleased. Synchronize the current Commercial revision.</p></div>)}</div></Panel>:null}

    <Panel title="Procurement Cost Authority" kicker="FIFO actual → approved PO/supplier price → approved planning price → exception">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Active BOM SKUs" value={String(data.costAuthority.summary.activePlanningBomSkus)} hint="Planning-standard BOM scope"/>
        <Kpi label="Governed costs" value={`${data.costAuthority.summary.resolvedSkus}/${data.costAuthority.summary.activePlanningBomSkus}`} hint="Eligible for IBPE valuation" tone={data.costAuthority.summary.unresolvedSkus.length?undefined:"ok"}/>
        <Kpi label="Unresolved costs" value={String(data.costAuthority.summary.unresolvedSkus.length)} hint="Block commercial completeness" tone={data.costAuthority.summary.unresolvedSkus.length?"danger":"ok"}/>
        <Kpi label="Reference-only" value={String(data.costAuthority.summary.legacyReferenceOnlySkus.length)} hint="Catalogue values excluded" tone={data.costAuthority.summary.legacyReferenceOnlySkus.length?"warn":undefined}/>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-3">{data.costAuthority.reconciliation.map((r)=><div key={r.modelId} className="rounded-xl border border-border bg-bg/30 p-4"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-fg">{r.modelLabel}</p><span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${r.coverageComplete?"bg-green/10 text-green":"bg-warn/10 text-warn"}`}>{r.coverageComplete?"Reconciled":"Incomplete"}</span></div><div className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><p className="text-subtle">Finance target COGS</p><p className="mt-1 font-semibold text-fg">{lakh(r.targetCogsLakh)}</p></div><div><p className="text-subtle">Bottom-up BOM</p><p className="mt-1 font-semibold text-fg">{r.bottomUpBomCostLakh==null?"Unresolved":lakh(r.bottomUpBomCostLakh)}</p></div><div><p className="text-subtle">Variance</p><p className="mt-1 font-semibold text-fg">{r.varianceLakh==null?"—":`${r.varianceLakh>=0?"+":""}${lakh(r.varianceLakh)}`}</p></div><div><p className="text-subtle">Missing SKUs</p><p className="mt-1 font-semibold text-fg">{r.missingSkus.length}</p></div></div></div>)}</div>
      <p className="mt-4 text-xs leading-5 text-muted">Finance COGS remains the top-down commercial assumption. Bottom-up BOM cost is an independent procurement model and is intentionally shown as a variance, not forced to equal Finance. This authority currently accepts INR values only; foreign-currency quotes require a governed FX conversion before entry.</p>
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[1500px] text-left text-xs"><thead className="border-b border-border text-[10px] uppercase tracking-[0.13em] text-subtle"><tr><th className="px-2 py-3">SKU</th><th className="px-2 py-3">Current authority</th><th className="px-2 py-3 text-right">Governed INR</th><th className="px-2 py-3 text-right">Catalogue ref.</th><th className="px-2 py-3">New authority</th><th className="px-2 py-3">Supplier</th><th className="px-2 py-3">INR / unit</th><th className="px-2 py-3">Evidence</th><th className="px-2 py-3">Draft / approval</th></tr></thead><tbody>{data.costAuthority.costs.map((row)=>{
        const draft=costDraft(row.sku);
        const existingDraft=data.costAuthority.prices.find((price)=>price.sku===row.sku&&price.status==="draft");
        return <tr key={row.sku} className="border-t border-border/70 align-top"><td className="px-2 py-3"><p className="font-mono font-semibold text-fg">{row.sku}</p><p className="mt-1 text-[10px] text-subtle">{row.unit}</p></td><td className="px-2 py-3"><span className={row.costAuthority==="MISSING"?"text-warn":"text-green"}>{authorityLabel(row.costAuthority)}</span></td><td className="px-2 py-3 text-right font-semibold">{inr(row.governedCostInr)}</td><td className="px-2 py-3 text-right"><span className={row.legacyReferencePriceInr!=null&&row.governedCostInr==null?"text-warn":"text-muted"}>{inr(row.legacyReferencePriceInr)}</span></td><td className="px-2 py-3"><select value={draft.priceType} onChange={(e)=>updateCostDraft(row.sku,{priceType:e.target.value as CostDraft["priceType"],supplierId:e.target.value==="planning"?"":draft.supplierId})} className="w-32 rounded-md border border-border bg-bg px-2 py-2 text-xs text-fg"><option value="planning">Planning</option><option value="supplier">Supplier</option></select></td><td className="px-2 py-3"><select disabled={draft.priceType!=="supplier"} value={draft.supplierId} onChange={(e)=>updateCostDraft(row.sku,{supplierId:e.target.value})} className="w-48 rounded-md border border-border bg-bg px-2 py-2 text-xs text-fg disabled:opacity-40"><option value="">Select approved supplier</option>{data.costAuthority.suppliers.map((supplier)=><option key={supplier.id} value={supplier.id}>{supplier.name} · {supplier.currency}</option>)}</select></td><td className="px-2 py-3"><input inputMode="decimal" value={draft.unitPrice} onChange={(e)=>updateCostDraft(row.sku,{unitPrice:e.target.value})} placeholder="0.00" className="w-28 rounded-md border border-border bg-bg px-2 py-2 text-xs text-fg"/></td><td className="px-2 py-3"><input value={draft.evidence} onChange={(e)=>updateCostDraft(row.sku,{evidence:e.target.value})} placeholder="Quote / RFQ / approved basis" className="w-64 rounded-md border border-border bg-bg px-2 py-2 text-xs text-fg"/></td><td className="px-2 py-3"><div className="flex min-w-44 flex-col items-start gap-2"><button disabled={busy===`cost-${row.sku}`} onClick={()=>void saveCost(row)} className="text-xs font-semibold text-accent disabled:opacity-40">Save draft</button>{existingDraft?<><p className="text-[10px] text-muted">Draft {inr(existingDraft.unitPriceInr)} · {existingDraft.priceType}</p><button disabled={busy===`approve-cost-${existingDraft.id}`} onClick={()=>void approveCost(existingDraft)} className="text-xs font-semibold text-green disabled:opacity-40">Approve draft</button></>:<span className="text-[10px] text-subtle">No pending draft</span>}</div></td></tr>;
      })}</tbody></table></div>
      {data.costAuthority.summary.unresolvedSkus.length?<div className="mt-4 rounded-lg border border-warn/30 bg-warn/5 p-3 text-xs leading-5 text-warn"><strong>IBPE decision gate:</strong> {data.costAuthority.summary.unresolvedSkus.length} active planning-BOM SKU cost(s) remain unresolved. Procurement and funding valuation must not be treated as commercially complete until governed prices are approved.</div>:<div className="mt-4 rounded-lg border border-green/30 bg-green/5 p-3 text-xs text-green">Active planning-BOM procurement cost coverage is complete. Rerun governed IBPE 1.2 before relying on procurement/funding recommendations.</div>}
    </Panel>

    <Panel title="Reconciled SKU requirements" kicker="Plan vs committed → stock → reservations → MSL → open PO → net buy"><div className="overflow-x-auto"><table className="w-full min-w-[1450px] text-left text-xs"><thead className="border-b border-border text-[10px] uppercase tracking-[0.13em] text-subtle"><tr><th className="px-2 py-3">Month</th><th className="px-2 py-3">SKU</th><th className="px-2 py-3 text-right">Plan</th><th className="px-2 py-3 text-right">Committed</th><th className="px-2 py-3 text-right">Governing</th><th className="px-2 py-3 text-right">Physical</th><th className="px-2 py-3 text-right">Reserved</th><th className="px-2 py-3 text-right">ATP</th><th className="px-2 py-3 text-right">MSL</th><th className="px-2 py-3 text-right">Open PO</th><th className="px-2 py-3 text-right">Projected close</th><th className="px-2 py-3 text-right">Net buy</th><th className="px-2 py-3">Basis</th><th className="px-2 py-3">Action</th></tr></thead><tbody>{data.requirements.map((r)=><tr key={`${r.requirementMonth}-${r.sku}-${r.unit}`} className="border-t border-border/70"><td className="px-2 py-3 font-semibold">M{r.requirementMonth}</td><td className="px-2 py-3"><span className="font-mono font-semibold text-fg">{r.sku}</span> <span className="text-subtle">{r.unit}</span></td><td className="px-2 py-3 text-right">{r.plannedRequirement.toFixed(2)}</td><td className="px-2 py-3 text-right">{r.committedRequirement.toFixed(2)}</td><td className="px-2 py-3 text-right font-semibold">{r.grossRequirement.toFixed(2)}</td><td className="px-2 py-3 text-right">{r.physicalQuantity.toFixed(2)}</td><td className="px-2 py-3 text-right">{r.reservedQuantity.toFixed(2)}</td><td className="px-2 py-3 text-right">{r.availableToPromise.toFixed(2)}</td><td className="px-2 py-3 text-right">{r.minimumStockLevel.toFixed(2)}</td><td className="px-2 py-3 text-right">{r.openPoQuantity.toFixed(2)}</td><td className="px-2 py-3 text-right">{r.projectedEndingStock.toFixed(2)}</td><td className={`px-2 py-3 text-right font-bold ${r.netRequirement>0?"text-warn":"text-green"}`}>{r.netRequirement.toFixed(2)}</td><td className="px-2 py-3 uppercase text-subtle">{r.demandBasis}</td><td className="px-2 py-3">{r.netRequirement>0?<div className="flex gap-2">{(["rfq","approval","po"] as const).map((a)=><button key={a} disabled={busy===`${r.requirementMonth}-${r.sku}-${a}`} onClick={()=>void action(r,a)} className="text-xs font-semibold text-accent disabled:opacity-40">{a.toUpperCase()}</button>)}</div>:<span className="text-green">Covered</span>}</td></tr>)}</tbody></table>{data.requirements.length===0?<p className="py-8 text-center text-sm text-muted">No mapped material requirement is generated. Check approved planning-standard BOM mappings.</p>:null}</div></Panel>
    <details className="rounded-xl border border-border bg-surface/30 p-4"><summary className="cursor-pointer text-sm font-semibold text-fg">36-month finance context</summary><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[850px] text-xs"><thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle"><tr><th className="px-2 py-2 text-left">Requirement</th><th className="px-2 py-2 text-left">Plan action</th><th className="px-2 py-2 text-left">Units</th><th className="px-2 py-2 text-left">Longitude / Latitude / Altitude</th><th className="px-2 py-2 text-right">Finance procurement</th><th className="px-2 py-2 text-left">Tranche</th></tr></thead><tbody>{data.forecast.map((r)=><tr key={r.month} className="border-t border-border"><td className="px-2 py-2">M{r.requirementMonth}</td><td className="px-2 py-2 text-accent">M{r.planningMonth}</td><td className="px-2 py-2">{r.units}</td><td className="px-2 py-2">{r.coreUnits} / {r.proUnits} / {r.apexUnits}</td><td className="px-2 py-2 text-right">{r.procurementLakh?lakh(r.procurementLakh):"—"}</td><td className="px-2 py-2">{r.tranche}</td></tr>)}</tbody></table></div><p className="mt-3 text-xs text-muted">This is modeled intent, not a PO register. Execution actions above preserve provenance and distinguish forecast from commitment.</p></details>
  </main>;
}