//#region node_modules/.nitro/vite/services/ssr/assets/format-DTEUCl60.js
/** Amounts in the model are in ₹ lakh unless noted. */
function lakh(n, digits = 1) {
	const sign = n < 0 ? "−" : "";
	const abs = Math.abs(n);
	if (abs >= 100) return `${sign}₹${abs.toFixed(0)} L`;
	if (abs >= 10) return `${sign}₹${abs.toFixed(1)} L`;
	return `${sign}₹${abs.toFixed(Math.max(digits, abs < 1 ? 2 : 1))} L`;
}
function inr(n) {
	return "₹" + Math.round(n).toLocaleString("en-IN");
}
function pct(n, digits = 1) {
	return `${n.toFixed(digits)}%`;
}
//#endregion
export { lakh as n, pct as r, inr as t };
