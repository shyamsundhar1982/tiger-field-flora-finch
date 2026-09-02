import { createFileRoute } from "@tanstack/react-router";
import { AI_KNOWLEDGE_RULES, AI_KNOWLEDGE_STATUS, AI_PROMPT_LIBRARY, AI_QUERY_SUGGESTIONS } from "@/lib/data/ai-knowledge";

export const Route = createFileRoute("/command/ai-knowledge")({ component: AIKnowledgePage });

const statusClass = (status: string) => status === "ready" ? "text-emerald-600" : status === "restricted" ? "text-red-600" : "text-amber-600";

function AIKnowledgePage() {
  const ready = AI_KNOWLEDGE_RULES.filter((item) => item.status === "ready").length;
  const restricted = AI_KNOWLEDGE_RULES.filter((item) => item.mode === "founder-only").length;
  return <div className="space-y-8">
    <header><p className="text-[10px] uppercase tracking-[0.2em] text-subtle">Stage 10 · AI / Knowledge</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">Controlled knowledge interface</h1><p className="mt-2 max-w-3xl text-sm text-muted">A governed interface for asking questions against the workspace knowledge system without turning assumptions, pending work or sensitive records into facts.</p></header>

    <section className="grid gap-3 sm:grid-cols-4">{[["Mode", "Controlled"],["Rules ready", `${ready}/${AI_KNOWLEDGE_RULES.length}`],["Founder-only rules", `${restricted}`],["Source of truth", "Knowledge + controls"]].map(([label, value]) => <div key={label} className="rounded-lg border border-border bg-surface p-4"><p className="text-[10px] uppercase tracking-widest text-subtle">{label}</p><p className="mt-2 text-lg font-semibold">{value}</p></div>)}</section>

    <section className="rounded-lg border border-border bg-surface p-5"><h2 className="text-sm font-semibold">Operating contract</h2><div className="mt-3 grid gap-3 md:grid-cols-3"><div><p className="text-[10px] uppercase tracking-widest text-subtle">Principle</p><p className="mt-2 text-sm text-muted">{AI_KNOWLEDGE_STATUS.principle}</p></div><div><p className="text-[10px] uppercase tracking-widest text-subtle">Source</p><p className="mt-2 text-sm text-muted">{AI_KNOWLEDGE_STATUS.sourceOfTruth}</p></div><div><p className="text-[10px] uppercase tracking-widest text-subtle">Restricted</p><p className="mt-2 text-sm text-muted">{AI_KNOWLEDGE_STATUS.restrictedHandling}</p></div></div></section>

    <section><h2 className="mb-3 text-sm font-semibold">Knowledge governance rules</h2><div className="overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[850px] text-left text-sm"><thead className="border-b border-border bg-surface text-[10px] uppercase tracking-wider text-subtle"><tr><th className="px-4 py-3">Rule</th><th className="px-4 py-3">Control</th><th className="px-4 py-3">Mode</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{AI_KNOWLEDGE_RULES.map((item) => <tr key={item.id} className="border-b border-border last:border-0"><td className="px-4 py-3 font-medium">{item.id} · {item.title}</td><td className="px-4 py-3 text-muted">{item.rule}</td><td className="px-4 py-3">{item.mode}</td><td className={`px-4 py-3 ${statusClass(item.status)}`}>{item.status}</td></tr>)}</tbody></table></div></section>

    <section><h2 className="mb-3 text-sm font-semibold">Prompt library</h2><div className="grid gap-3 md:grid-cols-2">{AI_PROMPT_LIBRARY.map((item) => <div key={item.id} className="rounded-lg border border-border p-4"><p className="text-sm font-semibold">{item.label}</p><p className="mt-2 text-xs leading-5 text-muted">{item.prompt}</p></div>)}</div></section>

    <section><h2 className="mb-3 text-sm font-semibold">Suggested queries</h2><div className="flex flex-wrap gap-2">{AI_QUERY_SUGGESTIONS.map((query) => <div key={query} className="rounded-full border border-border px-3 py-2 text-xs text-muted">{query}</div>)}</div></section>

    <section className="rounded-lg border border-border p-5"><h2 className="text-sm font-semibold">Important boundary</h2><p className="mt-3 text-sm leading-6 text-muted">This stage establishes the governed knowledge contract and reusable prompt/query surface. It does not pretend that a live LLM retrieval backend, authentication boundary or vector database exists. Those are implementation stages that require actual infrastructure before they can be called active.</p></section>
  </div>;
}
