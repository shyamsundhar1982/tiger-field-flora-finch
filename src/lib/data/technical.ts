import type { KnowledgeStatus } from "./knowledge";

export type TechnicalControl = {
  id: string;
  title: string;
  domain: "geometry" | "structure" | "materials" | "clearance" | "validation" | "release";
  status: KnowledgeStatus;
  requirement: string;
  currentValue: string;
  evidence: string;
  owner: string;
  gate: string;
  dependsOn?: string[];
};

/**
 * Stage 3 technical control layer.
 * Values marked pending/conflict are intentionally not presented as locked
 * production specifications until the master engineering source is verified.
 */
export const TECHNICAL_CONTROLS: TechnicalControl[] = [
  {
    id: "TC-01",
    title: "Master engineering reference",
    domain: "geometry",
    status: "pending",
    requirement: "Use one controlled engineering baseline for all geometry and manufacturing decisions.",
    currentValue: "VEDM-301 Rev 5.3.8",
    evidence: "Master dossier must be imported/reviewed before CAD release.",
    owner: "Founder / Engineering",
    gate: "Engineering baseline",
  },
  {
    id: "TC-02",
    title: "XS–XL geometry master",
    domain: "geometry",
    status: "pending",
    requirement: "Single reconciled geometry table for every production size.",
    currentValue: "XS–XL working range; exact values require VEDM reconciliation.",
    evidence: "Controlled geometry table + revision record.",
    owner: "Engineering",
    gate: "CAD lock",
    dependsOn: ["TC-01"],
  },
  {
    id: "TC-03",
    title: "Bottom bracket standard",
    domain: "geometry",
    status: "pending",
    requirement: "Freeze the BB interface before tooling and frame-shell detailing.",
    currentValue: "T47i / 85.5 mm shell width",
    evidence: "CAD interface drawing + component standard confirmation.",
    owner: "Engineering",
    gate: "CAD lock",
    dependsOn: ["TC-01"],
  },
  {
    id: "TC-04",
    title: "700×40 inflated tyre envelope",
    domain: "clearance",
    status: "pending",
    requirement: "Verify inflated 700×40 mm tyre clearance front and rear under the defined wheel/tyre conditions.",
    currentValue: "40 mm tyre requirement; clearance dimensions not yet locked.",
    evidence: "Parametric CAD envelope + physical inflated-tyre check.",
    owner: "Engineering / Quality",
    gate: "Geometry release",
    dependsOn: ["TC-02"],
  },
  {
    id: "TC-05",
    title: "Fork axle-to-crown correction",
    domain: "clearance",
    status: "conflict",
    requirement: "Resolve fork crown clearance without compromising rider fit or handling targets.",
    currentValue: "Approx. 378 mm is the current correction candidate; 370 mm legacy value is not accepted as final.",
    evidence: "Fork CAD, tyre envelope, trail/handling calculation and prototype verification.",
    owner: "Founder / Engineering",
    gate: "Geometry release",
    dependsOn: ["TC-04"],
  },
  {
    id: "TC-06",
    title: "Head-tube / front-end reconciliation",
    domain: "geometry",
    status: "pending",
    requirement: "Reconcile head-tube lengths, stack and fork A-C after the clearance correction.",
    currentValue: "Must be regenerated from the approved geometry master.",
    evidence: "Revised geometry table + fit/handling check.",
    owner: "Engineering",
    gate: "CAD lock",
    dependsOn: ["TC-02", "TC-05"],
  },
  {
    id: "TC-07",
    title: "Carbon material system",
    domain: "materials",
    status: "planned",
    requirement: "Define approved carbon/resin system and supplier-controlled prepreg specifications.",
    currentValue: "T700/T800 mixed system is the working platform.",
    evidence: "Supplier datasheets, material certificates and approved laminate schedule.",
    owner: "Engineering / Supply Chain",
    gate: "Laminate release",
  },
  {
    id: "TC-08",
    title: "Wall-thickness baseline",
    domain: "structure",
    status: "pending",
    requirement: "Use laminate engineering rather than nominal wall thickness alone to establish structural adequacy.",
    currentValue: "2.5 mm working baseline; not a locked laminate specification.",
    evidence: "Laminate schedule + FEA + coupon/material data.",
    owner: "Engineering",
    gate: "FEA release",
    dependsOn: ["TC-07"],
  },
  {
    id: "TC-09",
    title: "VAEA tube architecture",
    domain: "geometry",
    status: "pending",
    requirement: "Maintain the intended VAEA design language while meeting structural, clearance and manufacturability constraints.",
    currentValue: "VEDM-503 working profiles: DT 3.5:1 truncated Kammtail/KVF; TT 3.2:1 flattened aero ellipse; ST 3.0:1 KVF.",
    evidence: "Released section profiles + CFD/FEA/manufacturing review as applicable.",
    owner: "Founder / Engineering",
    gate: "Surface/CAD release",
    dependsOn: ["TC-01", "TC-02"],
  },
  {
    id: "TC-10",
    title: "Medium frame weight target",
    domain: "structure",
    status: "planned",
    requirement: "Track frame mass without allowing weight reduction to override safety requirements.",
    currentValue: "850–950 g painted Medium target.",
    evidence: "Prototype scale record + final configuration definition.",
    owner: "Engineering / Quality",
    gate: "Prototype review",
    dependsOn: ["TC-08"],
  },
  {
    id: "TC-11",
    title: "FEA structural viability",
    domain: "structure",
    status: "planned",
    requirement: "Close structural analysis before production tooling is authorised.",
    currentValue: "FEA planned around CAD lock; structural viability is a Para 58 trigger.",
    evidence: "Controlled FEA model, assumptions, loads, results and sign-off.",
    owner: "Engineering / Founder",
    gate: "M3–M4 engineering gate",
    dependsOn: ["TC-02", "TC-07", "TC-08"],
  },
  {
    id: "TC-12",
    title: "Prototype dimensional inspection",
    domain: "validation",
    status: "planned",
    requirement: "Measure critical dimensions against the released CAD before structural testing.",
    currentValue: "Prototype inspection required.",
    evidence: "CMM/dimensional report with serial number and revision.",
    owner: "Quality / OEM",
    gate: "Prototype gate",
    dependsOn: ["TC-06"],
  },
  {
    id: "TC-13",
    title: "NDT gate",
    domain: "validation",
    status: "planned",
    requirement: "Inspect prototype articles for manufacturing defects before/around formal validation as defined by the test plan.",
    currentValue: "Tap/ultrasonic NDT workflow planned.",
    evidence: "NDT report tied to serial number.",
    owner: "Quality",
    gate: "Prototype gate",
    dependsOn: ["TC-12"],
  },
  {
    id: "TC-14",
    title: "ISO 4210 validation",
    domain: "validation",
    status: "planned",
    requirement: "Complete the applicable frame/fork/system tests and retain objective evidence.",
    currentValue: "ISO 4210 programme; external lab confirmation required.",
    evidence: "Lab reports/certificates and test configuration record.",
    owner: "Founder / Quality / Lab",
    gate: "Validation pass",
    dependsOn: ["TC-13"],
  },
  {
    id: "TC-15",
    title: "Design freeze",
    domain: "release",
    status: "planned",
    requirement: "Freeze geometry, materials, laminate, interfaces and drawings only after validation evidence passes.",
    currentValue: "Planned after ISO validation pass; tooling follows freeze.",
    evidence: "Signed release checklist + revision-controlled CAD/drawings.",
    owner: "Founder / Engineering / Quality",
    gate: "Go / no-go",
    dependsOn: ["TC-11", "TC-14"],
  },
  {
    id: "TC-16",
    title: "Production tooling release",
    domain: "release",
    status: "planned",
    requirement: "Authorise production tooling only against the frozen engineering package.",
    currentValue: "Planned M10 in the current execution schedule.",
    evidence: "Tool drawing, purchase approval, ownership record and tool buy-off.",
    owner: "Founder / Supply Chain",
    gate: "Tooling gate",
    dependsOn: ["TC-15"],
  },
];

export const TECHNICAL_STATUS_COUNTS = TECHNICAL_CONTROLS.reduce(
  (acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  },
  {} as Record<KnowledgeStatus, number>,
);
