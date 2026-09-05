export const FIRST_100 = [
  { n: "1–15", who: "Founder network + randonneur clubs in TN / KA / MH", note: "Product loans, structured 100 km reports." },
  { n: "16–40", who: "25 hero endurance riders — content, not paid posts", note: "Honest disclosure. No staged reviews." },
  { n: "41–70", who: "Direct site + waitlist. Stagger builds.", note: "Protect service capacity." },
  { n: "71–100", who: "Max 8 selective dealers, 30% channel cap", note: "30–32% margin only for first 20 dealers if needed." },
] as const;

export const LAUNCH = [
  { phase: "Pre-launch (M9–M11)", items: ["Waitlist", "Geometry published", "ISO badge (if passed)", "Hero rider films", "PSG-STEP / club rides"] },
  { phase: "Launch (M12–M13)", items: ["Longitude + Latitude only", "Altitude as allocation", "D2C checkout", "Crash-replacement policy live"] },
  { phase: "First 100 (M13–M18)", items: ["Stagger 4–6 months", "Failure log after every 100 km", "Iterate cockpit/fit, not geometry"] },
] as const;

export const GRANTS = [
  { name: "DPIIT Deep Tech recognition", body: "DPIIT", quantum: "Status", stage: "M1", status: "Apply immediately after CoI", live: true },
  { name: "NIDHI-PRAYAS 2.0 (PC / APC)", body: "DST", quantum: "₹20 L / ₹40 L grant", stage: "Prototype", status: "Via PSG-STEP if they are a PC/APC", live: true },
  { name: "TANSEED", body: "StartupTN", quantum: "Up to ₹10 L grant", stage: "Early", status: "TN entity + incubation", live: true },
  { name: "Vetri Deep-Tech Fund", body: "iTNT / TIDCO", quantum: "Corpus (equity)", stage: "Post-prototype", status: "Watch 2026 calls", live: true },
  { name: "CGSS", body: "DPIIT / NCGTC", quantum: "Collateral-free debt to ₹20 Cr", stage: "Tooling", status: "After DPIIT. Prefer for moulds.", live: true },
  { name: "TN MSME capital subsidy", body: "IC&DIC", quantum: "25% up to ₹1.5 Cr", stage: "Tooling in TN", status: "If any tools land in TN", live: true },
  { name: "SISFS", body: "DPIIT", quantum: "₹20 L + ₹50 L", stage: "—", status: "Closed for new applications (31 May 2026)", live: false },
  { name: "MeitY TIDE 2.0", body: "MeitY", quantum: "₹7–25 L", stage: "IoT only", status: "Largely concluded. Do not base-case.", live: false },
] as const;
