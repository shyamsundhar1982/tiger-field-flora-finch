/** Amounts in the model are in ₹ lakh unless noted. */
export function lakh(n: number, digits = 1): string {
  const sign = n < 0 ? "−" : "";
  const abs = Math.abs(n);
  if (abs >= 100) return `${sign}₹${abs.toFixed(0)} L`;
  if (abs >= 10) return `${sign}₹${abs.toFixed(1)} L`;
  return `${sign}₹${abs.toFixed(Math.max(digits, abs < 1 ? 2 : 1))} L`;
}

export function inr(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export function pct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

export function monthLabel(m: number): string {
  return `M${m}`;
}
