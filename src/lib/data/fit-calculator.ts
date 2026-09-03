export type FitSize = "XS" | "S" | "M" | "L" | "XL";

export const FIT_SIZES: FitSize[] = ["XS", "S", "M", "L", "XL"];

export const FIT_MASTER: Record<FitSize, {
  stack: number; reach: number; str: number; hta: number; trail: number;
  targetHeight: [number, number]; heightText: string;
  recStem: [number, number]; recCrank: string; recCrankVal: number;
  recBar: string; recBarMin: number; recBarMax: number;
}> = {
  XS: { stack: 520, reach: 365, str: 1.425, hta: 71.0, trail: 60.4, targetHeight: [152, 162], heightText: "152–162 cm", recStem: [70, 80], recCrank: "165 mm", recCrankVal: 165, recBar: "380–400 mm", recBarMin: 380, recBarMax: 400 },
  S: { stack: 538, reach: 376, str: 1.431, hta: 71.5, trail: 57.3, targetHeight: [162, 170], heightText: "162–170 cm", recStem: [80, 90], recCrank: "170 mm", recCrankVal: 170, recBar: "400–420 mm", recBarMin: 400, recBarMax: 420 },
  M: { stack: 555, reach: 388, str: 1.430, hta: 72.0, trail: 58.4, targetHeight: [170, 177], heightText: "170–177 cm", recStem: [90, 100], recCrank: "170 mm", recCrankVal: 170, recBar: "400–420 mm", recBarMin: 400, recBarMax: 420 },
  L: { stack: 578, reach: 398, str: 1.452, hta: 72.3, trail: 56.5, targetHeight: [177, 184], heightText: "177–184 cm", recStem: [100, 110], recCrank: "172.5 mm", recCrankVal: 172.5, recBar: "420–440 mm", recBarMin: 420, recBarMax: 440 },
  XL: { stack: 602, reach: 408, str: 1.475, hta: 72.5, trail: 58.4, targetHeight: [184, 192], heightText: "184–192 cm", recStem: [110, 120], recCrank: "175 mm", recCrankVal: 175, recBar: "420–440 mm", recBarMin: 420, recBarMax: 440 },
};

export const STEM_OPTIONS = [70, 80, 90, 100, 110, 120];
export const BAR_OPTIONS = [380, 400, 420, 440];
export const CRANK_OPTIONS = [165, 170, 172.5, 175];

export function idealSizeForHeight(height: number): FitSize {
  if (height < 162) return "XS";
  if (height < 170) return "S";
  if (height < 177) return "M";
  if (height < 184) return "L";
  return "XL";
}

export function calculateFit(height: number, inseam: number, selectedSize: FitSize, barWidth: number, stem: number, crank: number) {
  const frame = FIT_MASTER[selectedSize];
  const recSaddleHeight = inseam * 0.883;
  const approxDrop = Math.max(0, Math.round((recSaddleHeight * 10) - frame.stack + 70) / 10);
  const idealSize = idealSizeForHeight(height);
  const idealIdx = FIT_SIZES.indexOf(idealSize);
  const selectedIdx = FIT_SIZES.indexOf(selectedSize);
  const sizeDiff = Math.abs(idealIdx - selectedIdx);
  const minStem = frame.recStem[0];
  const maxStem = frame.recStem[1];

  let stemStatus: "optimal" | "short" | "long" | "too-short" | "too-long" = "optimal";
  if (stem < minStem - 10) stemStatus = "too-short";
  else if (stem < minStem) stemStatus = "short";
  else if (stem > maxStem + 10) stemStatus = "too-long";
  else if (stem > maxStem) stemStatus = "long";

  let valuation: "BEST" | "GOOD" | "WORST" | "NO RECOMMENDED" = "BEST";
  let subtitle = "Optimal biomechanical alignment & handling neutral.";
  let reason = "";

  if (sizeDiff === 0 && ["optimal", "short", "long"].includes(stemStatus)) {
    valuation = "BEST";
    subtitle = "Perfect size mapping per GPO™ progression.";
    reason = `Your stature (${height} cm) aligns directly within the target range (${frame.heightText}) for Size ${selectedSize}. Combining this frame with a ${stem} mm stem and ${crank} mm cranks keeps cockpit geometry within factory design tolerances without distortion.`;
  } else if (sizeDiff === 1 && ["optimal", "short", "long"].includes(stemStatus)) {
    valuation = "GOOD";
    subtitle = "Acceptable fit achievable via cockpit tuning per VAEA™ guidelines.";
    reason = selectedIdx < idealIdx
      ? `You are on the higher height threshold (${height} cm) for Size ${selectedSize} (ideal: ${idealSize}). This setup creates a slightly lower/more aggressive handlebar drop (~${approxDrop} cm), but remains workable via stem spacer adjustments.`
      : `You are on the lower height threshold (${height} cm) for Size ${selectedSize} (ideal: ${idealSize}). This frame provides a more upright endurance stance with minimal drop (~${approxDrop} cm) and steady stability.`;
  } else if (sizeDiff === 1 && ["too-short", "too-long"].includes(stemStatus)) {
    valuation = "WORST";
    subtitle = "Sub-optimal geometry combination with severe stem compensation.";
    reason = stem < minStem
      ? `Size ${selectedSize} requires an excessively short ${stem} mm stem (min recommended: ${minStem} mm) to fit your ${height} cm height. This extreme stem reduction sharpens steering turn-in speed and alters front wheel weight distribution.`
      : `Size ${selectedSize} requires an over-extended ${stem} mm stem (max recommended: ${maxStem} mm) to achieve reach. This forces excessive forward lean and increases steering leverage lag.`;
  } else {
    valuation = "NO RECOMMENDED";
    subtitle = "Biomechanical mismatch outside safe operational window.";
    reason = `Selecting Size ${selectedSize} for a stature of ${height} cm creates an extreme frame mismatch (${sizeDiff} sizes away from ideal ${idealSize}). Standover clearance, reach projection, and weight bias fall outside the calculator's safe engineering parameters.`;
  }

  const barWithin = barWidth >= frame.recBarMin && barWidth <= frame.recBarMax;
  const biomech = sizeDiff === 0
    ? `Inseam of ${inseam} cm yields an ideal saddle height of ${recSaddleHeight.toFixed(1)} cm with an estimated drop of ~${approxDrop} cm. Aligning with the target band (${frame.heightText}).`
    : selectedIdx < idealIdx
      ? `Inseam of ${inseam} cm on downsized frame (${selectedSize}) produces an aggressive drop of ~${approxDrop} cm. Extra seatpost extension required.`
      : `Inseam of ${inseam} cm on upsized frame (${selectedSize}) reduces drop to ~${approxDrop} cm, offering an upright stance but reduced standover clearance.`;
  const cockpit = stem >= minStem && stem <= maxStem
    ? `Selected ${stem} mm stem aligns within spec (${minStem}–${maxStem} mm). ${barWithin ? `Selected ${barWidth} mm bar matches recommended range (${frame.recBar}).` : `Selected ${barWidth} mm bar deviates from baseline (${frame.recBar}), altering shoulder alignment and aerodynamic profile.`}`
    : `${stem} mm stem is ${stem < minStem ? "shorter" : "longer"} than spec (${minStem}–${maxStem} mm). ${barWithin ? `Selected ${barWidth} mm bar matches recommended range (${frame.recBar}).` : `Selected ${barWidth} mm bar deviates from baseline (${frame.recBar}).`}`;

  let rideFeel: string;
  if (valuation === "BEST") rideFeel = `Pure DNA™ Neutral Dynamics: Ideal proportioning for ${inseam} cm inseam (${recSaddleHeight.toFixed(1)} cm saddle height). The ${frame.trail.toFixed(1)} mm trail delivers intuitive turn-in, while the selected ${stem} mm stem, ${barWidth} mm handlebar, and ${crank} mm crank setup maintains smooth cadence transition and optimal control over endurance efforts.`;
  else if (valuation === "GOOD") rideFeel = selectedIdx < idealIdx
    ? `Agile & Race-Oriented: Compact chassis with ~${approxDrop} cm handlebar drop creates a lower, aerodynamic profile. Dynamic response feels quick with the ${barWidth} mm bar, though a higher seatpost extension increases drop.`
    : `Stable & Gliding Endurance: Upright riding stance with a mild ~${approxDrop} cm drop. Straight-line stability at cruising speed remains steady with controlled handlebar response.`;
  else if (valuation === "WORST") rideFeel = stem < minStem
    ? `Nervous & Hypersensitive: Shortened cockpit leverage combined with the ${frame.hta}° head angle creates quick turn-in. Steering sensitivity requires steady control at high speeds.`
    : `Stretched Position: Overly long reach forces forward shoulder extension. Steering response feels slow entering tight turns.`;
  else rideFeel = `Biomechanical Mismatch: Extreme deviation between rider torso/inseam dimensions and selected geometry options. Results may produce awkward joint angles and unpredictable handling dynamics. Adjustment recommended.`;

  return { frame, idealSize, valuation, subtitle, reason, recSaddleHeight, approxDrop, biomech, cockpit, rideFeel, stemRange: `${minStem}–${maxStem} mm`, barRange: frame.recBar };
}
