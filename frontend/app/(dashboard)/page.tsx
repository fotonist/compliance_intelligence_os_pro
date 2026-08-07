"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type DashboardSummary = {
  risk: {
    total: number;
    critical: number;
    average_score: number;
  };
  evidence: {
    total: number;
    approved: number;
    pending: number;
    rejected: number;
  };
  compliance_percentage: number;
};

type RiskTrendItem = {
  date: string;
  average_score: number;
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [riskTrend, setRiskTrend] = useState<RiskTrendItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const s = await apiFetch("/kpi/summary");
      if (!s.ok) throw new Error(await s.text());
      setSummary(await s.json());

      const t = await apiFetch("/kpi/risk-score-trend");
      if (t.ok) setRiskTrend(await t.json());
    } catch (e: any) {
      setError(e?.message || "Dashboard load error");
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (error) {
    return <div className="p-8 text-red-400">{error}</div>;
  }

  if (!summary) {
    return <div className="p-8 text-slate-400">Loading…</div>;
  }

  const evidenceData = [
    { name: "Pending", value: summary.evidence.pending },
    { name: "Approved", value: summary.evidence.approved },
    { name: "Rejected", value: summary.evidence.rejected },
  ];

  const PIE_COLORS = ["#64748b", "#22c55e", "#ef4444"];

  return (
    <div className="p-8 space-y-10">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Kpi title="Total Risks" value={summary.risk.total} />
        <Kpi title="Average Risk Score" value={summary.risk.average_score} />
        <Kpi title="Compliance %" value={`%${summary.compliance_percentage}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={riskTrend}>
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="average_score" stroke="#38bdf8" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={evidenceData} dataKey="value">
                {evidenceData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="border border-slate-800 rounded-xl p-6">
      <div className="text-sm text-slate-400">{title}</div>
      <div className="text-3xl font-semibold">{value}</div>
    </div>
  );
}