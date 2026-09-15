import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Printer, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/command/user-manual")({ component: UserManual });

type ManualSection = {
  id: string;
  chapter: "A" | "B" | "C" | "D" | "E";
  title: string;
  route?: string;
  purpose: string;
  steps?: readonly string[];
  controls?: readonly string[];
  warnings?: readonly string[];
  notes?: readonly string[];
};

const CHAPTERS = [
  { id: "A", title: "Dossier Control & Orientation" },
  { id: "B", title: "Core Operating Workflows" },
  { id: "C", title: "Role Procedures & VIBPE" },
  { id: "D", title: "Traceability, Exceptions & Governance" },
  { id: "E", title: "Training, Example & Maintenance" },
] as const;

const SECTIONS: readonly ManualSection[] = [
  {
    id: "00",
    chapter: "A",
    title: "Cover & Document Control",
    purpose: "Controlled operating manual for authorised VYNDI OS users. Document VYNDI-UM-001 · Revision 1.0 · baseline 15 September 2026 · VIBPE Co-Pilot 2.0.",
    controls: [
      "Classification: Controlled Internal Operating Document.",
      "Intended users: Management, Commercial, Operations, Engineering, QA, Finance, Compliance and Admin.",
      "Review trigger: material UI, workflow, approval, role or RBAC change.",
    ],
  },
  {
    id: "01",
    chapter: "A",
    title: "Purpose & Operating Philosophy",
    purpose: "VYNDI is one governed chain of business truth, not a collection of unrelated pages.",
    steps: [
      "Plan → Demand → Engineering/BOM → Inventory → Procurement → Receiving → Production → Traveller → Quality → Dispatch → Invoice → Collection.",
      "Source requirement → controlled transaction → evidence → approval where required → downstream consequence → audit trail.",
      "Command Centre, VIBPE, Finance, Governance, Audit and Administration support the transaction chain.",
    ],
  },
  {
    id: "02",
    chapter: "A",
    title: "First 30 Minutes with VYNDI",
    route: "/command",
    purpose: "Minimum orientation sequence for a new authorised user.",
    steps: [
      "Sign in with your individual VYNDI account.",
      "Open Command Centre and review current business condition.",
      "Open Action Inbox and Control Tower for exceptions requiring attention.",
      "Confirm your effective system role and page-level authority.",
      "Follow the governed workflow instead of jumping between unrelated pages.",
      "Use governed identifiers such as SO, JBC, PO, GRN, Traveller, serial and invoice for traceability.",
    ],
    warnings: ["A shared Command-password session may unlock a workspace but does not replace individual transaction identity."],
  },
  {
    id: "03",
    chapter: "A",
    title: "Navigation & Workspace Map",
    purpose: "Canonical VYNDI workspaces and the responsibility of each operating area.",
    controls: [
      "Command: Command Centre, Action Inbox, Control Tower, VIBPE.",
      "Plan & Commercial: Plan, Demand & Orders, Scenarios, GTM, Market Survey.",
      "Product & Engineering: Product, Engineering, BOM Control, BOM Cost.",
      "Supply & Operations: Overview, Inventory, Requirements, Purchase, Receiving, Build, Quality.",
      "People & Office: operating administration.",
      "Finance: Financial Cockpit, Cash, Payables, Receivables, Balance Sheet, Financial Planning.",
      "Governance & Assurance: Approvals, Risk, Legal & IP, EPR, QA Verification, Audit & Actions, CA Audit.",
      "Admin: Users & Roles, Master Data, Classification.",
    ],
  },
  {
    id: "04",
    chapter: "A",
    title: "Roles & Access Control",
    purpose: "VYNDI currently separates system roles from organisational job functions.",
    controls: [
      "admin — view, edit, approve, administer.",
      "management — broad view and edit.",
      "board — view only.",
      "finance — finance-domain view/edit/approve.",
      "operations — operations-domain view/edit/approve.",
      "engineering — engineering-domain view/edit/approve.",
      "qa — QA/manufacturing view/edit/approve.",
      "compliance — compliance/legal/risk view/edit/approve.",
      "viewer — read only.",
    ],
    warnings: ["Sales, Stores, Procurement and Production are operating functions, not separate current VYNDI login roles."],
  },
  {
    id: "05",
    chapter: "B",
    title: "Commercial / Demand & Orders",
    route: "/command/sales",
    purpose: "Create and revise controlled demand and commercial orders before downstream Production synchronization.",
    steps: [
      "Open Plan & Commercial → Demand & Orders.",
      "Enter month, model/variant, units, channel and status.",
      "Review optional component configuration.",
      "Select Add demand / order.",
      "Verify the persisted Commercial revision receipt.",
      "For confirmed demand, verify Production job-card synchronization.",
    ],
    controls: ["Current statuses: lead, confirmed, delivered, cancelled."],
    warnings: ["A lead is pipeline demand, not a production commitment or recognised collection."],
  },
  {
    id: "06",
    chapter: "B",
    title: "Product & BOM Control",
    route: "/command/bom-control",
    purpose: "Establish the controlled product identity and released material definition used by procurement and production.",
    steps: ["Verify model, variant, product configuration, released BOM, BOM revision, SKU mapping and required quantity before execution."],
    warnings: ["Do not substitute a component merely because it appears physically compatible. Use approved Engineering/BOM authority."],
  },
  {
    id: "07",
    chapter: "B",
    title: "Master Inventory / Stores",
    route: "/command/inventory",
    purpose: "Maintain one auditable stock view covering quantity, MSL, demand coverage, health and forecast.",
    steps: [
      "Use Receive against PO for normal supplier deliveries.",
      "Normal flow: PO → Receiving → Inspection → GRN → FIFO Inventory.",
      "Use Item / manual receipt only for master-data setup, openings, authorised non-PO adjustments or evidenced corrections.",
    ],
    warnings: ["Do not use manual inventory entry as a shortcut around PO receiving and incoming inspection."],
  },
  {
    id: "08",
    chapter: "B",
    title: "Procurement Requirements & Purchase Execution",
    route: "/command/purchase-execution",
    purpose: "Convert governed shortages and authorised needs into controlled supplier commitments.",
    steps: [
      "Expand Production shortage drafts and select the required shortage line.",
      "Assign an approved supplier.",
      "Confirm unit price, expected receipt and payment terms.",
      "Enter Quote / RFQ evidence.",
      "Select Submit for approval.",
      "After approval, issue the PO through the governed lifecycle.",
    ],
    controls: ["Manual controlled PO is for authorised needs not already represented by a Production shortage draft."],
    warnings: ["Draft PO ≠ supplier commitment. Approval and issuance remain separate states."],
  },
  {
    id: "09",
    chapter: "B",
    title: "Receiving & Inspection / GRN",
    route: "/command/receiving",
    purpose: "Record physical receipt and incoming inspection at the inventory boundary.",
    steps: [
      "Select the issued Purchase Order.",
      "Enter GRN number and received date.",
      "Select Accepted, Quarantine or Rejected.",
      "Enter received/accepted/rejected quantities and evidence.",
      "Select Post controlled GRN.",
      "For quarantine, enter disposition evidence then Accept to stock or Reject material.",
    ],
    controls: ["Accepted material becomes a FIFO inventory layer. Quarantined and rejected material remain outside available stock until authorised disposition."],
  },
  {
    id: "10",
    chapter: "B",
    title: "Production / Job Cards / Traveller",
    route: "/command/production",
    purpose: "Synchronise Commercial commitment to controlled build execution, batch approval and serial genealogy.",
    steps: [
      "Review confirmed Commercial orders and current Job Card revisions.",
      "Reconcile any order that is not synchronized before execution.",
      "For a released Job Card, use Approve bike / batch when authorised.",
      "Verify batch identity, Travellers and any generated shortage PO drafts.",
    ],
    controls: ["The Traveller is the manufacturing genealogy record for the physical unit."],
    warnings: ["Production approval can create shortage PO drafts; it does not approve or issue supplier commitments."],
  },
  {
    id: "11",
    chapter: "B",
    title: "Material Requisition & Issue",
    route: "/command/production",
    purpose: "Issue controlled materials to the correct Job Card and Traveller with reservation and FIFO evidence.",
    steps: [
      "Open Material Requisition & Issue inside Production.",
      "Verify Job Card, order, SKU, required quantity, reservation status and Traveller/serial.",
      "Reserve and issue the correct FIFO stock where applicable.",
      "Use the controlled print action when a formal issue record is required.",
    ],
    warnings: ["Never alter inventory merely to make Production appear material-ready."],
  },
  {
    id: "12",
    chapter: "B",
    title: "Quality / NCR / CAPA / Release",
    route: "/command/quality",
    purpose: "Control inspection evidence, non-conformance, corrective action and serialized release status.",
    controls: ["Inspection Register", "NCR Register", "CAPA", "Serialized Quality Release Register"],
    steps: ["Review incoming, in-process and final inspection lineage.", "Resolve NCR/CAPA through authorised disposition and effectiveness evidence.", "Verify current serialized Quality Release before shipment eligibility."],
    warnings: ["Production completion or Job Card approval is not the same as Quality Release."],
  },
  {
    id: "13",
    chapter: "B",
    title: "Dispatch & Operations Overview",
    route: "/command/operations",
    purpose: "View order-to-cash lineage and ensure shipment remains Operations-owned and Quality-gated.",
    steps: ["Review committed lineage, shortages, inventory alerts, Quality releases, open NCR and posted dispatch.", "Verify Order → Job Card → Traveller → Quality Release → Shipment before dispatch."],
    warnings: ["Dispatch must not exceed current eligible serialized Quality-release capacity."],
  },
  {
    id: "14",
    chapter: "B",
    title: "Finance / Receivables / Collections",
    route: "/command/receivables",
    purpose: "Maintain governed order-to-cash accounting from posted shipment through invoice and bank-backed collection.",
    steps: [
      "Issue invoice: select posted shipment, enter Invoice ID and evidence, then Issue invoice.",
      "Post collection: select open invoice, enter Collection ID, month, amount and bank reference, then Post collection.",
    ],
    warnings: ["Lead ≠ Order ≠ Dispatch ≠ Invoice ≠ Collection."],
  },
  {
    id: "15",
    chapter: "C",
    title: "Role-Based Daily Procedures",
    purpose: "Recommended daily sequence by business function.",
    controls: [
      "Management: Command → Action Inbox → Control Tower → Exceptions → Operations → Finance → VIBPE.",
      "Commercial: Demand & Orders → new demand/revision → persistence receipt → Production synchronization.",
      "Stores: Inventory → Receiving → GRN → quarantine disposition → requisition → FIFO issue.",
      "Procurement: Requirements → shortage drafts → supplier/price/evidence → approval → issue → receipt follow-up.",
      "Production: orders → Job Cards → batch approval → Traveller → material issue → build → Quality handoff.",
      "Quality: inspection → NCR/CAPA → final evidence → serialized release.",
      "Finance: Cockpit → shipments → invoice → receivable → collection → liquidity.",
      "Admin: users → roles → master data → classification; never use admin authority to bypass business gates.",
    ],
  },
  {
    id: "16",
    chapter: "C",
    title: "VIBPE Co-Pilot 2.0",
    route: "/command/ibpe-operating-workspace",
    purpose: "Governed intelligence and decision support across operating domains.",
    controls: [
      "01 · Operating Workspace",
      "02 · Planning Authority",
      "03 · Governed Optimizer",
      "04 · Outputs & Evidence",
      "05 · VIBPE Assurance",
      "06 · Release Readiness",
    ],
    notes: ["Useful questions: pending orders, material shortages, PO drafts needing action, dispatch blockers, liquidity drivers, or Trace JBC-…"],
    warnings: ["VIBPE recommendation ≠ approval. Execute the applicable governed transaction and authority."],
  },
  {
    id: "17",
    chapter: "D",
    title: "Traceability & Controlled Print",
    purpose: "Reconstruct the controlled business and manufacturing chain from customer requirement through cash collection.",
    steps: [
      "Trace Customer → Sales Order → Revision → Configuration → BOM → Inventory Requirement → Procurement → PO → GRN → Inventory → Job Card → Material Issue → Traveller → Quality Release → Dispatch → Invoice → Collection.",
      "Open the lineage/traceability record and verify expected upstream and downstream links.",
      "Use the controlled Print action or save the controlled print view as PDF where an electronic record is required.",
    ],
    warnings: ["Do not use an uncontrolled screenshot where VYNDI provides a formal printable transaction record."],
  },
  {
    id: "18",
    chapter: "D",
    title: "Exceptions & Troubleshooting",
    purpose: "Resolve the root operating condition instead of hiding the exception.",
    steps: ["Identify → understand cause → assign owner → decide action → obtain authority → execute → capture evidence → verify."],
    controls: ["Typical exceptions: unsynchronised order, missing Job Card, shortage, MSL alert, supplier missing, PO pending approval, PO awaiting receipt, quarantine, open NCR, Quality release missing, dispatch blocked, uninvoiced shipment, outstanding receivable, liquidity below reserve."],
    warnings: ["Never delete an exception merely to make a dashboard appear clean."],
  },
  {
    id: "19",
    chapter: "D",
    title: "Golden Rules & Prohibited Actions",
    purpose: "Operating disciplines that preserve VYNDI as a governed source of business truth.",
    controls: [
      "Enter business truth once.",
      "Planning is not commitment.",
      "Recommendation is not approval.",
      "Draft PO is not supplier commitment.",
      "Physical receipt is not available inventory until controlled receipt is completed.",
      "Job Card approval is not Quality Release.",
      "Every physical unit should maintain genealogy.",
      "Every material movement should have lineage.",
      "Every significant decision should have evidence.",
      "Every exception should have an owner and disposition.",
      "Finance should follow controlled operating transactions.",
      "The system must reflect actual business reality.",
    ],
    warnings: ["Do not share credentials, bypass Receiving, release quarantine without evidence, use unauthorised substitutions, duplicate Job Cards to bypass reconciliation, dispatch without Quality evidence, or use admin access to bypass approval."],
  },
  {
    id: "20",
    chapter: "E",
    title: "Complete End-to-End Example",
    purpose: "Example of one customer order moving through the complete governed lifecycle.",
    steps: [
      "Commercial: create customer order.",
      "Configuration: select model/variant.",
      "Engineering: confirm released BOM.",
      "Inventory: determine material availability.",
      "Production: synchronise Job Card and approve authorised batch.",
      "Procurement: complete shortage drafts, approve and issue supplier commitments.",
      "Receiving: post controlled GRNs; accepted material becomes FIFO stock.",
      "Material Issue: reserve and issue to Production.",
      "Traveller: maintain serial genealogy.",
      "Production and Quality: complete build, inspections, NCR/CAPA and serialized release.",
      "Dispatch: post shipment.",
      "Finance: issue invoice and post bank-backed collection.",
      "Traceability: verify the entire lineage.",
    ],
  },
  {
    id: "21",
    chapter: "E",
    title: "Training & Screenshot Register",
    purpose: "Operator competency checklist and controlled illustration register for future manual revisions.",
    controls: [
      "Operator should demonstrate login, role awareness, workspace navigation, order search, Job Card search, shortage review, Master Inventory, PO draft completion, approval vs issuance, GRN, quarantine, FIFO, Traveller, Quality Release, dispatch lineage, invoice, collection, VIBPE query, traceability and print.",
      "Controlled screenshot register S01–S17 covers Login, Command, Action Inbox, VIBPE, Demand & Orders, Inventory, Purchase, Receiving, Job Card, Material Requisition, Traveller, Quality, Operations lineage, Financial Cockpit, Receivables, Traceability/Print and Users & Roles.",
    ],
  },
  {
    id: "22",
    chapter: "E",
    title: "Controlled Document Maintenance",
    purpose: "Keep the manual synchronized with the controlled system rather than allowing documentation drift.",
    controls: ["Revise when navigation, page names, transaction buttons, approval flow, role permission, Job Card lifecycle, procurement, receiving, Quality release, dispatch, finance lineage, VIBPE, traceability/printing or governance materially changes."],
    notes: ["Final operator principle: What happened? Why? What proves it? What does it affect? What happens next? Who has authority? Was it completed? Can the chain be reconstructed?"],
  },
];

function ListBlock({ title, items, tone = "default" }: { title: string; items?: readonly string[]; tone?: "default" | "warn" | "note" }) {
  if (!items?.length) return null;
  return (
    <section className={cn(
      "rounded-xl border p-4",
      tone === "warn" ? "border-warn/35 bg-warn/5" : tone === "note" ? "border-accent/30 bg-accent/5" : "border-border bg-bg/45",
    )}>
      <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-subtle">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
        {items.map((item) => <li key={item} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent"/><span>{item}</span></li>)}
      </ul>
    </section>
  );
}

function SectionPage({ section }: { section: ManualSection }) {
  return (
    <article className="rounded-2xl border border-border bg-surface/60 p-5 shadow-sm md:p-8 print:border-0 print:bg-white print:text-black print:shadow-none">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-accent">{section.id} · VYNDI-UM-001 · Rev 1.0</p>
          <h2 className="mt-2 font-display text-3xl text-fg md:text-4xl print:text-black">{section.title}</h2>
          {section.route ? <p className="mt-2 font-mono text-xs text-cyan-300 print:text-black">{section.route}</p> : null}
        </div>
        <span className="w-fit rounded-full border border-border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">Chapter {section.chapter}</span>
      </div>
      <p className="mt-6 max-w-4xl text-sm leading-7 text-muted print:text-black">{section.purpose}</p>
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <ListBlock title="Procedure / sequence" items={section.steps} />
        <ListBlock title="Controls / reference" items={section.controls} />
        <ListBlock title="Operator notes" items={section.notes} tone="note" />
        <ListBlock title="Warnings / governing rules" items={section.warnings} tone="warn" />
      </div>
    </article>
  );
}

function UserManual() {
  const [activeId, setActiveId] = useState("00");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const activeIndex = Math.max(SECTIONS.findIndex((section) => section.id === activeId), 0);
  const needle = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!needle) return SECTIONS;
    return SECTIONS.filter((section) => JSON.stringify(section).toLowerCase().includes(needle));
  }, [needle]);
  const visibleSections = showAll || needle ? matches : [SECTIONS[activeIndex]];

  function move(delta: number) {
    const next = Math.max(0, Math.min(SECTIONS.length - 1, activeIndex + delta));
    setShowAll(false);
    setQuery("");
    setActiveId(SECTIONS[next].id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="space-y-5" data-user-manual="vyndi-um-001-rev-1">
      <header className="rounded-2xl border border-border bg-gradient-to-br from-surface via-bg-elevated to-bg p-5 md:p-7 print:border-0 print:bg-white print:text-black">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-green">Controlled dossier · VYNDI-UM-001</p>
            <h1 className="mt-2 font-display text-4xl text-accent md:text-5xl print:text-black">User & Operator Manual</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted print:text-black">Revision 1.0 · VYNDI Operating System · VIBPE Co-Pilot 2.0 · baseline 15 September 2026</p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <button type="button" onClick={() => { setQuery(""); setShowAll((value) => !value); }} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-fg hover:border-accent">{showAll ? "Single section" : "Show all"}</button>
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-bg"><Printer className="size-4"/>Print dossier</button>
          </div>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[310px_minmax(0,1fr)]">
        <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start print:hidden">
          <label className="relative block">
            <span className="sr-only">Search user manual</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"/>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the manual…" className="control w-full pl-9" />
          </label>
          <nav className="max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-surface/45 p-2" aria-label="User manual sections">
            {CHAPTERS.map((chapter) => {
              const chapterSections = SECTIONS.filter((section) => section.chapter === chapter.id).filter((section) => !needle || matches.includes(section));
              if (!chapterSections.length) return null;
              return (
                <details key={chapter.id} open className="border-b border-border/70 py-1 last:border-0">
                  <summary className="cursor-pointer list-none px-2 py-2 text-xs font-bold text-fg [&::-webkit-details-marker]:hidden"><span className="mr-2 font-mono text-accent">{chapter.id}</span>{chapter.title}</summary>
                  <div className="space-y-1 pb-2 pl-2">
                    {chapterSections.map((section) => (
                      <button key={section.id} type="button" onClick={() => { setQuery(""); setShowAll(false); setActiveId(section.id); window.scrollTo({ top: 0, behavior: "smooth" }); }} className={cn("grid w-full grid-cols-[34px_1fr] gap-2 rounded-lg px-2 py-2 text-left text-xs", activeId === section.id && !showAll && !needle ? "bg-bg text-fg" : "text-muted hover:bg-bg/70 hover:text-fg")}>
                        <span className="font-mono text-accent">{section.id}</span><span>{section.title}</span>
                      </button>
                    ))}
                  </div>
                </details>
              );
            })}
            {needle && !matches.length ? <p className="px-3 py-6 text-sm text-muted">No manual section matches “{query}”.</p> : null}
          </nav>
        </aside>

        <section className="min-w-0 space-y-5">
          {visibleSections.map((section) => <SectionPage key={section.id} section={section} />)}
          {!showAll && !needle ? (
            <div className="flex items-center justify-between gap-3 print:hidden">
              <button type="button" disabled={activeIndex === 0} onClick={() => move(-1)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted disabled:opacity-35"><ChevronLeft className="size-4"/>Previous</button>
              <span className="text-xs text-subtle">{activeIndex + 1} / {SECTIONS.length}</span>
              <button type="button" disabled={activeIndex === SECTIONS.length - 1} onClick={() => move(1)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted disabled:opacity-35">Next<ChevronRight className="size-4"/></button>
            </div>
          ) : null}
        </section>
      </div>

      <footer className="border-t border-border pt-4 text-center text-[10px] uppercase tracking-[0.14em] text-subtle print:text-black">VYNDI-UM-001 · Revision 1.0 · Controlled User & Operator Manual</footer>
    </main>
  );
}
