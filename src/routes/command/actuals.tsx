import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Kpi, Panel } from "@/components/kpi";
import { buildModelWithInputs } from "@/lib/finance/model";
import { useVeloxis } from "@/lib/store";

export const Route = createFileRoute("/command/actuals")({ component: Actuals });
type ActualField = "revenue" | "units" | "cogs" | "opex" | "closingCash" | "inventory" | "receivables" | "payables" | "headcount";
type ActualMonth = Partial<Record<ActualField, number | null>>; type ActualsMap = Record<number, ActualMonth>;
const STORAGE_KEY = "veloxis-actuals-v1";
const fields: { key: ActualField; label: string; suffix: string }[] = [
 {key:"revenue",label:"Revenue",suffix:"₹L"},{key:"units",label:"Units sold",suffix:"units"},{key:"cogs",label:"COGS",suffix:"₹L"},{key:"opex",label:"Opex",suffix:"₹L"},
 {key:"closingCash",label:"Closing cash",suffix:"₹L"},{key:"inventory",label:"Inventory",suffix:"₹L"},{key:"receivables",label:"Receivables",suffix:"₹L"},{key:"payables",label:"Payables",suffix:"₹L"},{key:"headcount",label:"Headcount",suffix:"people"},
];
const money=(n:number)=>`₹${n.toFixed(1)}L`;
function Actuals(){
 const scenario=useVeloxis(s=>s.scenario); const drawStandby=useVeloxis(s=>s.drawStandby); const finance=useVeloxis(s=>s.finance);
 const [actuals,setActuals]=useState<ActualsMap>({});
 useEffect(()=>{try{const raw=localStorage.getItem(STORAGE_KEY);if(raw)setActuals(JSON.parse(raw));}catch{}} ,[]);
 function save(next:ActualsMap){setActuals(next);try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next));}catch{}}
 function update(month:number,key:ActualField,value:number|null){save({...actuals,[month]:{...actuals[month],[key]:value}})}
 function clear(month:number){const next={...actuals};delete next[month];save(next)}
 const rows=useMemo(()=>buildModelWithInputs(scenario,drawStandby,finance),[scenario,drawStandby,finance]);
 const enteredMonths=Object.keys(actuals).map(Number).filter(m=>Object.values(actuals[m]??{}).some(v=>v!==null&&v!==undefined&&v!=="")).sort((a,b)=>a-b);
 const latestActual=enteredMonths.at(-1)??0;
 const entered=enteredMonths.length;
 const rolling=useMemo(()=>rows.map((plan,i)=>{const a=actuals[i+1]??{}; const has=Object.values(a).some(v=>v!==null&&v!==undefined&&v!==""); return {m:i+1,plan,actual:a,has};}),[rows,actuals]);
 const blendedRevenue=rolling.reduce((sum,r)=>sum+(r.m<=latestActual&&r.has&&r.actual.revenue!=null?r.actual.revenue:r.plan.revenue),0);
 const actualRevenue=enteredMonths.reduce((s,m)=>s+(actuals[m]?.revenue??0),0);
 const planThroughActual=enteredMonths.reduce((s,m)=>s+(rows[m-1]?.revenue??0),0);
 const revenueVariance=actualRevenue-planThroughActual;
 const latestHeadcount=latestActual?actuals[latestActual]?.headcount??null:null;
 const pct=(n:number,d:number)=>d?`${((n/d)*100).toFixed(1)}%`:"—";
 return <div className="space-y-6"><header><p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Finance · actual books</p><h1 className="font-display text-4xl">Actuals & rolling forecast</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">Enter verified monthly actuals. Completed months can be compared against Plan; the rolling view then uses Actual where available and the live model for future months.</p></header>
 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Kpi label="Actual months" value={`${entered}`} hint={latestActual?`Through M${latestActual}`:"No actuals entered"}/><Kpi label="Actual revenue" value={money(actualRevenue)} hint="Entered months"/><Kpi label="Revenue variance" value={money(revenueVariance)} hint={`${pct(revenueVariance,planThroughActual)} vs plan`} tone={revenueVariance<0?"danger":"ok"}/><Kpi label="Rolling 36M revenue" value={money(blendedRevenue)} hint="Actual through latest month"/><Kpi label="Latest actual headcount" value={latestHeadcount==null?"—":latestHeadcount.toFixed(0)} hint={latestActual?`M${latestActual}`:"Enter in actuals"}/></div>
 <Panel title="Actual vs Plan vs Rolling Forecast" kicker="Actual months are locked into the management forecast; future months remain model-driven"><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-xs"><thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle"><tr><th className="px-3 py-3">Month</th><th className="px-3 py-3 text-right">Plan revenue</th><th className="px-3 py-3 text-right">Actual revenue</th><th className="px-3 py-3 text-right">Variance</th><th className="px-3 py-3 text-right">Plan units</th><th className="px-3 py-3 text-right">Actual units</th><th className="px-3 py-3">Forecast basis</th></tr></thead><tbody>{rolling.map(r=>{const ar=r.actual.revenue;const au=r.actual.units;const variance=ar==null?null:ar-r.plan.revenue;return <tr key={r.m} className="border-t border-border"><td className="px-3 py-2 font-medium">M{r.m}</td><td className="px-3 py-2 text-right tabular-nums">{money(r.plan.revenue)}</td><td className="px-3 py-2 text-right tabular-nums">{ar==null?"—":money(ar)}</td><td className={`px-3 py-2 text-right tabular-nums ${variance!=null&&variance<0?"text-danger":"text-ok"}`}>{variance==null?"—":money(variance)}</td><td className="px-3 py-2 text-right tabular-nums">{r.plan.units}</td><td className="px-3 py-2 text-right tabular-nums">{au==null?"—":au}</td><td className="px-3 py-2">{r.m<=latestActual&&r.has?<span className="text-accent">ACTUAL</span>:<span className="text-muted">FORECAST</span>}</td></tr>})}</tbody></table></div><p className="mt-4 text-xs leading-5 text-muted">The rolling forecast does not overwrite the original Plan. It replaces only the completed, entered months with actuals and leaves future months linked to the selected live scenario and assumptions.</p></Panel>
 <Panel title="Monthly actual entry" kicker={`${entered} month${entered===1?"":"s"} with data · ₹ lakh unless stated`}><div className="overflow-x-auto"><table className="w-full min-w-[1200px] text-left text-sm"><thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle"><tr><th className="px-3 py-3">Month</th>{fields.map(f=><th key={f.key} className="px-2 py-3 text-right">{f.label}<br/><span className="font-normal">{f.suffix}</span></th>)}<th className="px-3 py-3">Action</th></tr></thead><tbody>{Array.from({length:36},(_,i)=>i+1).map(month=><tr key={month} className="border-t border-border"><td className="px-3 py-2 font-medium">M{month}</td>{fields.map(field=>{const value=actuals[month]?.[field.key];return <td key={field.key} className="px-2 py-2"><input aria-label={`M${month} ${field.label}`} type="number" min="0" step={field.key==="units"||field.key==="headcount"?"1":"0.1"} placeholder="—" value={value??""} onChange={e=>update(month,field.key,e.target.value===""?null:Number(e.target.value))} className="w-24 rounded-md border border-border bg-bg px-2 py-2 text-right text-sm tabular-nums text-fg outline-none focus:border-accent" /></td>})}<td className="px-3 py-2"><button type="button" onClick={()=>clear(month)} className="text-xs text-muted hover:text-danger">Clear</button></td></tr>)}</tbody></table></div><p className="mt-4 rounded-md border border-border bg-surface p-3 text-xs leading-5 text-muted">Blank means “not entered”, not zero. Use verified books, bank records, invoices and inventory records. Headcount feeds Board Control variance; enter the verified month-end headcount when available.</p></Panel>
 </div>;
}
