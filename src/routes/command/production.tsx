import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Kpi, Panel } from "@/components/kpi";
import { MANUFACTURING_CONTROLS, MANUFACTURING_GATES } from "@/lib/data/manufacturing-control";
import { buildAccountingModel } from "@/lib/finance/accounting";
import { buildModelWithInputs, type ScenarioId } from "@/lib/finance/model";
import { lakh } from "@/lib/format";
import { getProductionJobCardView } from "@/lib/production-job-card-view";
import { issueProductionReservation, syncProductionJobCard } from "@/lib/production-job-card";
import { createProductionTraveller } from "@/lib/production-traveller";
import { useVeloxis } from "@/lib/store";

export const Route = createFileRoute("/command/production")({
  loader: () => getProductionJobCardView(),
  component: ProductionWorkspace,
});

const control = "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg outline-none focus:border-accent";

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
  const [selectedTraveller, setSelectedTraveller] = useState<Record<string, string>>({});
  const [busyLine, setBusyLine] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"job" | "traveller" | null>(null);
  const [message, setMessage] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [travellerForm, setTravellerForm] = useState({
    jobCardId: "",
    serialNumber: "",
    engineeringRevision: "",
    supplier: "",
  });

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

  const releasedCards = cards.filter((card: any) => ["released", "in_progress"].includes(card.status)).length;
  const committedUnits = cards.reduce((sum: number, card: any) => sum + Number(card.units), 0);
  const shortages = lines.filter((line: any) => Number(line.shortage_quantity ?? 0) > 0).length;
  const materialLines = lines.filter((line: any) => Boolean(line.sku));
  const zeroPhysicalInventory = materialLines.length > 0 && materialLines.every((line: any) => Number(line.available_quantity ?? 0) === 0);
  const issueEligibleTravellers = travellers.filter((traveller: any) => ["released", "in_build"].includes(traveller.status));
  const pendingControls = MANUFACTURING_CONTROLS.filter((item) => item.status === "pending").length;
  const verifyControls = MANUFACTURING_CONTROLS.filter((item) => item.status === "verify").length;

  const ordersNeedingJobCard = orders.filter((order: any) =>
    !order.job_card_id || Number(order.job_card_revision ?? 0) !== Number(order.revision),
  );
  const travellerCandidateCards = cards.filter((card: any) => {
    if (!["released", "in_progress"].includes(card.status)) return false;
    const linked = travellers.filter((traveller: any) => traveller.job_card_id === card.id && traveller.status !== "rejected").length;
    return linked < Math.ceil(Number(card.units));
  });

  async function raiseJobCard() {
    if (!selectedOrderId) return;
    setBusyAction("job");
    setMessage("");
    try {
      const result = await syncProductionJobCard({ data: { salesOrderId: selectedOrderId } });
      setMessage(`Job card ${result.id ?? ""} synchronized from confirmed Commercial order ${selectedOrderId}. Variant, BOM, quantity and requirements were derived from controlled records.`);
      setSelectedOrderId("");
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Job card release failed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function raiseTraveller() {
    if (!travellerForm.jobCardId || !travellerForm.serialNumber.trim() || !travellerForm.engineeringRevision.trim()) return;
    setBusyAction("traveller");
    setMessage("");
    try {
      const result = await createProductionTraveller({ data: travellerForm });
      setMessage(`Traveller ${result.travellerId} created in draft for job card ${result.jobCardId} / order ${result.salesOrderId}. ${result.modelName} and BOM ${result.bomRevision} were inherited from the job card.`);
      setTravellerForm({ jobCardId: "", serialNumber: "", engineeringRevision: "", supplier: "" });
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Traveller creation failed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function issue(line: any) {
    const travellerId = selectedTraveller[line.id];
    if (!line.reservation_id || !travellerId) return;
    setBusyLine(line.id);
    setMessage("");
    try {
      const result = await issueProductionReservation({ data: { reservationId: line.reservation_id, travellerId } });
      setMessage(`${line.sku} issued against the linked traveller. FIFO COGS ₹${result.cogsInr.toFixed(2)} · resulting physical balance ${result.resultingBalance}.`);
      setSelectedTraveller((current) => ({ ...current, [line.id]: "" }));
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reserved material issue failed.");
    } finally {
      setBusyLine(null);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Supply & Production · canonical production workspace</p>
        <h1 className="mt-1 font-display text-4xl text-accent">Production</h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">
          Committed demand becomes a controlled job card, each physical unit receives a traveller/serial, and every material, process, quality and audit record remains linked to that genealogy. Zero physical inventory is valid and creates shortages rather than fake stock.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Kpi label="Job cards" value={String(cards.length)} hint={`${releasedCards} released / active`} />
        <Kpi label="Committed units" value={String(committedUnits)} hint="Confirmed order demand" />
        <Kpi label="Traveller records" value={String(travellers.length)} hint={`${issueEligibleTravellers.length} issue-eligible`} />
        <Kpi label="Shortage lines" value={String(shortages)} hint="Committed Procurement demand" tone={shortages ? "danger" : "ok"} />
        <Kpi label="36-mo plan" value={String(totalPlannedUnits)} hint={`${scenario} scenario`} />
        <Kpi label="Cash trough" value={lakh(trough.closingCash)} hint={`M${trough.m}`} tone={trough.closingCash < 0 ? "danger" : trough.closingCash < 15 ? "warn" : "ok"} />
      </div>

      {message ? <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">{message}</div> : null}

      <Panel title="Raise controlled Production records" kicker="No free-standing job cards or production travellers">
        <div className="grid gap-5 xl:grid-cols-2">
          <section className="rounded-xl border border-border bg-bg-elevated/30 p-4">
            <h3 className="text-base font-semibold text-green">Raise Job Card</h3>
            <p className="mt-1 text-xs leading-5 text-muted">
              Select confirmed Commercial demand. Production derives the order revision, model/variant, approved BOM, quantity, material requirements and shortages; these fields cannot be invented here.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <select value={selectedOrderId} onChange={(event) => setSelectedOrderId(event.target.value)} className={control}>
                <option value="">Select confirmed order needing a job card</option>
                {ordersNeedingJobCard.map((order: any) => (
                  <option key={order.id} value={order.id}>
                    {order.id} R{order.revision} · {order.variant_name ?? order.variant_id ?? "variant missing"} · {order.units} unit(s) · M{order.plan_month}
                  </option>
                ))}
              </select>
              <Button disabled={busyAction !== null || !selectedOrderId} onClick={() => void raiseJobCard()}>
                {busyAction === "job" ? "Raising…" : "Raise job card"}
              </Button>
            </div>
            <p className="mt-3 text-[11px] text-subtle">
              {ordersNeedingJobCard.length ? `${ordersNeedingJobCard.length} confirmed order(s) need initial release or revision synchronization.` : "All confirmed Commercial orders are already represented by the current Production revision."}
            </p>
          </section>

          <section className="rounded-xl border border-border bg-bg-elevated/30 p-4">
            <h3 className="text-base font-semibold text-green">Raise Traveller / Serial</h3>
            <p className="mt-1 text-xs leading-5 text-muted">
              A traveller is a child of one Production Job Card. Model family, exact variant, BOM and Commercial provenance are inherited; only serial-specific execution data is entered here.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <select value={travellerForm.jobCardId} onChange={(event) => setTravellerForm((value) => ({ ...value, jobCardId: event.target.value }))} className={control}>
                <option value="">Select released / in-progress job card</option>
                {travellerCandidateCards.map((card: any) => (
                  <option key={card.id} value={card.id}>{card.id} · {card.product_label} · {card.bom_revision}</option>
                ))}
              </select>
              <input value={travellerForm.serialNumber} onChange={(event) => setTravellerForm((value) => ({ ...value, serialNumber: event.target.value }))} placeholder="Serial number *" className={control} />
              <input value={travellerForm.engineeringRevision} onChange={(event) => setTravellerForm((value) => ({ ...value, engineeringRevision: event.target.value }))} placeholder="Engineering revision *" className={control} />
              <input value={travellerForm.supplier} onChange={(event) => setTravellerForm((value) => ({ ...value, supplier: event.target.value }))} placeholder="Supplier / OEM" className={control} />
            </div>
            <Button className="mt-3" disabled={busyAction !== null || !travellerForm.jobCardId || !travellerForm.serialNumber.trim() || !travellerForm.engineeringRevision.trim()} onClick={() => void raiseTraveller()}>
              {busyAction === "traveller" ? "Creating…" : "Create traveller"}
            </Button>
            <p className="mt-3 text-[11px] text-subtle">New travellers start in draft. Passing EPR-04 releases the serial; EPR-05 in-progress moves it into build. Only released/in-build serials can receive reserved material.</p>
          </section>
        </div>
      </Panel>

      <Panel title="Record relationship" kicker="One provenance chain from customer commitment to audit">
        <div className="grid gap-3 md:grid-cols-5">
          <LineageStep label="1 · Commercial Order" text="Demand, exact variant, configuration, quantity and revision." />
          <LineageStep label="2 · Job Card" text="Released BOM, due month, requirements, reservations and shortages." />
          <LineageStep label="3 · Traveller / Serial" text="One physical unit genealogy linked to its job card and order revision." />
          <LineageStep label="4 · Execution & Quality" text="Material lots, operations, inspections, NCR/CAPA, evidence and gates reference the traveller." />
          <LineageStep label="5 · Inventory & Finance" text="Reserved FIFO issue posts ledger movement, COGS and audit against the same serial." />
        </div>
      </Panel>

      <Panel title="Current execution state" kicker="Stock truth and committed demand">
        {cards.length === 0 ? (
          <p className="text-sm leading-6 text-muted">No production job card exists yet. Inventory quantity does not control job-card visibility; raise a job card from confirmed Commercial demand above.</p>
        ) : zeroPhysicalInventory ? (
          <p className="text-sm leading-6 text-muted">Physical inventory is currently 0 for all mapped material requirements. Job cards remain active; material lines show Physical 0 · Reserved 0 · ATP 0 and the full requirement as Shortage. Those shortages feed committed Procurement demand.</p>
        ) : (
          <p className="text-sm leading-6 text-muted">Physical stock exists for at least one mapped requirement. Reservations reduce ATP but do not change physical stock until a controlled FIFO issue is posted against a linked, released traveller.</p>
        )}
      </Panel>

      <Panel title="Production Job Cards" kicker="Commercial order → exact BOM → shortage / reservation → traveller issue">
        {cards.length === 0 ? <p className="text-sm text-muted">No job cards to display.</p> : (
          <div className="space-y-5">
            {cards.map((card: any) => {
              const cardLines = lines.filter((line: any) => line.job_card_id === card.id);
              const linkedTravellers = travellers.filter((traveller: any) => traveller.job_card_id === card.id);
              const family = familyForCard(card);
              const compatibleTravellers = linkedTravellers.filter((traveller: any) =>
                ["released", "in_build"].includes(traveller.status) && traveller.model_name === family && traveller.bom_revision === card.bom_revision,
              );
              return (
                <section key={card.id} className="rounded-xl border border-border bg-bg-elevated/25 p-4">
                  <div className="grid gap-3 md:grid-cols-6">
                    <Metric label="Job card" value={card.id} />
                    <Metric label="Commercial order" value={`${card.sales_order_id} R${card.sales_order_revision}`} />
                    <Metric label="Variant" value={card.variant_id ?? card.model_tier ?? "—"} />
                    <Metric label="BOM revision" value={card.bom_revision ?? "—"} />
                    <Metric label="Travellers" value={`${linkedTravellers.length} / ${Math.ceil(Number(card.units))}`} />
                    <Metric label="Status" value={String(card.status).replaceAll("_", " ")} />
                  </div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[1320px] text-sm">
                      <thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle"><tr><th className="px-3 py-3 text-left">Stage</th><th className="px-3 py-3 text-left">SKU / requirement</th><th className="px-3 py-3 text-right">Required</th><th className="px-3 py-3 text-right">Physical</th><th className="px-3 py-3 text-right">Reserved</th><th className="px-3 py-3 text-right">ATP</th><th className="px-3 py-3 text-right">Shortage</th><th className="px-3 py-3 text-left">Material issue</th></tr></thead>
                      <tbody>
                        {cardLines.map((line: any) => {
                          const required = Number(line.quantity ?? 0);
                          const physical = Number(line.available_quantity ?? 0);
                          const reserved = Number(line.reserved_quantity ?? 0);
                          const shortage = Number(line.shortage_quantity ?? 0);
                          const fullyReserved = Boolean(line.reservation_id) && reserved + 0.0001 >= required && shortage <= 0;
                          const alreadyIssued = line.issue_status === "issued";
                          return (
                            <tr key={line.id} className="border-t border-border/70">
                              <td className="px-3 py-3">{line.stage_code} · {line.stage_name}</td>
                              <td className="px-3 py-3"><span className="font-mono text-xs">{line.sku ?? "—"}</span><span className="ml-2 text-muted">{line.item}</span></td>
                              <td className="px-3 py-3 text-right">{required} {line.unit}</td><td className="px-3 py-3 text-right">{physical}</td><td className="px-3 py-3 text-right text-accent">{reserved}</td><td className="px-3 py-3 text-right">{Number(line.available_to_promise ?? 0)}</td><td className={`px-3 py-3 text-right font-semibold ${shortage > 0 ? "text-warn" : "text-green"}`}>{shortage || "—"}</td>
                              <td className="px-3 py-3">
                                {!line.sku ? <span className="text-xs uppercase text-subtle">{line.issue_status}</span>
                                  : alreadyIssued ? <span className="text-xs font-semibold text-green">Issued · FIFO posted</span>
                                  : physical === 0 ? <span className="text-xs text-warn">Await stock · committed shortage</span>
                                  : !line.reservation_id ? <span className="text-xs text-warn">No active reservation</span>
                                  : !fullyReserved ? <span className="text-xs text-warn">Await full reservation</span>
                                  : compatibleTravellers.length === 0 ? <span className="text-xs text-warn">Raise and release a traveller for this job card</span>
                                  : <div className="flex min-w-[350px] items-center gap-2"><select value={selectedTraveller[line.id] ?? ""} onChange={(event) => setSelectedTraveller((current) => ({ ...current, [line.id]: event.target.value }))} className="min-w-52 rounded-md border border-border bg-bg px-2 py-2 text-xs text-fg"><option value="">Select linked traveller / serial</option>{compatibleTravellers.map((traveller: any) => <option key={traveller.id} value={traveller.id}>{traveller.serial_number} · {traveller.status}</option>)}</select><button type="button" disabled={busyLine === line.id || !selectedTraveller[line.id]} onClick={() => void issue(line)} className="rounded-md bg-accent px-3 py-2 text-xs font-semibold text-bg disabled:opacity-40">{busyLine === line.id ? "Issuing…" : "Issue reserved FIFO"}</button></div>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title="Traveller Register" kicker="Serial-controlled production genealogy">
        {travellers.length === 0 ? <p className="text-sm leading-6 text-muted">No traveller records exist yet. Use Raise Traveller / Serial above after a Production Job Card is released.</p> : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {travellers.map((traveller: any) => (
              <article key={traveller.id} className="rounded-xl border border-border bg-bg-elevated/30 p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.14em] text-subtle">{traveller.id}</p><p className="mt-1 text-lg font-semibold text-fg">{traveller.serial_number}</p></div><span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${statusTone(String(traveller.status))}`}>{String(traveller.status).replaceAll("_", " ")}</span></div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs"><Metric label="Job card" value={traveller.job_card_id ?? "Pilot / legacy"} /><Metric label="Commercial order" value={traveller.sales_order_id ?? "—"} /><Metric label="Family" value={traveller.model_name ?? "—"} /><Metric label="BOM" value={traveller.bom_revision ?? "—"} /><Metric label="Engineering" value={traveller.engineering_revision ?? "—"} /><Metric label="Supplier / OEM" value={traveller.supplier || "—"} /></div>
                <p className="mt-3 text-[11px] text-subtle">{traveller.job_card_id ? `Linked to job-card revision ${traveller.job_card_revision}. ` : "Unlinked specialist/pilot genealogy. "}{["released", "in_build"].includes(traveller.status) ? "Eligible for matching reserved material issue." : "Visible for genealogy; not eligible for material issue in current status."}</p>
              </article>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="36-month Production Plan" kicker="Planning truth · separate from physical stock">
        <div className="grid gap-4 lg:grid-cols-[1fr_220px] lg:items-end"><div><p className="text-sm font-semibold text-fg">Portfolio production multiplier</p><p className="mt-1 max-w-2xl text-xs leading-5 text-muted">Adjusting the plan changes forecast units, revenue, COGS, inventory-buy requirement and cash. It does not create job cards, travellers or physical inventory.</p></div><label className="block"><span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-subtle">Multiplier</span><input type="number" min="0" max="5" step="0.05" value={finance.unitMultiplier} onChange={(event) => updateGlobalFinance("unitMultiplier", Math.max(0, Math.min(5, Number(event.target.value) || 0)))} className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-right tabular-nums text-fg outline-none focus:border-accent" /></label></div>
        <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="border-b border-border text-[10px] uppercase tracking-[0.14em] text-subtle"><tr><th className="px-3 py-3 text-left">Month</th><th className="px-3 py-3 text-right">Units</th><th className="px-3 py-3 text-right">Revenue</th><th className="px-3 py-3 text-right">COGS</th><th className="px-3 py-3 text-right">Inventory buy</th><th className="px-3 py-3 text-right">Closing cash</th></tr></thead><tbody>{productionRows.map((row) => <tr key={row.m} className="border-t border-border/70"><td className="px-3 py-3 font-semibold">M{row.m}</td><td className="px-3 py-3 text-right">{row.units}</td><td className="px-3 py-3 text-right">{lakh(row.revenue)}</td><td className="px-3 py-3 text-right">{lakh(row.cogs)}</td><td className="px-3 py-3 text-right text-accent">{lakh(row.inventoryBuy)}</td><td className="px-3 py-3 text-right">{lakh(accountingRows[row.m - 1]?.closingCash ?? 0)}</td></tr>)}</tbody></table></div>
      </Panel>

      <Panel title="Manufacturing readiness" kicker="Release controls">
        <div className="grid gap-3 sm:grid-cols-3"><Metric label="Evidence pending" value={String(pendingControls)} /><Metric label="Verification" value={String(verifyControls)} /><Metric label="Release gates" value={String(MANUFACTURING_GATES.length)} /></div>
      </Panel>
    </div>
  );
}

function LineageStep({ label, text }: { label: string; text: string }) {
  return <div className="rounded-xl border border-border bg-bg-elevated/25 p-4"><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-green">{label}</p><p className="mt-2 text-xs leading-5 text-muted">{text}</p></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><span className="text-[10px] uppercase tracking-wider text-subtle">{label}</span><p className="mt-1 break-all font-semibold text-fg">{value}</p></div>;
}
