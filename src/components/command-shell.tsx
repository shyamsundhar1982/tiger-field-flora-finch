import { Link, Outlet } from "@tanstack/react-router";
import { Activity, AlertTriangle, Bike, BookOpen, BrainCircuit, CheckSquare, ClipboardCheck, Factory, Landmark, Presentation, Rocket, Scale, Shield, UserRound, Wallet, Wrench, FileSpreadsheet, BadgeCheck, Ruler, LineChart } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { cn } from "@/lib/utils";

const NAV: Array<{ to: "/command" | "/command/finance" | "/command/product" | "/command/ops" | "/command/legal" | "/command/legal-control" | "/command/gtm" | "/command/risk" | "/command/actions" | "/command/knowledge" | "/command/technical" | "/command/finance-control" | "/command/funding" | "/command/manufacturing" | "/command/founder-command" | "/command/investor-board" | "/command/ai-knowledge" | "/command/qa-verification" | "/command/deployment-readiness" | "/command/balance-sheet" | "/command/ca-audit" | "/command/investor-pitch" | "/command/market-survey" | "/command/design-philosophy"; label: string; icon: typeof Activity; exact?: boolean }> = [
  { to: "/command", label: "Board", icon: Activity, exact: true },
  { to: "/command/founder-command", label: "Founder", icon: UserRound },
  { to: "/command/investor-pitch", label: "Investor Pitch", icon: Presentation },
  { to: "/command/investor-board", label: "Investor / Board", icon: Presentation },
  { to: "/command/market-survey", label: "Market Survey", icon: LineChart },
  { to: "/command/design-philosophy", label: "Design Philosophy", icon: Ruler },
  { to: "/command/ai-knowledge", label: "AI / Knowledge", icon: BrainCircuit },
  { to: "/command/qa-verification", label: "QA / Verify", icon: ClipboardCheck },
  { to: "/command/deployment-readiness", label: "Release", icon: Rocket },
  { to: "/command/finance", label: "Finance", icon: Wallet },
  { to: "/command/finance-control", label: "Finance Control", icon: Wallet },
  { to: "/command/balance-sheet", label: "Balance Sheet", icon: FileSpreadsheet },
  { to: "/command/ca-audit", label: "CA Verification", icon: BadgeCheck },
  { to: "/command/product", label: "Product", icon: Bike },
  { to: "/command/technical", label: "Technical", icon: Wrench },
  { to: "/command/funding", label: "Funding", icon: Landmark },
  { to: "/command/manufacturing", label: "Manufacturing", icon: Factory },
  { to: "/command/ops", label: "Ops", icon: Landmark },
  { to: "/command/legal", label: "Legal", icon: Scale },
  { to: "/command/legal-control", label: "Legal Control", icon: Scale },
  { to: "/command/gtm", label: "GTM", icon: Shield },
  { to: "/command/risk", label: "Risk", icon: AlertTriangle },
  { to: "/command/actions", label: "Actions", icon: CheckSquare },
  { to: "/command/knowledge", label: "Knowledge", icon: BookOpen },
];

export function CommandShell() {
  return <div className="min-h-dvh bg-bg"><SiteHeader /><div className="mx-auto flex max-w-7xl"><aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-52 shrink-0 border-r border-border py-6 lg:block"><p className="px-5 pb-3 text-[10px] uppercase tracking-[0.2em] text-subtle">Command</p><nav className="flex flex-col gap-0.5 px-2">{NAV.map((item) => <Link key={item.to} to={item.to} activeOptions={item.exact ? { exact: true } : undefined} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted transition-colors duration-150 hover:bg-surface hover:text-fg" activeProps={{ className: "bg-surface text-fg" }}><item.icon className="size-4" />{item.label}</Link>)}</nav></aside><div className="min-w-0 flex-1"><div className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 lg:hidden">{NAV.map((item) => <Link key={item.to} to={item.to} activeOptions={item.exact ? { exact: true } : undefined} className={cn("shrink-0 rounded-md px-3 py-2 text-xs text-muted")} activeProps={{ className: "bg-surface text-fg" }}>{item.label}</Link>)}</div><div className="px-4 py-6 sm:px-6 lg:px-8"><Outlet /></div></div></div></div>;
}
