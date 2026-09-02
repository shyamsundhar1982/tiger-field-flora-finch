export type ManufacturingStatus = "planned" | "pending" | "verify" | "complete" | "blocked";

export type ManufacturingOwner = "Founder" | "Engineering" | "Quality" | "OEM" | "Logistics";

export type ManufacturingControl = {
  id: string;
  title: string;
  domain: "Supplier" | "Tooling" | "Production" | "Quality" | "Logistics";
  status: ManufacturingStatus;
  requirement: string;
  evidence: string;
  owner: ManufacturingOwner;
  stage: string;
  dependency?: string;
  note?: string;
};

export const MANUFACTURING_CONTROLS: ManufacturingControl[] = [
  { id: "M-01", title: "Controlled OEM RFQ", domain: "Supplier", status: "pending", requirement: "Issue a controlled RFQ covering geometry, materials, layup, tooling, MOQ, sample build, lead time, Incoterms, QC, warranty and payment terms.", evidence: "Issued RFQ + supplier response matrix", owner: "Founder", stage: "M2–M4" },
  { id: "M-02", title: "OEM capability audit", domain: "Supplier", status: "pending", requirement: "Verify carbon process capability, export history, ISO experience, tooling controls, traceability and approved subcontractors before qualification.", evidence: "Supplier audit report + qualification decision", owner: "Quality", stage: "M3–M5", dependency: "M-01" },
  { id: "M-03", title: "Supplier NDA and disclosure gate", domain: "Supplier", status: "pending", requirement: "Release engineering information in controlled stages and maintain a disclosure register for every external recipient.", evidence: "Executed NDA + disclosure register", owner: "Founder", stage: "Before RFQ" },
  { id: "M-04", title: "Tooling ownership", domain: "Tooling", status: "planned", requirement: "Record buyer ownership, asset identification, custody, maintenance, storage, retrieval and non-use obligations for all production tooling.", evidence: "Tooling asset register + custody acknowledgement", owner: "Founder", stage: "M5–M9" },
  { id: "M-05", title: "Tooling acceptance", domain: "Tooling", status: "planned", requirement: "Accept moulds/jigs only after dimensional inspection against the controlled tooling drawing and approval record.", evidence: "Tooling inspection report + acceptance sign-off", owner: "Engineering", stage: "M8–M10", dependency: "M-04" },
  { id: "M-06", title: "Pilot build", domain: "Production", status: "planned", requirement: "Build a controlled pilot batch before commercial production and capture process deviations, yield and corrective actions.", evidence: "Pilot build report + NCR/CAPA log", owner: "Quality", stage: "M9–M11" },
  { id: "M-07", title: "Material traceability", domain: "Production", status: "planned", requirement: "Trace carbon prepreg and critical consumables by material specification, supplier, lot, storage condition and expiry.", evidence: "Material certificates + lot traceability records", owner: "OEM", stage: "Pilot onward" },
  { id: "M-08", title: "Layup and cure records", domain: "Production", status: "planned", requirement: "Retain controlled layup, cure-cycle and process records for each production serial or defined production lot.", evidence: "Layup traveller + cure log", owner: "OEM", stage: "Pilot onward" },
  { id: "M-09", title: "Critical dimension capability", domain: "Quality", status: "planned", requirement: "Measure critical-to-function dimensions and target Cp/Cpk ≥1.33 where statistically applicable and sample size supports the metric.", evidence: "SPC study + measurement reports", owner: "Quality", stage: "Pilot / ramp" },
  { id: "M-10", title: "NDT and cosmetic inspection", domain: "Quality", status: "planned", requirement: "Apply the approved NDT method and controlled cosmetic acceptance standard before release.", evidence: "NDT report + cosmetic inspection checklist", owner: "Quality", stage: "Prototype / pilot onward" },
  { id: "M-11", title: "Serial traceability", domain: "Quality", status: "planned", requirement: "Link serial number to material lot, layup, cure, NDT, finish, torque and final release records.", evidence: "Serial genealogy record", owner: "Quality", stage: "Pilot onward" },
  { id: "M-12", title: "Final release gate", domain: "Quality", status: "planned", requirement: "Release each frame only after dimensional, cosmetic, NDT, structural/validation and documentation gates are satisfied.", evidence: "Signed final inspection and release record", owner: "Quality", stage: "Pilot onward" },
  { id: "M-13", title: "Packaging validation", domain: "Logistics", status: "planned", requirement: "Validate packaging against transport handling, moisture, impact and cosmetic protection requirements before first customer shipment.", evidence: "Packaging test/inspection record", owner: "Logistics", stage: "M10–M12" },
  { id: "M-14", title: "Import / freight control", domain: "Logistics", status: "verify", requirement: "Confirm Incoterms, freight mode, customs documentation, HSN classification and landed-cost assumptions with the responsible advisers.", evidence: "Supplier quotation + freight/customs worksheet", owner: "Logistics", stage: "M5 onward" },
  { id: "M-15", title: "Supplier scorecard", domain: "Supplier", status: "planned", requirement: "Track quality, delivery, responsiveness, corrective action, cost variance and traceability performance per supplier.", evidence: "Monthly supplier scorecard", owner: "Founder", stage: "Pilot onward" },
  { id: "M-16", title: "Change control", domain: "Production", status: "planned", requirement: "No geometry, material, layup, tooling, process or supplier change without controlled engineering review and revalidation impact assessment.", evidence: "Engineering change request + approval record", owner: "Engineering", stage: "Design freeze onward" },
  { id: "M-17", title: "Nonconformance and CAPA", domain: "Quality", status: "planned", requirement: "Record NCRs, containment, root cause, corrective action and verification of effectiveness for production defects.", evidence: "NCR/CAPA register", owner: "Quality", stage: "Pilot onward" },
  { id: "M-18", title: "Tool retrieval / exit plan", domain: "Tooling", status: "planned", requirement: "Maintain a practical exit plan for tooling, unfinished inventory, technical records and supplier transition if the OEM relationship ends.", evidence: "Supplier exit checklist + asset register", owner: "Founder", stage: "Before tooling PO" },
];

export const MANUFACTURING_GATES = [
  { gate: "S1", when: "M2–M5", title: "Supplier qualification", controls: ["M-01", "M-02", "M-03"] },
  { gate: "S2", when: "M5–M10", title: "Tooling control", controls: ["M-04", "M-05", "M-18"] },
  { gate: "S3", when: "M9–M11", title: "Pilot production", controls: ["M-06", "M-07", "M-08", "M-09"] },
  { gate: "S4", when: "Pilot onward", title: "Quality release", controls: ["M-10", "M-11", "M-12", "M-17"] },
  { gate: "S5", when: "M10–M12", title: "Shipment readiness", controls: ["M-13", "M-14"] },
  { gate: "S6", when: "Ramp onward", title: "Controlled scale", controls: ["M-15", "M-16"] },
];

export const MANUFACTURING_STATUS_LABELS: Record<ManufacturingStatus, string> = {
  planned: "Planned",
  pending: "Pending evidence",
  verify: "Verify",
  complete: "Complete",
  blocked: "Blocked",
};
