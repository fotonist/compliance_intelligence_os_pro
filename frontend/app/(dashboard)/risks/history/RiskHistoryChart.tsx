"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Row = {
  date: string;
  score: number;
};

type Props = {
  rows: Row[];
};

function formatDate(v: string) {
  try {
    return new Date(v).toLocaleDateString();
  } catch {
    return v;
  }
}

/* ===== COMPACT TOOLTIP ===== */
function CompactTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded shadow">
      <div className="text-slate-400">{formatDate(label ?? "")}</div>
      <div className="text-white font-semibold">
        Score: {payload[0].value}
      </div>
    </div>
  );
}

export default function RiskHistoryChart({ rows }: Props) {
  if (!rows || rows.length === 0) {
    return (
      <div className="text-sm text-slate-400">
        No history data available.
      </div>
    );
  }

  return (
    <div className="border border-slate-800 rounded-lg bg-slate-950 p-3">
      <div className="text-sm font-semibold text-white mb-2">
        Risk Score History
      </div>

      {/* 👇 Grafik boyutu burada küçültüldü */}
      <div style={{ width: "100%", height: 180 }}>
        <ResponsiveContainer>
          <LineChart
            data={rows}
            margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1e293b"
            />

            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
            />

            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              width={28}
            />

            <Tooltip content={<CompactTooltip />} />

            <Line
              type="monotone"
              dataKey="score"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
