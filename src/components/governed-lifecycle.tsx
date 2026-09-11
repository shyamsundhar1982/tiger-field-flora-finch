import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type LifecycleTone = "neutral" | "info" | "warn" | "danger" | "ok";

export type LifecycleAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "primary" | "neutral" | "danger" | "ok";
};

const statusToneClass: Record<LifecycleTone, string> = {
  neutral: "border-border text-muted bg-surface/50",
  info: "border-accent/40 text-accent bg-accent/5",
  warn: "border-warn/40 text-warn bg-warn/5",
  danger: "border-danger/40 text-danger bg-danger/5",
  ok: "border-ok/40 text-ok bg-ok/5",
};

const actionToneClass = {
  primary: "border-accent bg-accent text-bg hover:opacity-90",
  neutral: "border-border text-fg hover:border-accent hover:text-accent",
  danger: "border-danger/40 text-danger hover:bg-danger/5",
  ok: "border-ok/40 text-ok hover:bg-ok/5",
} as const;

export function GovernedLifecycle({
  label = "Lifecycle",
  status,
  tone = "neutral",
  hint,
  actions = [],
  children,
}: {
  label?: string;
  status: string;
  tone?: LifecycleTone;
  hint?: string;
  actions?: LifecycleAction[];
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-elevated/20 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-subtle">{label}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                statusToneClass[tone],
              )}
            >
              {status}
            </span>
            {hint ? <span className="text-xs text-muted">{hint}</span> : null}
          </div>
          {children ? <div className="mt-2 text-xs leading-5 text-muted">{children}</div> : null}
        </div>
        {actions.length ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                disabled={action.disabled}
                onClick={action.onClick}
                className={cn(
                  "inline-flex min-h-10 items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40",
                  actionToneClass[action.tone ?? "neutral"],
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
