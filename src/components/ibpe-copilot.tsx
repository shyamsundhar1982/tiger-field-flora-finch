import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { Bot, BrainCircuit, ChevronRight, FileSearch, Printer, Send, ShieldCheck, Sparkles, X } from "lucide-react";
import { VIBPE_COPILOT_NAME } from "@/lib/ibpe-brand";
import { askIbpeCopilot } from "@/lib/ibpe-copilot";
import { getAdvancedPlanningVibpeEvidence } from "@/lib/advanced-planning-vibpe-evidence";
import type { IbpeScenarioRequest } from "@/lib/ibpe-scenario-lab";
import { askTraceabilityCopilot } from "@/lib/traceability-search";
import { askVibpeGovernanceCopilot } from "@/lib/vibpe-governance-server";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  meta?: string;
  traceabilityQuery?: string;
};

type ScenarioEvent = CustomEvent<IbpeScenarioRequest | null>;

type RoutedAnswer = {
  text: string;
  meta?: string;
  traceabilityQuery?: string;
};

const suggestions = [
  "What is the biggest constraint to the current 36-month plan?",
  "Where will cash become critical after recommended procurement?",
  "Which material shortages need management action first?",
  "Find the records related to a Job Card, serial number or PO reference.",
];

function workspaceLabel(pathname: string) {
  if (pathname.startsWith("/command/planning") || pathname.startsWith("/command/scenarios")) return "Planning";
  if (pathname.startsWith("/command/inventory") || pathname.startsWith("/command/procurement") || pathname.startsWith("/command/production") || pathname.startsWith("/command/operations")) return "Supply & Production";
  if (pathname.startsWith("/command/financial") || pathname.startsWith("/command/finance") || pathname.startsWith("/command/cash") || pathname.startsWith("/command/funding")) return "Finance";
  if (pathname.startsWith("/command/sales")) return "Commercial";
  if (pathname.startsWith("/command/engineering") || pathname.startsWith("/command/bom") || pathname.startsWith("/command/product")) return "Engineering";
  if (pathname.startsWith("/command/governance")) return "Governance";
  return "Command";
}

function numberedQuestions(text: string) {
  const questions = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.match(/^(\d{1,2})[.)]\s+(.+?)\s*$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({ number: Number(match[1]), question: match[2].trim() }))
    .filter((item) => item.question.length > 0);
  return questions.length >= 2 ? questions.slice(0, 12) : [];
}

function batchSynthesisInstruction(text: string) {
  const lines = text.split(/\r?\n/);
  let lastNumberedIndex = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (/^\s*\d{1,2}[.)]\s+/.test(lines[index])) lastNumberedIndex = index;
  }
  if (lastNumberedIndex < 0 || lastNumberedIndex >= lines.length - 1) return "";
  const trailing = lines
    .slice(lastNumberedIndex + 1)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
  if (!trailing) return "";
  const asksSynthesis = /finish with|overall assessment|overall operating status|primary blocker|secondary blocker|founder decision|highest-priority executable action|contradiction/i.test(trailing);
  return asksSynthesis ? trailing.slice(0, 1600) : "";
}

function printAssistantResult(message: Message, workspace: string) {
  const printWindow = window.open("", "_blank", "width=900,height=900");
  if (!printWindow) return;
  printWindow.opener = null;

  printWindow.document.write(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>VIBPE Co-Pilot Result</title>
  <style>
    @page { size: A4; margin: 16mm 15mm 18mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #161616; background: #fff; font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; line-height: 1.5; }
    .document { max-width: 180mm; margin: 0 auto; }
    .header { border-bottom: 2px solid #232323; padding-bottom: 12px; margin-bottom: 18px; }
    .eyebrow { margin: 0 0 4px; font-size: 8pt; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
    h1 { margin: 0; font-size: 20pt; line-height: 1.15; }
    .context { margin-top: 7px; color: #555; font-size: 9pt; }
    .result { white-space: pre-wrap; overflow-wrap: anywhere; font-family: Arial, Helvetica, sans-serif; }
    .meta { margin-top: 18px; border-top: 1px solid #bdbdbd; padding-top: 9px; color: #555; font-size: 8.5pt; }
    .footer { margin-top: 24px; border-top: 1px solid #ddd; padding-top: 9px; color: #666; font-size: 8pt; }
    .footer strong { color: #333; }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .document { max-width: none; }
    }
  </style>
</head>
<body>
  <main class="document">
    <header class="header">
      <p class="eyebrow">VYNDI Intelligence</p>
      <h1>VIBPE Co-Pilot Result</h1>
      <div id="context" class="context"></div>
    </header>
    <section id="result" class="result"></section>
    <div id="meta" class="meta"></div>
    <footer class="footer"><strong>Advisory / read-only analysis.</strong> Authorised transaction workspaces and governed records remain the controlling business authority.<br />© 2026 Vāyú Shastr Pvt Ltd. All Rights Reserved.</footer>
  </main>
</body>
</html>`);
  printWindow.document.close();

  const context = printWindow.document.getElementById("context");
  const result = printWindow.document.getElementById("result");
  const meta = printWindow.document.getElementById("meta");
  if (context) context.textContent = `${workspace} · Generated ${new Date().toLocaleString()}`;
  if (result) result.textContent = message.text;
  if (meta) meta.textContent = message.meta ? `Evidence / lineage: ${message.meta}` : "Evidence / lineage: result displayed from the current governed VIBPE session.";

  printWindow.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 150);
}

export function IbpeCopilot() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [scenario, setScenario] = useState<IbpeScenarioRequest | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const endRef = useRef<HTMLDivElement | null>(null);
  const workspace = useMemo(() => workspaceLabel(pathname), [pathname]);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as ScenarioEvent;
      setScenario(custom.detail ?? null);
    };
    window.addEventListener("vyndi:ibpe-scenario", handler);
    return () => window.removeEventListener("vyndi:ibpe-scenario", handler);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, busy]);

  async function resolveOne(clean: string): Promise<RoutedAnswer> {
    const governance = await askVibpeGovernanceCopilot({ data: { question: clean } });
    if (governance.handled) {
      return {
        text: governance.answer,
        meta: "Governed VIBPE control state · live read-only sources",
      };
    }

    const traceability = await askTraceabilityCopilot({ data: { question: clean } });
    if (traceability.handled) {
      return {
        text: traceability.answer,
        meta: "Governed traceability search · read-only · RBAC filtered",
        traceabilityQuery: traceability.query,
      };
    }

    const response = await askIbpeCopilot({ data: { question: clean, scenario: scenario ?? undefined } });
    let responseText = response.ok ? response.answer ?? "No analysis returned." : response.error ?? `${VIBPE_COPILOT_NAME} is unavailable.`;
    let advancedPacketId: string | null = null;
    if (response.ok && response.lineage && !response.scenarioId) {
      try {
        const advanced = await getAdvancedPlanningVibpeEvidence({
          data: { parentIbpeRunId: response.lineage.governedRunId, question: clean },
        });
        if (advanced.handled && advanced.text && !responseText.includes("Advanced planning evidence (governed baseline):")) {
          responseText = `${responseText}\n\n${advanced.text}`;
          advancedPacketId = advanced.packetId;
        }
      } catch {
        // Advanced-planning evidence is supplementary. Existing governed VIBPE
        // remains available if the derived packet has not been deployed yet.
      }
    }

    return {
      text: responseText,
      meta: response.lineage
        ? `Governed R${response.lineage.approvedPlanRevision} · ${response.lineage.inputHash.slice(0, 8)}${response.scenarioId ? ` · scenario ${response.scenarioId}` : ""}${advancedPacketId ? " · advanced evidence linked" : ""}`
        : undefined,
    };
  }

  async function ask(text = question) {
    const clean = text.trim();
    if (!clean || busy) return;
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", text: clean };
    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setBusy(true);
    try {
      const batch = numberedQuestions(clean);
      if (batch.length > 1) {
        const sections: string[] = [];
        for (const item of batch) {
          try {
            const routed = await resolveOne(item.question);
            sections.push(`${item.number}. ${item.question}\n${routed.text}`);
          } catch (error) {
            sections.push(`${item.number}. ${item.question}\nUnable to resolve this question: ${error instanceof Error ? error.message : "request failed"}.`);
          }
        }

        const synthesisInstruction = batchSynthesisInstruction(clean);
        if (synthesisInstruction) {
          try {
            const synthesis = await resolveOne(`Founder operating review synthesis. ${synthesisInstruction}`);
            sections.push(`Overall assessment\n${synthesis.text}`);
          } catch (error) {
            sections.push(`Overall assessment\nUnable to resolve the requested synthesis: ${error instanceof Error ? error.message : "request failed"}.`);
          }
        }

        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: sections.join("\n\n"),
            meta: `Independent multi-intent review · ${batch.length} questions routed separately${synthesisInstruction ? " · overall synthesis included" : ""}`,
          },
        ]);
        return;
      }

      const routed = await resolveOne(clean);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: routed.text,
          meta: routed.meta,
          traceabilityQuery: routed.traceabilityQuery,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: error instanceof Error ? error.message : `${VIBPE_COPILOT_NAME} request failed.`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex min-h-12 items-center gap-2 rounded-full border border-accent/35 bg-bg/95 px-4 py-3 text-sm font-semibold text-fg shadow-2xl backdrop-blur-xl transition hover:border-accent hover:bg-surface"
        aria-label={`Open ${VIBPE_COPILOT_NAME}`}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent"><BrainCircuit className="size-4" /></span>
        <span className="hidden sm:inline">{VIBPE_COPILOT_NAME}</span>
        {scenario ? <span className="size-2 rounded-full bg-green" title={`Scenario context: ${scenario.label}`} /> : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-bg/55 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={VIBPE_COPILOT_NAME}>
          <button type="button" aria-label={`Close ${VIBPE_COPILOT_NAME}`} className="absolute inset-0 cursor-default" onClick={() => setOpen(false)} />
          <aside className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-border bg-bg shadow-2xl">
            <header className="border-b border-border bg-surface/55 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent"><Bot className="size-5" /></span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-green">VYNDI Intelligence</p>
                    <h2 className="font-display text-xl font-semibold text-fg">{VIBPE_COPILOT_NAME}</h2>
                    <p className="mt-1 text-xs leading-5 text-muted">{workspace} · deterministic business truth first, AI explanation second.</p>
                  </div>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="flex size-10 items-center justify-center rounded-lg border border-border text-muted transition hover:border-accent/50 hover:text-fg" aria-label="Close"><X className="size-4" /></button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-wider">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg/60 px-2.5 py-1 text-muted"><ShieldCheck className="size-3 text-green" /> Advisory only</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg/60 px-2.5 py-1 text-muted"><FileSearch className="size-3 text-accent" /> Vernacular traceability</span>
                {scenario ? <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/8 px-2.5 py-1 text-accent"><Sparkles className="size-3" /> {scenario.label}</span> : <span className="rounded-full border border-border bg-bg/60 px-2.5 py-1 text-muted">Governed baseline</span>}
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {messages.length === 0 ? (
                <div className="space-y-5">
                  <div className="rounded-xl border border-border bg-surface/35 p-4">
                    <p className="font-medium text-fg">Explore the operating model and trace governed records.</p>
                    <p className="mt-2 text-sm leading-6 text-muted">Ask about cash, demand, procurement and capacity, or use ordinary shorthand and mixed Tamil-English wording to find an Order, Job Card, Traveller/serial, MR, PO, GRN, Quality Release, Dispatch or Invoice. Partial identifiers are accepted.</p>
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-green">Useful questions</p>
                    <div className="grid gap-2">
                      {suggestions.map((item) => (
                        <button key={item} type="button" onClick={() => void ask(item)} className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border bg-surface/25 px-3 py-2.5 text-left text-sm text-muted transition hover:border-accent/40 hover:text-fg">
                          <span>{item}</span><ChevronRight className="size-4 shrink-0 text-accent" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <article key={message.id} className={message.role === "user" ? "ml-8 rounded-xl border border-accent/25 bg-accent/8 p-4" : "mr-4 rounded-xl border border-border bg-surface/35 p-4"}>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-green">{message.role === "user" ? "You" : VIBPE_COPILOT_NAME}</p>
                      <div className="whitespace-pre-wrap text-sm leading-6 text-fg">{message.text}</div>
                      {message.role === "assistant" ? (
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-border/70 pt-3">
                          <button type="button" onClick={() => printAssistantResult(message, workspace)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-fg" aria-label="Print VIBPE result"><Printer className="size-3.5" /> Print Result</button>
                          {message.traceabilityQuery ? <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("vyndi:traceability-search", { detail: { query: message.traceabilityQuery } }))} className="inline-flex items-center gap-2 rounded-lg border border-accent/40 px-3 py-2 text-xs font-semibold text-accent hover:bg-accent/10"><FileSearch className="size-3.5" /> Open Traceability & Print</button> : null}
                        </div>
                      ) : null}
                      {message.meta ? <p className="mt-3 text-[10px] text-subtle">{message.meta}</p> : null}
                    </article>
                  ))}
                  {busy ? <div className="mr-4 rounded-xl border border-border bg-surface/35 p-4 text-sm text-muted">Resolving governed control state, traceability or analysing the IBPE packet…</div> : null}
                  <div ref={endRef} />
                </div>
              )}
            </div>

            <footer className="border-t border-border bg-surface/45 p-4">
              {scenario ? (
                <div className="mb-3 flex items-center justify-between rounded-lg border border-accent/25 bg-accent/8 px-3 py-2 text-xs">
                  <span className="text-muted">Scenario context: <strong className="text-fg">{scenario.label}</strong></span>
                  <button type="button" onClick={() => setScenario(null)} className="text-accent hover:text-fg">Use baseline</button>
                </div>
              ) : null}
              <div className="flex items-end gap-2">
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void ask();
                    }
                  }}
                  rows={2}
                  maxLength={8000}
                  placeholder={`Ask ${VIBPE_COPILOT_NAME} normally — e.g. “061E6697 related papers”, “C3 cycles oda pending PO”, or paste a numbered multi-question review…`}
                  className="min-h-12 flex-1 resize-none rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-fg outline-none transition placeholder:text-subtle focus:border-accent/60"
                />
                <button type="button" disabled={busy || !question.trim()} onClick={() => void ask()} className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-bg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40" aria-label={`Ask ${VIBPE_COPILOT_NAME}`}><Send className="size-4" /></button>
              </div>
              <p className="mt-2 text-[10px] leading-4 text-subtle">Read-only governance and traceability can be queried here; numbered multi-question reviews are routed one question at a time. Authorised transaction workspaces remain the only place to approve or execute business actions.</p>
            </footer>
          </aside>
        </div>
      ) : null}
    </>
  );
}
