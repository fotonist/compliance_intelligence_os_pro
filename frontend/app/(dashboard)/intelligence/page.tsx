"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { X } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

type DashboardSummary = {
  tenant_id?: number;
  total_evidences?: number;
  orphan_evidences?: number;
  avg_quality_score?: number;
};

type OverviewSummary = {
  total_risks: number;
  forecasted_risks: number;
  high_probability_risks: number;
  executive_alerts: number;
  avg_escalation_probability: number;
  avg_expected_score_delta: number;
};

type TopControl = {
  control_id: number;
  control_code?: string | null;
  control_title?: string | null;
  risk_count: number;
  avg_escalation_probability: number;
  max_escalation_probability: number;
  expected_score_delta_sum: number;
  ai_priority_score: number;
};

type TopRisk = {
  risk_id: number;
  title?: string | null;
  current_score?: number | null;
  risk_level?: string | null;
  status?: string | null;
  escalation_probability_30d: number;
  expected_score_delta: number;
  control_code?: string | null;
};

type ExecAlert = {
  risk_id: number;
  title?: string | null;
  risk_level?: string | null;
  escalation_probability_30d: number;
  control_code?: string | null;
};

type Overview = {
  summary: OverviewSummary;
  top_controls: TopControl[];
  top_risks: TopRisk[];
  executive_alerts: ExecAlert[];
};

type ControlHealth = {
  summary: any;
  trend: any[];
  top_risks: any[];
  process_distribution: any[];
};

export default function IntelligencePage() {
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [selectedControl, setSelectedControl] = useState<number | null>(null);
  const [controlHealth, setControlHealth] = useState<ControlHealth | null>(null);

  const [escalationDist, setEscalationDist] = useState<any[]>([]);
  const [exposureMatrix, setExposureMatrix] = useState<any[]>([]);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const [dashRes, overviewRes, escRes, matrixRes] = await Promise.all([
      apiFetch("/company/intelligence/dashboard"),
      apiFetch("/company/intelligence/overview"),
      apiFetch("/company/intelligence/escalation-distribution"),
      apiFetch("/company/intelligence/exposure-coverage"),
    ]);

    setDashboard(await dashRes.json());
    setOverview(await overviewRes.json());
    setEscalationDist(await escRes.json());
    setExposureMatrix(await matrixRes.json());
  }

  async function openControl(controlId: number) {
    setSelectedControl(controlId);
    const res = await apiFetch(`/company/intelligence/control/${controlId}`);
    setControlHealth(await res.json());
  }

  if (!overview) {
    return <div className="p-6 text-white">Loading...</div>;
  }

  const executive = overview.summary;

  return (
    <div className="min-h-screen bg-[#020817] p-6 text-white space-y-8">
      <h1 className="text-3xl font-bold">Compliance Intelligence Console</h1>

      {/* Executive Summary */}
      <div className="grid grid-cols-6 gap-4">
        <Card label="Total Risks" value={executive.total_risks} />
        <Card label="High Probability" value={executive.high_probability_risks} />
        <Card
          label="Executive Alerts"
          value={executive.executive_alerts}
          danger={Number(executive.executive_alerts || 0) > 0}
        />
        <Card
          label="Avg Escalation %"
          value={`${Math.round((executive.avg_escalation_probability || 0) * 100)}%`}
        />
        <Card
          label="Avg Expected Delta"
          value={(executive.avg_expected_score_delta || 0).toFixed(2)}
        />
        <Card label="Total Evidences" value={dashboard?.total_evidences ?? 0} />
      </div>

      {/* AI Priority Controls */}
      <Panel title="AI Priority Controls">
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              <th className="py-2">Control</th>
              <th>Risks</th>
              <th>Max Prob</th>
              <th>AI Score</th>
            </tr>
          </thead>
          <tbody>
            {overview.top_controls.map((c) => (
              <tr
                key={c.control_id}
                className="border-b border-gray-900 hover:bg-gray-800 cursor-pointer"
                onClick={() => openControl(c.control_id)}
              >
                <td className="py-2 font-semibold">
                  {c.control_code || `Control #${c.control_id}`}
                </td>
                <td>{c.risk_count}</td>
                <td>{Math.round((c.max_escalation_probability || 0) * 100)}%</td>
                <td>{(c.ai_priority_score || 0).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {/* Top Risk Exposure */}
      <Panel title="Top Risk Exposure (Forecast)">
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              <th>Risk</th>
              <th>Level</th>
              <th>Score</th>
              <th>Prob</th>
              <th>Control</th>
            </tr>
          </thead>
          <tbody>
            {overview.top_risks.map((r) => (
              <tr key={r.risk_id} className="border-b border-gray-900">
                <td className="py-2 font-semibold">{r.title}</td>
                <td>{r.risk_level}</td>
                <td>{r.current_score}</td>
                <td>{Math.round((r.escalation_probability_30d || 0) * 100)}%</td>
                <td>{r.control_code}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {/* Escalation Distribution */}
      <Panel title="Escalation Probability Distribution">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={escalationDist}>
              <XAxis dataKey="probability_bucket" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #1e293b",
                }}
                labelStyle={{ color: "#cbd5e1" }}
              />
              <Bar dataKey="risk_count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* Exposure vs Coverage Matrix */}
      <Panel title="Exposure vs Coverage Matrix">
        <ExposureMatrix data={exposureMatrix} />
      </Panel>

      {/* Control Deep Dive Drawer */}
      {selectedControl && controlHealth && (
        <div className="fixed top-0 right-0 w-[600px] h-full bg-[#111827] shadow-xl p-6 overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Control Health</h2>
            <X
              className="cursor-pointer"
              onClick={() => {
                setSelectedControl(null);
                setControlHealth(null);
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card
              label="Linked Risks"
              value={controlHealth.summary?.linked_risk_count ?? 0}
            />
            <Card
              label="High Risks"
              value={controlHealth.summary?.high_risk_count ?? 0}
              danger={Number(controlHealth.summary?.high_risk_count || 0) > 0}
            />
            <Card
              label="Critical Risks"
              value={controlHealth.summary?.critical_risk_count ?? 0}
              danger={Number(controlHealth.summary?.critical_risk_count || 0) > 0}
            />
            <Card
              label="Avg Esc Prob"
              value={`${Math.round(
                (Number(controlHealth.summary?.avg_escalation_probability) || 0) * 100
              )}%`}
            />
          </div>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={controlHealth.trend}>
                <XAxis dataKey="date" hide />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #1e293b",
                  }}
                  labelStyle={{ color: "#cbd5e1" }}
                />
                <Line
                  type="monotone"
                  dataKey="avg_score"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

function ExposureMatrix({ data }: { data: any[] }) {
  const riskBuckets = [1, 2, 3, 4];
  const coverageBuckets = ["0", "1-2", "3-5", "5+"];

  const getCount = (r: number, c: string) => {
    const found = data.find((d) => d.risk_bucket === r && d.coverage_bucket === c);
    return found ? found.risk_count : 0;
  };

  const max = Math.max(...data.map((d) => d.risk_count), 1);

  return (
    <table className="text-xs border-collapse">
      <thead>
        <tr>
          <th></th>
          {coverageBuckets.map((c) => (
            <th key={c} className="p-2">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {riskBuckets.map((r) => (
          <tr key={r}>
            <td className="p-2 font-semibold">Risk {r}</td>
            {coverageBuckets.map((c) => {
              const value = getCount(r, c);
              const opacity = value / max;
              return (
                <td key={c} className="p-2">
                  <div
                    className="w-14 h-10 flex items-center justify-center rounded"
                    style={{
                      backgroundColor: `rgba(239,68,68,${opacity})`,
                    }}
                  >
                    {value}
                  </div>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#0B1220] rounded-xl p-4 border border-[#1E293B]">
      <h2 className="text-lg mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Card({
  label,
  value,
  danger,
}: {
  label: string;
  value: any;
  danger?: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-xl border ${
        danger
          ? "bg-red-900/30 border-red-700"
          : "bg-[#0B1220] border-[#1E293B]"
      }`}
    >
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}