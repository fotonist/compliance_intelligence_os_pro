"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  BookOpen,
  FolderOpen,
  Gauge,
  ListChecks,
  Network,
  ShieldAlert,
  ShieldCheck,
  Target,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiFetch } from "../lib/api";

type Status = "good" | "warning" | "critical";

type UeeSummary = {
  unified_exposure_score: number;
  compliance_health_index: number;
  indices?: {
    risk?: number;
    coverage?: number;
    maturity?: number;
    evidence?: number;
    task_pressure?: number;
  };
};

type Standard = {
  id: number;
  code: string;
  title?: string;
  type: "CONTROL_BASED" | "MATURITY_BASED";
};

type MatrixRow = {
  coverage_status?: string | null;
  evidence_count?: number | null;
  target_level?: number | null;
  achieved_level?: number | null;
};

type IntelligenceOverview = {
  summary: {
    total_risks: number;
    open_risks?: number;
    forecasted_risks: number;
    high_probability_risks: number;
    executive_alerts: number;
    avg_escalation_probability: number;
  };
  executive_alerts?: Array<{
    risk_id: number;
    title?: string | null;
    risk_level?: string | null;
    escalation_probability_30d: number;
    control_code?: string | null;
  }>;
};

type GapResponse = {
  summary?: {
    gaps_total?: number;
    uncovered?: number;
    partial?: number;
    worst_severity_score?: number;
  };
};

type ControlHealth = {
  open_tasks?: number;
  health_index?: number;
};

type Evidence = {
  id: number;
  title?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type Risk = {
  id: number;
  title?: string | null;
  risk_level?: string | null;
  created_at?: string | null;
};

type TrendPoint = {
  date: string;
  risk_exposure_pct?: number;
  approvals?: number;
};

type CurrentUser = {
  full_name?: string | null;
  username?: string | null;
  role?: string | null;
};

function num(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function healthStatus(value: number): Status {
  if (value >= 75) return "good";
  if (value >= 50) return "warning";
  return "critical";
}

function exposureStatus(value: number): Status {
  if (value <= 25) return "good";
  if (value <= 50) return "warning";
  return "critical";
}

function statusText(status: Status) {
  if (status === "good") return "Good";
  if (status === "warning") return "Warning";
  return "Critical";
}

function progressColor(value: number) {
  if (value >= 75) return "bg-emerald-500";
  if (value >= 50) return "bg-amber-500";
  return "bg-orange-500";
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Donut({ value, label }: { value: number; label: string }) {
  const safe = clamp(value);
  return (
    <div
      className="relative h-28 w-28 shrink-0 rounded-full"
      style={{ background: `conic-gradient(#22c55e ${safe * 3.6}deg, #e5e7eb 0deg)` }}
    >
      <div className="absolute inset-[10px] flex flex-col items-center justify-center rounded-full bg-white">
        <span className="text-xl font-bold text-slate-900">{Math.round(safe)}</span>
        <span className="text-[10px] text-slate-500">{label}</span>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  href,
  tone,
}: {
  title: string;
  value: string | number;
  subtitle: React.ReactNode;
  icon: React.ReactNode;
  href?: string;
  tone: string;
}) {
  const content = (
    <div className="h-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>{icon}</div>
      </div>
      <div className="mt-4 text-[10px] font-bold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      <div className="mt-1 min-h-8 text-[11px] text-slate-500">{subtitle}</div>
      {href && <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600">View all <ArrowUpRight size={12} /></div>}
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<UeeSummary | null>(null);
  const [overview, setOverview] = useState<IntelligenceOverview | null>(null);
  const [gaps, setGaps] = useState<GapResponse | null>(null);
  const [controlHealth, setControlHealth] = useState<ControlHealth | null>(null);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [coverage, setCoverage] = useState<{ id: number; code: string; type: Standard["type"]; score: number }[]>([]);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [controlsCount, setControlsCount] = useState(0);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function safeFetch(path: string): Promise<Response | null> {
      try {
        return await apiFetch(path);
      } catch (error) {
        console.warn(`Company Home optional request failed: ${path}`, error);
        return null;
      }
    }

    async function readJson<T = any>(res: Response | null): Promise<T | null> {
      if (!res || !res.ok) return null;
      try {
        return (await res.json()) as T;
      } catch {
        return null;
      }
    }

    async function load() {
      try {
        const [summaryRes, overviewRes, gapsRes, healthRes, standardsRes, evidenceRes, risksRes, controlsRes, trendRes, userRes] = await Promise.all([
          safeFetch("/matrix/kpi"),
          safeFetch("/company/intelligence/overview"),
          safeFetch("/company/intelligence/gaps"),
          safeFetch("/company/intelligence/control-health"),
          safeFetch("/standards/"),
          safeFetch("/evidences"),
          safeFetch("/risks?page=1&page_size=100&status=all"),
          safeFetch("/controls/?skip=0&limit=100"),
          safeFetch("/dashboard/trends?days=180"),
          safeFetch("/auth/me"),
        ]);

        const [summaryData, overviewData, gapsData, healthData, standardsData, evidenceData, risksData, controlsData, trendData, userData] = await Promise.all([
          readJson<UeeSummary>(summaryRes),
          readJson<IntelligenceOverview>(overviewRes),
          readJson<GapResponse>(gapsRes),
          readJson<ControlHealth>(healthRes),
          readJson<Standard[]>(standardsRes),
          readJson<Evidence[]>(evidenceRes),
          readJson<{ items?: Risk[] }>(risksRes),
          readJson<any>(controlsRes),
          readJson<any>(trendRes),
          readJson<CurrentUser>(userRes),
        ]);

        if (!mounted) return;

        // /matrix/kpi is the live KPI endpoint in the current backend.
        if (summaryData) setSummary(summaryData);
        if (overviewData) setOverview(overviewData);
        if (gapsData) setGaps(gapsData);
        if (healthData) setControlHealth(healthData);
        setStandards(Array.isArray(standardsData) ? standardsData : []);
        setEvidences(Array.isArray(evidenceData) ? evidenceData : []);
        setRisks(Array.isArray(risksData?.items) ? risksData.items : []);

        if (Array.isArray(controlsData)) setControlsCount(controlsData.length);
        else if (Array.isArray(controlsData?.items)) setControlsCount(controlsData.items.length);

        if (trendData) {
          const approvals = Array.isArray(trendData.evidence_approvals_daily) ? trendData.evidence_approvals_daily : [];
          const exposure = Array.isArray(trendData.risk_exposure_trend) ? trendData.risk_exposure_trend : [];
          const byDate = new Map<string, TrendPoint>();
          for (const item of exposure) byDate.set(item.date, { date: item.date, risk_exposure_pct: num(item.risk_exposure_pct) });
          for (const item of approvals) {
            const existing = byDate.get(item.date);
            if (existing) existing.approvals = num(item.count);
            else byDate.set(item.date, { date: item.date, approvals: num(item.count) });
          }
          setTrend(Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date)));
        }

        if (userData) setUser(userData);

        const loadedStandards = Array.isArray(standardsData) ? standardsData : [];
        const result = await Promise.all(
          loadedStandards.map(async (standard: Standard) => {
            try {
              const res = await safeFetch(`/matrix?standard_id=${standard.id}`);
              if (!res?.ok) return null;
              const data = await res.json();
              const rows: MatrixRow[] = Array.isArray(data?.rows) ? data.rows : [];
              if (!rows.length) return { id: standard.id, code: standard.code, type: standard.type, score: 0 };

              if (data?.mode === "maturity" || standard.type === "MATURITY_BASED") {
                const valid = rows.filter((row) => num(row.target_level) > 0);
                const score = valid.length
                  ? valid.reduce((sum, row) => sum + clamp((num(row.achieved_level) / num(row.target_level)) * 100), 0) / valid.length
                  : 0;
                return { id: standard.id, code: standard.code, type: standard.type, score: Math.round(score) };
              }

              const covered = rows.filter((row) => ["COVERED", "ACHIEVED"].includes(String(row.coverage_status || "").toUpperCase())).length;
              return { id: standard.id, code: standard.code, type: standard.type, score: Math.round((covered / rows.length) * 100) };
            } catch {
              return null;
            }
          })
        );
        if (mounted) setCoverage(result.filter(Boolean) as { id: number; code: string; type: Standard["type"]; score: number }[]);
      } catch (error) {
        console.error("Company Home load failed", error);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, []);

  const evidenceStats = useMemo(() => {
    const result = { approved: 0, pending: 0, rejected: 0, draft: 0 };
    for (const evidence of evidences) {
      const status = String(evidence.status || "").toLowerCase();
      if (status.includes("approved")) result.approved += 1;
      else if (status.includes("reject")) result.rejected += 1;
      else if (status.includes("pending") || status.includes("review") || status.includes("upload")) result.pending += 1;
      else result.draft += 1;
    }
    return result;
  }, [evidences]);

  const riskStats = useMemo(() => {
    const result = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const risk of risks) {
      const level = String(risk.risk_level || "").toLowerCase();
      if (level === "critical") result.critical += 1;
      else if (level === "high") result.high += 1;
      else if (level === "medium") result.medium += 1;
      else result.low += 1;
    }
    return result;
  }, [risks]);

  const activities = useMemo(() => {
    return [...evidences.slice(0, 4).map((item) => ({ id: `e-${item.id}`, title: `Evidence ${item.title || `#${item.id}`} updated`, meta: "Evidence Management", time: formatDate(item.created_at), icon: "evidence" as const })), ...risks.slice(0, 4).map((item) => ({ id: `r-${item.id}`, title: `Risk ${item.title || `#${item.id}`} was updated`, meta: `${item.risk_level || "Risk"} Risk`, time: formatDate(item.created_at), icon: "risk" as const }))].slice(0, 7);
  }, [evidences, risks]);

  if (loading || !summary || !overview) {
    return <div className="min-h-screen bg-slate-50 p-8 text-sm text-slate-500">Loading Company Home...</div>;
  }

  const complianceHealth = clamp(num(summary.compliance_health_index));
  const exposure = clamp(num(summary.unified_exposure_score));
  const complianceStatus = healthStatus(complianceHealth);
  const exposureState = exposureStatus(exposure);
  const totalRisks = num(overview.summary.total_risks);
  const openRisks = num(overview.summary.open_risks, totalRisks);
  const totalGaps = num(gaps?.summary?.gaps_total);
  const openTasks = num(controlHealth?.open_tasks);
  const chartData = trend.map((item) => ({ ...item, label: new Date(item.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }), compliance_health: complianceHealth, control_coverage: num(summary.indices?.coverage), evidence_strength: num(summary.indices?.evidence), risk_exposure: num(item.risk_exposure_pct) }));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1700px] p-5 lg:p-6">
        <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div><h1 className="text-3xl font-bold tracking-tight text-slate-900">Company Home</h1><p className="mt-1 text-sm text-slate-500">Welcome back, {user?.full_name || user?.username || "User"}! Here is your compliance overview.</p></div>
          <div className="flex flex-wrap items-center gap-3"><div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium">Demo Company A.Ş.</div><button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">Reporting Period <span className="ml-2 font-semibold">Aug 2026</span></button><Link href="/settings/scoring" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">Scoring</Link></div>
        </header>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard title="Compliance Health" value={`${Math.round(complianceHealth)}%`} subtitle={`${statusText(complianceStatus)} compliance health`} icon={<ShieldCheck size={20} />} href="/dashboard" tone="bg-emerald-50 text-emerald-600" />
          <KpiCard title="Unified Exposure" value={`${Math.round(exposure)}%`} subtitle={`${statusText(exposureState)} exposure`} icon={<ShieldAlert size={20} />} href="/risks" tone="bg-orange-50 text-orange-600" />
          <KpiCard title="Open Risks" value={openRisks} subtitle={`${totalRisks} total risks`} icon={<AlertTriangle size={20} />} href="/risks" tone="bg-red-50 text-red-600" />
          <KpiCard title="Open Gaps" value={totalGaps} subtitle={`${openTasks} remediation tasks`} icon={<Target size={20} />} href="/gaps" tone="bg-amber-50 text-amber-600" />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2"><div className="flex items-center justify-between"><div><h2 className="text-sm font-bold text-slate-900">Compliance Overview</h2><p className="text-xs text-slate-500">Current enterprise posture</p></div><Gauge className="text-slate-400" size={18} /></div><div className="mt-5 grid gap-5 md:grid-cols-2"><div className="flex items-center gap-5"><Donut value={complianceHealth} label="Health" /><div><div className="text-xs text-slate-500">Compliance Health</div><div className="text-2xl font-bold">{Math.round(complianceHealth)}%</div><div className="mt-1 text-xs text-slate-500">Based on current risk, coverage, maturity and evidence posture.</div></div></div><div className="flex items-center gap-5"><Donut value={100 - exposure} label="Exposure" /><div><div className="text-xs text-slate-500">Exposure Control</div><div className="text-2xl font-bold">{Math.round(100 - exposure)}%</div><div className="mt-1 text-xs text-slate-500">Lower exposure indicates stronger compliance posture.</div></div></div></div></section>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-sm font-bold">Risk Intelligence</h2><p className="text-xs text-slate-500">Current risk distribution</p></div><Activity size={18} className="text-slate-400" /></div><div className="mt-5 space-y-3 text-xs">{([['Critical', riskStats.critical, 'bg-red-500'], ['High', riskStats.high, 'bg-orange-500'], ['Medium', riskStats.medium, 'bg-amber-400'], ['Low', riskStats.low, 'bg-emerald-500']] as const).map(([label, value, color]) => <div key={label}><div className="mb-1 flex justify-between"><span>{label}</span><span className="font-semibold">{value}</span></div><div className="h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${color}`} style={{ width: `${totalRisks ? (value / totalRisks) * 100 : 0}%` }} /></div></div>)}</div></section>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2"><div className="flex items-center justify-between"><div><h2 className="text-sm font-bold">Posture Trend</h2><p className="text-xs text-slate-500">Risk exposure and compliance indicators</p></div><Link href="/analytics" className="text-xs font-semibold text-blue-600">Open Analytics</Link></div><div className="mt-4 h-64">{chartData.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 10 }} /><Tooltip /><Line type="monotone" dataKey="compliance_health" stroke="#16a34a" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="control_coverage" stroke="#2563eb" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="risk_exposure" stroke="#ea580c" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-slate-400">No trend data available.</div>}</div></section>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-sm font-bold">Standards Coverage</h2><p className="text-xs text-slate-500">Control and maturity posture</p></div><BookOpen size={18} className="text-slate-400" /></div><div className="mt-4 space-y-4">{coverage.map((row) => <div key={row.id}><div className="mb-1 flex justify-between text-xs"><span className="font-semibold">{row.code}</span><span>{row.score}%</span></div><div className="h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${progressColor(row.score)}`} style={{ width: `${row.score}%` }} /></div></div>)}{!coverage.length && <div className="text-sm text-slate-400">No standards data available.</div>}</div></section>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-sm font-bold">Evidence Intelligence</h2><p className="text-xs text-slate-500">Evidence lifecycle</p></div><FolderOpen size={18} className="text-slate-400" /></div><div className="mt-5 grid grid-cols-2 gap-3">{[['Approved', evidenceStats.approved], ['Pending', evidenceStats.pending], ['Rejected', evidenceStats.rejected], ['Draft', evidenceStats.draft]].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-slate-50 p-3"><div className="text-[10px] uppercase text-slate-500">{label}</div><div className="mt-1 text-xl font-bold">{value}</div></div>)}</div></section>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-sm font-bold">Executive Alerts</h2><p className="text-xs text-slate-500">Predicted risk escalation</p></div><Bell size={18} className="text-slate-400" /></div><div className="mt-4 space-y-3">{(overview.executive_alerts || []).slice(0, 4).map((alert) => <Link key={alert.risk_id} href={`/risks/${alert.risk_id}`} className="block rounded-lg border border-slate-100 p-3 hover:bg-slate-50"><div className="flex items-center justify-between text-xs font-semibold"><span>{alert.title || `Risk #${alert.risk_id}`}</span><span>{Math.round(alert.escalation_probability_30d)}%</span></div><div className="mt-1 text-[11px] text-slate-500">{alert.risk_level || 'Risk'} · {alert.control_code || 'No control'}</div></Link>)}{!(overview.executive_alerts || []).length && <div className="text-sm text-slate-400">No executive alerts.</div>}</div></section>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-sm font-bold">Recent Activity</h2><p className="text-xs text-slate-500">Latest evidence and risk updates</p></div><ListChecks size={18} className="text-slate-400" /></div><div className="mt-4 space-y-3">{activities.map((item) => <div key={item.id} className="flex items-start gap-3"><div className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg ${item.icon === 'risk' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{item.icon === 'risk' ? <ShieldAlert size={14} /> : <FolderOpen size={14} />}</div><div className="min-w-0"><div className="truncate text-xs font-semibold">{item.title}</div><div className="text-[10px] text-slate-500">{item.meta}{item.time ? ` · ${item.time}` : ''}</div></div></div>)}{!activities.length && <div className="text-sm text-slate-400">No recent activity.</div>}</div></section>
        </div>

        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-sm font-bold">Enterprise Snapshot</h2><p className="text-xs text-slate-500">Current operating footprint</p></div><Network size={18} className="text-slate-400" /></div><div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4"><div><div className="text-[10px] uppercase text-slate-500">Standards</div><div className="text-xl font-bold">{standards.length}</div></div><div><div className="text-[10px] uppercase text-slate-500">Controls</div><div className="text-xl font-bold">{controlsCount}</div></div><div><div className="text-[10px] uppercase text-slate-500">Evidence</div><div className="text-xl font-bold">{evidences.length}</div></div><div><div className="text-[10px] uppercase text-slate-500">Risks</div><div className="text-xl font-bold">{risks.length}</div></div></div></section>
      </div>
    </div>
  );
}
