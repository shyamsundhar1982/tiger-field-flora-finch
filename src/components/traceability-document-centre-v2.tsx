import { ExternalLink, FileSearch, Loader2, Printer, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { printControlledDocument } from "@/lib/controlled-document";
import {
  getTraceabilityPrintRecord,
  interpretTraceabilityQuery,
  searchTraceability,
  type TraceabilityDocumentRef,
  type TraceabilityDocumentType,
  type TraceabilitySearchHit,
  type TraceabilitySearchResponse,
} from "@/lib/traceability-search";

type TraceabilitySearchEvent = CustomEvent<{ query?: string } | undefined>;

const DIRECT_SEARCH_SENTINEL = "vyndi-direct-9f4c2a7b";

const TYPE_LABELS: Record<TraceabilityDocumentType, string> = {
  commercial_order: "Order",
  job_card: "Job Card",
  material_requisition: "MR",
  traveller: "Traveller",
  purchase_order: "PO",
  grn: "GRN",
  quality_release: "Quality",
  dispatch: "Dispatch",
  invoice: "Invoice",
  collection: "Collection",
};

function directSearchInput(query: string) {
  const trimmed = query.trim();
  const interpretation = interpretTraceabilityQuery(trimmed);
  return interpretation.recognized ? trimmed : `${DIRECT_SEARCH_SENTINEL} ${trimmed}`;
}

function short(value: string, length = 22) {
  if (!value) return "—";
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function printLineage(hit: TraceabilitySearchHit) {
  const stages = [
    ["1", "Commercial Order", hit.salesOrderId, hit.orderStatus || "recorded"],
    ["2", "Production Job Card", hit.jobCardId || "—", hit.jobCardId ? hit.jobCardStatus || "recorded" : "PENDING"],
    ["3", "Material Requisition", hit.materialRequisitionId || "—", hit.materialRequisitionId ? "RECORDED" : "PENDING"],
    ["4", "Traveller / Serial", hit.travellerIds.join(", ") || "—", hit.travellerIds.length ? "RECORDED" : "PENDING"],
    ["5", "Purchase Order", hit.purchaseOrderIds.join(", ") || "—", hit.purchaseOrderIds.length ? "RECORDED" : "PENDING"],
    ["6", "Receiving / GRN", hit.goodsReceiptIds.join(", ") || "—", hit.goodsReceiptIds.length ? "RECORDED" : "PENDING"],
    ["7", "Quality Release", hit.qualityReleaseIds.join(", ") || "—", hit.qualityReleaseIds.length ? "RECORDED" : "PENDING"],
    ["8", "Dispatch", hit.shipmentIds.join(", ") || "—", hit.shipmentIds.length ? "RECORDED" : "PENDING"],
    ["9", "Invoice", hit.invoiceIds.join(", ") || "—", hit.invoiceIds.length ? "RECORDED" : "PENDING"],
    ["10", "Collection", hit.collectionIds.join(", ") || "—", hit.collectionIds.length ? "RECORDED" : "PENDING"],
  ];

  printControlledDocument({
    title: `${hit.salesOrderId || hit.jobCardId} · End-to-End Digital Thread`,
    recordType: "End-to-End Demand-to-Cash Digital Thread",
    status: hit.collectionIds.length ? "closed loop" : "in progress",
    authority: "VYNDI canonical operating authorities · read-only lineage extract",
    sourceReference: `Traceability search · ${hit.salesOrderId || hit.jobCardId}`,
    orientation: "landscape",
    fields: [
      { label: "Commercial order", value: hit.salesOrderId || "Restricted" },
      { label: "Revision", value: hit.salesOrderRevision || "—" },
      { label: "Variant", value: hit.variantName || hit.variantId || "—" },
      { label: "Units", value: hit.units || "—" },
      { label: "Job Card", value: hit.jobCardId || "Pending" },
      { label: "Batch", value: hit.batchCode || "Pending" },
      { label: "BOM", value: hit.bomRevision || "—" },
      { label: "Matched by", value: hit.matchedFields.join(", ") || "lineage" },
    ],
    sections: [
      { title: "Canonical stage-by-stage traceability", table: { columns: ["#", "Stage", "Persisted record(s)", "State"], rows: stages } },
      { title: "Interpretation", text: "A stage is shown as PENDING when no persisted canonical record exists. The electronic VYNDI system record remains authoritative." },
    ],
  });
}

function DocumentPill({ doc, onPrint }: { doc: TraceabilityDocumentRef; onPrint: (doc: TraceabilityDocumentRef) => void }) {
  return (
    <div className="flex min-w-0 items-center gap-1 rounded-md border border-border/80 bg-bg/60 px-1.5 py-1" title={`${TYPE_LABELS[doc.type]} · ${doc.id} · ${doc.status || "status not recorded"}`}>
      <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-fg">{short(doc.label)}</span>
      <button type="button" className="shrink-0 rounded p-1 text-muted hover:bg-surface hover:text-accent" onClick={() => onPrint(doc)} aria-label={`Print ${doc.label}`}><Printer className="size-3" /></button>
      <button type="button" className="shrink-0 rounded p-1 text-muted hover:bg-surface hover:text-accent" onClick={() => window.location.assign(doc.route)} aria-label={`Open ${doc.label}`}><ExternalLink className="size-3" /></button>
    </div>
  );
}

function StageCell({ hit, types, onPrint }: { hit: TraceabilitySearchHit; types: TraceabilityDocumentType[]; onPrint: (doc: TraceabilityDocumentRef) => void }) {
  const docs = hit.documents.filter((doc) => types.includes(doc.type));
  if (!docs.length) return <span className="text-[10px] font-semibold uppercase tracking-wide text-subtle">Pending</span>;
  return <div className="grid gap-1">{docs.slice(0, 2).map((doc) => <DocumentPill key={`${doc.type}-${doc.id}`} doc={doc} onPrint={onPrint} />)}{docs.length > 2 ? <span className="text-[10px] text-muted">+{docs.length - 2} more</span> : null}</div>;
}

export function TraceabilityDocumentCentreV2() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | TraceabilityDocumentType>("all");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [response, setResponse] = useState<TraceabilitySearchResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(0);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as TraceabilitySearchEvent).detail;
      if (detail?.query) setQuery(detail.query);
      setOpen(true);
    };
    window.addEventListener("vyndi:traceability-search", handler);
    return () => window.removeEventListener("vyndi:traceability-search", handler);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!open || trimmed.length < 2) {
      if (!trimmed) setResponse(null);
      return;
    }

    const id = ++requestRef.current;
    const timer = window.setTimeout(async () => {
      setBusy(true);
      setError("");
      try {
        const serverQuery = directSearchInput(trimmed);
        const result = await searchTraceability({ data: { query: serverQuery, limit: 60 } });
        if (id === requestRef.current) {
          setResponse({ ...result, query: trimmed, interpretation: interpretTraceabilityQuery(trimmed) });
        }
      } catch (cause) {
        if (id === requestRef.current) setError(cause instanceof Error ? cause.message : "Traceability search failed.");
      } finally {
        if (id === requestRef.current) setBusy(false);
      }
    }, 220);

    return () => window.clearTimeout(timer);
  }, [open, query]);

  const hits = useMemo(() => {
    const source = response?.hits ?? [];
    return source.filter((hit) => {
      if (typeFilter !== "all" && !hit.documents.some((doc) => doc.type === typeFilter)) return false;
      if (pendingOnly && hit.qualityReleaseIds.length && hit.shipmentIds.length && hit.invoiceIds.length) return false;
      return true;
    });
  }, [pendingOnly, response, typeFilter]);

  async function printDocument(doc: TraceabilityDocumentRef) {
    setError("");
    try {
      const record = await getTraceabilityPrintRecord({ data: { type: doc.type, id: doc.id } });
      printControlledDocument(record);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Controlled document could not be prepared.");
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="fixed bottom-20 right-5 z-40 inline-flex min-h-11 items-center gap-2 rounded-full border border-accent/35 bg-bg/95 px-4 py-2.5 text-xs font-semibold text-fg shadow-xl backdrop-blur-xl transition hover:border-accent hover:bg-surface print:hidden" aria-label="Open Traceability and Print">
        <FileSearch className="size-4 text-accent" /><span className="hidden sm:inline">Traceability & Print</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] bg-bg/70 p-2 backdrop-blur-md sm:p-4 print:hidden" role="dialog" aria-modal="true" aria-label="Traceability and Print Centre">
          <section className="mx-auto flex h-[calc(100dvh-1rem)] w-full max-w-[1680px] flex-col overflow-hidden rounded-2xl border border-border bg-bg shadow-2xl sm:h-[calc(100dvh-2rem)]">
            <header className="shrink-0 border-b border-border bg-surface/45 px-4 py-3 sm:px-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-green">VYNDI controlled records</p>
                  <h2 className="mt-1 font-display text-xl font-semibold text-fg sm:text-2xl">Traceability & Print Centre</h2>
                  <p className="mt-1 text-xs text-muted">Landscape genealogy view · direct partial-ID, SKU, supplier, model and vernacular search.</p>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted hover:border-accent/50 hover:text-fg" aria-label="Close"><X className="size-4" /></button>
              </div>

              <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_190px_170px]">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
                  <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} className="control w-full pl-10" placeholder="Search order, Job Card, traveller/serial, batch, MR, PO, GRN, invoice, SKU, supplier, model…" />
                </label>
                <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)} className="control w-full">
                  <option value="all">All record types</option>
                  {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <label className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 text-xs text-muted"><input type="checkbox" checked={pendingOnly} onChange={(event) => setPendingOnly(event.target.checked)} /> Show incomplete only</label>
              </div>

              <div className="mt-2 flex min-h-5 items-center gap-3 text-[10px] text-subtle">
                {busy ? <span className="inline-flex items-center gap-1.5"><Loader2 className="size-3 animate-spin" /> Searching governed records…</span> : response ? <span>{hits.length} displayed · {response.total} matched server-side{response.limited ? " · result limit applied" : ""}</span> : <span>Try “C3 cycles”, “Longitude”, “HB-AL-420”, “061E6697”, “782055”, or “C3 cycles oda pending PO”.</span>}
                {error ? <span className="text-danger">{error}</span> : null}
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
              {!query.trim() ? <div className="mx-auto mt-20 max-w-2xl rounded-xl border border-border bg-surface/30 p-6 text-center"><FileSearch className="mx-auto size-8 text-accent" /><p className="mt-3 font-medium text-fg">Search by any traceable fragment.</p><p className="mt-2 text-sm leading-6 text-muted">Partial IDs, supplier names, model names, SKUs and vernacular business phrases resolve to the governed digital thread.</p></div> : null}
              {query.trim() && !busy && response && !hits.length ? <div className="mx-auto mt-16 max-w-xl rounded-xl border border-border p-5 text-center text-sm text-muted">No governed lineage matched this search and filter combination.</div> : null}

              {hits.length ? (
                <div className="space-y-2">
                  <div className="sticky top-0 z-10 hidden grid-cols-[1.15fr_1.05fr_1.2fr_.85fr_1fr_1fr_.9fr_.9fr_.9fr_.8fr] gap-2 rounded-lg border border-border bg-surface/95 px-2 py-2 text-[9px] font-bold uppercase tracking-[0.12em] text-subtle backdrop-blur lg:grid">
                    <span>Order</span><span>Job Card</span><span>Traveller / Serial</span><span>MR</span><span>PO</span><span>GRN</span><span>Quality</span><span>Dispatch</span><span>Invoice</span><span>Actions</span>
                  </div>
                  {hits.map((hit) => (
                    <article key={`${hit.salesOrderId || hit.jobCardId}-${hit.salesOrderRevision}`} className="rounded-xl border border-border bg-surface/20 p-3">
                      <div className="hidden grid-cols-[1.15fr_1.05fr_1.2fr_.85fr_1fr_1fr_.9fr_.9fr_.9fr_.8fr] items-start gap-2 lg:grid">
                        <div className="min-w-0"><p className="truncate text-xs font-semibold text-fg" title={hit.salesOrderId}>{short(hit.salesOrderId, 24)}{hit.salesOrderRevision ? ` R${hit.salesOrderRevision}` : ""}</p><p className="mt-1 truncate text-[10px] text-muted" title={hit.variantName}>{hit.variantName || hit.variantId || "—"}</p><p className="mt-1 text-[9px] uppercase text-subtle">Matched: {hit.matchedFields.join(", ") || "lineage"}</p></div>
                        <StageCell hit={hit} types={["job_card"]} onPrint={printDocument} />
                        <StageCell hit={hit} types={["traveller"]} onPrint={printDocument} />
                        <StageCell hit={hit} types={["material_requisition"]} onPrint={printDocument} />
                        <StageCell hit={hit} types={["purchase_order"]} onPrint={printDocument} />
                        <StageCell hit={hit} types={["grn"]} onPrint={printDocument} />
                        <StageCell hit={hit} types={["quality_release"]} onPrint={printDocument} />
                        <StageCell hit={hit} types={["dispatch"]} onPrint={printDocument} />
                        <StageCell hit={hit} types={["invoice", "collection"]} onPrint={printDocument} />
                        <button type="button" onClick={() => printLineage(hit)} className="rounded-md border border-accent/40 px-2 py-1.5 text-[10px] font-semibold text-accent hover:bg-accent/10">E2E Print</button>
                      </div>

                      <div className="grid gap-2 lg:hidden">
                        <div><p className="text-sm font-semibold text-fg">{hit.salesOrderId || hit.jobCardId}</p><p className="text-xs text-muted">{hit.variantName || hit.variantId}</p></div>
                        <div className="grid gap-1 sm:grid-cols-2">{hit.documents.map((doc) => <DocumentPill key={`${doc.type}-${doc.id}`} doc={doc} onPrint={printDocument} />)}</div>
                        <button type="button" onClick={() => printLineage(hit)} className="rounded-md border border-accent/40 px-3 py-2 text-xs font-semibold text-accent hover:bg-accent/10">Print End-to-End Thread</button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
