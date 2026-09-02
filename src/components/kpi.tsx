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
  return (
    <div className="rounded-lg bg-bg-elevated p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
      <p className="text-[10px] uppercase tracking-[0.16em] text-subtle sm:text-[11px]">{label}</p>
      <p
        className={cn(
          "mt-2 font-display text-2xl tabular-nums tracking-tight",
          tone === "ok" && "text-ok",
          tone === "warn" && "text-warn",
          tone === "danger" && "text-danger",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
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
    <section className={cn("rounded-xl bg-bg-elevated p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]", className)}>
      {kicker ? (
        <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">{kicker}</p>
      ) : null}
      <h2 className="font-display text-xl text-fg">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
