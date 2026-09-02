import { R as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as Panel } from "./kpi-BYNZKiYJ.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ops-BzDrbmxz.js
var import_jsx_runtime = require_jsx_runtime();
var OEM_CRITERIA = [
	"Carbon frame OEM with ISO 4210 experience and export history to EU/US",
	"Willingness to accept buyer-owned tooling (serial-tagged, retrieval in 30 days)",
	"No sub-contracting of layup without written approval",
	"NDA executed before any geometry or layup file is sent",
	"Indicative quote + MOQ + 50/50 deposit terms disclosed up front",
	"Factory visit slot within 60 days of shortlist",
	"Statistical QC — Cp/Cpk on critical dimensions, not sample-only",
	"English-speaking PM and weekly photo/video layup reports"
];
var CONTRACT_CLAUSES = [
	{
		id: "1",
		title: "Tooling ownership",
		body: "Moulds, jigs, masters are VéLOXIS property. Serial tagged. Location disclosed. Retrieval within 30 days of notice, freight on OEM if breach."
	},
	{
		id: "2",
		title: "IP non-use",
		body: "No use of geometry, layup, or photos for any other customer. Employee NDAs. Photographic evidence control."
	},
	{
		id: "3",
		title: "Staged file release",
		body: "NDA → RFQ (envelope + stack) → CAD after provisional filing. Never reverse."
	},
	{
		id: "4",
		title: "Payment",
		body: "50% on PO (deposit — budgeted M8 ₹2 L shifted from inventory), 50% before bill of lading."
	},
	{
		id: "5",
		title: "Lead times",
		body: "Prototype 6–8 weeks. Production 10–14 weeks after tool buy-off."
	},
	{
		id: "6",
		title: "Incoterms",
		body: "FOB Taiwan/Vietnam preferred. CHA and IEC in company name."
	},
	{
		id: "7",
		title: "Defect / rejection",
		body: "AQL plan. Scrap at OEM cost if process-caused. Rework window 14 days."
	},
	{
		id: "8",
		title: "Warranty back-to-back",
		body: "Structural defects 36 months OEM → company. Crash damage excluded."
	},
	{
		id: "9",
		title: "No sub-contract",
		body: "Mandatory approval. Spillover liability remains with contracted OEM."
	},
	{
		id: "10",
		title: "Tool retrieval",
		body: "On termination, tools ship to Coimbatore or nominated India store within 30 days."
	}
];
var QC_GATES = [
	"IQC — carbon, resin, core, hardware certificates",
	"Ply book / laser projection vs released ply book",
	"Prepreg out-time log",
	"Layup photo at every ply for first 20 frames",
	"Cure cycle chart (temp/pressure) archived per serial",
	"Demould dimensional CMM on criticals (Cp/Cpk ≥ 1.33)",
	"NDT (tap / ultrasonic sample)",
	"Finish / paint / clear thickness",
	"Assembly torque map",
	"Final rolling test + serial + QR",
	"Customer release — only after IQC + OQC dual sign"
];
var GANTT = [
	{
		id: "inc",
		label: "Incorporate + banking",
		start: 1,
		end: 1,
		dep: "—"
	},
	{
		id: "dpiit",
		label: "DPIIT Deep Tech + StartupTN",
		start: 1,
		end: 2,
		dep: "inc"
	},
	{
		id: "psg",
		label: "PSG-STEP / PRAYAS application",
		start: 1,
		end: 3,
		dep: "inc"
	},
	{
		id: "cad",
		label: "CAD geometry lock",
		start: 2,
		end: 3,
		dep: "inc"
	},
	{
		id: "pat",
		label: "Provisional patents + designs",
		start: 3,
		end: 3,
		dep: "cad"
	},
	{
		id: "fea",
		label: "FEA + Para 58 minute",
		start: 3,
		end: 4,
		dep: "cad"
	},
	{
		id: "nda",
		label: "OEM NDA + RFQ",
		start: 4,
		end: 5,
		dep: "pat"
	},
	{
		id: "proto",
		label: "Prototype articles",
		start: 5,
		end: 6,
		dep: "fea"
	},
	{
		id: "bench",
		label: "In-house NDT overlap",
		start: 6,
		end: 6,
		dep: "proto"
	},
	{
		id: "iso",
		label: "ISO 4210 lab (6–8 wks)",
		start: 7,
		end: 9,
		dep: "proto"
	},
	{
		id: "freeze",
		label: "Design freeze (go/no-go)",
		start: 9,
		end: 9,
		dep: "iso"
	},
	{
		id: "tool",
		label: "Production tooling",
		start: 10,
		end: 12,
		dep: "freeze"
	},
	{
		id: "pilot",
		label: "Pilot batch + QC",
		start: 11,
		end: 13,
		dep: "tool"
	},
	{
		id: "launch",
		label: "Commercial launch",
		start: 12,
		end: 13,
		dep: "pilot"
	},
	{
		id: "hun",
		label: "First 100 (staggered)",
		start: 13,
		end: 18,
		dep: "launch"
	}
];
function Ops() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[11px] uppercase tracking-[0.2em] text-subtle",
					children: "Schedule 4 + Gantt"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-4xl",
					children: "Manufacturing"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 max-w-2xl text-sm text-muted",
					children: "Taiwan / Vietnam for frames. India for assembly, brand, and service. No CAD leaves the house until NDA + M3 provisional filing."
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, {
				title: "24-month critical path",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "space-y-2",
					children: GANTT.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-[7rem_1fr] items-center gap-3 text-sm sm:grid-cols-[11rem_1fr_4rem]",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "truncate text-muted",
								children: g.label
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "relative h-7 rounded-md bg-surface",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "absolute inset-y-1 rounded-sm bg-accent/80",
									style: {
										left: `${(g.start - 1) / 24 * 100}%`,
										width: `${(g.end - g.start + 1) / 24 * 100}%`
									}
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "hidden tabular-nums text-xs text-subtle sm:block",
								children: [
									"M",
									g.start,
									"–",
									g.end
								]
							})
						]
					}, g.id))
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-[11px] uppercase tracking-[0.16em] text-subtle",
					children: "M1 — M24"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-4 lg:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
					title: "OEM qualification",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
						className: "list-decimal space-y-2 pl-4 text-sm text-muted",
						children: OEM_CRITERIA.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: c }, c))
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
					title: "QC gates",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
						className: "list-decimal space-y-2 pl-4 text-sm text-muted",
						children: QC_GATES.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: c }, c))
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
				title: "Ten non-negotiable clauses",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-3 md:grid-cols-2",
					children: CONTRACT_CLAUSES.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-md bg-surface p-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-sm text-accent",
							children: [
								c.id,
								". ",
								c.title
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-sm text-muted",
							children: c.body
						})]
					}, c.id))
				})
			})
		]
	});
}
//#endregion
export { Ops as component };
