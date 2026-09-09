export type CarbonBikeDesignInputs = {
  riderMassKg?: number;
  systemMassKg?: number;
  tyreWidthMm?: number;
  targetUse?: "endurance" | "race" | "all_road" | "ultra_endurance";
  targetFrameMassG?: number;
  targetBbStiffness?: "comfort" | "balanced" | "high";
  targetFrontEndCompliance?: "low" | "medium" | "high";
};

export const CARBON_DESIGN_DOMAINS = [
  "frame geometry, trail, wheelbase, front-centre and toe overlap",
  "tube-section design, local buckling and stiffness distribution",
  "laminate architecture, fibre orientation, ply drops, overlaps and transitions",
  "T700/T800-class fibre selection, resin-system compatibility and process constraints",
  "head tube, bottom bracket, dropout and junction reinforcement",
  "fatigue, impact, proof/load-case planning and design allowables",
  "aero versus compliance versus mass trade-offs",
  "tyre clearance, fork crown, chainstay, seatstay and crank/heel clearance",
  "manufacturability: bladder/EPS tooling, drape, compaction, cure and QA",
] as const;

export function carbonDesignGuardrails(input: CarbonBikeDesignInputs) {
  const notes = [
    "Published fibre datasheets are material-selection references, not laminate or structural design allowables.",
    "Production ply books require validated laminate allowables, manufacturing-process controls, FEA/test correlation and formal engineering release.",
    "Do not infer safe wall thickness or ply count from fibre tensile strength alone.",
  ];
  if ((input.tyreWidthMm ?? 0) >= 40) notes.push("Validate fork crown, down-tube, chainstay, seatstay, toe-overlap and mud/debris clearance for the full tyre/rim tolerance stack.");
  if ((input.targetFrameMassG ?? 9999) < 900) notes.push("Low mass target increases sensitivity to local reinforcement, impact tolerance and manufacturing variation; require coupon/subcomponent validation before release.");
  return notes;
}
