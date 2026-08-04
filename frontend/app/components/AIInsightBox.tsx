"use client";

type Insight = {
  summary: string;
  root_causes: string[];
  warnings: string[];
  actions: string[];
};

type Props = {
  insight: Insight | null;
  loading?: boolean;
};

export default function AIInsightBox({ insight, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded p-4 text-slate-400 text-sm">
        AI is analyzing dashboard data…
      </div>
    );
  }

  if (!insight) return null;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded p-4 space-y-4">
      <h3 className="font-semibold text-slate-100">
        AI Insights
      </h3>

      {/* SUMMARY */}
      <div>
        <div className="text-xs text-slate-400 mb-1">
          Summary
        </div>
        <div className="text-sm text-slate-200">
          {insight.summary}
        </div>
      </div>

      {/* ROOT CAUSES */}
      {insight.root_causes?.length > 0 && (
        <div>
          <div className="text-xs text-slate-400 mb-1">
            Possible Root Causes
          </div>
          <ul className="list-disc pl-4 text-sm text-slate-300 space-y-1">
            {insight.root_causes.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* WARNINGS */}
      {insight.warnings?.length > 0 && (
        <div>
          <div className="text-xs text-amber-400 mb-1">
            Warnings
          </div>
          <ul className="list-disc pl-4 text-sm text-amber-300 space-y-1">
            {insight.warnings.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ACTIONS */}
      {insight.actions?.length > 0 && (
        <div>
          <div className="text-xs text-emerald-400 mb-1">
            Suggested Actions
          </div>
          <ul className="list-disc pl-4 text-sm text-emerald-300 space-y-1">
            {insight.actions.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
