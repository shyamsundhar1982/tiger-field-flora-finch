export type EvidenceClass = "governed-internal" | "manufacturer-reference" | "regulatory-reference" | "model-inference";

export type CarbonMaterialReference = {
  manufacturer: string;
  grade: string;
  modulusClass: "standard" | "intermediate" | "high";
  tensileStrengthMpa?: number;
  tensileModulusGpa?: number;
  strainAtFailurePercent?: number;
  densityGcm3?: number;
  compatibleResins?: string[];
  evidenceClass: EvidenceClass;
  sourceReference: string;
  selectionOnly: boolean;
};

export const TORAY_REFERENCE_MATERIALS: CarbonMaterialReference[] = [
  {
    manufacturer: "Toray",
    grade: "T700S",
    modulusClass: "standard",
    tensileStrengthMpa: 4900,
    tensileModulusGpa: 230,
    strainAtFailurePercent: 2.1,
    densityGcm3: 1.8,
    compatibleResins: ["epoxy", "phenolic", "polyester", "vinyl ester"],
    evidenceClass: "manufacturer-reference",
    sourceReference: "Toray Composite Materials America T700S data sheet",
    selectionOnly: true,
  },
];

export type LaminateDesignQuestion = {
  loadCase: "tension" | "compression" | "torsion" | "bending" | "impact" | "mixed";
  region: "head-tube" | "down-tube" | "top-tube" | "seat-tube" | "bottom-bracket" | "chainstay" | "seatstay" | "fork" | "other";
  stiffnessPriority: number;
  toughnessPriority: number;
  weightPriority: number;
};

export function recommendMaterialSelectionFrame(question: LaminateDesignQuestion) {
  const notes: string[] = [];
  if (question.toughnessPriority >= 8 || question.loadCase === "impact") notes.push("Prefer higher strain-to-failure/toughness contribution; do not optimise solely for modulus.");
  if (question.stiffnessPriority >= 8) notes.push("Evaluate intermediate/high-modulus plies locally, with strain and damage-tolerance checks.");
  if (["head-tube", "bottom-bracket", "chainstay", "fork"].includes(question.region)) notes.push("Treat the region as multi-axial and joint/load-introduction dominated; require local FEA and coupon/subcomponent validation.");
  notes.push("Material family recommendation is advisory only. Ply angles, ply count, overlaps, drops, cure cycle and production release require engineering validation and controlled drawings/ply books.");
  return notes;
}

export type RoadComponentReference = {
  category: "groupset" | "brake" | "cassette" | "crank" | "bottom-bracket" | "wheel" | "tyre" | "cockpit" | "seatpost" | "headset" | "axle" | "other";
  manufacturer: string;
  family: string;
  model?: string;
  keySpecifications: Record<string, string | number | boolean>;
  compatibilityKeys: Record<string, string | number | boolean>;
  sourceReference: string;
  evidenceClass: EvidenceClass;
};

export function checkCompatibility(required: Record<string, string | number | boolean>, candidate: RoadComponentReference) {
  const conflicts = Object.entries(required)
    .filter(([key, value]) => candidate.compatibilityKeys[key] !== undefined && candidate.compatibilityKeys[key] !== value)
    .map(([key, value]) => ({ key, required: value, candidate: candidate.compatibilityKeys[key] }));
  return { compatibleOnKnownKeys: conflicts.length === 0, conflicts };
}

export const ENGINEERING_GOVERNANCE = [
  "Manufacturer datasheets support material/component selection but do not by themselves constitute VYNDI production release authority.",
  "Do not invent laminate allowables, fatigue life, cure cycle, safety factors or ply schedules where controlled test/FEA data is absent.",
  "Component selection must reconcile interface standards, geometry, tyre clearance, chainline, gearing, rotor/caliper, axle, headset and bottom-bracket constraints.",
  "Prefer current manufacturer technical documentation over reseller descriptions.",
  "Any substitution affecting fit, structural load path, braking, steering or drivetrain compatibility requires controlled engineering review.",
] as const;
