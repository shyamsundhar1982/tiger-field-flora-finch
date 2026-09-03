import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { Activity, AlertTriangle, Bike, BookOpen, BrainCircuit, CheckSquare, ChevronDown, ClipboardCheck, Factory, Landmark, Presentation, Rocket, Scale, UserRound, Wallet, Wrench, FileSpreadsheet, BadgeCheck, Ruler, LineChart, Boxes, Layers3, SlidersHorizontal, GitCompare, Cog, Shield } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { cn } from "@/lib/utils";

type NavItem = {
  to: "/command" | "/command/financial-cockpit" | "/command/finance-assumptions" | "/command/scenarios" | "/command/finance" | "/command/product" | "/command/ops" | "/command/legal" | "/command/legal-control" | "/command/gtm" | "/command/risk" | "/command/actions" | "/command/knowledge" | "/command/technical" | "/command/finance-control" | "/command/funding" | "/command/manufacturing" | "/command/production" | "/command/sales" | "/command/cash" | "/command/founder-command" | "/command/investor-board" | "/command/ai-knowledge" | "/command/qa-verification" | "/command/deployment-readiness" | "/command/balance-sheet" | "/command/ca-audit" | "/command/investor-pitch" | "/command/market-survey" | "/command/design-philosophy" | "/command/aluminium-finance" | "/command/master-finance" | "/command/inventory" | "/inventory";
  label: string;
  icon: typeof Activity;
  exact?: boolean;
};

type NavGroup = {
  label: string;
  icon: typeof Activity;
  items: NavItem[];
  defaultOpen?: boolean;
};

const GROUPS: NavGroup[] = [
  {
    label: "Overview",
    icon: Activity,
    defaultOpen: true,
    items: [
      { to: "/command", label: "Board", icon: Activity, exact: true },
      { to: "/command/financial-cockpit", label: "Financial Cockpit", icon: Wallet },
    ],
  },
  {
    label: "Finance",
    icon: Wallet,
    defaultOpen: true,
    items: [
      { to: "/command/finance-assumptions", label: "Plan & Assumptions", icon: SlidersHorizontal },
      { to: "/command/scenarios", label: "Scenarios", icon: GitCompare },
      { to: "/command/master-finance", label: "Master Finance", icon: Layers3 },
      { to: "/command/aluminium-finance", label: "Aluminium Vertical", icon: Factory },
      { to: "/command/finance", label: "Finance", icon: Wallet },
      { to: "/command/finance-control", label: "Finance Control", icon: Wallet },
      { to: "/command/balance-sheet", label: "Balance Sheet", icon: FileSpreadsheet },
      { to: "/command/ca-audit", label: "CA Verification", icon: BadgeCheck },
      { to: "/command/funding", label: "Funding", icon: Landmark },
      { to: "/command/cash", label: "Cash & Working Capital", icon: Wallet },
    ],
  },
  {
    label: "Production",
    icon: Factory,
    defaultOpen: true,
    items: [
      { to: "/command/production", label: "Production Planning", icon: Cog },
      { to: "/command/manufacturing", label: "Manufacturing Controls", icon: Factory },
      { to: "/command/inventory", label: "Inventory Planning", icon: Boxes },
      { to: "/inventory", label: "Component Control", icon: Boxes },
      { to: "/command/ops", label: "Ops", icon: Landmark },
    ],
  },
  {
    label: "Product & Technical",
    icon: Wrench,
    items: [
      { to: "/command/product", label: "Product", icon: Bike },
      { to: "/command/technical", label: "Technical", icon: Wrench },
      { to: "/command/design-philosophy", label: "Design Philosophy", icon: Ruler },
    ],
  },
  {
    label: "Sales & Market",
    icon: LineChart,
    items: [
      { to: "/command/sales", label: "Sales Planning", icon: LineChart },
      { to: "/command/market-survey", label: "Market Survey", icon: LineChart },
      { to: "/command/gtm", label: "GTM", icon: Shield },
    ],
  },
  {
    label: "Legal & Risk",
    icon: Scale,
    items: [
      { to: "/command/legal", label: "Legal", icon: Scale },
      { to: "/command/legal-control", label: "Legal Control", icon: Scale },
      { to: "/command/risk", label: "Risk", icon: AlertTriangle },
    ],
  },
  {
    label: "Leadership & Investors",
    icon: Presentation,
    items: [
      { to: "/command/founder-command", label: "Founder", icon: UserRound },
      { to: "/command/investor-pitch", label: "Investor Pitch", icon: Presentation },
      { to: "/command/investor-board", label: "Investor / Board", icon: Presentation },
    ],
  },
  {
    label: "Knowledge & Delivery",
    icon: BookOpen,
    items: [
      { to: "/command/ai-knowledge", label: "AI / Knowledge", icon: BrainCircuit },
      { to: "/command/qa-verification", label: "QA / Verify", icon: ClipboardCheck },
      { to: "/command/deployment-readiness", label: "Release", icon: Rocket },
      { to: "/command/actions", label: "Actions", icon: CheckSquare },
      { to: "/command/knowledge", label: "Knowledge", icon: BookOpen },
    ],
  },
];

function Group({ group }: { group: NavGroup }) {
  const location = useLocation();
  const active = group.items.some((item) => location.pathname === item.to || (!item.exact && location.pathname.startsWith(`${item.to}/`)));
  return (
    <details open={active || group.defaultOpen} className="group/section">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-subtle hover:bg-surface hover:text-fg [&::-webkit-details-marker]:hidden">
        <group.icon className="size-3.5 shrink-0" />
        <span className="flex-1">{group.label}</span>
        <ChevronDown className="size-3 transition-transform group-open/section:rotate-180" />
      </summary>
      <div className="ml-2 mt-1 space-y-0.5 border-l border-border pl-2">
        {group.items.map((item) => (
          <Link key={item.to} to={item.to} activeOptions={item.exact ? { exact: true } : undefined} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted transition-colors duration-150 hover:bg-surface hover:text-fg" activeProps={{ className: "bg-surface text-fg" }}>
            <item.icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        ))}
      </div>
    </details>
  );
}

export function CommandShell() {
  return <div className="min-h-dvh bg-bg"><SiteHeader /><div className="mx-auto flex max-w-7xl"><aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-56 shrink-0 flex-col border-r border-border py-6 lg:flex"><p className="px-5 pb-3 text-[10px] uppercase tracking-[0.2em] text-subtle">Command</p><nav className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-4 pr-1 [scrollbar-width:thin]">{GROUPS.map((group) => <Group key={group.label} group={group} />)}</nav></aside><div className="min-w-0 flex-1"><div className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 lg:hidden [scrollbar-width:thin]">{GROUPS.flatMap((group) => group.items).map((item) => <Link key={item.to} to={item.to} activeOptions={item.exact ? { exact: true } : undefined} className={cn("shrink-0 rounded-md px-3 py-2 text-xs text-muted")} activeProps={{ className: "bg-surface text-fg" }}>{item.label}</Link>)}</div><div className="px-4 py-6 sm:px-6 lg:px-8"><Outlet /></div></div></div></div>;
}
