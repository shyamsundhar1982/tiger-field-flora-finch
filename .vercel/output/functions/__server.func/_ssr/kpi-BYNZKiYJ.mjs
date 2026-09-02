import { t as cn } from "./utils-C_uf36nf.mjs";
import { R as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/kpi-BYNZKiYJ.js
var import_jsx_runtime = require_jsx_runtime();
function Kpi({ label, value, hint, tone = "default" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg bg-bg-elevated p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[10px] uppercase tracking-[0.16em] text-subtle sm:text-[11px]",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: cn("mt-2 font-display text-2xl tabular-nums tracking-tight", tone === "ok" && "text-ok", tone === "warn" && "text-warn", tone === "danger" && "text-danger"),
				children: value
			}),
			hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-muted",
				children: hint
			}) : null
		]
	});
}
function Panel({ title, kicker, children, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: cn("rounded-xl bg-bg-elevated p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]", className),
		children: [
			kicker ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[11px] uppercase tracking-[0.16em] text-subtle",
				children: kicker
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-display text-xl text-fg",
				children: title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4",
				children
			})
		]
	});
}
//#endregion
export { Panel as n, Kpi as t };
