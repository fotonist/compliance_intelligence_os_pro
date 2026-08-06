import type { RiskItem as Risk } from "@/services/risk";

export type Severity = "Low" | "Medium" | "High" | "Critical";

export type HeatmapCell = {
  impact: number;
  likelihood: number;
  count: number;
  score: number;
  severity: Severity;
};

export function scoreToSeverity(score: number): Severity {
  if (score >= 16) return "Critical";
  if (score >= 9) return "High";
  if (score >= 4) return "Medium";
  return "Low";
}

export function buildHeatmap(risks: Risk[]): HeatmapCell[] {
  const map = new Map<string, HeatmapCell>();

  for (const r of risks) {
    const impact = r.impact ?? 0;
    const likelihood = r.likelihood ?? 0;

    const key = `${impact}-${likelihood}`;
    const score = impact * likelihood;

    if (!map.has(key)) {
      map.set(key, {
        impact,
        likelihood,
        count: 0,
        score,
        severity: scoreToSeverity(score),
      });
    }

    map.get(key)!.count += 1;
  }

  return Array.from(map.values());
}
