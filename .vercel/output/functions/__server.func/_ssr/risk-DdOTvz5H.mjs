import { R as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as Panel, t as Kpi } from "./kpi-BYNZKiYJ.mjs";
import { n as SCENARIOS } from "./model-C7zrYnKC.mjs";
import { n as lakh, r as pct } from "./format-DTEUCl60.mjs";
import { n as DILUTION } from "./legal-Dk0ljmR5.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/risk-DdOTvz5H.js
var import_jsx_runtime = require_jsx_runtime();
var RISKS = [
	{
		risk: "Grant delay 3–6 months",
		like: "High",
		impact: "High",
		mit: "Standby CN ₹25–40 L, cap ₹5 Cr"
	},
	{
		risk: "OEM quality / schedule",
		like: "Med",
		impact: "High",
		mit: "Dual qualify + factory visit + QC gates"
	},
	{
		risk: "ISO first-pass fail",
		like: "Med",
		impact: "High",
		mit: "FEA first, ₹2 L retest, tooling only after pass"
	},
	{
		risk: "IP leakage to OEM",
		like: "Med",
		impact: "High",
		mit: "Provisional at M3, staged CAD, tooling ownership"
	},
	{
		risk: "Early cheap equity",
		like: "Med",
		impact: "High",
		mit: "Grants + CN until ₹85 L / ISO"
	},
	{
		risk: "M10–M11 cash gap",
		like: "High",
		impact: "High",
		mit: "T4 at M10 + standby drawn if needed"
	},
	{
		risk: "Founder incapacity",
		like: "Low",
		impact: "High",
		mit: "Key-person insurance quotes in M1"
	},
	{
		risk: "HS / customs miss",
		like: "Med",
		impact: "Med",
		mit: "CHA + CA confirm before price list"
	},
	{
		risk: "Product liability",
		like: "Low",
		impact: "High",
		mit: "Bind insurance before first delivery"
	},
	{
		risk: "BIS (if ever e-bike)",
		like: "Low",
		impact: "High",
		mit: "Mechanical bikes likely out of scope — verify"
	}
];
function Risk() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[11px] uppercase tracking-[0.2em] text-subtle",
				children: "Schedule 8"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-4xl",
				children: "Risk & dilution"
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-3 sm:grid-cols-3",
				children: Object.keys(SCENARIOS).map((id) => {
					const s = SCENARIOS[id];
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: `${s.label} · ${s.probability}`,
						value: s.extra ? `+${lakh(s.extra, 0)}` : "₹2.00 Cr",
						hint: s.note,
						tone: id === "stress" ? "danger" : id === "delayed" ? "warn" : "ok"
					}, id);
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
				title: "Register",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "overflow-x-auto",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "w-full min-w-[44rem] text-left text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
							className: "text-[11px] uppercase tracking-[0.14em] text-subtle",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 font-medium",
									children: "Risk"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 font-medium",
									children: "L"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 font-medium",
									children: "I"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 font-medium",
									children: "Mitigation"
								})
							] })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: RISKS.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-t border-border",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2",
									children: r.risk
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 text-muted",
									children: r.like
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 text-muted",
									children: r.impact
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 text-muted",
									children: r.mit
								})
							]
						}, r.risk)) })]
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, {
				title: "Cap table — target path",
				kicker: "ESOP 10% created at incorporation",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "overflow-x-auto",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "w-full min-w-[44rem] text-left text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
							className: "text-[11px] uppercase tracking-[0.14em] text-subtle",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: [
								"Round",
								"₹ L",
								"Pre",
								"Founder",
								"ESOP",
								"Investor",
								"Note"
							].map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-2 font-medium",
								children: h
							}, h)) })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: DILUTION.map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-t border-border",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2",
									children: d.round
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 tabular-nums",
									children: d.capital
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 tabular-nums",
									children: d.pre ? lakh(d.pre, 0) : "—"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 tabular-nums",
									children: pct(d.founder, 1)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 tabular-nums",
									children: pct(d.esop, 1)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 tabular-nums",
									children: pct(d.investor, 1)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 text-muted",
									children: d.note
								})
							]
						}, d.round)) })]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-sm text-muted",
					children: "Convertible notes: valuation cap ₹5 Cr, 20% discount. Refuse a priced ₹3 Cr pre-seed if ISO has already passed."
				})]
			})
		]
	});
}
//#endregion
export { Risk as component };
