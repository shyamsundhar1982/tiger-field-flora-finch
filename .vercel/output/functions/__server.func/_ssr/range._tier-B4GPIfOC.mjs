import { L as notFound, R as require_jsx_runtime, _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as pct, t as inr } from "./format-DTEUCl60.mjs";
import { n as TIERS } from "./company-BH866iCc.mjs";
import { o as bomTotal, r as BOM } from "./bom-BiNEi0Sf.mjs";
import { n as SiteHeader, t as SiteFooter } from "./site-header-DdBaCZax.mjs";
import { n as Route } from "./router-BmolDcXc.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/range._tier-B4GPIfOC.js
var import_jsx_runtime = require_jsx_runtime();
function TierPage() {
	const { tier } = Route.useParams();
	const t = TIERS.find((x) => x.id === tier);
	if (!t) throw notFound();
	const cogs = bomTotal(t.id);
	const gm = (t.asp - cogs) / t.asp * 100;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh bg-bg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteHeader, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
				className: "mx-auto max-w-6xl px-4 py-10 sm:px-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/range",
						className: "text-sm text-muted hover:text-fg",
						children: "Range"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 grid gap-10 lg:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: t.image,
							alt: `${t.name} bicycle`,
							className: "media w-full rounded-xl object-cover"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[11px] uppercase tracking-[0.22em] text-subtle",
								children: t.epithet
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "mt-2 font-display text-5xl",
								children: t.name
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-4 text-muted",
								children: t.pitch
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
								className: "mt-8 grid grid-cols-2 gap-4 text-sm",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
										className: "text-subtle",
										children: "ASP"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
										className: "font-display text-2xl tabular-nums",
										children: inr(t.asp)
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
										className: "text-subtle",
										children: "Landed COGS"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
										className: "font-display text-2xl tabular-nums",
										children: inr(cogs)
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
										className: "text-subtle",
										children: "Gross margin"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
										className: "font-display text-2xl tabular-nums",
										children: pct(gm, 1)
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
										className: "text-subtle",
										children: "Frame target"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
										className: "font-display text-2xl",
										children: t.weight
									})] })
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "mt-8 space-y-2 text-sm text-muted",
								children: t.highlights.map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
									className: "border-l border-accent pl-3",
									children: h
								}, h))
							})
						] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "mt-16 font-display text-3xl",
						children: "Indicative BOM"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted",
						children: "Replace yellow-path quotes with OEM numbers before investor use."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-6 overflow-x-auto",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
							className: "w-full min-w-[32rem] text-left text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
								className: "text-[11px] uppercase tracking-[0.14em] text-subtle",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 font-medium",
									children: "Line"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 font-medium",
									children: "Amount"
								})] })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", { children: [BOM.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "border-t border-border",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: "py-2.5 pr-4",
									children: [row.item, row.flag === "hs" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "ml-2 text-[10px] uppercase tracking-wider text-warn",
										children: "HS risk"
									}) : null]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2.5 tabular-nums text-muted",
									children: inr(row[t.id])
								})]
							}, row.item)), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "border-t border-border",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-3 font-medium",
									children: "Total landed"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-3 tabular-nums",
									children: inr(cogs)
								})]
							})] })]
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteFooter, {})
		]
	});
}
//#endregion
export { TierPage as component };
