import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Kpi, Panel } from "@/components/kpi";
import { InventoryWorkspaceNav } from "@/components/inventory-workspace-nav";
import { getProductionJobCardView } from "@/lib/production-job-card-view";
import { issueProductionReservation } from "@/lib/production-job-card";

export const Route = createFileRoute("/command/production-jobcards")({
  loader: () => getProductionJobCardView(),
  component: ProductionJobCards,
});

function familyForCard(card: any) {
  const value = String(card.variant_id ?? card.model_tier ?? "");
  if (value === "core" || value.startsWith("core-")) return "Longitude";
  if (value === "pro" || value.startsWith("pro-")) return "Latitude";
  if (value === "apex" || value.startsWith("apex-")) return "Altitude";
  return "";
}

function ProductionJobCards() {
  const { cards, lines, travellers } = Route.useLoaderData();
  const router = useRouter();
  const [selectedTraveller, setSelectedTraveller] = useState<Record<string, string>>({});
  const [busyLine, setBusyLine] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const released = cards.filter((x: any) => ["released", "in_progress"].includes(x.status)).length;
  const units = cards.reduce((sum: number, x: any) => sum + Number(x.units), 0);
  const reserved = lines.reduce((sum: number, x: any) => sum + Number(x.reserved_quantity ?? 0), 0);
  const shortages = lines.filter((x: any) => Number(x.shortage_quantity ?? 0) > 0).length;
  const stageCount = useMemo(() => new Set(lines.map((x: any) => x.stage_code)).size, [lines]);

  async function issue(line: any) {
    const travellerId = selectedTraveller[line.id];
    if (!line.reservation_id || !travellerId) return;
    setBusyLine(line.id);
    setMessage("");
    try {
      const result = await issueProductionReservation({
        data: { reservationId: line.reservation_id, travellerId },
      });
      setMessage(
        `${line.sku} issued from reservation ${line.reservation_id}. FIFO COGS ₹${result.cogsInr.toFixed(2)} · resulting physical balance ${result.resultingBalance}.`,
      );
      setSelectedTraveller((current) => ({ ...current, [line.id]: "" }));
      await router.invalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reserved material issue failed.");
    } finally {
      setBusyLine(null);
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-green">Operations · controlled order handoff</p>
          <h1 className="mt-2 text-4xl font-bold text-accent">Production job cards</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-muted">
            Each released card is a projection of one Commercial order revision and one exact approved BOM revision. Reservations reduce ATP without moving stock. Kitting converts a fully reserved line into a physical FIFO issue only against a compatible released traveller/serial record.
          </p>
        </div>
        <Link to="/command/production" className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-muted hover:border-accent">
          Back to Production →
        </Link>
      </header>

      <InventoryWorkspaceNav />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Job cards" value={String(cards.length)} hint="Revisioned projections" />
        <Kpi label="Released / active" value={String(released)} hint="Production queue" />
        <Kpi label="Units" value={String(units)} hint="Committed production" />
        <Kpi label="Reserved components" value={reserved.toFixed(0)} hint="ATP commitments" />
        <Kpi label="Shortage lines" value={String(shortages)} hint={`${stageCount} controlled stages`} tone={shortages ? "danger" : "ok"} />
      </div>

      {message ? <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">{message}</div> : null}

      {cards.length === 0 ? (
        <Panel title="Production queue is empty">
          <p className="text-sm text-muted">No released production projection exists. Confirm an order in Commercial after its exact variant BOM mappings are approved.</p>
        </Panel>
      ) : (
        cards.map((card: any) => {
          const cardLines = lines.filter((x: any) => x.job_card_id === card.id);
          const stages = [...new Map(cardLines.map((x: any) => [x.stage_no, x])).values()];
          const family = familyForCard(card);
          const compatibleTravellers = travellers.filter(
            (traveller: any) => traveller.model_name === family && traveller.bom_revision === card.bom_revision,
          );

          return (
            <Panel
              key={card.id}
              title={`${card.product_label} · ${card.units} unit${Number(card.units) === 1 ? "" : "s"}`}
              kicker={`${card.id} · SO ${card.sales_order_id} R${card.sales_order_revision} · ${String(card.status).replaceAll("_", " ")}`}
            >
              <div className="grid gap-3 text-sm md:grid-cols-5">
                <Metric label="Variant" value={card.variant_id ?? card.model_tier ?? "—"} />
                <Metric label="Released BOM" value={card.bom_revision ?? "Not released"} />
                <Metric label="Required month" value={`M${card.due_month}`} />
                <Metric label="Owner" value={card.production_owner} />
                <Metric label="Mapping set" value={`${Array.isArray(card.released_mapping_set) ? card.released_mapping_set.length : 0} lines`} />
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-5">
                {stages.map((stage: any) => (
                  <div key={stage.stage_no} className="rounded-xl border border-border bg-bg-elevated/30 p-4">
                    <span className="text-[10px] font-bold tracking-[0.16em] text-accent">{String(stage.stage_no).padStart(2, "0")}</span>
                    <p className="mt-2 text-sm font-semibold text-fg">{stage.stage_name}</p>
                    <p className="mt-1 text-xs text-muted">{cardLines.filter((x: any) => x.stage_no === stage.stage_no).length} requirement lines</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[1500px] text-sm">
                  <thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle">
                    <tr>
                      <th className="px-3 py-3 text-left">Stage</th>
                      <th className="px-3 py-3 text-left">SKU</th>
                      <th className="px-3 py-3 text-left">Requirement</th>
                      <th className="px-3 py-3 text-right">Required</th>
                      <th className="px-3 py-3 text-right">Physical</th>
                      <th className="px-3 py-3 text-right">Reserved</th>
                      <th className="px-3 py-3 text-right">ATP</th>
                      <th className="px-3 py-3 text-right">Shortage</th>
                      <th className="px-3 py-3 text-left">Issue control</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cardLines.map((line: any) => {
                      const required = Number(line.quantity ?? 0);
                      const reservedQuantity = Number(line.reserved_quantity ?? 0);
                      const shortage = Number(line.shortage_quantity ?? 0);
                      const fullyReserved = Boolean(line.reservation_id) && reservedQuantity + 0.0001 >= required && shortage <= 0;
                      const alreadyIssued = line.issue_status === "issued";
                      return (
                        <tr key={line.id} className="border-t border-border/70">
                          <td className="px-3 py-3">{line.stage_code} · {line.stage_name}</td>
                          <td className="px-3 py-3 font-mono text-xs">{line.sku ?? "—"}</td>
                          <td className="px-3 py-3 font-medium">{line.item}</td>
                          <td className="px-3 py-3 text-right">{required} {line.unit}</td>
                          <td className="px-3 py-3 text-right">{Number(line.available_quantity ?? 0)}</td>
                          <td className="px-3 py-3 text-right text-accent">{reservedQuantity}</td>
                          <td className="px-3 py-3 text-right">{Number(line.available_to_promise ?? 0)}</td>
                          <td className={`px-3 py-3 text-right font-semibold ${shortage > 0 ? "text-warn" : "text-green"}`}>{shortage || "—"}</td>
                          <td className="px-3 py-3">
                            {!line.sku ? (
                              <span className="text-xs uppercase text-subtle">{line.issue_status}</span>
                            ) : alreadyIssued ? (
                              <span className="text-xs font-semibold text-green">Issued · FIFO posted</span>
                            ) : !line.reservation_id ? (
                              <span className="text-xs text-warn">No active reservation</span>
                            ) : !fullyReserved ? (
                              <span className="text-xs text-warn">Await full reservation before kitting</span>
                            ) : compatibleTravellers.length === 0 ? (
                              <div className="space-y-1 text-xs">
                                <p className="text-warn">No released {family || "matching"} traveller on BOM {card.bom_revision ?? "—"}.</p>
                                <Link to="/command/epr-live" className="font-semibold text-accent">Create / release traveller →</Link>
                              </div>
                            ) : (
                              <div className="flex min-w-[360px] items-center gap-2">
                                <select
                                  value={selectedTraveller[line.id] ?? ""}
                                  onChange={(event) => setSelectedTraveller((current) => ({ ...current, [line.id]: event.target.value }))}
                                  className="min-w-52 rounded-md border border-border bg-bg px-2 py-2 text-xs text-fg"
                                >
                                  <option value="">Select traveller / serial</option>
                                  {compatibleTravellers.map((traveller: any) => (
                                    <option key={traveller.id} value={traveller.id}>{traveller.serial_number} · {traveller.status}</option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  disabled={busyLine === line.id || !selectedTraveller[line.id]}
                                  onClick={() => void issue(line)}
                                  className="rounded-md bg-accent px-3 py-2 text-xs font-semibold text-bg disabled:opacity-40"
                                >
                                  {busyLine === line.id ? "Issuing…" : "Issue reserved FIFO"}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          );
        })
      )}

      <Panel title="Connected controls" kicker="Trace the handoff">
        <div className="flex flex-wrap gap-2">
          <Link to="/command/sales" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">Commercial order →</Link>
          <Link to="/command/bom-inventory-mapping" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">Released BOM →</Link>
          <Link to="/command/inventory" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">Master Inventory →</Link>
          <Link to="/command/procurement-planning" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">Procurement →</Link>
          <Link to="/command/epr-live" className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">Traveller control →</Link>
        </div>
      </Panel>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><span className="text-[10px] uppercase tracking-wider text-subtle">{label}</span><p className="mt-1 break-all font-semibold">{value}</p></div>;
}
