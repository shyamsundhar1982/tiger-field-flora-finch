import { t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { R as require_jsx_runtime, _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as inr } from "./format-DTEUCl60.mjs";
import { n as TIERS } from "./company-BH866iCc.mjs";
import { u as ArrowRight } from "../_libs/lucide-react.mjs";
import { n as SiteHeader, t as SiteFooter } from "./site-header-DdBaCZax.mjs";
import { t as Slot } from "../_libs/radix-ui__react-slot.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-CO17iR8H.js
var import_jsx_runtime = require_jsx_runtime();
var buttonVariants = cva("inline-flex items-center justify-center gap-2 font-medium transition-opacity duration-150 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4", {
	variants: {
		variant: {
			primary: "bg-accent text-accent-fg hover:opacity-90",
			ghost: "bg-transparent text-fg hover:bg-surface",
			outline: "border border-border text-fg hover:bg-surface",
			paper: "bg-paper text-ink hover:opacity-90"
		},
		size: {
			sm: "h-9 rounded-md px-3 text-sm",
			md: "h-11 rounded-md px-4 text-sm",
			lg: "h-12 rounded-lg px-5 text-base"
		}
	},
	defaultVariants: {
		variant: "primary",
		size: "md"
	}
});
function Button({ className, variant, size, asChild, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size
		}), className),
		...props
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh bg-bg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteHeader, { ghost: true }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "relative min-h-[82dvh] overflow-hidden",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						src: "/bikes/hero.jpg",
						alt: "VéLOXIS carbon endurance bicycle in studio light",
						className: "media absolute inset-0 size-full object-cover"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-gradient-to-t from-bg via-bg/55 to-bg/20" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative mx-auto flex min-h-[82dvh] max-w-6xl flex-col justify-end px-4 pb-16 sm:px-6",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[11px] uppercase tracking-[0.28em] text-accent",
								children: "Designed in Coimbatore"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "mt-3 max-w-xl font-display text-5xl leading-[0.95] tracking-tight text-fg sm:text-7xl",
								children: "Wind, rendered in carbon."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-5 max-w-md text-base text-fg/80 sm:text-lg",
								children: "VéLOXIS is an IP-led carbon platform — T700/T800 frames engineered to ISO 4210, built with qualified contract OEMs, owned in India."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-8 flex flex-wrap gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									asChild: true,
									size: "lg",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
										to: "/range",
										children: ["The range ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, {})]
									})
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									asChild: true,
									variant: "outline",
									size: "lg",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
										to: "/command",
										children: "Founder command"
									})
								})]
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
				className: "mx-auto grid max-w-6xl gap-8 px-4 py-20 sm:px-6 lg:grid-cols-3",
				children: TIERS.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/range/$tier",
					params: { tier: t.id },
					className: "group block",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "overflow-hidden rounded-xl bg-bg-elevated shadow-[0_0_0_1px_rgba(255,255,255,0.08)]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: t.image,
							alt: `${t.name} carbon bicycle`,
							className: "media aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "p-5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11px] uppercase tracking-[0.2em] text-subtle",
									children: t.epithet
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-1 flex items-baseline justify-between gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
										className: "font-display text-3xl",
										children: t.name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm tabular-nums text-muted",
										children: inr(t.asp)
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-3 text-sm text-muted",
									children: t.pitch
								})
							]
						})]
					})
				}, t.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
				className: "border-y border-border",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[11px] uppercase tracking-[0.2em] text-subtle",
							children: "Model"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mt-2 font-display text-4xl",
							children: "Asset-light. IP-heavy."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-4 max-w-md text-muted",
							children: "Geometry, layup, FEA and tooling IP sit in Vāyú Shastr. Production sits with qualified carbon houses in Taiwan and Vietnam. India keeps design, brand, and the customer."
						})
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "grid gap-4 text-sm",
						children: [
							["Para 58", "Research expensed. Development capitalised from the M3 CAD + FEA lock — never reinstated."],
							["Capital", "₹15 L → ₹50 L → ₹85 L → ₹1.35 Cr → ₹2 Cr. Grants first. Equity last."],
							["Channel", "D2C is 3.9× the dealer contribution. Dealers capped at 30% in year one."]
						].map(([k, v]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "rounded-lg bg-bg-elevated p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-accent",
								children: k
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-muted",
								children: v
							})]
						}, k))
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteFooter, {})
		]
	});
}
//#endregion
export { Home as component };
