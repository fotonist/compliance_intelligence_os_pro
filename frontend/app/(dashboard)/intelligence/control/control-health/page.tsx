"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/* ================= TYPES ================= */

type TrendRow = {
  day: string;
  gap_count: number;
  worst_severity: number;
  health_index: number;
};

type HealthResponse = {
  linked_risks: number;
  high_risks: number;
  critical_risks: number;
  avg_escalation_probability: number;

  gap_count: number;
  worst_severity: number;
  open_tasks: number;
  evidence_count: number;

  health_index?: number;

  trend: TrendRow[];
};

/* ================= HEALTH INDEX FALLBACK ================= */

function fallbackHealthIndex(
  worstSeverity: number,
  gaps: number,
  tasks: number
) {
  return Math.max(0, 100 - worstSeverity * 0.5 - gaps * 5 - tasks * 3);
}

/* ================= PAGE ================= */

export default function ControlHealthPage() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch("/api/intelligence/control-health");

        if (!res.ok) {
          throw new Error("Control health fetch failed");
        }

        const json: HealthResponse = await res.json();
		console.log("CONTROL HEALTH RESPONSE", json);

        setData(json);
      } catch (err) {
        console.error("Control health load error:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading || !data) {
    return (
      <div className="p-6 text-slate-400">
        Loading control health...
      </div>
    );
  }

  const health =
    data.health_index ??
    fallbackHealthIndex(
      data.worst_severity ?? 0,
      data.gap_count ?? 0,
      data.open_tasks ?? 0
    );

  const avgProb =
    data.avg_escalation_probability
      ? (data.avg_escalation_probability * 100).toFixed(0) + "%"
      : "0%";

  return (
    <div className="p-6 space-y-6">

      <div className="text-xl font-semibold text-white">
        Control Health
      </div>

      <div className="grid grid-cols-4 gap-4">

        <Card label="Linked Risks" value={data.linked_risks ?? 0} />
        <Card label="High Risks" value={data.high_risks ?? 0} />
        <Card label="Critical Risks" value={data.critical_risks ?? 0} />
        <Card label="Avg Esc Prob" value={avgProb} />
        <Card label="Gap Count" value={data.gap_count ?? 0} />
        <Card
          label="Worst Severity"
          value={(data.worst_severity ?? 0).toFixed(2)}
        />
        <Card label="Open Tasks" value={data.open_tasks ?? 0} />
        <Card label="Evidence Count" value={data.evidence_count ?? 0} />

      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">

        <div className="text-sm text-slate-400 mb-2">
          Health Index
        </div>

        <div className="text-3xl font-semibold text-cyan-400">
          {health.toFixed(1)}
        </div>

      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">

        <div className="text-sm text-slate-400 mb-4">
          Control Health Trend
        </div>

        <div className="w-full h-[250px]">
         <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.trend ?? []}>
            <XAxis
              dataKey="day"
              tickFormatter={(d) =>
                typeof d === "string" ? d.slice(5, 10) : ""
              }
            />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="health_index"
              stroke="#22c55e"
              strokeWidth={2}
            />
          </LineChart>
         </ResponsiveContainer>
        </div>

      </div>

    </div>
  );
}

/* ================= CARD ================= */

function Card({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="text-xs text-slate-400">
        {label}
      </div>
      <div className="text-2xl font-semibold text-white mt-1">
        {value}
      </div>
    </div>
  );
}