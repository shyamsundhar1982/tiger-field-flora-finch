import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { R as require_jsx_runtime, _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as Menu, t as X } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/site-header-DdBaCZax.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var LINKS = [
	{
		to: "/",
		label: "House"
	},
	{
		to: "/range",
		label: "Range"
	},
	{
		to: "/command",
		label: "Command"
	}
];
function SiteHeader({ ghost = false }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
		className: cn("sticky top-0 z-40 border-b border-border/80", ghost ? "bg-bg/70 backdrop-blur-md" : "bg-bg"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/",
					className: "flex items-baseline gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-display text-xl tracking-tight text-fg sm:text-2xl",
						children: "VéLOXIS"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "hidden text-[10px] uppercase tracking-[0.22em] text-muted sm:inline",
						children: "Vāyú Shastr"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
					className: "hidden items-center gap-8 md:flex",
					children: LINKS.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: l.to,
						className: "text-sm text-muted transition-colors duration-150 hover:text-fg",
						activeProps: { className: "text-fg" },
						children: l.label
					}, l.to))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "inline-flex size-11 items-center justify-center rounded-md md:hidden",
					"aria-label": open ? "Close menu" : "Open menu",
					onClick: () => setOpen((v) => !v),
					children: open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Menu, { className: "size-5" })
				})
			]
		}), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
			className: "border-t border-border px-4 py-3 md:hidden",
			children: LINKS.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: l.to,
				className: "block py-3 text-base text-fg",
				onClick: () => setOpen(false),
				children: l.label
			}, l.to))
		}) : null]
	});
}
function SiteFooter() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
		className: "border-t border-border",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Vāyú Shastr Pvt. Ltd. · Coimbatore" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Planning figures. Validate with CA/CS before filing." })]
		})
	});
}
//#endregion
export { SiteHeader as n, SiteFooter as t };
