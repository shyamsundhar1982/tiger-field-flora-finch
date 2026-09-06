import { createFileRoute, Link } from "@tanstack/react-router";
import { getRouteMeta, type PageMaturity, type PageMode } from "@/lib/page-metadata";

export const Route = createFileRoute("/command/classification")({ component: Classification });

const MODES: PageMode[] = ["understand", "observe", "operate", "showcase"];
const maturityLabel: Record<PageMaturity,string> = { keep:"KEEP", merge:"MERGE", review:"REVIEW" };
const modeLabel: Record<PageMode,string> = { understand:"UNDERSTAND", observe:"OBSERVE", operate:"OPERATE", showcase:"SHOWCASE" };

function Classification(){
  const known = Object.keys(import.meta.glob("/src/routes/command/*.tsx", { eager:true })).map(route=>route.replace(/^\/src\/routes/, "").replace(/\.tsx$/, "")).map(route=>getRouteMeta(route)).filter(Boolean);
  const counts = MODES.map(mode=>({mode,count:known.filter(p=>p?.mode===mode).length}));
  return <div className="space-y-6">
    <header><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-subtle">VINDY 2.0</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Page Classification</h1><p className="mt-2 max-w-3xl text-sm text-muted">Every page is governed by four tags: <strong>Mode</strong> — why the user opened it; <strong>Domain</strong> — business area; <strong>Owner</strong> — primary user; <strong>Maturity</strong> — Keep, Merge or Review.</p></header>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{counts.map(({mode,count})=><div key={mode} className="rounded-lg border border-border bg-surface/40 p-4"><p className="text-[10px] uppercase tracking-[0.18em] text-subtle">{modeLabel[mode]}</p><p className="mt-2 text-2xl font-semibold">{count}</p><p className="mt-1 text-xs text-muted">classified pages</p></div>)}</section>
    <section className="overflow-hidden rounded-lg border border-border"><div className="border-b border-border bg-surface/40 px-4 py-3"><p className="text-xs font-semibold uppercase tracking-[0.16em]">Classification Register</p></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-border text-[10px] uppercase tracking-[0.14em] text-subtle"><tr><th className="px-4 py-3">Page</th><th className="px-4 py-3">Mode</th><th className="px-4 py-3">Domain</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3">Maturity</th></tr></thead><tbody>{known.map(p=>p&&<tr key={p.route} className="border-b border-border last:border-0"><td className="px-4 py-3"><Link to={p.route as never} className="font-medium hover:underline">{p.label}</Link><div className="mt-0.5 text-[11px] text-subtle">{p.route}</div></td><td className="px-4 py-3"><span className="rounded border border-border px-2 py-1 text-[10px] font-semibold uppercase">{p.mode}</span></td><td className="px-4 py-3 capitalize">{p.domain}</td><td className="px-4 py-3 capitalize">{p.owner}</td><td className="px-4 py-3"><span className="rounded border border-border px-2 py-1 text-[10px] font-semibold uppercase">{maturityLabel[p.maturity]}</span></td></tr>)}</tbody></table></div></section>
    <div className="rounded-lg border border-border bg-surface/30 p-4 text-xs text-muted"><strong className="text-fg">Governance rule:</strong> classification controls navigation, access-policy context and future merge/review decisions. No page is deleted by classification alone.</div>
  </div>
}
