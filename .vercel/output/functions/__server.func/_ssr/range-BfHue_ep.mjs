import { R as require_jsx_runtime, _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as pct, t as inr } from "./format-DTEUCl60.mjs";
import { n as TIERS } from "./company-BH866iCc.mjs";
import { n as SiteHeader, t as SiteFooter } from "./site-header-DdBaCZax.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/range-BfHue_ep.js
var import_jsx_runtime = require_jsx_runtime();
function Range() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh bg-bg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteHeader, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
				className: "mx-auto max-w-6xl px-4 py-12 sm:px-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[11px] uppercase tracking-[0.22em] text-subtle",
						children: "Platform"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "mt-2 font-display text-5xl",
						children: "One geometry. Three altitudes."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-4 max-w-xl text-muted",
						children: "Core, Pro and Apex share the same CAD family and ISO 4210 validation path. Mix is 40 / 45 / 15. Blended ASP ₹1.80 L, landed COGS ~₹1.08 L, gross margin ~39%."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-12 grid gap-8 lg:grid-cols-3",
						children: TIERS.map((t) => {
							const gm = (t.asp - t.cogs) / t.asp * 100;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: "/range/$tier",
								params: { tier: t.id },
								className: "group",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
										src: t.image,
										alt: "",
										className: "media aspect-[4/3] w-full rounded-xl object-cover"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-4 text-[11px] uppercase tracking-[0.2em] text-subtle",
										children: t.epithet
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "font-display text-3xl",
										children: t.name
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-2 text-sm text-muted",
										children: t.pitch
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "mt-4 text-sm tabular-nums text-fg",
										children: [
											inr(t.asp),
											" · GM ",
											pct(gm, 0),
											" · ",
											t.weight
										]
									})
								]
							}, t.id);
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteFooter, {})
		]
	});
}
//#endregion
export { Range as component };
