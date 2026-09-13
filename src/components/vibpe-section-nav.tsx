import { Link } from "@tanstack/react-router";

export type VibpeSection =
  | "workspace"
  | "authority"
  | "optimizer"
  | "outputs"
  | "assurance"
  | "release";

const STEPS: ReadonlyArray<{ id: VibpeSection; label: string; short: string; to: string }> = [
  { id: "workspace", label: "Operating Workspace", short: "Workspace", to: "/command/ibpe-operating-workspace" },
  { id: "authority", label: "Planning Authority", short: "Authority", to: "/command/ibpe-operating-workspace/authority" },
  { id: "optimizer", label: "Governed Optimizer", short: "Optimizer", to: "/command/ibpe-operating-workspace/optimizer" },
  { id: "outputs", label: "Outputs & Evidence", short: "Outputs", to: "/command/ibpe-operating-workspace/outputs" },
  { id: "assurance", label: "VIBPE Assurance", short: "Assurance", to: "/command/ibpe-operating-workspace/assurance" },
  { id: "release", label: "Release Readiness", short: "Release", to: "/command/ibpe-operating-workspace/release" },
];

export function VibpeSectionNav({ current }: { current: VibpeSection }) {
  return (
    <nav aria-label="VIBPE governed workflow" className="print:hidden">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        {STEPS.map((step, index) => {
          const active = step.id === current;
          return (
            <Link
              key={step.id}
              to={step.to as never}
              aria-current={active ? "page" : undefined}
              className={`rounded-xl border px-3 py-3 transition-colors ${
                active
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-surface/20 text-muted hover:border-accent hover:text-fg"
              }`}
            >
              <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="mt-1 block text-sm font-semibold">{step.short}</span>
              <span className="mt-1 block text-[11px] leading-4 text-subtle">{step.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
