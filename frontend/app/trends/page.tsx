"use client";

import { useEffect, useState } from "react";

type ApprovalPoint = { date: string; count: number };
type RiskPoint = { date: string; risk_exposure_pct: number };

type TrendsResponse = {
  period_days: number;
  evidence_approvals_daily: ApprovalPoint[];
  risk_exposure_trend: RiskPoint[];
  current: {
    compliance_readiness_pct: number;
    audit_preparation_status: "READY" | "PARTIALLY_READY" | "NOT_READY";
  };
};

const BACKEND_URL = "https://compliance-intelligence-os-pro-2.onrender.com";

export default function TrendsPage() {
  const [data, setData] = useState<TrendsResponse | null>(null);

  useEffect(() => {
    async function load() {
      const token = sessionStorage.getItem("access_token");
      const res = await fetch(`${BACKEND_URL}/dashboard/trends?days=30`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setData(json);
    }
    load();
  }, []);

  if (!data) return <div className="p-6 text-slate-400">Loading trends…</div>;

  const statusColor =
    data.current.audit_preparation_status === "READY"
      ? "text-emerald-400"
      : data.current.audit_preparation_status === "PARTIALLY_READY"
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">KPI Trends</h1>

      <div className="grid grid-cols-3 gap-6">
        <Card title="Compliance Readiness">
          <div className="text-2xl font-bold">
            {data.current.compliance_readiness_pct}%
          </div>
        </Card>

        <Card title="Audit Status">
          <div className={`text-2xl font-bold ${statusColor}`}>
            {data.current.audit_preparation_status.replace("_", " ")}
          </div>
        </Card>

        <Card title="Period">
          <div className="text-2xl font-bold">
            Last {data.period_days} days
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card title="Evidence Approval Velocity (daily)">
          <SimpleBarChart
            points={data.evidence_approvals_daily.map(p => ({
              x: p.date,
              y: p.count,
            }))}
          />
        </Card>

        <Card title="Risk Exposure Trend (%)">
          <SimpleLineChart
            points={data.risk_exposure_trend.map(p => ({
              x: p.date,
              y: p.risk_exposure_pct,
            }))}
          />
        </Card>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: any }) {
  return (
    <div className="rounded-xl bg-slate-900/70 p-4">
      <div className="text-xs text-slate-400 mb-2">{title}</div>
      {children}
    </div>
  );
}

/**
 * Minimal inline charts (no external libs)
 * Production’da Recharts / Chart.js’e kolay taşınır.
 */
function SimpleBarChart({ points }: { points: { x: string; y: number }[] }) {
  const max = Math.max(1, ...points.map(p => p.y));
  return (
    <div className="flex items-end gap-1 h-32">
      {points.map(p => (
        <div key={p.x} className="flex-1 bg-sky-600/70" style={{ height: `${(p.y / max) * 100}%` }} />
      ))}
    </div>
  );
}

function SimpleLineChart({ points }: { points: { x: string; y: number }[] }) {
  return (
    <div className="h-32 text-slate-400 text-xs">
      {points.map(p => (
        <div key={p.x}>{p.x}: {p.y}%</div>
      ))}
    </div>
  );
}
