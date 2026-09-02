import { R as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as Panel, t as Kpi } from "./kpi-BYNZKiYJ.mjs";
import { t as inr } from "./format-DTEUCl60.mjs";
import { i as CHANNEL, n as BLENDED_COGS, t as BLENDED_ASP } from "./bom-BiNEi0Sf.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/gtm-mDE7eevd.js
var import_jsx_runtime = require_jsx_runtime();
var FIRST_100 = [
	{
		n: "1–15",
		who: "Founder network + randonneur clubs in TN / KA / MH",
		note: "Product loans, structured 100 km reports."
	},
	{
		n: "16–40",
		who: "25 hero endurance riders — content, not paid posts",
		note: "Honest disclosure. No staged reviews."
	},
	{
		n: "41–70",
		who: "Direct site + waitlist. Stagger builds.",
		note: "Protect service capacity."
	},
	{
		n: "71–100",
		who: "Max 8 selective dealers, 30% channel cap",
		note: "30–32% margin only for first 20 dealers if needed."
	}
];
var LAUNCH = [
	{
		phase: "Pre-launch (M9–M11)",
		items: [
			"Waitlist",
			"Geometry published",
			"ISO badge (if passed)",
			"Hero rider films",
			"PSG-STEP / club rides"
		]
	},
	{
		phase: "Launch (M12–M13)",
		items: [
			"Core + Pro only",
			"Apex as allocation",
			"D2C checkout",
			"Crash-replacement policy live"
		]
	},
	{
		phase: "First 100 (M13–M18)",
		items: [
			"Stagger 4–6 months",
			"Failure log after every 100 km",
			"Iterate cockpit/fit, not geometry"
		]
	}
];
var GRANTS = [
	{
		name: "DPIIT Deep Tech recognition",
		body: "DPIIT",
		quantum: "Status",
		stage: "M1",
		status: "Apply immediately after CoI",
		live: true
	},
	{
		name: "NIDHI-PRAYAS 2.0 (PC / APC)",
		body: "DST",
		quantum: "₹20 L / ₹40 L grant",
		stage: "Prototype",
		status: "Via PSG-STEP if they are a PC/APC",
		live: true
	},
	{
		name: "TANSEED",
		body: "StartupTN",
		quantum: "Up to ₹10 L grant",
		stage: "Early",
		status: "TN entity + incubation",
		live: true
	},
	{
		name: "Vetri Deep-Tech Fund",
		body: "iTNT / TIDCO",
		quantum: "Corpus (equity)",
		stage: "Post-prototype",
		status: "Watch 2026 calls",
		live: true
	},
	{
		name: "CGSS",
		body: "DPIIT / NCGTC",
		quantum: "Collateral-free debt to ₹20 Cr",
		stage: "Tooling",
		status: "After DPIIT. Prefer for moulds.",
		live: true
	},
	{
		name: "TN MSME capital subsidy",
		body: "IC&DIC",
		quantum: "25% up to ₹1.5 Cr",
		stage: "Tooling in TN",
		status: "If any tools land in TN",
		live: true
	},
	{
		name: "SISFS",
		body: "DPIIT",
		quantum: "₹20 L + ₹50 L",
		stage: "—",
		status: "Closed for new applications (31 May 2026)",
		live: false
	},
	{
		name: "MeitY TIDE 2.0",
		body: "MeitY",
		quantum: "₹7–25 L",
		stage: "IoT only",
		status: "Largely concluded. Do not base-case.",
		live: false
	}
];
function Gtm() {
	const gp = BLENDED_ASP - BLENDED_COGS;
	const d2cContrib = gp - CHANNEL.d2cVariable;
	const dealerContrib = gp - BLENDED_ASP * CHANNEL.dealerMargin;
	const d2cNet = d2cContrib - CHANNEL.d2cCac;
	const dealerNet = dealerContrib - CHANNEL.dealerCac;
	const ratio = d2cNet / dealerNet;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[11px] uppercase tracking-[0.2em] text-subtle",
				children: "Schedule 7"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-4xl",
				children: "Go to market"
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "D2C net contribution",
						value: inr(Math.round(d2cNet))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Dealer net contribution",
						value: inr(Math.round(dealerNet))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "D2C advantage",
						value: `${ratio.toFixed(1)}×`,
						hint: "Keep dealers ≤ 30% in year one",
						tone: "ok"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Early mix",
						value: "70 / 30",
						hint: "D2C / dealer"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
				title: "Unit economics after channel cost",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "39% gross margin is not 39% contribution. D2C pays gateway + shipping (₹3,500) and CAC (₹8,000). Dealer pays ~26% margin. First 20 dealers may need 30–32% — still cap the channel."
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-4 lg:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
					title: "First 100",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "space-y-3 text-sm",
						children: FIRST_100.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-accent",
								children: f.n
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: f.who }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted",
								children: f.note
							})
						] }, f.n))
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
					title: "Launch sequence",
					children: LAUNCH.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-fg",
							children: p.phase
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-1 list-disc pl-4 text-sm text-muted",
							children: p.items.map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: i }, i))
						})]
					}, p.phase))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
				title: "Grant pipeline",
				kicker: "SISFS and TIDE are not base-case",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "overflow-x-auto",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "w-full min-w-[40rem] text-left text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
							className: "text-[11px] uppercase tracking-[0.14em] text-subtle",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 font-medium",
									children: "Scheme"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 font-medium",
									children: "Quantum"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 font-medium",
									children: "Status"
								})
							] })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: GRANTS.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-t border-border",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: "py-2",
									children: [g.name, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-muted",
										children: g.body
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2",
									children: g.quantum
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: g.live ? "py-2 text-ok" : "py-2 text-danger",
									children: g.status
								})
							]
						}, g.name)) })]
					})
				})
			})
		]
	});
}
//#endregion
export { Gtm as component };
