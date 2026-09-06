import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Kpi({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "ok" | "warn" | "danger";
}) {
  const explanation = hint
    ? `Why: this KPI is a decision signal for ${label.toLowerCase()}. How derived: ${hint}`
    : `Why: this KPI provides a decision signal for ${label.toLowerCase()}. How derived: the value shown is supplied by the page's underlying data/model.`;

  return (
    <div
      title={explanation}
      className="min-h-[104px] rounded-lg border border-border bg-bg-elevated p-4 transition-colors hover:border-fg/30 hover:bg-bg-elevated/80"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-subtle sm:text-[11px]">{label}</p>
      <p
        className={cn(
          "mt-2 break-words font-display text-2xl tabular-nums tracking-tight text-fg",
          tone === "ok" && "text-ok",
          tone === "warn" && "text-warn",
          tone === "danger" && "text-danger",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-2 break-words text-xs leading-5 text-muted">{hint}</p> : <p className="mt-2 text-xs leading-5 text-muted">Hover for why this matters and how it is derived.</p>}
    </div>
  );
}

export function Panel({
  title,
  kicker,
  children,
  className,
}: {
  title: string;
  kicker?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-bg-elevated p-5", className)}>
      {kicker ? (
        <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">{kicker}</p>
      ) : null}
      <h2 className="font-display text-xl text-fg">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
