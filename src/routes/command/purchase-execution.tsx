import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowRight, FileCheck2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Kpi, Panel } from "@/components/kpi";
import { PurchaseHistoryLedger } from "@/components/purchase-history-ledger";
import { createPurchaseOrder, getPurchaseExecutionData, saveSupplier, transitionPurchaseOrder } from "@/lib/procure-to-pay-authority";
import { submitDraftPurchaseOrder } from "@/lib/purchase-draft-authority";
import { getPurchaseHistoryData } from "@/lib/purchase-history-ledger";

export const Route = createFileRoute("/command/purchase-execution")({ loader:async()=>{const [execution,purchaseHistory]=await Promise.all([getPurchaseExecutionData(),getPurchaseHistoryData()]);return {...execution,purchaseHistory};}, component:PurchaseExecution });
const today=()=>new Date().toISOString().slice(0,10);
const money=(value:unknown)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(value??0));
const rowNumber=(row:Record<string,unknown>,key:string)=>Number(row[key]??0);
const rowText=(row:Record<string,unknown>,key:string)=>String(row[key]??"");

function PurchaseExecution(){
  const data=Route.useLoaderData();const router=useRouter();const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
  const approvedSuppliers=data.suppliers.filter((row)=>rowText(row,"approval_status")==="approved"&&row.active!==false);
  const openOrders=data.purchaseOrders.filter((row)=>!["received","cancelled"].includes(rowText(row,"status")));
  const autoDrafts=data.purchaseOrders.filter((row)=>rowText(row,"status")==="draft"&&Boolean(row.auto_generated));
  const pendingApprovals=data.purchaseOrders.filter((row)=>rowText(row,"status")==="pending_approval").length;
  const openValue=openOrders.filter((row)=>!["draft"].includes(rowText(row,"status"))).reduce((sum,row)=>sum+rowNumber(row,"order_value_inr"),0);
  const [supplier,setSupplier]=useState({id:"",name:"",paymentTermsDays:30,leadTimeDays:30,sourceReference:""});
  const [purchase,setPurchase]=useState({id:"",supplierId:"",sourceActionId:"",requirementMonth:1,sku:"",unit:"ea",quantity:1,unitPriceInr:0,orderDate:today(),expectedReceiptOn:today(),paymentTermsDays:30,sourceReference:"",notes:""});
  const [draftEdit,setDraftEdit]=useState<Record<string,{supplierId:string;unitPriceInr:number;expectedReceiptOn:string;paymentTermsDays:number;sourceReference:string;notes:string}>>({});
  const recommendations=useMemo(()=>data.recommendations.filter((row)=>rowNumber(row,"quantity")>rowNumber(row,"committed_quantity")),[data.recommendations]);
  const autoDraftGroups=useMemo(()=>{const groups=new Map<string,Record<string,unknown>[]>();for(const row of autoDrafts){const key=rowText(row,"job_card_id")||"Unlinked production need";groups.set(key,[...(groups.get(key)??[]),row]);}return [...groups.entries()];},[autoDrafts]);
  const poSupplierGroups=useMemo(()=>{const groups=new Map<string,Record<string,unknown>[]>();for(const row of data.purchaseOrders){const key=rowText(row,"supplier_name")||"Supplier not assigned";groups.set(key,[...(groups.get(key)??[]),row]);}return [...groups.entries()];},[data.purchaseOrders]);

  async function run(task:()=>Promise<unknown>,success:string){setBusy(true);setMessage("");try{await task();setMessage(success);await router.invalidate();}catch(error){setMessage(error instanceof Error?error.message:"The transaction could not be completed.");}finally{setBusy(false);}}
  async function addSupplier(){if(!supplier.id||!supplier.name||!supplier.sourceReference){setMessage("Supplier ID, name and evidence reference are required.");return;}await run(()=>saveSupplier({data:{...supplier,currency:"INR",approvalStatus:"pending",qualityRating:null,deliveryRating:null}}),`${supplier.id.toUpperCase()} saved for approval.`);}
  async function approveSupplier(row:Record<string,unknown>){await run(()=>saveSupplier({data:{id:rowText(row,"id"),name:rowText(row,"name"),currency:rowText(row,"currency")||"INR",paymentTermsDays:rowNumber(row,"payment_terms_days"),leadTimeDays:rowNumber(row,"lead_time_days"),approvalStatus:"approved",qualityRating:row.quality_rating==null?null:rowNumber(row,"quality_rating"),deliveryRating:row.delivery_rating==null?null:rowNumber(row,"delivery_rating"),sourceReference:rowText(row,"source_reference")}}),`${rowText(row,"id")} approved for purchasing.`);}
  function chooseRecommendation(id:string){const row=data.recommendations.find((item)=>rowText(item,"id")===id);if(!row){setPurchase((current)=>({...current,sourceActionId:id}));return;}setPurchase((current)=>({...current,sourceActionId:id,requirementMonth:rowNumber(row,"requirement_month"),sku:rowText(row,"sku"),unit:rowText(row,"unit"),quantity:Math.max(rowNumber(row,"quantity")-rowNumber(row,"committed_quantity"),0)}));}
  async function submitManual(){if(!purchase.id||!purchase.supplierId||!purchase.sku||!purchase.sourceReference){setMessage("PO number, approved supplier, SKU and evidence reference are required.");return;}await run(()=>createPurchaseOrder({data:purchase}),`${purchase.id.toUpperCase()} submitted for independent approval.`);}
  async function transition(id:string,nextStatus:"approved"|"issued"|"cancelled"){const evidence=window.prompt(`Evidence / decision reference for ${nextStatus}`)?.trim();if(!evidence)return;await run(()=>transitionPurchaseOrder({data:{id,nextStatus,sourceReference:evidence}}),`${id} moved to ${nextStatus.replaceAll("_"," ")}.`);}
  function draftFor(row:Record<string,unknown>){const id=rowText(row,"id");return draftEdit[id]??{supplierId:"",unitPriceInr:rowNumber(row,"unit_price_inr"),expectedReceiptOn:rowText(row,"expected_receipt_on")||today(),paymentTermsDays:30,sourceReference:"",notes:rowText(row,"notes")};}
  function patchDraft(id:string,patch:Partial<ReturnType<typeof draftFor>>){const row=data.purchaseOrders.find((item)=>rowText(item,"id")===id) as Record<string,unknown>|undefined;if(!row)return;setDraftEdit((current)=>({...current,[id]:{...draftFor(row),...patch}}));}
  async function completeAutoDraft(row:Record<string,unknown>){const id=rowText(row,"id"),edit=draftFor(row);if(!edit.supplierId||edit.unitPriceInr<=0||!edit.sourceReference){setMessage("Assign an approved supplier, confirm a positive supplier price and enter quotation/evidence before submitting the draft PO.");return;}await run(()=>submitDraftPurchaseOrder({data:{id,supplierId:edit.supplierId,unitPriceInr:edit.unitPriceInr,expectedReceiptOn:edit.expectedReceiptOn,paymentTermsDays:edit.paymentTermsDays,sourceReference:edit.sourceReference,notes:edit.notes}}),`${id} completed and submitted for independent PO approval.`);}

  return <main className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-green">Supply & Production · authorised transactions</p><h1 className="mt-2 font-display text-4xl text-accent">Purchase Execution</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-muted">Approved Production batches create draft PO shells automatically for stock shortages. Drafts carry SKU, quantity, job-card lineage and planning price only; Procurement must assign an approved supplier, confirm commercial price/lead time and submit before independent approval creates a commitment.</p></div><Link to="/command/production" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted hover:border-accent hover:text-accent">Back to Production <ArrowRight className="size-4"/></Link></header>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Auto shortage drafts" value={String(autoDrafts.length)} hint="Supplier not committed" tone={autoDrafts.length?"warn":"ok"}/><Kpi label="Pending approval" value={String(pendingApprovals)} hint="Independent PO approval" tone={pendingApprovals?"warn":"ok"}/><Kpi label="Open committed value" value={money(openValue)} hint={`${openOrders.filter((r)=>rowText(r,"status")!=="draft").length} open commitments`}/><Kpi label="Approved suppliers" value={String(approvedSuppliers.length)} hint={`${data.suppliers.length} supplier records`}/></div>
    {message?<div role="status" className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">{message}</div>:null}

    {autoDrafts.length?<Panel title="Production shortage drafts" kicker="Grouped by job card · expand only when commercial completion is required">
      <div className="space-y-3">
        {autoDraftGroups.map(([jobCardId,rows])=><details key={jobCardId} className="rounded-xl border border-warn/40 bg-warn/5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <div><p className="font-mono text-xs font-semibold text-fg">{jobCardId}</p><p className="mt-1 text-[10px] text-muted">{rows.length} shortage draft line{rows.length===1?"":"s"} · no supplier commitment</p></div>
            <span className="text-xs font-semibold text-accent">Expand lines</span>
          </summary>
          <div className="space-y-3 border-t border-border p-3">
            {rows.map((row)=>{const id=rowText(row,"id"),edit=draftFor(row);return <details key={id} className="rounded-lg border border-border bg-bg/40">
              <summary className="grid cursor-pointer list-none gap-2 px-3 py-3 text-xs sm:grid-cols-[1.2fr_0.8fr_0.6fr_auto] sm:items-center [&::-webkit-details-marker]:hidden">
                <span className="font-mono font-semibold text-fg">{rowText(row,"sku")}</span>
                <span className="text-muted">{rowNumber(row,"quantity")} {rowText(row,"unit")}</span>
                <span className="text-muted">M{rowNumber(row,"requirement_month")}</span>
                <span className="font-semibold text-warn">Edit / submit</span>
              </summary>
              <div className="border-t border-border p-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Approved supplier"><select className="control mt-1" value={edit.supplierId} onChange={(e)=>patchDraft(id,{supplierId:e.target.value})}><option value="">Select supplier</option>{approvedSuppliers.map((supplierRow)=><option key={rowText(supplierRow,"id")} value={rowText(supplierRow,"id")}>{rowText(supplierRow,"name")}</option>)}</select></Field>
                  <Field label="Confirmed unit price · INR"><input className="control mt-1" type="number" min="0.01" step="0.01" value={edit.unitPriceInr} onChange={(e)=>patchDraft(id,{unitPriceInr:Number(e.target.value)})}/></Field>
                  <Field label="Expected receipt"><input className="control mt-1" type="date" value={edit.expectedReceiptOn} onChange={(e)=>patchDraft(id,{expectedReceiptOn:e.target.value})}/></Field>
                  <Field label="Payment terms · days"><input className="control mt-1" type="number" min="0" max="365" value={edit.paymentTermsDays} onChange={(e)=>patchDraft(id,{paymentTermsDays:Number(e.target.value)})}/></Field>
                  <Field label="Quote / RFQ reference"><input className="control mt-1" value={edit.sourceReference} onChange={(e)=>patchDraft(id,{sourceReference:e.target.value})} placeholder="RFQ / supplier quote"/></Field>
                  <Field label="Notes"><input className="control mt-1" value={edit.notes} onChange={(e)=>patchDraft(id,{notes:e.target.value})}/></Field>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button disabled={busy} onClick={()=>void completeAutoDraft(row)} className="rounded-md bg-accent px-3 py-2 text-xs font-semibold text-bg disabled:opacity-40">Submit for approval</button>
                  <button disabled={busy} onClick={()=>void transition(id,"cancelled")} className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted">Cancel draft</button>
                </div>
              </div>
            </details>;})}
          </div>
        </details>)}
      </div>
    </Panel>:null}

    <Panel title="Raise manual controlled PO" kicker="For authorised needs not already generated from a Production shortage"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Field label="Recommendation lineage"><select className="control mt-1" value={purchase.sourceActionId} onChange={(e)=>chooseRecommendation(e.target.value)}><option value="">Manual controlled need</option>{recommendations.map((row)=><option key={rowText(row,"id")} value={rowText(row,"id")}>M{rowNumber(row,"requirement_month")} · {rowText(row,"sku")} · {rowNumber(row,"quantity")-rowNumber(row,"committed_quantity")} {rowText(row,"unit")}</option>)}</select></Field><Field label="PO number"><input className="control mt-1 uppercase" value={purchase.id} onChange={(e)=>setPurchase({...purchase,id:e.target.value})} placeholder="PO-2026-001"/></Field><Field label="Approved supplier"><select className="control mt-1" value={purchase.supplierId} onChange={(e)=>{const selected=data.suppliers.find((row)=>rowText(row,"id")===e.target.value);setPurchase({...purchase,supplierId:e.target.value,paymentTermsDays:selected?rowNumber(selected,"payment_terms_days"):purchase.paymentTermsDays});}}><option value="">Select supplier</option>{approvedSuppliers.map((row)=><option key={rowText(row,"id")} value={rowText(row,"id")}>{rowText(row,"name")}</option>)}</select></Field><Field label="Requirement month"><input className="control mt-1" type="number" min="1" max="36" value={purchase.requirementMonth} onChange={(e)=>setPurchase({...purchase,requirementMonth:Number(e.target.value)})}/></Field><Field label="Inventory SKU"><select className="control mt-1" value={purchase.sku} onChange={(e)=>{const item=data.inventoryItems.find((row)=>rowText(row,"sku")===e.target.value);setPurchase({...purchase,sku:e.target.value,unit:item?rowText(item,"unit"):purchase.unit});}}><option value="">Select controlled SKU</option>{data.inventoryItems.map((row)=><option key={rowText(row,"sku")} value={rowText(row,"sku")}>{rowText(row,"sku")} · {rowText(row,"name")}</option>)}</select></Field><Field label="Quantity"><input className="control mt-1" type="number" min="0.01" step="0.01" value={purchase.quantity} onChange={(e)=>setPurchase({...purchase,quantity:Number(e.target.value)})}/></Field><Field label="Unit price · INR"><input className="control mt-1" type="number" min="0" step="0.01" value={purchase.unitPriceInr} onChange={(e)=>setPurchase({...purchase,unitPriceInr:Number(e.target.value)})}/></Field><Field label="Payment terms"><input className="control mt-1" type="number" min="0" max="365" value={purchase.paymentTermsDays} onChange={(e)=>setPurchase({...purchase,paymentTermsDays:Number(e.target.value)})}/></Field><Field label="Order date"><input className="control mt-1" type="date" value={purchase.orderDate} onChange={(e)=>setPurchase({...purchase,orderDate:e.target.value})}/></Field><Field label="Expected receipt"><input className="control mt-1" type="date" value={purchase.expectedReceiptOn} onChange={(e)=>setPurchase({...purchase,expectedReceiptOn:e.target.value})}/></Field><Field label="Quote / evidence"><input className="control mt-1" value={purchase.sourceReference} onChange={(e)=>setPurchase({...purchase,sourceReference:e.target.value})}/></Field><Field label="Notes"><input className="control mt-1" value={purchase.notes} onChange={(e)=>setPurchase({...purchase,notes:e.target.value})}/></Field></div><button type="button" disabled={busy} onClick={()=>void submitManual()} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-50"><FileCheck2 className="size-4"/>Submit for approval</button></Panel>

    <Panel title="Purchase order register" kicker="Grouped by supplier · spreadsheet register · expand only when needed">
      {data.purchaseOrders.length===0?<Empty text="No purchase orders have been raised."/>:
        <div className="space-y-3">{poSupplierGroups.map(([supplierName,rows])=>{
          const total=rows.reduce((sum,row)=>sum+rowNumber(row,"order_value_inr"),0);
          return <details key={supplierName} className="rounded-xl border border-border bg-surface/20">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
              <div><p className="font-semibold text-fg">{supplierName}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-subtle">{rows.length} PO line{rows.length===1?"":"s"} · {money(total)}</p></div>
              <span className="text-xs font-semibold text-accent">Expand register</span>
            </summary>
            <div className="overflow-x-auto border-t border-border">
              <table className="w-full table-auto text-left text-xs">
                <thead className="sticky top-0 bg-bg-elevated text-[10px] uppercase tracking-wider text-subtle"><tr>
                  <th className="px-3 py-2">PO</th><th className="px-3 py-2">SKU</th><th className="px-3 py-2">Req.</th><th className="px-3 py-2">Ordered / open</th><th className="px-3 py-2">Value</th><th className="px-3 py-2">Expected</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Control</th>
                </tr></thead>
                <tbody>{rows.map((row)=>{const status=rowText(row,"status"),id=rowText(row,"id");return <tr key={id} className="border-t border-border/70 align-top">
                  <td className="px-3 py-3 font-mono font-semibold text-fg">{id}</td>
                  <td className="px-3 py-3 text-fg">{rowText(row,"sku")}</td>
                  <td className="px-3 py-3 text-muted">M{rowNumber(row,"requirement_month")}</td>
                  <td className="px-3 py-3 text-muted">{rowNumber(row,"quantity")} / {rowNumber(row,"quantity_open")}</td>
                  <td className="px-3 py-3 text-muted">{money(row.order_value_inr)}</td>
                  <td className="px-3 py-3 text-muted">{rowText(row,"expected_receipt_on")}</td>
                  <td className="max-w-[220px] px-3 py-3 text-muted">{rowText(row,"job_card_id")||rowText(row,"source_action_id")||"Manual"}</td>
                  <td className="px-3 py-3"><Status value={status}/></td>
                  <td className="px-3 py-3"><div className="flex justify-end gap-2">
                    {status==="pending_approval"?<button disabled={busy} onClick={()=>void transition(id,"approved")} className="rounded-md bg-accent px-3 py-1.5 font-semibold text-bg">Approve</button>:null}
                    {status==="approved"?<button disabled={busy} onClick={()=>void transition(id,"issued")} className="rounded-md bg-accent px-3 py-1.5 font-semibold text-bg">Issue</button>:null}
                    {!["received","cancelled"].includes(status)?<button disabled={busy} onClick={()=>void transition(id,"cancelled")} className="rounded-md border border-border px-3 py-1.5 text-muted">Cancel</button>:null}
                  </div></td>
                </tr>;})}</tbody>
              </table>
            </div>
          </details>;
        })}</div>}
    </Panel>

    <PurchaseHistoryLedger rows={data.purchaseHistory}/>
    <Panel title="Supplier register" kicker="Qualified source control before PO commitment"><div className="grid gap-4 rounded-xl border border-border bg-bg-elevated/30 p-4 md:grid-cols-2 xl:grid-cols-5"><Field label="Supplier ID"><input className="control mt-1 uppercase" value={supplier.id} onChange={(e)=>setSupplier({...supplier,id:e.target.value})} placeholder="SUP-001"/></Field><Field label="Supplier name"><input className="control mt-1" value={supplier.name} onChange={(e)=>setSupplier({...supplier,name:e.target.value})}/></Field><Field label="Payment terms · days"><input className="control mt-1" type="number" min="0" max="365" value={supplier.paymentTermsDays} onChange={(e)=>setSupplier({...supplier,paymentTermsDays:Number(e.target.value)})}/></Field><Field label="Lead time · days"><input className="control mt-1" type="number" min="0" max="730" value={supplier.leadTimeDays} onChange={(e)=>setSupplier({...supplier,leadTimeDays:Number(e.target.value)})}/></Field><Field label="Evidence reference"><input className="control mt-1" value={supplier.sourceReference} onChange={(e)=>setSupplier({...supplier,sourceReference:e.target.value})}/></Field></div><button disabled={busy} onClick={()=>void addSupplier()} className="mt-3 rounded-md border border-border px-4 py-2 text-xs font-semibold">Save supplier for approval</button><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.suppliers.map((row)=><article key={rowText(row,"id")} className="rounded-lg border border-border p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-fg">{rowText(row,"name")}</p><p className="font-mono text-[10px] text-subtle">{rowText(row,"id")}</p></div><Status value={rowText(row,"approval_status")}/></div><p className="mt-2 text-xs text-muted">Terms {rowNumber(row,"payment_terms_days")}d · Lead {rowNumber(row,"lead_time_days")}d</p>{rowText(row,"approval_status")==="pending"?<button disabled={busy} onClick={()=>void approveSupplier(row)} className="mt-3 w-full rounded-md bg-accent px-3 py-2 text-xs font-semibold text-bg">Approve supplier</button>:null}</article>)}</div></Panel>
  </main>;
}
function Status({value}:{value:string}){const good=["approved","issued","received"].includes(value),warn=["draft","pending","pending_approval","part_received"].includes(value);return <span className={`text-[10px] font-bold uppercase tracking-wide ${good?"text-green":warn?"text-warn":"text-muted"}`}>{value.replaceAll("_"," ")}</span>;}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block text-xs text-muted"><span>{label}</span>{children}</label>;}
function Mini({label,value}:{label:string;value:string}){return <div><p className="text-[9px] uppercase tracking-wider text-subtle">{label}</p><p className="mt-1 break-words font-semibold text-fg">{value}</p></div>;}
function Empty({text}:{text:string}){return <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">{text}</div>;}
