import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  ClipboardPlus,
  Factory,
  FilePlus2,
  PackageCheck,
  Ruler,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kpi, Panel } from "@/components/kpi";
import { InventoryWorkspaceNav } from "@/components/inventory-workspace-nav";
import { createEprTraveller, getEprSnapshot, recordEprEvidence, updateEprGate } from "@/lib/epr/execution";
import {
  getEprExecutionChain,
  recordEprInspection,
  recordInventoryMovement,
  recordMaterialLot,
  recordNcrCapa,
  recordProcessOperation,
} from "@/lib/epr/traceability";

export const Route = createFileRoute("/command/epr-live")({ component: LiveEpr });
type Snapshot = Awaited<ReturnType<typeof getEprSnapshot>>;
type Chain = Awaited<ReturnType<typeof getEprExecutionChain>>;
const models = { core: "Longitude", pro: "Latitude", apex: "Altitude" } as const;
const control = "rounded-md border border-border bg-bg px-3 py-2 text-sm";

function LiveEpr() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [chain, setChain] = useState<Chain | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    venture: "carbon",
    modelId: "core",
    modelName: "Longitude",
    sku: "VINDY-LONGITUDE-PILOT",
    bomRevision: "BOM-001",
    engineeringRevision: "VEDM-301-5.3.8",
    serialNumber: "",
    supplier: "",
  });
  const [evidence, setEvidence] = useState({ travellerId: "", gateId: "EPR-05", evidenceType: "process-record", title: "", reference: "", notes: "" });
  const [lot, setLot] = useState({ travellerId: "", materialCode: "T700", materialDescription: "Carbon fibre / prepreg", lotNumber: "", supplier: "", certificateReference: "", quantity: 1, unit: "lot", disposition: "quarantine" });
  const [operation, setOperation] = useState({ travellerId: "", operationCode: "OP-001", operationName: "Frame layup", workstation: "", operatorName: "", status: "planned", recordReference: "", notes: "" });
  const [inspection, setInspection] = useState({ travellerId: "", inspectionType: "dimensional", characteristic: "", nominalValue: "", measuredValue: "", acceptanceCriteria: "", result: "pending", evidenceReference: "", notes: "" });
  const [ncr, setNcr] = useState({ travellerId: "", recordType: "ncr", severity: "minor", title: "", description: "", containment: "", rootCause: "", correctiveAction: "", owner: "", status: "open", closureReference: "" });
  const [movement, setMovement] = useState({ travellerId: "", sku: "", movementType: "issue", quantity: 1, unit: "unit", reference: "", notes: "" });

  async function refresh() {
    try {
      const [snapshot, execution] = await Promise.all([getEprSnapshot(), getEprExecutionChain()]);
      setData(snapshot);
      setChain(execution);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Command access required.");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const travellers = data?.travellers ?? [];
  const travellerVenture = (travellerId: string) =>
    (travellers.find((traveller: any) => traveller.id === travellerId)?.venture ?? "carbon") as "carbon" | "aluminium";

  async function transact(fn: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
      setMessage(success);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Transaction failed.");
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    await transact(async () => {
      if (!form.serialNumber.trim()) throw new Error("Serial number is required.");
      const result = await createEprTraveller({
        data: {
          ...form,
          venture: form.venture as "carbon" | "aluminium",
          modelId: form.modelId as "core" | "pro" | "apex",
          modelName: form.modelName as "Longitude" | "Latitude" | "Altitude",
        },
      });
      const travellerId = result.travellerId;
      setEvidence((value) => ({ ...value, travellerId }));
      setLot((value) => ({ ...value, travellerId }));
      setOperation((value) => ({ ...value, travellerId }));
      setInspection((value) => ({ ...value, travellerId }));
      setNcr((value) => ({ ...value, travellerId }));
      setMovement((value) => ({ ...value, travellerId }));
      setForm((value) => ({ ...value, serialNumber: "" }));
    }, "Traveller created and execution workspace linked.");
  }

  async function gate(travellerId: string, status: "in_progress" | "passed" | "blocked" | "hold" | "rework") {
    await transact(
      () => updateEprGate({ data: { travellerId, venture: travellerVenture(travellerId), gateId: evidence.gateId as any, status, reason: status === "passed" ? "Evidence reviewed by operator." : "Operator disposition." } }),
      `${evidence.gateId} recorded as ${status}.`,
    );
  }

  async function addEvidence() {
    await transact(async () => {
      if (!evidence.travellerId || !evidence.title) throw new Error("Traveller and evidence title are required.");
      await recordEprEvidence({ data: { ...evidence, venture: travellerVenture(evidence.travellerId), gateId: evidence.gateId as any } });
    }, "Evidence committed to the EPR ledger.");
    setEvidence((value) => ({ ...value, title: "", reference: "", notes: "" }));
  }

  const travellerSelect = (current: string, setter: (value: any) => void) => (
    <select value={current} onChange={(event) => setter((value: any) => ({ ...value, travellerId: event.target.value }))} className={control}>
      <option value="">Select traveller</option>
      {travellers.map((traveller: any) => <option key={traveller.id} value={traveller.id}>{traveller.serial_number} · {traveller.model_name}</option>)}
    </select>
  );

  async function execute(kind: "lot" | "operation" | "inspection" | "ncr" | "movement") {
    if (kind === "lot") {
      return transact(async () => {
        if (!lot.lotNumber.trim()) throw new Error("Lot number is required.");
        await recordMaterialLot({ ...lot, venture: travellerVenture(lot.travellerId), quantity: Number(lot.quantity), disposition: lot.disposition as any } as any);
      }, "Material lot recorded.");
    }
    if (kind === "operation") {
      return transact(() => recordProcessOperation({ ...operation, venture: travellerVenture(operation.travellerId), status: operation.status as any } as any), "Process operation recorded.");
    }
    if (kind === "inspection") {
      return transact(() => recordEprInspection({ ...inspection, venture: travellerVenture(inspection.travellerId), inspectionType: inspection.inspectionType as any, result: inspection.result as any } as any), "Inspection record committed.");
    }
    if (kind === "ncr") {
      return transact(() => recordNcrCapa({ ...ncr, venture: travellerVenture(ncr.travellerId), recordType: ncr.recordType as any, severity: ncr.severity as any, status: ncr.status as any } as any), "NCR/CAPA record committed.");
    }
    return transact(
      () => recordInventoryMovement({ ...movement, venture: travellerVenture(movement.travellerId), movementType: movement.movementType as any, quantity: Number(movement.quantity) } as any),
      "Direct EPR inventory movement committed.",
    );
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-border bg-bg-elevated/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Vāyú Shastr · VINDY · Production control</p>
            <h1 className="mt-1 font-display text-4xl text-accent">Live EPR Transaction Core</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">Traveller → material → process → inspection → NCR/CAPA → inventory → evidence → gate → audit.</p>
          </div>
          <ShieldCheck className="size-12 text-accent" />
        </div>
      </header>

      <InventoryWorkspaceNav />

      <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 text-xs leading-5 text-muted">
        <strong className="text-fg">Inventory authority:</strong> physical stock, valuation, MSL and FIFO are canonical in <Link to="/command/inventory" className="font-semibold text-accent">Master Inventory</Link>. Job-card reservations are commitments, not movements, and reserved material must be consumed from <Link to="/command/production" className="font-semibold text-accent">Production</Link> against the released traveller/serial. This EPR form is only for permitted direct unreserved issue/consume or return transactions.
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Travellers" value={String(travellers.length)} hint="durable records" />
        <Kpi label="Lots" value={String(chain?.lots.length ?? 0)} hint="material traceability" />
        <Kpi label="Operations" value={String(chain?.operations.length ?? 0)} hint="process records" />
        <Kpi label="Inspections" value={String(chain?.inspections.length ?? 0)} hint="quality records" />
        <Kpi label="NCR/CAPA" value={String(chain?.ncrCapa.length ?? 0)} hint="quality containment" />
      </div>

      <Panel title="Create controlled pilot traveller" kicker="EPR-04 · serial genealogy root">
        <div className="grid gap-3 md:grid-cols-4">
          <select value={form.venture} onChange={(event) => setForm({ ...form, venture: event.target.value })} className={control}><option value="carbon">VINDY · Carbon</option><option value="aluminium">Aluminium Bicycle</option></select>
          <select value={form.modelId} onChange={(event) => { const modelId = event.target.value as keyof typeof models; setForm({ ...form, modelId, modelName: models[modelId] }); }} className={control}><option value="core">Longitude</option><option value="pro">Latitude</option><option value="apex">Altitude</option></select>
          <input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} placeholder="SKU" className={control} />
          <input value={form.serialNumber} onChange={(event) => setForm({ ...form, serialNumber: event.target.value })} placeholder="Serial number *" className={control} />
          <input value={form.bomRevision} onChange={(event) => setForm({ ...form, bomRevision: event.target.value })} placeholder="BOM revision" className={control} />
          <input value={form.engineeringRevision} onChange={(event) => setForm({ ...form, engineeringRevision: event.target.value })} placeholder="Engineering revision" className={control} />
          <input value={form.supplier} onChange={(event) => setForm({ ...form, supplier: event.target.value })} placeholder="Supplier / OEM" className={control} />
          <Button disabled={busy} onClick={create}><ClipboardPlus /> Create traveller</Button>
        </div>
      </Panel>

      <Panel title="Material & lot traceability" kicker="EPR-05 · material / certificate control">
        <div className="grid gap-3 md:grid-cols-4">
          {travellerSelect(lot.travellerId, setLot)}
          <input value={lot.materialCode} onChange={(event) => setLot({ ...lot, materialCode: event.target.value })} placeholder="Material code" className={control} />
          <input value={lot.materialDescription} onChange={(event) => setLot({ ...lot, materialDescription: event.target.value })} placeholder="Material description" className={control} />
          <input value={lot.lotNumber} onChange={(event) => setLot({ ...lot, lotNumber: event.target.value })} placeholder="Lot number *" className={control} />
          <input value={lot.supplier} onChange={(event) => setLot({ ...lot, supplier: event.target.value })} placeholder="Supplier" className={control} />
          <input value={lot.certificateReference} onChange={(event) => setLot({ ...lot, certificateReference: event.target.value })} placeholder="Certificate reference" className={control} />
          <input type="number" value={lot.quantity} onChange={(event) => setLot({ ...lot, quantity: Number(event.target.value) })} placeholder="Quantity" className={control} />
          <select value={lot.disposition} onChange={(event) => setLot({ ...lot, disposition: event.target.value })} className={control}><option>quarantine</option><option>accepted</option><option>rejected</option><option>consumed</option></select>
        </div>
        <Button className="mt-3" disabled={busy} onClick={() => void execute("lot")}><PackageCheck /> Record lot</Button>
      </Panel>

      <Panel title="Process execution" kicker="EPR-06 · traveller-linked operation record">
        <div className="grid gap-3 md:grid-cols-4">
          {travellerSelect(operation.travellerId, setOperation)}
          <input value={operation.operationCode} onChange={(event) => setOperation({ ...operation, operationCode: event.target.value })} placeholder="Operation code" className={control} />
          <input value={operation.operationName} onChange={(event) => setOperation({ ...operation, operationName: event.target.value })} placeholder="Operation name" className={control} />
          <input value={operation.workstation} onChange={(event) => setOperation({ ...operation, workstation: event.target.value })} placeholder="Workstation" className={control} />
          <input value={operation.operatorName} onChange={(event) => setOperation({ ...operation, operatorName: event.target.value })} placeholder="Operator" className={control} />
          <select value={operation.status} onChange={(event) => setOperation({ ...operation, status: event.target.value })} className={control}><option>planned</option><option>in_progress</option><option>completed</option><option>hold</option><option>rework</option><option>rejected</option></select>
          <input value={operation.recordReference} onChange={(event) => setOperation({ ...operation, recordReference: event.target.value })} placeholder="Record reference" className={control} />
          <Button disabled={busy} onClick={() => void execute("operation")}><Factory /> Record operation</Button>
        </div>
      </Panel>

      <Panel title="Inspection & test record" kicker="EPR-07 → EPR-10 · objective result">
        <div className="grid gap-3 md:grid-cols-4">
          {travellerSelect(inspection.travellerId, setInspection)}
          <select value={inspection.inspectionType} onChange={(event) => setInspection({ ...inspection, inspectionType: event.target.value })} className={control}>{["dimensional", "interface", "ndt", "cosmetic", "structural", "iso4210"].map((value) => <option key={value}>{value}</option>)}</select>
          <input value={inspection.characteristic} onChange={(event) => setInspection({ ...inspection, characteristic: event.target.value })} placeholder="Characteristic *" className={control} />
          <input value={inspection.nominalValue} onChange={(event) => setInspection({ ...inspection, nominalValue: event.target.value })} placeholder="Nominal" className={control} />
          <input value={inspection.measuredValue} onChange={(event) => setInspection({ ...inspection, measuredValue: event.target.value })} placeholder="Measured" className={control} />
          <input value={inspection.acceptanceCriteria} onChange={(event) => setInspection({ ...inspection, acceptanceCriteria: event.target.value })} placeholder="Acceptance criteria" className={control} />
          <select value={inspection.result} onChange={(event) => setInspection({ ...inspection, result: event.target.value })} className={control}><option>pending</option><option>pass</option><option>fail</option><option>conditional</option></select>
          <input value={inspection.evidenceReference} onChange={(event) => setInspection({ ...inspection, evidenceReference: event.target.value })} placeholder="Evidence reference" className={control} />
        </div>
        <Button className="mt-3" disabled={busy} onClick={() => void execute("inspection")}><Ruler /> Commit inspection</Button>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="NCR / CAPA" kicker="EPR-11 · deviation control">
          <div className="space-y-3">
            {travellerSelect(ncr.travellerId, setNcr)}
            <div className="grid grid-cols-2 gap-3">
              <select value={ncr.recordType} onChange={(event) => setNcr({ ...ncr, recordType: event.target.value })} className={control}><option>ncr</option><option>capa</option></select>
              <select value={ncr.severity} onChange={(event) => setNcr({ ...ncr, severity: event.target.value })} className={control}><option>minor</option><option>major</option><option>critical</option></select>
            </div>
            <input value={ncr.title} onChange={(event) => setNcr({ ...ncr, title: event.target.value })} placeholder="Title *" className={`w-full ${control}`} />
            <textarea value={ncr.description} onChange={(event) => setNcr({ ...ncr, description: event.target.value })} placeholder="Description *" className={`min-h-20 w-full ${control}`} />
            <textarea value={ncr.containment} onChange={(event) => setNcr({ ...ncr, containment: event.target.value })} placeholder="Containment" className={`min-h-16 w-full ${control}`} />
            <textarea value={ncr.correctiveAction} onChange={(event) => setNcr({ ...ncr, correctiveAction: event.target.value })} placeholder="Corrective action" className={`min-h-16 w-full ${control}`} />
            <Button disabled={busy} onClick={() => void execute("ncr")}><AlertTriangle /> Commit NCR/CAPA</Button>
          </div>
        </Panel>

        <Panel title="Direct inventory movement" kicker="EPR-05 / EPR-12 · unreserved stock / return only">
          <div className="space-y-3">
            <p className="text-xs leading-5 text-muted">Do not use this form for a Production reservation. Reserved job-card material must be issued from Production Job Cards so the reservation, FIFO allocation, COGS, line status and audit chain are updated atomically.</p>
            {travellerSelect(movement.travellerId, setMovement)}
            <input value={movement.sku} onChange={(event) => setMovement({ ...movement, sku: event.target.value })} placeholder="SKU *" className={`w-full ${control}`} />
            <div className="grid grid-cols-2 gap-3">
              <select value={movement.movementType} onChange={(event) => setMovement({ ...movement, movementType: event.target.value })} className={control}>
                <option value="issue">issue unreserved stock</option>
                <option value="consume">consume unreserved stock</option>
                <option value="return">return to stock</option>
              </select>
              <input type="number" min="0.01" value={movement.quantity} onChange={(event) => setMovement({ ...movement, quantity: Number(event.target.value) })} className={control} />
            </div>
            <input value={movement.reference} onChange={(event) => setMovement({ ...movement, reference: event.target.value })} placeholder="Reference" className={`w-full ${control}`} />
            <Button disabled={busy} onClick={() => void execute("movement")}><Boxes /> Commit direct movement</Button>
          </div>
        </Panel>
      </div>

      <Panel title="Evidence, gate & audit" kicker="EPR-12 · release control">
        <div className="grid gap-3 md:grid-cols-4">
          <select value={evidence.travellerId} onChange={(event) => setEvidence({ ...evidence, travellerId: event.target.value })} className={control}><option value="">Select traveller</option>{travellers.map((traveller: any) => <option key={traveller.id} value={traveller.id}>{traveller.serial_number} · {traveller.model_name}</option>)}</select>
          <select value={evidence.gateId} onChange={(event) => setEvidence({ ...evidence, gateId: event.target.value })} className={control}>{["EPR-05", "EPR-06", "EPR-07", "EPR-08", "EPR-09", "EPR-10", "EPR-11", "EPR-12"].map((gateId) => <option key={gateId}>{gateId}</option>)}</select>
          <input value={evidence.evidenceType} onChange={(event) => setEvidence({ ...evidence, evidenceType: event.target.value })} placeholder="Evidence type" className={control} />
          <input value={evidence.title} onChange={(event) => setEvidence({ ...evidence, title: event.target.value })} placeholder="Evidence title *" className={control} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button disabled={busy} onClick={addEvidence}><FilePlus2 /> Commit evidence</Button>
          <Button disabled={busy || !evidence.travellerId} variant="outline" onClick={() => void gate(evidence.travellerId, "in_progress")}><ArrowRight /> Start selected gate</Button>
          <Button disabled={busy || !evidence.travellerId} onClick={() => void gate(evidence.travellerId, "passed")}><CheckCircle2 /> Pass selected gate</Button>
        </div>
      </Panel>

      {message ? <div className="rounded-xl border border-accent/40 bg-accent/5 p-4 text-sm text-fg">{message}</div> : null}
    </div>
  );
}
