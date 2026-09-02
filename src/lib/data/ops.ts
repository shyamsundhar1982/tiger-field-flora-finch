export const OEM_CRITERIA = [
  "Carbon frame OEM with ISO 4210 experience and export history to EU/US",
  "Willingness to accept buyer-owned tooling (serial-tagged, retrieval in 30 days)",
  "No sub-contracting of layup without written approval",
  "NDA executed before any geometry or layup file is sent",
  "Indicative quote + MOQ + 50/50 deposit terms disclosed up front",
  "Factory visit slot within 60 days of shortlist",
  "Statistical QC — Cp/Cpk on critical dimensions, not sample-only",
  "English-speaking PM and weekly photo/video layup reports",
] as const;

export const CONTRACT_CLAUSES = [
  { id: "1", title: "Tooling ownership", body: "Moulds, jigs, masters are VéLOXIS property. Serial tagged. Location disclosed. Retrieval within 30 days of notice, freight on OEM if breach." },
  { id: "2", title: "IP non-use", body: "No use of geometry, layup, or photos for any other customer. Employee NDAs. Photographic evidence control." },
  { id: "3", title: "Staged file release", body: "NDA → RFQ (envelope + stack) → CAD after provisional filing. Never reverse." },
  { id: "4", title: "Payment", body: "50% on PO (deposit — budgeted M8 ₹2 L shifted from inventory), 50% before bill of lading." },
  { id: "5", title: "Lead times", body: "Prototype 6–8 weeks. Production 10–14 weeks after tool buy-off." },
  { id: "6", title: "Incoterms", body: "FOB Taiwan/Vietnam preferred. CHA and IEC in company name." },
  { id: "7", title: "Defect / rejection", body: "AQL plan. Scrap at OEM cost if process-caused. Rework window 14 days." },
  { id: "8", title: "Warranty back-to-back", body: "Structural defects 36 months OEM → company. Crash damage excluded." },
  { id: "9", title: "No sub-contract", body: "Mandatory approval. Spillover liability remains with contracted OEM." },
  { id: "10", title: "Tool retrieval", body: "On termination, tools ship to Coimbatore or nominated India store within 30 days." },
] as const;

export const QC_GATES = [
  "IQC — carbon, resin, core, hardware certificates",
  "Ply book / laser projection vs released ply book",
  "Prepreg out-time log",
  "Layup photo at every ply for first 20 frames",
  "Cure cycle chart (temp/pressure) archived per serial",
  "Demould dimensional CMM on criticals (Cp/Cpk ≥ 1.33)",
  "NDT (tap / ultrasonic sample)",
  "Finish / paint / clear thickness",
  "Assembly torque map",
  "Final rolling test + serial + QR",
  "Customer release — only after IQC + OQC dual sign",
] as const;

export const GANTT = [
  { id: "inc", label: "Incorporate + banking", start: 1, end: 1, dep: "—" },
  { id: "dpiit", label: "DPIIT Deep Tech + StartupTN", start: 1, end: 2, dep: "inc" },
  { id: "psg", label: "PSG-STEP / PRAYAS application", start: 1, end: 3, dep: "inc" },
  { id: "cad", label: "CAD geometry lock", start: 2, end: 3, dep: "inc" },
  { id: "pat", label: "Provisional patents + designs", start: 3, end: 3, dep: "cad" },
  { id: "fea", label: "FEA + Para 58 minute", start: 3, end: 4, dep: "cad" },
  { id: "nda", label: "OEM NDA + RFQ", start: 4, end: 5, dep: "pat" },
  { id: "proto", label: "Prototype articles", start: 5, end: 6, dep: "fea" },
  { id: "bench", label: "In-house NDT overlap", start: 6, end: 6, dep: "proto" },
  { id: "iso", label: "ISO 4210 lab (6–8 wks)", start: 7, end: 9, dep: "proto" },
  { id: "freeze", label: "Design freeze (go/no-go)", start: 9, end: 9, dep: "iso" },
  { id: "tool", label: "Production tooling", start: 10, end: 12, dep: "freeze" },
  { id: "pilot", label: "Pilot batch + QC", start: 11, end: 13, dep: "tool" },
  { id: "launch", label: "Commercial launch", start: 12, end: 13, dep: "pilot" },
  { id: "hun", label: "First 100 (staggered)", start: 13, end: 18, dep: "launch" },
] as const;
