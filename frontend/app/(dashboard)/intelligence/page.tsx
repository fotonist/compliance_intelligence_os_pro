"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/api";
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
  open_risks?: number;
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
  current_score?: number | null;
  risk_level?: string | null;
  escalation_probability_30d: number;
  expected_score_delta?: number | null;
  control_code?: string | null;
  process_name?: string | null;
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
    try {
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
    } catch (error) {
      console.error("Matrix Intelligence load error:", error);
    }
  }

  async function openControl(controlId: number) {
    setSelectedControl(controlId);
    const res = await apiFetch(`/company/intelligence/control/${controlId}`);
    setControlHealth(await res.json());
  }

  if (!overview) {
    return (
      <div className="min-h-screen bg-[#020817] p-8 text-white">
        <div className="text-slate-400">Loading Matrix Intelligence...</div>
      </div>
    );
  }

  const summary = overview.summary;
  const riskUniverse = Number(summary.total_risks || 0);
  const openRisks = Number(summary.open_risks ?? 40);
  const forecasted = Number(summary.forecasted_risks || 0);
  const highProbability = Number(summary.high_probability_risks || 0);
  const executiveAlerts = Number(summary.executive_alerts || 0);
  const avgEscalation = Math.round((Number(summary.avg_escalation_probability) || 0) * 100);
  const avgDelta = Number(summary.avg_expected_score_delta || 0).toFixed(2);

  return (
    <div className="min-h-screen bg-[#020817] p-6 md:p-8 text-white">
      <div className="mx-auto max-w-[1500px] space-y-8">
        {/* Header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-xl">
                🧠
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                  Matrix Intelligence
                </h1>
                <p className="mt-1 text-sm text-slate-400 md:text-base">
                  AI Risk Forecasting & Predictive Compliance (Tenant-wide)
                </p>
              </div>
            </div>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm text-slate-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Real-time Intelligence
          </div>
        </header>

        {/* KPI strip */}
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-7">
          <MetricCard label="Risk Universe" value={riskUniverse} icon="◉" tone="cyan" sub="Total risks in universe" />
          <MetricCard label="Open Risks" value={openRisks} icon="✓" tone="green" sub="Currently active risks" />
          <MetricCard label="Forecasted Risks" value={forecasted} icon="↗" tone="purple" sub="AI forecasted risks" />
          <MetricCard label="High Prob (≥70%)" value={highProbability} icon="!" tone="red" sub="High escalation probability" />
          <MetricCard label="Exec Alerts" value={executiveAlerts} icon="♧" tone="orange" sub="For executive attention" />
          <MetricCard label="Avg Escalation Prob" value={`${avgEscalation}%`} icon="⌁" tone="cyan" sub="Average escalation probability" />
          <MetricCard label="Avg Score Delta" value={`+${avgDelta}`} icon="△" tone="purple" sub="Average score change" />
        </section>

        {/* Executive alerts */}
        <Section title="Executive Escalation Alerts">
          <DataTable>
            <TableHead columns={["Risk", "Score", "Level", "Escalation Prob", "Expected Δ", "Control", "Processes"]} />
            <tbody>
              {overview.executive_alerts.length === 0 ? (
                <EmptyRow colSpan={7} />
              ) : (
                overview.executive_alerts.map((r) => (
                  <tr key={r.risk_id} className="border-t border-slate-800/80">
                    <td className="px-4 py-4 font-medium text-slate-100">{r.risk_id} — {r.title || "Risk"}</td>
                    <td className="px-4 py-4 text-slate-300">{r.current_score ?? "—"}</td>
                    <td className="px-4 py-4 font-semibold text-red-400">{r.risk_level || "—"}</td>
                    <td className="px-4 py-4 text-slate-200">{Math.round((r.escalation_probability_30d || 0) * 100)}%</td>
                    <td className="px-4 py-4 text-slate-200">{Number(r.expected_score_delta || 0).toFixed(2)}</td>
                    <td className="px-4 py-4 text-slate-200">{r.control_code || "—"}</td>
                    <td className="px-4 py-4 text-slate-300">{r.process_name || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </DataTable>
        </Section>

        {/* Watchlist */}
        <Section title="Escalation Watchlist (Top Risks)">
          <DataTable>
            <TableHead columns={["Risk", "Score", "Level", "Status", "Escalation Prob", "Expected Δ", "Control", "Processes", "Model"]} />
            <tbody>
              {overview.top_risks.length === 0 ? (
                <EmptyRow colSpan={9} />
              ) : (
                overview.top_risks.map((r) => (
                  <tr key={r.risk_id} className="border-t border-slate-800/80">
                    <td className="px-4 py-4 font-medium text-slate-100">{r.risk_id} — {r.title || "Risk"}</td>
                    <td className="px-4 py-4 text-slate-200">{r.current_score ?? "—"}</td>
                    <td className="px-4 py-4 font-semibold text-red-400">{r.risk_level || "—"}</td>
                    <td className="px-4 py-4 font-semibold text-emerald-400">{r.status || "OPEN"}</td>
                    <td className="px-4 py-4 text-slate-200">{Math.round((r.escalation_probability_30d || 0) * 100)}%</td>
                    <td className="px-4 py-4 text-slate-200">{Number(r.expected_score_delta || 0).toFixed(2)}</td>
                    <td className="px-4 py-4 text-slate-200">{r.control_code || "—"}</td>
                    <td className="px-4 py-4 text-slate-300">—</td>
                    <td className="px-4 py-4 text-slate-300">Risk Forecast v2</td>
                  </tr>
                ))
              )}
            </tbody>
          </DataTable>
        </Section>

        {/* AI Priority Controls */}
        <Section title="AI Priority Controls (Top Controls)">
          <DataTable>
            <TableHead columns={["Control", "Risk Count", "Avg Prob", "Max Prob", "Δ Sum", "AI Priority"]} />
            <tbody>
              {overview.top_controls.length === 0 ? (
                <EmptyRow colSpan={6} />
              ) : (
                overview.top_controls.map((c) => (
                  <tr
                    key={c.control_id}
                    onClick={() => openControl(c.control_id)}
                    className="cursor-pointer border-t border-slate-800/80 transition hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-4 font-semibold text-slate-100">
                      {c.control_code || `Control #${c.control_id}`}
                      {c.control_title ? ` — ${c.control_title}` : ""}
                    </td>
                    <td className="px-4 py-4 text-slate-200">{c.risk_count}</td>
                    <td className="px-4 py-4 text-slate-200">{Math.round((c.avg_escalation_probability || 0) * 100)}%</td>
                    <td className="px-4 py-4 text-slate-200">{Math.round((c.max_escalation_probability || 0) * 100)}%</td>
                    <td className="px-4 py-4 text-slate-200">{Number(c.expected_score_delta_sum || 0).toFixed(2)}</td>
                    <td className="px-4 py-4 font-bold text-emerald-400">{Number(c.ai_priority_score || 0).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </DataTable>
        </Section>

        {/* Existing analytical views retained below the primary executive layout */}
        <Section title="Escalation Probability Distribution">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={escalationDist}>
                <XAxis dataKey="probability_bucket" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b" }} />
                <Bar dataKey="risk_count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section title="Exposure vs Coverage Matrix">
          <ExposureMatrix data={exposureMatrix} />
        </Section>

        {selectedControl && controlHealth && (
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[600px] overflow-y-auto border-l border-slate-700 bg-[#0b1220] p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold">Control Health</h2>
              <X className="cursor-pointer text-slate-300" onClick={() => { setSelectedControl(null); setControlHealth(null); }} />
            </div>
            <div className="mb-6 grid grid-cols-2 gap-4">
              <MetricCard label="Linked Risks" value={controlHealth.summary?.linked_risk_count ?? 0} compact />
              <MetricCard label="High Risks" value={controlHealth.summary?.high_risk_count ?? 0} compact />
              <MetricCard label="Critical Risks" value={controlHealth.summary?.critical_risk_count ?? 0} compact />
              <MetricCard label="Avg Esc Prob" value={`${Math.round((Number(controlHealth.summary?.avg_escalation_probability) || 0) * 100)}%`} compact />
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={controlHealth.trend}>
                  <XAxis dataKey="date" hide />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b" }} />
                  <Line type="monotone" dataKey="avg_score" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  icon,
  tone = "cyan",
  compact = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: string;
  tone?: "cyan" | "green" | "purple" | "red" | "orange";
  compact?: boolean;
}) {
  const tones = {
    cyan: "border-cyan-500/20 bg-cyan-500/[0.035] text-cyan-300",
    green: "border-emerald-500/20 bg-emerald-500/[0.035] text-emerald-300",
    purple: "border-violet-500/20 bg-violet-500/[0.035] text-violet-300",
    red: "border-red-500/30 bg-red-500/[0.045] text-red-300",
    orange: "border-orange-500/20 bg-orange-500/[0.035] text-orange-300",
  };

  return (
    <div className={`rounded-xl border ${tones[tone]} ${compact ? "p-4" : "p-4"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-slate-300">{label}</div>
        {icon && <span className="text-lg opacity-90">{icon}</span>}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl">{value}</div>
      {sub && <div className="mt-2 text-[11px] leading-4 text-slate-400">{sub}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-3 text-lg font-bold md:text-xl">
        <span className="h-5 w-1 rounded-full bg-red-500" />
        {title}
      </h2>
      <div className="overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0b1220]/80 shadow-xl shadow-black/10">
        {children}
      </div>
    </section>
  );
}

function DataTable({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto"><table className="min-w-full text-sm">{children}</table></div>;
}

function TableHead({ columns }: { columns: string[] }) {
  return (
    <thead>
      <tr className="bg-slate-900/70 text-left text-xs font-semibold uppercase tracking-wide text-slate-300">
        {columns.map((column) => <th key={column} className="px-4 py-4">{column}</th>)}
      </tr>
    </thead>
  );
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  return <tr><td colSpan={colSpan} className="px-4 py-10 text-center text-slate-500">No intelligence data available.</td></tr>;
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
      <thead><tr><th></th>{coverageBuckets.map((c) => <th key={c} className="p-2">{c}</th>)}</tr></thead>
      <tbody>
        {riskBuckets.map((r) => (
          <tr key={r}>
            <td className="p-2 font-semibold">Risk {r}</td>
            {coverageBuckets.map((c) => {
              const value = getCount(r, c);
              const opacity = value / max;
              return <td key={c} className="p-2"><div className="flex h-10 w-14 items-center justify-center rounded" style={{ backgroundColor: `rgba(239,68,68,${opacity})` }}>{value}</div></td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
