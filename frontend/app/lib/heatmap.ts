import { Risk } from "@/app/risks/page";

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
    const key = `${r.impact}-${r.likelihood}`;
    const score = r.impact * r.likelihood;

    if (!map.has(key)) {
      map.set(key, {
        impact: r.impact,
        likelihood: r.likelihood,
        count: 0,
        score,
        severity: scoreToSeverity(score),
      });
    }

    map.get(key)!.count += 1;
  }

  return Array.from(map.values());
}
