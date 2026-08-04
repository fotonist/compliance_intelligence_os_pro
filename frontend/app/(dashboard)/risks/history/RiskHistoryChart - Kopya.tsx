"use client";

import { useState } from "react";

type Row = {
  date: string;
  score: number;
};

export default function RiskHistoryChart({ rows }: { rows: Row[] }) {
  if (!Array.isArray(rows) || rows.length < 2) {
    return (
      <div className="text-sm text-slate-400">
        Not enough history data to draw chart.
      </div>
    );
  }

  const width = 640;
  const height = 220;
  const padding = 30;

  const scores = rows.map((r) => Number(r.score));
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max === min ? 1 : max - min;

  const points = rows.map((r, i) => {
    const x =
      padding +
      (i * (width - padding * 2)) / (rows.length - 1);

    const y =
      height -
      padding -
      ((r.score - min) / range) * (height - padding * 2);

    return { x, y, ...r };
  });

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  return (
    <div className="relative border border-slate-800 rounded-lg bg-slate-900 p-3">
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {/* LINE */}
        <path
          d={path}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
        />

        {/* POINTS */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoverIndex === i ? 5 : 3}
            fill="#3b82f6"
            onMouseEnter={() => setHoverIndex(i)}
          />
        ))}

        {/* TOOLTIP */}
        {hoverIndex !== null && (
          <>
            <line
              x1={points[hoverIndex].x}
              x2={points[hoverIndex].x}
              y1={padding}
              y2={height - padding}
              stroke="#334155"
              strokeDasharray="4 4"
            />

            <g
              transform={`translate(${points[hoverIndex].x + 8}, ${
                points[hoverIndex].y - 12
              })`}
            >
              <rect
                x="0"
                y="-24"
                rx="4"
                ry="4"
                width="140"
                height="44"
                fill="#020617"
                stroke="#334155"
              />
              <text
                x="8"
                y="-8"
                fill="#e5e7eb"
                fontSize="11"
              >
                {new Date(points[hoverIndex].date).toLocaleString()}
              </text>
              <text
                x="8"
                y="8"
                fill="#93c5fd"
                fontSize="12"
                fontWeight="bold"
              >
                Score: {points[hoverIndex].score}
              </text>
            </g>
          </>
        )}
      </svg>
    </div>
  );
}
