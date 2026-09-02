import { t as cn } from "./utils-C_uf36nf.mjs";
import { R as require_jsx_runtime, _ as Link, p as Outlet } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as Shield, c as Landmark, d as Activity, i as SquareCheckBig, l as Bike, n as Wallet, o as Scale, r as TriangleAlert } from "../_libs/lucide-react.mjs";
import { n as SiteHeader } from "./site-header-DdBaCZax.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/route-BJ9-VDhu.js
var import_jsx_runtime = require_jsx_runtime();
var NAV = [
	{
		to: "/command",
		label: "Board",
		icon: Activity,
		exact: true
	},
	{
		to: "/command/finance",
		label: "Finance",
		icon: Wallet
	},
	{
		to: "/command/product",
		label: "Product",
		icon: Bike
	},
	{
		to: "/command/ops",
		label: "Ops",
		icon: Landmark
	},
	{
		to: "/command/legal",
		label: "Legal",
		icon: Scale
	},
	{
		to: "/command/gtm",
		label: "GTM",
		icon: Shield
	},
	{
		to: "/command/risk",
		label: "Risk",
		icon: TriangleAlert
	},
	{
		to: "/command/actions",
		label: "Actions",
		icon: SquareCheckBig
	}
];
function CommandShell() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh bg-bg",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteHeader, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex max-w-7xl",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-52 shrink-0 border-r border-border py-6 lg:block",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "px-5 pb-3 text-[10px] uppercase tracking-[0.2em] text-subtle",
					children: "Command"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
					className: "flex flex-col gap-0.5 px-2",
					children: NAV.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: item.to,
						activeOptions: item.exact ? { exact: true } : void 0,
						className: "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted transition-colors duration-150 hover:bg-surface hover:text-fg",
						activeProps: { className: "bg-surface text-fg" },
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(item.icon, { className: "size-4" }), item.label]
					}, item.to))
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex gap-1 overflow-x-auto border-b border-border px-3 py-2 lg:hidden",
					children: NAV.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: item.to,
						activeOptions: item.exact ? { exact: true } : void 0,
						className: cn("shrink-0 rounded-md px-3 py-2 text-xs text-muted"),
						activeProps: { className: "bg-surface text-fg" },
						children: item.label
					}, item.to))
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "px-4 py-6 sm:px-6 lg:px-8",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {})
				})]
			})]
		})]
	});
}
var SplitComponent = CommandShell;
//#endregion
export { SplitComponent as component };
