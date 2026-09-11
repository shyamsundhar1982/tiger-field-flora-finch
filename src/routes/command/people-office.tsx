import { createFileRoute, Link } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/kpi";
import { listPeopleOfficeAuthority } from "@/lib/people-office-authority";

type Row = Record<string, unknown>;
const text = (row: Row, ...keys: string[]) => {
  for (const key of keys) if (row[key] != null) return String(row[key]);
  return "";
};
const num = (row: Row, ...keys: string[]) => {
  for (const key of keys) if (row[key] != null) return Number(row[key]) || 0;
  return 0;
};
const money = (value: number) => `₹${value.toFixed(2)}L`;

export const Route = createFileRoute("/command/people-office")({
  loader: () => listPeopleOfficeAuthority(),
  component: PeopleOffice,
});

function PeopleOffice() {
  const data = Route.useLoaderData();
  const people = data.people as Row[];
  const costs = data.costs as Row[];
  const assets = data.assets as Row[];
  const financeFeed = data.financeFeed as Row[];
  const approvedCosts = costs.filter(
    (row) => text(row, "lifecycle_status", "lifecycleStatus") === "approved",
  );
  const approvedAssets = assets.filter(
    (row) => text(row, "lifecycle_status", "lifecycleStatus") === "approved",
  );
  const feedOpex = financeFeed.reduce(
    (sum, row) => sum + num(row, "operating_expense_lakh", "operatingExpenseLakh"),
    0,
  );

  return (
    <div className="space-y-6">
      <header className="border-b border-border pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">
          People & Office · operating administration · canonical authority
        </p>
        <h1 className="mt-1 font-display text-4xl text-accent">People & Office</h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">
          People, operating costs and office assets are read from their governed source records.
          Finance consumes the approved cost model downstream; this page no longer uses separate
          browser-only finance ledgers as source authority.
        </p>
        <div className="mt-3 flex gap-3 text-sm font-semibold">
          <Link to="/command/financial-cockpit" className="text-accent">
            Downstream Finance →
          </Link>
          <Link to="/command/governance" className="text-accent">
            Governance →
          </Link>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi label="People records" value={String(people.length)} hint="Lifecycle-controlled" />
        <Kpi
          label="Approved cost items"
          value={String(approvedCosts.length)}
          hint={`${costs.length} total`}
        />
        <Kpi
          label="Approved assets"
          value={String(approvedAssets.length)}
          hint={`${assets.length} total`}
        />
        <Kpi
          label="Approved 36M feed"
          value={money(feedOpex)}
          hint="Finance-consumable OPEX"
          tone={financeFeed.length ? "ok" : "warn"}
        />
      </div>

      <Panel
        title="Operating administration registers"
        kicker="Collapsed by default · expand only the register you need"
      >
        <div className="space-y-3">
          <details className="rounded-xl border border-border p-3">
            <summary className="cursor-pointer font-semibold text-accent">
              People Register ({people.length})
            </summary>
            <p className="mt-2 text-xs text-muted">
              Identity · function · role · engagement lifecycle
            </p>
            {people.length ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full table-auto text-left text-xs">
                  <thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle">
                    <tr>
                      <th className="px-2 py-2">Person / role</th>
                      <th className="px-2 py-2">Function</th>
                      <th className="px-2 py-2">Engagement</th>
                      <th className="px-2 py-2">Timing</th>
                      <th className="px-2 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {people.map((row) => (
                      <tr key={text(row, "id")} className="border-t border-border/70">
                        <td className="px-2 py-2">
                          <p className="font-semibold">
                            {text(row, "display_name", "displayName")}
                          </p>
                          <p className="text-[10px] text-muted">
                            {text(row, "role_title", "roleTitle")}
                          </p>
                        </td>
                        <td className="px-2 py-2">{text(row, "function_name", "functionName")}</td>
                        <td className="px-2 py-2">
                          {text(row, "engagement_type", "engagementType")}
                        </td>
                        <td className="px-2 py-2 text-muted">
                          M{text(row, "start_month", "startMonth") || "—"} → M
                          {text(row, "end_month", "endMonth") || "—"}
                        </td>
                        <td className="px-2 py-2 font-semibold uppercase">
                          {text(row, "lifecycle_status", "lifecycleStatus")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">No People record has been created yet.</p>
            )}
          </details>

          <details className="rounded-xl border border-border p-3">
            <summary className="cursor-pointer font-semibold text-accent">
              Office Assets Register ({assets.length})
            </summary>
            <p className="mt-2 text-xs text-muted">
              Physical office / admin assets. Cost shows 0 until a value is recorded — the row
              itself stays registered.
            </p>
            {assets.length ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full table-auto text-left text-xs">
                  <thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle">
                    <tr>
                      <th className="px-2 py-2">Asset</th>
                      <th className="px-2 py-2">Category</th>
                      <th className="px-2 py-2">Class</th>
                      <th className="px-2 py-2 text-right">Cost</th>
                      <th className="px-2 py-2 text-right">Monthly cost</th>
                      <th className="px-2 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((row) => (
                      <tr key={text(row, "id")} className="border-t border-border/70">
                        <td className="px-2 py-2 font-semibold">{text(row, "name")}</td>
                        <td className="px-2 py-2">{text(row, "category")}</td>
                        <td className="px-2 py-2 text-muted">
                          {text(row, "asset_class", "assetClass")}
                        </td>
                        <td className="px-2 py-2 text-right">
                          {money(num(row, "cost_lakh", "costLakh"))}
                        </td>
                        <td className="px-2 py-2 text-right">
                          {money(num(row, "monthly_cost_lakh", "monthlyCostLakh"))}
                        </td>
                        <td className="px-2 py-2 font-semibold uppercase">
                          {text(row, "lifecycle_status", "lifecycleStatus")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">No Office asset has been recorded.</p>
            )}
          </details>

          <details className="rounded-xl border border-border p-3">
            <summary className="cursor-pointer font-semibold text-accent">
              People & Office Cost Register ({costs.length})
            </summary>
            <p className="mt-2 text-xs text-muted">Approved source records feed Finance.</p>
            {costs.length ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full table-auto text-left text-xs">
                  <thead className="border-b border-border text-[10px] uppercase tracking-wider text-subtle">
                    <tr>
                      <th className="px-2 py-2">Item</th>
                      <th className="px-2 py-2">Group</th>
                      <th className="px-2 py-2">Stage</th>
                      <th className="px-2 py-2 text-right">Qty</th>
                      <th className="px-2 py-2 text-right">Monthly / unit</th>
                      <th className="px-2 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costs.map((row) => (
                      <tr key={text(row, "id")} className="border-t border-border/70">
                        <td className="px-2 py-2 font-semibold">{text(row, "name")}</td>
                        <td className="px-2 py-2">{text(row, "cost_group", "costGroup")}</td>
                        <td className="px-2 py-2 text-muted">{text(row, "stage")}</td>
                        <td className="px-2 py-2 text-right">{num(row, "quantity")}</td>
                        <td className="px-2 py-2 text-right">
                          {money(num(row, "monthly_unit_cost_lakh", "monthlyUnitCostLakh"))}
                        </td>
                        <td className="px-2 py-2 font-semibold uppercase">
                          {text(row, "lifecycle_status", "lifecycleStatus")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">
                No People & Office cost item has been recorded.
              </p>
            )}
          </details>

          <details className="rounded-xl border border-border p-3">
            <summary className="cursor-pointer font-semibold text-accent">
              Approved Finance Feed ({financeFeed.length})
            </summary>
            <p className="mt-2 text-xs text-muted">
              Read-only downstream consumption; only approved People & Office source records appear
              here.
            </p>
            {financeFeed.length ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {financeFeed.map((row) => (
                  <div
                    key={text(row, "plan_month", "planMonth")}
                    className="rounded-lg border border-border p-3"
                  >
                    <p className="text-xs font-semibold text-accent">
                      M{text(row, "plan_month", "planMonth")}
                    </p>
                    <p className="mt-2 text-sm">
                      OPEX {money(num(row, "operating_expense_lakh", "operatingExpenseLakh"))}
                    </p>
                    <p className="text-xs text-muted">
                      CAPEX {money(num(row, "office_capex_lakh", "officeCapexLakh"))}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">
                No approved source record currently feeds Finance.
              </p>
            )}
          </details>
        </div>
      </Panel>

      <p className="text-xs text-muted">
        Canonical authority: <code>vyndi_people_records</code>,{" "}
        <code>vyndi_people_office_cost_items</code>, <code>vyndi_people_office_assets</code> and{" "}
        <code>vyndi_people_office_finance_feed</code>.
      </p>
    </div>
  );
}
