import { R as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as Panel, t as Kpi } from "./kpi-BYNZKiYJ.mjs";
import { n as lakh, r as pct, t as inr } from "./format-DTEUCl60.mjs";
import { n as TIERS } from "./company-BH866iCc.mjs";
import { a as MIX, n as BLENDED_COGS, o as bomTotal, r as BOM, t as BLENDED_ASP } from "./bom-BiNEi0Sf.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/product-0xnBkNNB.js
var import_jsx_runtime = require_jsx_runtime();
var ISO_TESTS = [
	{
		id: "T01",
		item: "Frame — static strength (ISO 4210-6)",
		samples: "2 frames",
		weeks: "1–2",
		cost: 1.2,
		accept: "No fracture / crack beyond limit at proof load"
	},
	{
		id: "T02",
		item: "Frame — fatigue (pedalling + horizontal)",
		samples: "2 frames",
		weeks: "3–5",
		cost: 2.8,
		accept: "Survive specified cycles without failure"
	},
	{
		id: "T03",
		item: "Frame — impact (falling mass / frame)",
		samples: "1–2 frames",
		weeks: "1",
		cost: .9,
		accept: "Residual strength after impact within spec"
	},
	{
		id: "T04",
		item: "Fork — static + fatigue + impact",
		samples: "2 forks",
		weeks: "2–4",
		cost: 2.1,
		accept: "ISO 4210-6 fork clauses met"
	},
	{
		id: "T05",
		item: "Handlebar / stem assembly",
		samples: "2 assemblies",
		weeks: "1–2",
		cost: .8,
		accept: "No slip, crack, or clamp failure"
	},
	{
		id: "T06",
		item: "Seatpost",
		samples: "2 posts",
		weeks: "1",
		cost: .5,
		accept: "Clamp and fatigue clauses met"
	},
	{
		id: "T07",
		item: "Steering / headset assembly",
		samples: "1 system",
		weeks: "1",
		cost: .4,
		accept: "Steering torque and security"
	},
	{
		id: "T08",
		item: "Braking (system, ISO 4210-4)",
		samples: "1 complete bike",
		weeks: "1",
		cost: .7,
		accept: "Stopping distance / control"
	},
	{
		id: "T09",
		item: "Environmental conditioning",
		samples: "1 frame",
		weeks: "1–2",
		cost: .6,
		accept: "No delamination after heat/humidity"
	},
	{
		id: "T10",
		item: "Retest reserve (20–30% probability)",
		samples: "as needed",
		weeks: "2–4",
		cost: 2,
		accept: "Pass on second article after FEA-guided fix"
	}
];
var ISO_BUDGET = ISO_TESTS.reduce((s, t) => s + t.cost, 0);
var ISO_GATES = [
	"FEA closed — no red stress hotspots at ISO loads (M4)",
	"Non-destructive bench overlap during M6 prototype build",
	"Lab slot booked 4 weeks before articles are ready",
	"Articles submitted M7 — results expected M8–M9",
	"Design freeze only on pass. Tooling (T4) releases at M10, not M9."
];
var LABS = [
	{
		name: "ARAI, Pune",
		fit: "Primary India option — confirm ISO 4210 bicycle capability this week"
	},
	{
		name: "ICAT, Manesar",
		fit: "Parallel quote — lead time and fixture availability"
	},
	{
		name: "International (TW / EU)",
		fit: "Backup if India slots are full. Budget freight + 2 weeks"
	}
];
function Product() {
	const gm = (BLENDED_ASP - BLENDED_COGS) / BLENDED_ASP * 100;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[11px] uppercase tracking-[0.2em] text-subtle",
				children: "Schedules 3 + 5"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-4xl",
				children: "Product & ISO 4210"
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 sm:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Blended ASP",
						value: inr(BLENDED_ASP),
						hint: `Mix ${MIX.core * 100}/${MIX.pro * 100}/${MIX.apex * 100}`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Blended COGS",
						value: inr(Math.round(BLENDED_COGS)),
						hint: "vs plan ₹1.10 L (+2.2%)"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Gross margin",
						value: pct(gm, 1)
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, {
				title: "BOM bridge",
				kicker: "Indicative India-landed ₹",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "overflow-x-auto",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "w-full min-w-[40rem] text-left text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
							className: "text-[11px] uppercase tracking-[0.14em] text-subtle",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 font-medium",
									children: "Component"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 font-medium",
									children: "Core"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 font-medium",
									children: "Pro"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 font-medium",
									children: "Apex"
								})
							] })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [BOM.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-t border-border",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: "py-2 pr-3",
									children: [
										r.item,
										r.flag === "hs" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "ml-2 text-[10px] uppercase text-warn",
											children: "Confirm HS"
										}) : null,
										r.note ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-xs text-muted",
											children: r.note
										}) : null
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 tabular-nums",
									children: inr(r.core)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 tabular-nums",
									children: inr(r.pro)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 tabular-nums",
									children: inr(r.apex)
								})
							]
						}, r.item)), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-t border-border font-medium",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-3",
									children: "Total"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-3 tabular-nums",
									children: inr(bomTotal("core"))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-3 tabular-nums",
									children: inr(bomTotal("pro"))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-3 tabular-nums",
									children: inr(bomTotal("apex"))
								})
							]
						})] })]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-4 grid gap-3 sm:grid-cols-3 text-sm",
					children: TIERS.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-muted",
						children: [
							t.name,
							" GM ",
							pct((t.asp - bomTotal(t.id)) / t.asp * 100, 1)
						]
					}, t.id))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, {
				title: "ISO 4210 validation",
				kicker: `Budget ${lakh(ISO_BUDGET)} · 6–8 week lab lag`,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "overflow-x-auto",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
							className: "w-full min-w-[44rem] text-left text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
								className: "text-[11px] uppercase tracking-[0.14em] text-subtle",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2 font-medium",
										children: "ID"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2 font-medium",
										children: "Test"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2 font-medium",
										children: "Samples"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2 font-medium",
										children: "Weeks"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2 font-medium",
										children: "₹ L"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2 font-medium",
										children: "Accept"
									})
								] })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: ISO_TESTS.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "border-t border-border",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-2 text-accent",
										children: t.id
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-2",
										children: t.item
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-2 text-muted",
										children: t.samples
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-2 tabular-nums",
										children: t.weeks
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-2 tabular-nums",
										children: t.cost.toFixed(1)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "py-2 text-muted",
										children: t.accept
									})
								]
							}, t.id)) })]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-4 space-y-2 text-sm text-muted",
						children: ISO_GATES.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: ["— ", g] }, g))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-4 grid gap-3 sm:grid-cols-3",
						children: LABS.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-md bg-surface p-3 text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-fg",
								children: l.name
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-muted",
								children: l.fit
							})]
						}, l.name))
					})
				]
			})
		]
	});
}
//#endregion
export { Product as component };
