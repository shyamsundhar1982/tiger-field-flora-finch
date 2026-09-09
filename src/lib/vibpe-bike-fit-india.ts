export type RiderAnthropometry = {
  statureMm: number;
  inseamMm: number;
  torsoMm?: number;
  armMm?: number;
  shoulderBreadthMm?: number;
  footLengthMm?: number;
  flexibility?: "low" | "medium" | "high";
  ridingGoal?: "endurance" | "all_round" | "race" | "ultra_endurance";
};

export type BikeFitEnvelope = {
  saddleHeightMm: { min: number; max: number };
  recommendedCrankMm: number[];
  fitNotes: string[];
};

export function estimateBikeFitEnvelope(rider: RiderAnthropometry): BikeFitEnvelope {
  const saddle = rider.inseamMm * 0.883;
  const ratio = rider.inseamMm / rider.statureMm;
  const shorterLegged = ratio < 0.46;
  const crank = rider.inseamMm < 740 ? [150, 155, 160] : rider.inseamMm < 780 ? [160, 165] : rider.inseamMm < 830 ? [165, 170] : [170, 172.5, 175];
  const notes = [
    "Use this only as a fit starting envelope; validate dynamically for knee/hip angles, reach, handling and comfort.",
    shorterLegged ? "Relatively short inseam-to-stature ratio: prioritise low stack-over/seat-tube constraints and avoid unnecessarily long cranks." : "Anthropometric proportions are within the generic starting envelope; torso/arm measurements remain important for reach.",
  ];
  if (rider.ridingGoal === "ultra_endurance" || rider.ridingGoal === "endurance") notes.push("Bias fit toward sustainable hip angle, hand comfort, breathing freedom and multiple hand positions rather than minimum frontal area alone.");
  return { saddleHeightMm: { min: Math.round(saddle - 8), max: Math.round(saddle + 8) }, recommendedCrankMm: crank, fitNotes: notes };
}

export const INDIA_FIT_GOVERNANCE = [
  "Use measured Indian anthropometric references where population priors are needed; never treat population averages as an individual rider measurement.",
  "Direct rider measurements override population priors.",
  "Fit decisions must consider stature, inseam, torso, arms, shoulder breadth, mobility, riding goal, crank length, shoe/cleat system and target bicycle geometry.",
  "Do not derive frame size from height alone.",
  "Geometry recommendation must evaluate stack, reach, standover, saddle setback, bar reach/drop, crank clearance, toe overlap and tyre clearance together.",
] as const;
