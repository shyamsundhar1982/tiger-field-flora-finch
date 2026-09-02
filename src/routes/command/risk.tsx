import { createFileRoute } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";
import { DILUTION } from "@/lib/data/legal";
import { SCENARIOS } from "@/lib/finance/model";
import { lakh, pct } from "@/lib/format";

export const Route = createFileRoute("/command/risk")({ component: Risk });

const RISKS = [
  { risk: "Grant delay 3–6 months", like: "High", impact: "High", mit: "Standby CN ₹25–40 L, cap ₹5 Cr" },
  { risk: "OEM quality / schedule", like: "Med", impact: "High", mit: "Dual qualify + factory visit + QC gates" },
  { risk: "ISO first-pass fail", like: "Med", impact: "High", mit: "FEA first, ₹2 L retest, tooling only after pass" },
  { risk: "IP leakage to OEM", like: "Med", impact: "High", mit: "Provisional at M3, staged CAD, tooling ownership" },
  { risk: "Early cheap equity", like: "Med", impact: "High", mit: "Grants + CN until ₹85 L / ISO" },
  { risk: "M10–M11 cash gap", like: "High", impact: "High", mit: "T4 at M10 + standby drawn if needed" },
  { risk: "Founder incapacity", like: "Low", impact: "High", mit: "Key-person insurance quotes in M1" },
  { risk: "HS / customs miss", like: "Med", impact: "Med", mit: "CHA + CA confirm before price list" },
  { risk: "Product liability", like: "Low", impact: "High", mit: "Bind insurance before first delivery" },
  { risk: "BIS (if ever e-bike)", like: "Low", impact: "High", mit: "Mechanical bikes likely out of scope — verify" },
] as const;

function Risk() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Schedule 8</p>
        <h1 className="font-display text-4xl">Risk & dilution</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(SCENARIOS) as Array<keyof typeof SCENARIOS>).map((id) => {
          const s = SCENARIOS[id];
          return (
            <Kpi
              key={id}
              label={`${s.label} · ${s.probability}`}
              value={s.extra ? `+${lakh(s.extra, 0)}` : "₹2.00 Cr"}
              hint={s.note}
              tone={id === "stress" ? "danger" : id === "delayed" ? "warn" : "ok"}
            />
          );
        })}
      </div>

      <Panel title="Register">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-subtle">
              <tr>
                <th className="py-2 font-medium">Risk</th>
                <th className="py-2 font-medium">L</th>
                <th className="py-2 font-medium">I</th>
                <th className="py-2 font-medium">Mitigation</th>
              </tr>
            </thead>
            <tbody>
              {RISKS.map((r) => (
                <tr key={r.risk} className="border-t border-border">
                  <td className="py-2">{r.risk}</td>
                  <td className="py-2 text-muted">{r.like}</td>
                  <td className="py-2 text-muted">{r.impact}</td>
                  <td className="py-2 text-muted">{r.mit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Cap table — target path" kicker="ESOP 10% created at incorporation">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-subtle">
              <tr>
                {["Round", "₹ L", "Pre", "Founder", "ESOP", "Investor", "Note"].map((h) => (
                  <th key={h} className="py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DILUTION.map((d) => (
                <tr key={d.round} className="border-t border-border">
                  <td className="py-2">{d.round}</td>
                  <td className="py-2 tabular-nums">{d.capital}</td>
                  <td className="py-2 tabular-nums">{d.pre ? lakh(d.pre, 0) : "—"}</td>
                  <td className="py-2 tabular-nums">{pct(d.founder, 1)}</td>
                  <td className="py-2 tabular-nums">{pct(d.esop, 1)}</td>
                  <td className="py-2 tabular-nums">{pct(d.investor, 1)}</td>
                  <td className="py-2 text-muted">{d.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted">
          Convertible notes: valuation cap ₹5 Cr, 20% discount. Refuse a priced ₹3 Cr pre-seed if ISO has
          already passed.
        </p>
      </Panel>
    </div>
  );
}
