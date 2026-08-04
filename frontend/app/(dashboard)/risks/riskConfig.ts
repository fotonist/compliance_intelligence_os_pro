export type RiskThreshold = {
  min: number;
  max: number;
  level: string;
  treatment: string;
};

export const RISK_THRESHOLDS: RiskThreshold[] = [
  { min: 1, max: 4, level: "Low", treatment: "Accept" },
  { min: 5, max: 9, level: "Medium", treatment: "Monitor" },
  { min: 10, max: 14, level: "High", treatment: "Mitigate" },
  { min: 15, max: 25, level: "Critical", treatment: "Avoid / Transfer" },
];

export function calculateRisk(score: number) {
  const found =
    RISK_THRESHOLDS.find((t) => score >= t.min && score <= t.max) ??
    RISK_THRESHOLDS[RISK_THRESHOLDS.length - 1];

  return {
    score,
    level: found.level,
    treatment: found.treatment,
  };
}
