import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { n as useVeloxis } from "./store-BsqAv0nA.mjs";
import { R as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as Panel, t as Kpi } from "./kpi-BYNZKiYJ.mjs";
import { a as totals, i as minCash, n as SCENARIOS, r as buildModel, t as GM } from "./model-C7zrYnKC.mjs";
import { n as lakh, r as pct } from "./format-DTEUCl60.mjs";
import { r as TRANCHES } from "./company-BH866iCc.mjs";
import { c as ResponsiveContainer, i as XAxis, l as Tooltip, n as BarChart, o as CartesianGrid, r as YAxis, s as Bar, u as Legend } from "../_libs/recharts+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/finance-C2T18d3A.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Finance() {
	const scenario = useVeloxis((s) => s.scenario);
	const setScenario = useVeloxis((s) => s.setScenario);
	const drawStandby = useVeloxis((s) => s.drawStandby);
	const setDrawStandby = useVeloxis((s) => s.setDrawStandby);
	const rows = (0, import_react.useMemo)(() => buildModel(scenario, drawStandby), [scenario, drawStandby]);
	const t = totals(rows);
	const trough = minCash(rows);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[11px] uppercase tracking-[0.2em] text-subtle",
				children: "Schedule 1 + 2 + 8"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-4xl",
				children: "Finance"
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [Object.keys(SCENARIOS).map((id) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => setScenario(id),
					className: `h-10 rounded-md px-4 text-sm ${scenario === id ? "bg-accent text-accent-fg" : "bg-surface text-muted"}`,
					children: [
						SCENARIOS[id].label,
						" · ",
						SCENARIOS[id].probability
					]
				}, id)), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => setDrawStandby(!drawStandby),
					className: `h-10 rounded-md px-4 text-sm ${drawStandby ? "bg-ok text-accent-fg" : "bg-surface text-muted"}`,
					children: ["Standby CN ", drawStandby ? "on" : "off"]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: SCENARIOS[scenario].note
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Gross margin",
						value: pct(GM, 1),
						hint: "Blended ASP ₹1.80 L"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Break-even",
						value: `19 u/mo`,
						hint: `Scale phase 29 after M14 opex`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Cash trough",
						value: lakh(trough.cash),
						hint: `M${trough.m}`,
						tone: trough.cash < 8 ? "danger" : "ok"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "24-mo EBITDA",
						value: lakh(t.ebitda, 0)
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
				title: "Revenue · COGS · OPEX",
				kicker: "₹ Lakh",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-64",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
						width: "100%",
						height: "100%",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(BarChart, {
							data: rows,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
									stroke: "rgba(236,234,228,0.06)",
									vertical: false
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
									dataKey: "m",
									tickFormatter: (v) => `M${v}`,
									stroke: "#8e8b84",
									fontSize: 11
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
									stroke: "#8e8b84",
									fontSize: 11
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, {
									contentStyle: {
										background: "#131316",
										border: "1px solid #2a2a2e"
									},
									formatter: (v) => lakh(Number(v))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Legend, {}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
									dataKey: "revenue",
									fill: "#8fa38a",
									name: "Revenue"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
									dataKey: "cogs",
									fill: "#6a6760",
									name: "COGS"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
									dataKey: "opex",
									fill: "#c4a574",
									name: "OPEX"
								})
							]
						})
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
				title: "₹2 Cr utilisation",
				kicker: "Line items against T1–T5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "overflow-x-auto",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "w-full min-w-[40rem] text-left text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
							className: "text-[11px] uppercase tracking-[0.14em] text-subtle",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 font-medium",
									children: "Gate"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 font-medium",
									children: "M"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 font-medium",
									children: "₹"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 font-medium",
									children: "Deliverable"
								})
							] })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: TRANCHES.map((tr) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-t border-border",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: "py-2.5",
									children: [
										tr.id,
										" ",
										tr.name
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: "py-2.5 tabular-nums",
									children: ["M", tr.month]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2.5 tabular-nums",
									children: lakh(tr.amount, 0)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2.5 text-muted",
									children: tr.deliverable
								})
							]
						}, tr.id)) })]
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
				title: "Monthly P&L + cash",
				kicker: "All figures ₹ L",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "overflow-x-auto",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "w-full min-w-[52rem] text-left text-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
							className: "text-[10px] uppercase tracking-[0.12em] text-subtle",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: [
								"M",
								"U",
								"Rev",
								"COGS",
								"GP",
								"OPEX",
								"EBITDA",
								"Capex",
								"Fund",
								"Cash"
							].map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-2 font-medium",
								children: h
							}, h)) })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: rows.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-t border-border tabular-nums",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-1.5",
									children: r.m
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-1.5",
									children: r.units
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-1.5",
									children: r.revenue.toFixed(1)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-1.5",
									children: r.cogs.toFixed(1)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-1.5",
									children: r.gp.toFixed(1)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-1.5",
									children: r.opex.toFixed(1)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: r.ebitda < 0 ? "py-1.5 text-danger" : "py-1.5 text-ok",
									children: r.ebitda.toFixed(1)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-1.5",
									children: r.capex.toFixed(1)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-1.5",
									children: r.funding ? r.funding.toFixed(0) : "—"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: r.closing < 8 ? "py-1.5 text-warn" : "py-1.5",
									children: r.closing.toFixed(1)
								})
							]
						}, r.m)) })]
					})
				})
			})
		]
	});
}
//#endregion
export { Finance as component };
