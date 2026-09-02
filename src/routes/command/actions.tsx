import { createFileRoute } from "@tanstack/react-router";
import { ACTIONS, type Action } from "@/lib/data/actions";
import { useVeloxis } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/command/actions")({ component: ActionsPage });

const WINDOWS: Array<Action["window"]> = ["2w", "M1-M3", "M4-M8", "M9-M24"];
const LABELS: Record<Action["window"], string> = {
  "2w": "First two weeks",
  "M1-M3": "Foundation",
  "M4-M8": "Engineering",
  "M9-M24": "Launch",
};

function ActionsPage() {
  const state = useVeloxis((s) => s.actions);
  const setAction = useVeloxis((s) => s.setAction);
  const done = ACTIONS.filter((a) => state[a.id] === "done").length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Execution log</p>
        <h1 className="font-display text-4xl">Actions</h1>
        <p className="mt-2 text-sm text-muted">
          {done} / {ACTIONS.length} complete. Status is saved on this device. Verification column stops a
          planning assumption becoming a CA instruction.
        </p>
      </div>

      {WINDOWS.map((w) => (
        <section key={w}>
          <h2 className="font-display text-2xl">{LABELS[w]}</h2>
          <ul className="mt-3 space-y-2">
            {ACTIONS.filter((a) => a.window === w).map((a) => {
              const st = state[a.id] ?? "open";
              return (
                <li
                  key={a.id}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-bg-elevated p-4 sm:flex-row sm:items-start"
                >
                  <div className="flex-1">
                    <p className={cn("text-sm", st === "done" && "text-muted line-through")}>{a.title}</p>
                    <p className="mt-1 text-xs text-muted">{a.why}</p>
                    <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-subtle">
                      {a.owner} · {a.verify}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {(["open", "doing", "done"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setAction(a.id, s)}
                        className={cn(
                          "h-9 rounded-md px-3 text-xs capitalize",
                          st === s ? "bg-accent text-accent-fg" : "bg-surface text-muted",
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
