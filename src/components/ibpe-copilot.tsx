import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { Bot, BrainCircuit, ChevronRight, Send, ShieldCheck, Sparkles, X } from "lucide-react";
import { VIBPE_COPILOT_NAME } from "@/lib/ibpe-brand";
import { askIbpeCopilot } from "@/lib/ibpe-copilot";
import type { IbpeScenarioRequest } from "@/lib/ibpe-scenario-lab";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  meta?: string;
};

type ScenarioEvent = CustomEvent<IbpeScenarioRequest | null>;

const suggestions = [
  "What is the biggest constraint to the current 36-month plan?",
  "Where will cash become critical after recommended procurement?",
  "Which material shortages need management action first?",
  "What should I change to improve feasibility without breaking commitments?",
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

  async function ask(text = question) {
    const clean = text.trim();
    if (!clean || busy) return;
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", text: clean };
    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setBusy(true);
    try {
      const response = await askIbpeCopilot({ data: { question: clean, scenario: scenario ?? undefined } });
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: response.ok ? response.answer ?? "No analysis returned." : response.error ?? `${VIBPE_COPILOT_NAME} is unavailable.`,
          meta: response.lineage
            ? `Governed R${response.lineage.approvedPlanRevision} · ${response.lineage.inputHash.slice(0, 8)}${response.scenarioId ? ` · scenario ${response.scenarioId}` : ""}`
            : undefined,
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
        <span className="flex size-8 items-center justify-center rounded-full bg-accent/12 text-accent"><BrainCircuit className="size-4" /></span>
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
                {scenario ? <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/8 px-2.5 py-1 text-accent"><Sparkles className="size-3" /> {scenario.label}</span> : <span className="rounded-full border border-border bg-bg/60 px-2.5 py-1 text-muted">Governed baseline</span>}
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {messages.length === 0 ? (
                <div className="space-y-5">
                  <div className="rounded-xl border border-border bg-surface/35 p-4">
                    <p className="font-medium text-fg">Explore the operating model, not a generic chatbot.</p>
                    <p className="mt-2 text-sm leading-6 text-muted">Ask why a funding gap appears, what material drives a shortage, how a demand change affects procurement, or which controlled action improves feasibility. Numbers come from the governed IBPE packet.</p>
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
                      {message.meta ? <p className="mt-3 border-t border-border/70 pt-2 text-[10px] text-subtle">{message.meta}</p> : null}
                    </article>
                  ))}
                  {busy ? <div className="mr-4 rounded-xl border border-border bg-surface/35 p-4 text-sm text-muted">Analysing the governed IBPE packet…</div> : null}
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
                  maxLength={1800}
                  placeholder={`Ask ${VIBPE_COPILOT_NAME} about demand, materials, procurement, cash, funding or capacity…`}
                  className="min-h-12 flex-1 resize-none rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-fg outline-none transition placeholder:text-subtle focus:border-accent/60"
                />
                <button type="button" disabled={busy || !question.trim()} onClick={() => void ask()} className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-bg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40" aria-label={`Ask ${VIBPE_COPILOT_NAME}`}><Send className="size-4" /></button>
              </div>
              <p className="mt-2 text-[10px] leading-4 text-subtle">AI explains and explores; authorised transaction workspaces remain the only place to approve or execute business actions.</p>
            </footer>
          </aside>
        </div>
      ) : null}
    </>
  );
}
