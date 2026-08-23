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

/* ===== ENTERPRISE TOOLTIP ===== */
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
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {formatDate(label ?? "")}
      </div>

      <div className="mt-1 text-sm font-semibold text-slate-900">
        Risk Score: {payload[0].value}
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
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <div className="text-sm font-semibold text-slate-900">
          Risk Score History
        </div>

        <div className="mt-0.5 text-xs text-slate-500">
          Historical movement of the recorded risk score
        </div>
      </div>

      <div style={{ width: "100%", height: 180 }}>
        <ResponsiveContainer>
          <LineChart
            data={rows}
            margin={{ top: 10, right: 12, left: 0, bottom: 4 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e2e8f0"
              vertical={false}
            />

            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{
                fontSize: 10,
                fill: "#64748b",
              }}
              axisLine={{
                stroke: "#cbd5e1",
              }}
              tickLine={false}
            />

            <YAxis
              allowDecimals={false}
              tick={{
                fontSize: 10,
                fill: "#64748b",
              }}
              width={28}
              axisLine={false}
              tickLine={false}
            />

            <Tooltip
              content={<CompactTooltip />}
              cursor={{
                stroke: "#cbd5e1",
                strokeDasharray: "4 4",
              }}
            />

            <Line
              type="monotone"
              dataKey="score"
              stroke="#0f766e"
              strokeWidth={2.5}
              dot={{
                r: 3,
                fill: "#ffffff",
                stroke: "#0f766e",
                strokeWidth: 2,
              }}
              activeDot={{
                r: 5,
                fill: "#ffffff",
                stroke: "#0f766e",
                strokeWidth: 2,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
