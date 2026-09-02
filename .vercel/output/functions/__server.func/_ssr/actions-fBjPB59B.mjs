import { n as useVeloxis, t as ACTIONS } from "./store-BsqAv0nA.mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { R as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/actions-fBjPB59B.js
var import_jsx_runtime = require_jsx_runtime();
var WINDOWS = [
	"2w",
	"M1-M3",
	"M4-M8",
	"M9-M24"
];
var LABELS = {
	"2w": "First two weeks",
	"M1-M3": "Foundation",
	"M4-M8": "Engineering",
	"M9-M24": "Launch"
};
function ActionsPage() {
	const state = useVeloxis((s) => s.actions);
	const setAction = useVeloxis((s) => s.setAction);
	const done = ACTIONS.filter((a) => state[a.id] === "done").length;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[11px] uppercase tracking-[0.2em] text-subtle",
				children: "Execution log"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-4xl",
				children: "Actions"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-2 text-sm text-muted",
				children: [
					done,
					" / ",
					ACTIONS.length,
					" complete. Status is saved on this device. Verification column stops a planning assumption becoming a CA instruction."
				]
			})
		] }), WINDOWS.map((w) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "font-display text-2xl",
			children: LABELS[w]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-3 space-y-2",
			children: ACTIONS.filter((a) => a.window === w).map((a) => {
				const st = state[a.id] ?? "open";
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex flex-col gap-3 rounded-lg bg-bg-elevated p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] sm:flex-row sm:items-start",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: cn("text-sm", st === "done" && "text-muted line-through"),
								children: a.title
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-muted",
								children: a.why
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-2 text-[11px] uppercase tracking-[0.14em] text-subtle",
								children: [
									a.owner,
									" · ",
									a.verify
								]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex gap-1",
						children: [
							"open",
							"doing",
							"done"
						].map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setAction(a.id, s),
							className: cn("h-9 rounded-md px-3 text-xs capitalize", st === s ? "bg-accent text-accent-fg" : "bg-surface text-muted"),
							children: s
						}, s))
					})]
				}, a.id);
			})
		})] }, w))]
	});
}
//#endregion
export { ActionsPage as component };
