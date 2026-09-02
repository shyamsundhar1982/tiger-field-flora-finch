import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { n as useVeloxis, t as ACTIONS } from "./store-BsqAv0nA.mjs";
import { R as require_jsx_runtime, _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as Panel, t as Kpi } from "./kpi-BYNZKiYJ.mjs";
import { a as totals, i as minCash, r as buildModel } from "./model-C7zrYnKC.mjs";
import { n as lakh } from "./format-DTEUCl60.mjs";
import { r as TRANCHES } from "./company-BH866iCc.mjs";
import { a as Area, c as ResponsiveContainer, i as XAxis, l as Tooltip, o as CartesianGrid, r as YAxis, t as AreaChart } from "../_libs/recharts+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/command-bxOGZInD.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Board() {
	const scenario = useVeloxis((s) => s.scenario);
	const drawStandby = useVeloxis((s) => s.drawStandby);
	const actionState = useVeloxis((s) => s.actions);
	const rows = (0, import_react.useMemo)(() => buildModel(scenario, drawStandby), [scenario, drawStandby]);
	const t = totals(rows);
	const trough = minCash(rows);
	const openActions = ACTIONS.filter((a) => a.window === "2w" && actionState[a.id] !== "done");
	const m11 = rows[10];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[11px] uppercase tracking-[0.2em] text-subtle",
					children: "Board pack · M1"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-4xl",
					children: "VéLOXIS command"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 max-w-2xl text-sm text-muted",
					children: "Review findings are now in the live model: T4 tooling at M10, ₹25 L standby CN, 10% ESOP at incorporation, provisional patents at M3, D2C-first."
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "24-mo funding",
						value: lakh(t.funding, 0),
						hint: `${scenario} scenario`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Cash trough",
						value: lakh(trough.cash),
						hint: `M${trough.m}`,
						tone: trough.cash < 8 ? "danger" : trough.cash < 15 ? "warn" : "ok"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "M9–M11 gap",
						value: drawStandby ? "Closed" : "Open",
						hint: drawStandby ? `Standby on · M11 close ${lakh(m11.closing)}` : "Enable standby CN",
						tone: drawStandby ? "ok" : "danger"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Units by M24",
						value: String(t.units),
						hint: `Revenue ${lakh(t.revenue, 0)}`
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
				title: "Cash",
				kicker: "Opening → close, ₹ L",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-56",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
						width: "100%",
						height: "100%",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AreaChart, {
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
										border: "1px solid #2a2a2e",
										borderRadius: 8
									},
									labelFormatter: (v) => `Month ${v}`,
									formatter: (v) => lakh(Number(v))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Area, {
									type: "monotone",
									dataKey: "closing",
									stroke: "#c9c4b8",
									fill: "rgba(201,196,184,0.15)"
								})
							]
						})
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-4 lg:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
					title: "Tranches",
					kicker: "Preserved architecture",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
						className: "space-y-3",
						children: TRANCHES.map((tr) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex gap-3 text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "w-12 shrink-0 tabular-nums text-accent",
								children: tr.id
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-fg",
									children: [
										tr.name,
										" · ",
										lakh(tr.amount, 0),
										" · M",
										tr.month
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "mt-0.5 block text-xs text-muted",
									children: tr.deliverable
								})]
							})]
						}, tr.id))
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, {
					title: "This fortnight",
					kicker: `${openActions.length} open`,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "space-y-3 text-sm",
						children: openActions.slice(0, 6).map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-fg",
							children: a.title
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted",
							children: a.why
						})] }, a.id))
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/command/actions",
						className: "mt-4 inline-block text-sm text-accent hover:text-fg",
						children: "Open action log"
					})]
				})]
			})
		]
	});
}
//#endregion
export { Board as component };
