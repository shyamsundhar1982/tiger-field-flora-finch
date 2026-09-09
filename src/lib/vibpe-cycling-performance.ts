export type RideMetrics = {
  durationSeconds?: number;
  distanceKm?: number;
  elevationGainM?: number;
  avgPowerW?: number;
  normalizedPowerW?: number;
  ftpW?: number;
  avgHeartRateBpm?: number;
  maxHeartRateBpm?: number;
  cadenceRpm?: number;
  speedKph?: number;
  vo2MaxMlKgMin?: number;
  spo2Percent?: number;
  temperatureC?: number;
};

export function deriveCyclingMetrics(m: RideMetrics) {
  const intensityFactor = m.normalizedPowerW && m.ftpW ? m.normalizedPowerW / m.ftpW : undefined;
  const tss = intensityFactor && m.durationSeconds
    ? (m.durationSeconds * (m.normalizedPowerW ?? 0) * intensityFactor) / ((m.ftpW ?? 1) * 3600) * 100
    : undefined;
  const variabilityIndex = m.normalizedPowerW && m.avgPowerW ? m.normalizedPowerW / m.avgPowerW : undefined;
  const workKj = m.avgPowerW && m.durationSeconds ? (m.avgPowerW * m.durationSeconds) / 1000 : undefined;
  return { intensityFactor, tss, variabilityIndex, workKj };
}

export const CYCLING_PERFORMANCE_DOMAINS = [
  "FTP and power-duration profile",
  "normalized power, intensity factor, variability and workload",
  "heart-rate response and decoupling",
  "cadence, speed, climbing, elevation and pacing",
  "VO2max estimates and trend interpretation",
  "SpO2 observations with device/context limitations",
  "training load, recovery and fatigue trend interpretation",
  "aerodynamic/position trade-offs against sustainable power",
] as const;

export const PHYSIOLOGY_SAFETY_RULES = [
  "Performance metrics are coaching/analytics signals, not medical diagnoses.",
  "Treat wearable VO2max and SpO2 values as device estimates/observations unless measured clinically.",
  "Do not infer disease from a single SpO2, heart-rate or VO2max value.",
  "Escalate concerning symptoms or persistently abnormal physiological observations to an appropriate clinician rather than giving a diagnosis.",
] as const;
