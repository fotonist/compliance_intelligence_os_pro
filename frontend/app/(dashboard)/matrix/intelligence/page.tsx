"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/api";
import {
  AlertTriangle,
  Bell,
  BrainCircuit,
  ChartNoAxesCombined,
  ChevronRight,
  Globe2,
  LineChart as LineChartIcon,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type Summary = {
  total_risks: number;
  forecasted_risks: number;
  high_probability_risks: number;
  executive_alerts: number;
  avg_escalation_probability: number;
  avg_expected_score_delta: number;
};

type TopRisk = {
  risk_id: number;
  title?: string | null;
  current_score?: number | null;
  risk_level?: string | null;
  status?: string | null;
  escalation_probability_30d: number;
  expected_score_delta: number;
  model_version?: string | null;
  control_id?: number | null;
  control_code?: string | null;
  process_names?: string[];
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

type ExecAlert = {
  risk_id: number;
  title?: string | null;
  current_score?: number | null;
  risk_level?: string | null;
  escalation_probability_30d: number;
  expected_score_delta: number;
  control_code?: string | null;
  process_names: string[];
};

type OverviewResponse = {
  summary: Summary;
  top_risks: TopRisk[];
  top_controls: TopControl[];
  executive_alerts: ExecAlert[];
};

type ControlHealth = {
  summary: {
    linked_risk_count: number;
    high_risk_count: number;
    critical_risk_count: number;
    avg_escalation_probability: number;
    max_escalation_probability: number;
    expected_score_delta_sum: number;
  };
  trend: { date: string; avg_score: number }[];
};

function fmtPct(x: number) {
  return `${Math.round((x || 0) * 100)}%`;
}

function fmtNum(x: number) {
  return (x || 0).toFixed(2);
}

function levelTone(level?: string | null) {
  const value = String(level || "").toUpperCase();
  if (value === "CRITICAL") return "critical";
  if (value === "HIGH") return "high";
  if (value === "MEDIUM") return "medium";
  return "low";
}

function statusTone(status?: string | null) {
  const value = String(status || "").toUpperCase();
  if (value === "OPEN") return "open";
  if (value === "CLOSED") return "closed";
  return "neutral";
}

function probabilityTone(value: number) {
  if (value >= 0.7) return "critical";
  if (value >= 0.4) return "high";
  return "low";
}

export default function MatrixIntelligencePage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [openRisks, setOpenRisks] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedControl, setSelectedControl] = useState<number | null>(null);
  const [controlHealth, setControlHealth] = useState<ControlHealth | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [overviewRes, openRisksRes] = await Promise.all([
        apiFetch("/company/intelligence/overview"),
        apiFetch("/risks?page=1&page_size=1&status=open"),
      ]);

      if (!overviewRes.ok) throw new Error(await overviewRes.text());
      if (!openRisksRes.ok) throw new Error(await openRisksRes.text());

      const overview = await overviewRes.json();
      const openRisksData = await openRisksRes.json();

      setData(overview);
      setOpenRisks(Number(openRisksData?.total ?? 0));
    } catch (e: any) {
      setError(e?.message || "Unable to load intelligence data.");
      setOpenRisks(null);
    } finally {
      setLoading(false);
    }
  }

  async function openControl(id: number) {
    setSelectedControl(id);
    setDrawerLoading(true);
    try {
      const res = await apiFetch(`/company/intelligence/control/${id}`);
      if (!res.ok) throw new Error(await res.text());
      setControlHealth(await res.json());
    } catch {
      setControlHealth(null);
    } finally {
      setDrawerLoading(false);
    }
  }

  function closeDrawer() {
    setSelectedControl(null);
    setControlHealth(null);
  }

  useEffect(() => {
    load();
  }, []);

  const summary = data?.summary;
  const topRisks = useMemo(() => data?.top_risks || [], [data]);
  const topControls = useMemo(() => data?.top_controls || [], [data]);
  const execAlerts = useMemo(() => data?.executive_alerts || [], [data]);

  return (
    <div className="min-h-full bg-[#020817] text-slate-100">
      <div className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-7">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/10">
                <BrainCircuit className="h-4 w-4 text-cyan-300" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">Matrix Intelligence</h1>
            </div>
            <div className="mt-1 text-sm text-slate-300 sm:text-base">
              AI Risk Forecasting &amp; Predictive Compliance (Tenant-wide)
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-md border border-emerald-400/15 bg-slate-900/80 px-3 py-2 text-[11px] text-slate-300 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.8)]" />
            Real-time Intelligence
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          <KpiCard icon={Globe2} iconClass="text-cyan-300" label="Risk Universe" value={String(summary?.total_risks ?? "-")} sub="Total risks in universe" />
          <KpiCard icon={ShieldCheck} iconClass="text-emerald-400" label="Open Risks" value={String(openRisks ?? "-")} sub="Currently active risks" />
          <KpiCard icon={TrendingUp} iconClass="text-violet-400" label="Forecasted Risks" value={String(summary?.forecasted_risks ?? "-")} sub="AI forecasted risks" />
          <KpiCard icon={AlertTriangle} iconClass="text-red-400" label="High Prob (≥70%)" value={String(summary?.high_probability_risks ?? "-")} sub="High escalation probability" />
          <KpiCard icon={Bell} iconClass="text-amber-400" label="Exec Alerts" value={String(summary?.executive_alerts ?? execAlerts.length)} sub="For executive attention" />
          <KpiCard icon={ChartNoAxesCombined} iconClass="text-sky-400" label="Avg Escalation Prob" value={fmtPct(summary?.avg_escalation_probability || 0)} sub="Average escalation probability" />
          <KpiCard icon={LineChartIcon} iconClass="text-purple-400" label="Avg Score Delta" value={`+${fmtNum(summary?.avg_expected_score_delta || 0)}`} sub="Average score change" />
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <Section title="Executive Escalation Alerts">
          <DataTable
            columns={["Risk", "Score", "Level", "Escalation Prob", "Expected Δ", "Control", "Processes"]}
            empty={loading || execAlerts.length === 0}
            emptyText={loading ? "Loading intelligence..." : "No executive escalation alerts."}
            rows={execAlerts.map((r) => [
              <span key="risk" className="font-medium text-slate-100">{r.risk_id} — {r.title || "Untitled risk"}</span>,
              r.current_score ?? "—",
              <Badge key="level" tone={levelTone(r.risk_level)}>{r.risk_level || "—"}</Badge>,
              <Badge key="prob" tone={probabilityTone(r.escalation_probability_30d)}>{fmtPct(r.escalation_probability_30d)}</Badge>,
              fmtNum(r.expected_score_delta),
              r.control_code ?? "—",
              (r.process_names ?? []).join(", ") || "—",
            ])}
          />
        </Section>

        <Section title="Escalation Watchlist (Top Risks)">
          <DataTable
            columns={["Risk", "Score", "Level", "Status", "Escalation Prob", "Expected Δ", "Control", "Processes", "Model"]}
            empty={loading || topRisks.length === 0}
            emptyText={loading ? "Loading intelligence..." : "No watchlist risks."}
            rows={topRisks.map((r) => [
              <span key="risk" className="font-medium text-slate-100">{r.risk_id} — {r.title || "Untitled risk"}</span>,
              r.current_score ?? "—",
              <Badge key="level" tone={levelTone(r.risk_level)}>{r.risk_level || "—"}</Badge>,
              <Badge key="status" tone={statusTone(r.status)}>{r.status || "—"}</Badge>,
              <Badge key="prob" tone={probabilityTone(r.escalation_probability_30d)}>{fmtPct(r.escalation_probability_30d)}</Badge>,
              fmtNum(r.expected_score_delta),
              r.control_code ?? "—",
              (r.process_names ?? []).join(", ") || "—",
              r.model_version ?? "—",
            ])}
          />
        </Section>

        <Section title="AI Priority Controls (Top Controls)">
          <DataTable
            columns={["Control", "Risk Count", "Avg Prob", "Max Prob", "Δ Sum", "AI Priority"]}
            empty={loading || topControls.length === 0}
            emptyText={loading ? "Loading intelligence..." : "No priority controls."}
            rows={topControls.map((c) => [
              <button key="control" type="button" onClick={() => openControl(c.control_id)} className="group flex items-center gap-1 text-left font-semibold text-slate-100 hover:text-cyan-300">
                <span>{c.control_code} — {c.control_title}</span>
                <ChevronRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
              </button>,
              c.risk_count,
              <Badge key="avg" tone={probabilityTone(c.avg_escalation_probability)}>{fmtPct(c.avg_escalation_probability)}</Badge>,
              <Badge key="max" tone={probabilityTone(c.max_escalation_probability)}>{fmtPct(c.max_escalation_probability)}</Badge>,
              fmtNum(c.expected_score_delta_sum),
              <span key="priority" className="font-bold text-emerald-400">{fmtNum(c.ai_priority_score)}</span>,
            ])}
          />
        </Section>
      </div>

      {selectedControl && (
        <>
          <button aria-label="Close control health" onClick={closeDrawer} className="fixed inset-0 z-40 cursor-default bg-black/60" />
          <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-[600px] overflow-y-auto border-l border-slate-700 bg-[#08111f] p-5 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-700 pb-4">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-cyan-300">Control Intelligence</div>
                <h2 className="mt-1 text-xl font-bold">Control Health</h2>
              </div>
              <button type="button" onClick={closeDrawer} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {drawerLoading && <div className="py-8 text-sm text-slate-400">Loading control intelligence...</div>}

            {controlHealth && (
              <>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <MiniCard label="Linked Risks" value={controlHealth.summary.linked_risk_count} />
                  <MiniCard label="High Risks" value={controlHealth.summary.high_risk_count} />
                  <MiniCard label="Critical Risks" value={controlHealth.summary.critical_risk_count} />
                  <MiniCard label="Avg Esc Prob" value={fmtPct(controlHealth.summary.avg_escalation_probability)} />
                </div>

                <div className="mt-6 rounded-xl border border-slate-700 bg-slate-900/70 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-violet-400" />90 Day Trend</div>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={controlHealth.trend}>
                        <CartesianGrid stroke="#243244" />
                        <XAxis dataKey="date" hide />
                        <YAxis stroke="#94a3b8" />
                        <ReTooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }} />
                        <Line type="monotone" dataKey="avg_score" stroke="#38bdf8" strokeWidth={2.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
          </aside>
        </>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, iconClass, label, value, sub }: any) {
  return (
    <div className="group min-w-0 rounded-xl border border-slate-700/80 bg-[#0a1525] p-3 shadow-[0_10px_30px_rgba(0,0,0,.12)] transition hover:border-slate-600 hover:bg-[#0d1a2d]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Icon className={`h-5 w-5 shrink-0 ${iconClass}`} />
      </div>
      <div className="truncate text-[11px] font-medium text-slate-300">{label}</div>
      <div className="mt-1 text-2xl font-extrabold tracking-tight text-white">{value}</div>
      <div className="mt-1 hidden text-[9px] leading-3 text-slate-500 xl:block">{sub}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <div className="mb-2 flex items-center gap-2 text-[16px] font-bold text-white">
        <span className="h-4 w-0.5 rounded-full bg-cyan-400" />
        {title}
      </div>
      {children}
    </section>
  );
}

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  const classes: Record<string, string> = {
    critical: "border-red-500/40 bg-red-500/10 text-red-300",
    high: "border-orange-400/35 bg-orange-400/10 text-orange-300",
    medium: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    low: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    open: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    closed: "border-slate-500/30 bg-slate-500/10 text-slate-300",
    neutral: "border-slate-600 bg-slate-700/30 text-slate-300",
  };
  return <span className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-bold tracking-wide ${classes[tone] || classes.neutral}`}>{children}</span>;
}

function MiniCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-xl font-bold text-white">{value}</div>
    </div>
  );
}

function DataTable({ columns, rows, empty, emptyText }: { columns: string[]; rows: any[][]; empty: boolean; emptyText: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700 bg-[#0a1525]">
      <table className="w-full min-w-[900px] border-collapse text-left">
        <thead>
          <tr className="border-b border-slate-700 bg-slate-900/60">
            {columns.map((column) => (
              <th key={column} className="whitespace-nowrap px-3 py-3 text-[11px] font-semibold text-slate-300">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {empty ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-slate-500">{emptyText}</td>
            </tr>
          ) : rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-slate-800/80 last:border-b-0 hover:bg-slate-800/30">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="whitespace-nowrap px-3 py-3 text-[12px] text-slate-200">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
