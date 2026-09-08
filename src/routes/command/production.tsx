import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Kpi, Panel } from "@/components/kpi";
import { MANUFACTURING_CONTROLS, MANUFACTURING_GATES } from "@/lib/data/manufacturing-control";
import { buildAccountingModel } from "@/lib/finance/accounting";
import { buildModelWithInputs, type ScenarioId } from "@/lib/finance/model";
import { lakh } from "@/lib/format";
import { getProductionJobCardView } from "@/lib/production-job-card-view";
import { issueProductionReservation, syncProductionJobCard } from "@/lib/production-job-card";
import { approveProductionBatch } from "@/lib/production-release-authority";
import { useVeloxis } from "@/lib/store";

export const Route = createFileRoute("/command/production")({
  loader: () => getProductionJobCardView(),
  component: ProductionWorkspace,
});

function familyForCard(card: any) {
  const value = String(card.variant_id ?? card.model_tier ?? "");
  if (value === "core" || value.startsWith("core-")) return "Longitude";
  if (value === "pro" || value.startsWith("pro-")) return "Latitude";
  if (value === "apex" || value.startsWith("apex-")) return "Altitude";
  return "";
}

function statusTone(status: string) {
  if (["released", "in_build", "in_progress", "completed", "complete"].includes(status)) return "text-green";
  if (["hold", "rejected", "cancelled"].includes(status)) return "text-warn";
  return "text-muted";
}

function ProductionWorkspace() {
  const { orders, cards, lines, travellers } = Route.useLoaderData();
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [busyLine, setBusyLine] = useState<string | null>(null);
  const [selectedTraveller, setSelectedTraveller] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  const scenario = useVeloxis((state) => state.scenario) as ScenarioId;
  const drawStandby = useVeloxis((state) => state.drawStandby);
  const finance = useVeloxis((state) => state.finance);
  const accounting = useVeloxis((state) => state.accounting);
  const updateGlobalFinance = useVeloxis((state) => state.updateGlobalFinance);

  const planRows = useMemo(() => buildModelWithInputs(scenario, drawStandby, finance), [scenario, drawStandby, finance]);
  const accountingRows = useMemo(() => buildAccountingModel(planRows, accounting), [planRows, accounting]);
  const productionRows = planRows.filter((row) => row.units > 0).slice(0, 12);
  const totalPlannedUnits = planRows.reduce((sum, row) => sum + row.units, 0);
  const trough = accountingRows.reduce((minimum, row) => row.closingCash < minimum.closingCash ? row : minimum, accountingRows[0]);

  const approvedCards = cards.filter((card: any) => Boolean(card.approved_at)).length;
  const committedUnits = cards.reduce((sum: number, card: any) => sum + Number(card.units), 0);
  const shortages = lines.filter((line: any) => Number(line.shortage_quantity ?? 0) > 0 && Boolean(line.sku)).length;
  const draftPos = cards.reduce((sum: number, card: any) => sum + Number(card.po_draft_count ?? 0), 0);
  const pendingControls = MANUFACTURING_CONTROLS.filter((item) => item.status === "pending").length;
  const verifyControls = MANUFACTURING_CONTROLS.filter((item) => item.status === "verify").length;

  const ordersNeedingJobCard = orders.filter((order: any) =>
    !order.job_card_id || Number(order.job_card_revision ?? 0) !== Number(order.revision),
  );

  async function synchronize(orderId: string) {
    setBusyAction(`sync:${orderId}`);
    setMessage("");
    try {
      const result = await syncProductionJobCard({ data: { salesOrderId: orderId } });
      setMessage(`Production build ${result.id ?? ""} synchronized from Commercial order ${orderId}. Components, quantities, BOM and shortages were selected automatically.`);
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Production synchronization failed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function approve(card: any) {
    setBusyAction(`approve:${card.id}`);
    setMessage("");
    try {
      const result = await approveProductionBatch({ data: { jobCardId: card.id } });
      setMessage(
        `${result.batchCode} approved as one controlled build. ${result.travellersCreated} traveller(s) auto-created; ${result.shortageSkuCount} shortage SKU(s); ${result.poDraftsCreated} draft PO shell(s) created for Procurement.`,
      );
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bike / batch approval failed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function issue(line: any, travellerId: string) {
    if (!line.reservation_id || !travellerId) return;
    setBusyLine(line.id);
    setMessage("");
    try {
      const result = await issueProductionReservation({ data: { reservationId: line.reservation_id, travellerId } });
      setMessage(`${line.sku} issued to ${travellerId}. FIFO COGS ₹${result.cogsInr.toFixed(2)} · resulting physical balance ${result.resultingBalance}.`);
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reserved material issue failed.");
    } finally {
      setBusyLine(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Supply & Production · order to serial genealogy</p>
          <h1 className="mt-1 font-display text-4xl text-accent">Production</h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">
            Select the bicycle once in Commercial. VYNDI automatically carries its controlled configuration into one job card, expands the BOM, reserves available stock, registers one traveller per physical unit and raises draft procurement for shortages. The production decision is approved once per bike / batch.
          </p>
        </div>
        <Link to="/command/purchase-execution" className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-muted hover:border-accent hover:text-accent">
          Open shortage-generated POs
        </Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Kpi label="Job cards" value={String(cards.length)} hint={`${approvedCards} approved builds`} />
        <Kpi label="Committed units" value={String(committedUnits)} hint="Confirmed Commercial demand" />
        <Kpi label="Travellers" value={String(travellers.length)} hint="Auto-registered genealogy" />
        <Kpi label="Shortage lines" value={String(shortages)} hint="Stock required" tone={shortages ? "danger" : "ok"} />
        <Kpi label="Draft POs" value={String(draftPos)} hint="Not supplier commitments" tone={draftPos ? "warn" : "ok"} />
        <Kpi label="36-mo plan" value={String(totalPlannedUnits)} hint={`${scenario} · trough ${lakh(trough.closingCash)}`} />
      </div>

      {message ? <div role="status" className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">{message}</div> : null}

      {ordersNeedingJobCard.length ? (
        <Panel title="Commercial orders awaiting Production synchronization" kicker="Normally automatic on order save">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {ordersNeedingJobCard.map((order: any) => (
              <article key={order.id} className="rounded-xl border border-border bg-bg-elevated/25 p-4">
                <p className="text-xs font-semibold text-fg">{order.variant_name ?? order.variant_id ?? order.id}</p>
                <p className="mt-1 text-xs text-muted">{order.id} R{order.revision} · {order.units} unit(s) · M{order.plan_month}</p>
                <Button className="mt-3 w-full" disabled={busyAction !== null} onClick={() => void synchronize(order.id)}>
                  {busyAction === `sync:${order.id}` ? "Synchronizing…" : "Synchronize controlled build"}
                </Button>
              </article>
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel title="Bike / batch release" kicker="One approval creates the dependent production records">
        {cards.length === 0 ? (
          <p className="text-sm leading-6 text-muted">No controlled job card exists. Create a confirmed bicycle order in Commercial; its model configuration is carried here automatically.</p>
        ) : (
          <div className="space-y-4">
            {cards.map((card: any) => {
              const cardLines = lines.filter((line: any) => line.job_card_id === card.id);
              const linkedTravellers = travellers.filter((traveller: any) => traveller.job_card_id === card.id && traveller.status !== "rejected");
              const shortageCount = cardLines.filter((line: any) => line.sku && Number(line.shortage_quantity ?? 0) > 0).length;
              const approved = Boolean(card.approved_at);
              return (
                <article key={card.id} className="rounded-xl border border-border bg-bg-elevated/25 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      <Metric label="Bicycle / variant" value={card.product_label ?? card.variant_id ?? "—"} />
                      <Metric label="Order" value={`${card.sales_order_id} R${card.sales_order_revision}`} />
                      <Metric label="Quantity" value={`${Number(card.units)} bike(s)`} />
                      <Metric label="BOM" value={card.bom_revision ?? "—"} />
                      <Metric label="Material state" value={shortageCount ? `${shortageCount} shortage line(s)` : "Ready"} />
                    </div>
                    <div className="min-w-56 rounded-lg border border-border bg-bg p-3">
                      {approved ? (
                        <>
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-green">Approved build</p>
                          <p className="mt-1 font-mono text-xs text-fg">{card.batch_code}</p>
                          <p className="mt-1 text-[11px] text-muted">{linkedTravellers.length} traveller(s) · {Number(card.po_draft_count ?? 0)} draft PO(s)</p>
                        </>
                      ) : (
                        <>
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-warn">Awaiting one production approval</p>
                          <Button className="mt-2 w-full" disabled={busyAction !== null || card.status !== "released"} onClick={() => void approve(card)}>
                            {busyAction === `approve:${card.id}` ? "Approving…" : "Approve bike / batch"}
                          </Button>
                          <p className="mt-2 text-[10px] leading-4 text-subtle">Creates travellers and draft shortage POs; it does not approve or issue supplier commitments.</p>
                        </>
                      )}
                    </div>
                  </div>

                  <details className="mt-4 rounded-lg border border-border/70 bg-bg/40 p-3" open={false}>
                    <summary className="cursor-pointer text-xs font-semibold text-fg">Material requirements · automatically selected from released BOM</summary>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {cardLines.map((line: any) => {
                        const required = Number(line.quantity ?? 0);
                        const physical = Number(line.available_quantity ?? 0);
                        const reserved = Number(line.reserved_quantity ?? 0);
                        const shortage = Number(line.shortage_quantity ?? 0);
                        const compatibleTravellers = linkedTravellers.filter((traveller: any) =>
                          ["released", "in_build"].includes(traveller.status) && traveller.model_name === familyForCard(card) && traveller.bom_revision === card.bom_revision,
                        );
                        const automaticTraveller = compatibleTravellers.length === 1 ? compatibleTravellers[0].id : "";
                        const chosenTraveller = automaticTraveller || selectedTraveller[line.id] || "";
                        const fullyReserved = Boolean(line.reservation_id) && reserved + 0.0001 >= required && shortage <= 0;
                        return (
                          <div key={line.id} className="rounded-lg border border-border/70 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0"><p className="truncate font-mono text-xs font-semibold text-fg">{line.sku ?? line.item}</p><p className="mt-1 text-[10px] text-subtle">{line.stage_code} · {line.stage_name}</p></div>
                              <span className={`text-[10px] font-bold uppercase ${shortage > 0 ? "text-warn" : "text-green"}`}>{shortage > 0 ? "Short" : line.sku ? "Covered" : "Operation"}</span>
                            </div>
                            <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[10px]">
                              <SmallMetric label="Req" value={`${required}`} /><SmallMetric label="Stock" value={`${physical}`} /><SmallMetric label="Reserved" value={`${reserved}`} /><SmallMetric label="Short" value={`${shortage}`} />
                            </div>
                            {line.sku && line.issue_status !== "issued" && fullyReserved && compatibleTravellers.length > 0 ? (
                              <div className="mt-3">
                                {compatibleTravellers.length > 1 ? (
                                  <select value={selectedTraveller[line.id] ?? ""} onChange={(event) => setSelectedTraveller((current) => ({ ...current, [line.id]: event.target.value }))} className="control mb-2 text-xs">
                                    <option value="">Select serial for FIFO issue</option>
                                    {compatibleTravellers.map((traveller: any) => <option key={traveller.id} value={traveller.id}>{traveller.serial_number}</option>)}
                                  </select>
                                ) : <p className="mb-2 text-[10px] text-muted">Serial auto-selected: {compatibleTravellers[0].serial_number}</p>}
                                <button type="button" disabled={busyLine === line.id || !chosenTraveller} onClick={() => void issue(line, chosenTraveller)} className="w-full rounded-md bg-accent px-3 py-2 text-xs font-semibold text-bg disabled:opacity-40">
                                  {busyLine === line.id ? "Issuing…" : "Issue reserved FIFO"}
                                </button>
                              </div>
                            ) : line.issue_status === "issued" ? <p className="mt-3 text-[10px] font-semibold text-green">FIFO issued</p>
                              : line.sku && shortage > 0 ? <p className="mt-3 text-[10px] text-warn">Draft PO is generated when this build is approved.</p>
                              : null}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title="Traveller register" kicker="Automatically registered from approved bike / batch">
        {travellers.length === 0 ? <p className="text-sm text-muted">No traveller exists yet. Approve a synchronized bike / batch above; VYNDI will register one serial-controlled traveller per physical unit.</p> : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {travellers.map((traveller: any) => (
              <article key={traveller.id} className="rounded-xl border border-border bg-bg-elevated/30 p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.14em] text-subtle">{traveller.id}</p><p className="mt-1 text-lg font-semibold text-fg">{traveller.serial_number}</p></div><span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${statusTone(String(traveller.status))}`}>{String(traveller.status).replaceAll("_", " ")}</span></div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs"><Metric label="Job card" value={traveller.job_card_id ?? "Pilot / legacy"} /><Metric label="Commercial order" value={traveller.sales_order_id ?? "—"} /><Metric label="Family" value={traveller.model_name ?? "—"} /><Metric label="BOM" value={traveller.bom_revision ?? "—"} /></div>
                <p className="mt-3 text-[11px] text-subtle">Production approval is recorded as accepted EPR-04 release evidence. Subsequent build, quality and final-release gates remain separately controlled.</p>
              </article>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="36-month Production Plan" kicker="Planning truth · separate from committed bike releases">
        <div className="grid gap-4 lg:grid-cols-[1fr_220px] lg:items-end"><div><p className="text-sm font-semibold text-fg">Portfolio production multiplier</p><p className="mt-1 max-w-2xl text-xs leading-5 text-muted">Forecast changes do not create job cards, travellers, POs or physical inventory. Only confirmed orders enter the controlled release chain above.</p></div><label className="block"><span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-subtle">Multiplier</span><input type="number" min="0" max="5" step="0.05" value={finance.unitMultiplier} onChange={(event) => updateGlobalFinance("unitMultiplier", Math.max(0, Math.min(5, Number(event.target.value) || 0)))} className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-right tabular-nums text-fg outline-none focus:border-accent" /></label></div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {productionRows.map((row) => <div key={row.m} className="rounded-lg border border-border/70 p-3"><div className="flex items-center justify-between"><span className="font-semibold">M{row.m}</span><span className="text-xs text-accent">{row.units} units</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><Metric label="Revenue" value={lakh(row.revenue)} /><Metric label="COGS" value={lakh(row.cogs)} /><Metric label="Inventory buy" value={lakh(row.inventoryBuy)} /><Metric label="Closing cash" value={lakh(accountingRows[row.m - 1]?.closingCash ?? 0)} /></div></div>)}
        </div>
      </Panel>

      <Panel title="Control boundary" kicker="Automation without uncontrolled commitments">
        <div className="grid gap-3 md:grid-cols-3">
          <LineageStep label="Automatic" text="Model defaults, BOM expansion, job-card lines, stock reservations, traveller registration and shortage draft POs." />
          <LineageStep label="One production approval" text="One bike / batch approval releases its genealogy and confirms the controlled build decision." />
          <LineageStep label="Still independently controlled" text="Supplier qualification, PO commercial completion, PO approval/issue, GRN, invoice/payment and later EPR quality gates." />
        </div>
        <p className="mt-4 text-xs text-muted">Manufacturing controls: {pendingControls} pending · {verifyControls} verification · {MANUFACTURING_GATES.length} release gates.</p>
      </Panel>
    </div>
  );
}

function LineageStep({ label, text }: { label: string; text: string }) {
  return <div className="rounded-xl border border-border bg-bg-elevated/25 p-4"><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-green">{label}</p><p className="mt-2 text-xs leading-5 text-muted">{text}</p></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><span className="text-[10px] uppercase tracking-wider text-subtle">{label}</span><p className="mt-1 break-words font-semibold text-fg">{value}</p></div>;
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded bg-bg-elevated/60 px-2 py-1.5"><p className="text-subtle">{label}</p><p className="mt-0.5 font-semibold text-fg">{value}</p></div>;
}