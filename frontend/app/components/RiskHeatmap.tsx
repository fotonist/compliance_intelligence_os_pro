"use client";

import React from "react";

type Risk = {
  id: number;
  impact: number;
  likelihood: number;
  score: number; // 🔴 BACKEND SCORE (tek gerçek)
};

type Props = {
  risks: Risk[];
  onCellClick?: (risksInCell: Risk[]) => void;
};

/* === TEK OTORİTE RENK KURALI (BACKEND SCORE) === */
function colorByScore(score: number) {
  if (score >= 1 && score <= 3)
    return { bg: "rgba(21,128,61,0.85)", fg: "#fff" };   // Very Low

  if (score > 3 && score <= 6)
    return { bg: "rgba(250,204,21,0.85)", fg: "#000" };  // Low (SARI)

  if (score > 6 && score <= 10)
    return { bg: "rgba(251,146,60,0.85)", fg: "#fff" };  // Medium

  if (score > 10 && score <= 15)
    return { bg: "rgba(220,38,38,0.85)", fg: "#fff" };   // High

  return { bg: "rgba(51,65,85,0.6)", fg: "#fff" };
}

export default function RiskHeatmap({ risks, onCellClick }: Props) {
  const risksInCell = (i: number, l: number) =>
    risks.filter((r) => r.impact === i && r.likelihood === l);

  return (
    <div className="grid grid-cols-6 gap-2">
      <div />
      {[1, 2, 3, 4, 5].map((l) => (
        <div key={l} className="text-center text-xs text-slate-400">
          L{l}
        </div>
      ))}

      {[5, 4, 3, 2, 1].map((impact) => (
        <React.Fragment key={impact}>
          <div className="text-xs text-slate-400 flex items-center justify-end pr-1">
            I{impact}
          </div>

          {[1, 2, 3, 4, 5].map((likelihood) => {
            const cellRisks = risksInCell(impact, likelihood);

            if (cellRisks.length === 0) {
              return (
                <div
                  key={`${impact}-${likelihood}`}
                  className="h-16 rounded bg-slate-800/60 border border-slate-700"
                />
              );
            }

            // 🔴 TEK GERÇEK: backend score
            const maxScore = Math.max(...cellRisks.map((r) => r.score));
            const meta = colorByScore(maxScore);

            return (
              <div
                key={`${impact}-${likelihood}`}
                onClick={() => onCellClick?.(cellRisks)}
                className="h-16 rounded border border-slate-700 flex items-center justify-center font-semibold cursor-pointer hover:opacity-90"
                style={{
                  backgroundColor: meta.bg,
                  color: meta.fg,
                  backdropFilter: "blur(2px)",
                }}
                title={`Score: ${maxScore} • ${cellRisks.length} risk`}
              >
                {cellRisks.length}
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}
