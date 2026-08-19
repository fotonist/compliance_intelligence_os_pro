"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FolderOpen,
  Gauge,
  Layers3,
  ListChecks,
  Network,
  ShieldAlert,
  ShieldCheck,
  Target,
  User,
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
  top_risks?: Array<{
    risk_id: number;
    title?: string | null;
    risk_level?: string | null;
    escalation_probability_30d: number;
    control_code?: string | null;
  }>;
  top_controls?: Array<{
    control_id: number;
    control_code?: string | null;
    control_title?: string | null;
    ai_priority_score: number;
  }>;
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
  compliance_health?: number;
  control_coverage?: number;
  evidence_strength?: number;
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
      {href && (
        <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600">
          View all <ArrowUpRight size={12} />
        </div>
      )}
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<UeeSummary | null>(null);
  const [overview, setOverview] = useState<IntelligenceOverview | null>(null);
  const [gaps, setGaps] = useState<GapResponse | null>(null);
  const [health, setHealth] = useState<ControlHealth | null>(null);
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

    async function load() {
      try {
        const responses = await Promise.all([
          apiFetch("/kpi/summary"),
          apiFetch("/company/intelligence/overview"),
          apiFetch("/company/intelligence/gaps"),
          apiFetch("/company/intelligence/control-health"),
          apiFetch("/standards/"),
          apiFetch("/evidences"),
          apiFetch("/risks?page=1&page_size=100&status=all"),
          apiFetch("/controls/?skip=0&limit=100"),
          apiFetch("/dashboard/trends?days=180"),
          apiFetch("/auth/me"),
        ]);

        const [summaryRes, overviewRes, gapsRes, healthRes, standardsRes, evidenceRes, risksRes, controlsRes, trendRes, userRes] = responses;
        const [summaryData, overviewData, gapsData, healthData, standardsData, evidenceData, risksData] = await Promise.all([
          summaryRes.json(),
          overviewRes.json(),
          gapsRes.json(),
          healthRes.json(),
          standardsRes.json(),
          evidenceRes.json(),
          risksRes.json(),
        ]);

        if (!mounted) return;

        setSummary(summaryData || null);
        setOverview(overviewData || null);
        setGaps(gapsData || null);
        setHealth(healthData || null);
        setStandards(Array.isArray(standardsData) ? standardsData : []);
        setEvidences(Array.isArray(evidenceData) ? evidenceData : []);
        setRisks(Array.isArray(risksData?.items) ? risksData.items : []);

        if (controlsRes.ok) {
          const controlsData = await controlsRes.json();
          setControlsCount(Array.isArray(controlsData) ? controlsData.length : 0);
        }

        if (trendRes.ok) {
          const trendData = await trendRes.json();
          const approvals = Array.isArray(trendData?.evidence_approvals_daily) ? trendData.evidence_approvals_daily : [];
          const exposure = Array.isArray(trendData?.risk_exposure_trend) ? trendData.risk_exposure_trend : [];
          const byDate = new Map<string, TrendPoint>();
          for (const item of exposure) byDate.set(item.date, { date: item.date, risk_exposure_pct: num(item.risk_exposure_pct) });
          for (const item of approvals) {
            const existing = byDate.get(item.date) || { date: item.date };
            existing.approvals = num(item.count);
            byDate.set(item.date, existing);
          }
          setTrend(Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date)));
        }

        if (userRes.ok) setUser(await userRes.json());

        const loadedStandards = Array.isArray(standardsData) ? standardsData : [];
        const result = await Promise.all(
          loadedStandards.map(async (standard: Standard) => {
            try {
              const res = await apiFetch(`/matrix?standard_id=${standard.id}`);
              if (!res.ok) return null;
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
    return () => {
      mounted = false;
    };
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
    return [...evidences.slice(0, 4).map((item) => ({
      id: `e-${item.id}`,
      title: `Evidence ${item.title || `#${item.id}`} updated`,
      meta: "Evidence Management",
      time: formatDate(item.created_at),
      icon: "evidence" as const,
    })), ...risks.slice(0, 4).map((item) => ({
      id: `r-${item.id}`,
      title: `Risk ${item.title || `#${item.id}`} was updated`,
      meta: `${item.risk_level || "Risk"} Risk`,
      time: formatDate(item.created_at),
      icon: "risk" as const,
    }))].slice(0, 7);
  }, [evidences, risks]);

  if (loading || !summary || !overview) {
    return <div className="min-h-screen bg-slate-50 p-8 text-sm text-slate-500">Loading Company Home...</div>;
  }

  const complianceHealth = clamp(num(summary.compliance_health_index));
  const exposure = clamp(num(summary.unified_exposure_score));
  const health = healthStatus(complianceHealth);
  const exposureState = exposureStatus(exposure);
  const totalRisks = num(overview.summary.total_risks);
  const openRisks = num(overview.summary.open_risks, totalRisks);
  const totalGaps = num(gaps?.summary?.gaps_total);
  const openTasks = num(health?.open_tasks);
  const standardRows = coverage;
  const avgCoverage = standardRows.length ? Math.round(standardRows.reduce((sum, item) => sum + item.score, 0) / standardRows.length) : 0;

  const chartData = trend.map((item) => ({
    ...item,
    label: new Date(item.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    compliance_health: complianceHealth,
    control_coverage: num(summary.indices?.coverage),
    evidence_strength: num(summary.indices?.evidence),
    risk_exposure: num(item.risk_exposure_pct),
  }));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1700px] p-5 lg:p-6">
        <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Company Home</h1>
            <p className="mt-1 text-sm text-slate-500">Welcome back, {user?.full_name || user?.username || "User"}! Here is your compliance overview.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium">Demo Company A.Ş.</div>
            <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">Reporting Period <span className="ml-2 font-semibold">Aug 2026</span></button>
            <Link href="/settings/scoring" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"><Gauge size={15} /> Customize Dashboard</Link>
            <button className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white"><Bell size={17} /><span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] text-white">{num(overview.summary.executive_alerts)}</span></button>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100"><User size={14} /></div><div className="leading-tight"><div className="text-xs font-semibold">{user?.full_name || user?.username || "User"}</div><div className="text-[10px] text-slate-400">{user?.role || "User"}</div></div></div>
          </div>
        </header>

        <div className={`mb-5 flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${exposureState === "critical" ? "border-red-200 bg-red-50 text-red-700" : exposureState === "warning" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          <div className="flex items-center gap-2 font-semibold"><AlertTriangle size={16} />{exposureState === "critical" ? "Unified exposure is in CRITICAL zone." : exposureState === "warning" ? "Unified exposure is in WARNING zone." : "Unified exposure is in an acceptable zone."} Monitoring and remediation are recommended.</div>
          <div className="text-xs font-medium">Exposure {exposure.toFixed(1)} · Health {complianceHealth.toFixed(1)}</div>
        </div>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <KpiCard title="Compliance Health" value={`${Math.round(complianceHealth)}%`} subtitle={<><span className="font-semibold">{statusText(health)}</span><span className="ml-2 text-emerald-600">▲ Current</span></>} icon={<ShieldCheck size={21} className="text-emerald-600" />} tone="bg-emerald-50" />
          <KpiCard title="Standards" value={standards.length} subtitle="Active Standards" icon={<BookOpen size={21} className="text-blue-600" />} href="/standards" tone="bg-blue-50" />
          <KpiCard title="Controls" value={controlsCount || "—"} subtitle="Active Controls" icon={<Layers3 size={21} className="text-violet-600" />} href="/controls" tone="bg-violet-50" />
          <KpiCard title="Risks" value={totalRisks} subtitle={<><span>{openRisks} Open Risks</span><span className="ml-2 font-semibold text-red-500">{riskStats.critical} Critical</span></>} icon={<AlertTriangle size={21} className="text-amber-600" />} href="/risks" tone="bg-amber-50" />
          <KpiCard title="Evidence" value={evidences.length} subtitle={<><span>{evidenceStats.approved} Approved</span><span className="ml-2 font-semibold text-amber-600">{evidenceStats.pending} Pending</span></>} icon={<FolderOpen size={21} className="text-cyan-600" />} href="/evidences" tone="bg-cyan-50" />
          <KpiCard title="Gaps" value={totalGaps} subtitle={<><span>Open Gaps</span><span className="ml-2 font-semibold text-red-500">{num(gaps?.summary?.uncovered)} High Priority</span></>} icon={<Target size={21} className="text-rose-600" />} href="/intelligence/gaps" tone="bg-rose-50" />
        </section>

        <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.65fr_0.95fr_1.15fr]">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><div><h2 className="font-bold">Compliance Health Trend</h2><div className="mt-2 flex flex-wrap gap-4 text-[10px] text-slate-500"><span>● Overall Compliance</span><span>● Control Coverage</span><span>● Evidence Strength</span><span>● Risk Exposure</span></div></div><button className="rounded-md border border-slate-200 px-3 py-1.5 text-[10px] text-slate-600">Last 6 Months⌄</button></div>
            <div className="mt-4 h-[240px]">
              {chartData.length > 1 ? <ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}><CartesianGrid stroke="#eef2f7" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 11 }} /><Line type="monotone" dataKey="compliance_health" name="Overall Compliance" stroke="#22c55e" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="control_coverage" name="Control Coverage" stroke="#3b82f6" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="evidence_strength" name="Evidence Strength" stroke="#8b5cf6" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="risk_exposure" name="Risk Exposure" stroke="#ef4444" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-400">Historical trend data is not available yet.</div>}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-bold">Compliance by Standard</h2><Link href="/matrix" className="text-[10px] font-semibold text-blue-600">View all</Link></div><div className="mt-5 space-y-5">{standardRows.length ? standardRows.map((item) => <div key={item.id}><div className="mb-2 flex justify-between text-xs"><span className="font-semibold">{item.code}</span><span className="font-bold">{item.score}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${progressColor(item.score)}`} style={{ width: `${item.score}%` }} /></div></div>) : <div className="text-xs text-slate-400">No standard coverage data.</div>}</div></div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-bold">Critical Actions</h2><Link href="/intelligence" className="text-[10px] font-semibold text-blue-600">View all</Link></div><div className="mt-4 space-y-2">{(overview.executive_alerts || []).slice(0, 5).map((item) => <Link key={item.risk_id} href={`/risks/${item.risk_id}`} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-500"><AlertTriangle size={15} /></div><div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold">{item.title || `Risk #${item.risk_id}`}</div><div className="mt-1 text-[10px] text-slate-400">{item.control_code || "Risk Intelligence"}</div></div><span className="whitespace-nowrap rounded bg-red-50 px-2 py-1 text-[9px] font-semibold text-red-500">{Math.max(1, Math.round(item.escalation_probability_30d * 100 / 10))} days</span></Link>)}{!overview.executive_alerts?.length && <div className="rounded-lg bg-emerald-50 p-4 text-xs text-emerald-700">No critical executive alerts.</div>}</div></div>
        </section>

        <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_1fr_0.75fr_1.2fr]">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><h3 className="font-bold">Risk Summary</h3><div className="mt-4 flex items-center gap-4"><Donut value={totalRisks ? riskStats.critical / totalRisks * 100 : 0} label="Critical" /><div className="w-full space-y-2 text-[11px]"><div className="flex justify-between"><span>Critical</span><b>{riskStats.critical}</b></div><div className="flex justify-between"><span>High</span><b>{riskStats.high}</b></div><div className="flex justify-between"><span>Medium</span><b>{riskStats.medium}</b></div><div className="flex justify-between"><span>Low</span><b>{riskStats.low}</b></div></div></div><Link href="/risks" className="mt-3 inline-block text-[10px] font-semibold text-blue-600">View all risks</Link></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><h3 className="font-bold">Evidence Status</h3><div className="mt-4 flex items-center gap-4"><Donut value={evidences.length ? evidenceStats.approved / evidences.length * 100 : 0} label="Approved" /><div className="w-full space-y-2 text-[11px]"><div className="flex justify-between"><span>Approved</span><b>{evidenceStats.approved}</b></div><div className="flex justify-between"><span>Pending</span><b>{evidenceStats.pending}</b></div><div className="flex justify-between"><span>Rejected</span><b>{evidenceStats.rejected}</b></div><div className="flex justify-between"><span>Draft</span><b>{evidenceStats.draft}</b></div></div></div><Link href="/evidences" className="mt-3 inline-block text-[10px] font-semibold text-blue-600">View all evidence</Link></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><h3 className="font-bold">Remediation Status</h3><div className="mt-4 flex items-center gap-4"><Donut value={openTasks ? Math.max(0, 100 - openTasks * 5) : 100} label="Health" /><div className="w-full space-y-2 text-[11px]"><div className="flex justify-between"><span>Open Tasks</span><b>{openTasks}</b></div><div className="flex justify-between"><span>Open Gaps</span><b>{totalGaps}</b></div><div className="flex justify-between"><span>Completed</span><b>{Math.max(0, 100 - openTasks)}</b></div></div></div><Link href="/company/remediation" className="mt-3 inline-block text-[10px] font-semibold text-blue-600">View remediation center</Link></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm"><h3 className="text-left font-bold">Overdue Tasks</h3><div className="mt-7 text-4xl font-bold text-red-500">{openTasks}</div><div className="mt-1 text-[11px] font-semibold text-red-500">High Priority</div><Link href="/company/tasks" className="mt-8 inline-block text-[10px] font-semibold text-blue-600">View tasks</Link></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><h3 className="font-bold">Recent Activities</h3><Link href="/admin/logs" className="text-[10px] font-semibold text-blue-600">View all</Link></div><div className="mt-2 divide-y divide-slate-100">{activities.length ? activities.map((item) => <div key={item.id} className="flex items-center gap-2 py-2.5"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">{item.icon === "evidence" ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}</div><div className="min-w-0 flex-1"><div className="truncate text-[10px] font-medium">{item.title}</div><div className="text-[9px] text-slate-400">{item.meta}</div></div><span className="text-[9px] text-slate-400">{item.time}</span></div>) : <div className="py-4 text-xs text-slate-400">No recent activities.</div>}</div></div>
        </section>

        <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_1fr]">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-bold">Quick Actions</h3><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">{[["New Risk", "/risks/create", <ShieldAlert size={18} />],["New Objective", "/company/objectives", <Target size={18} />],["New Process", "/company/processes", <Network size={18} />],["Add Standard", "/standards", <BookOpen size={18} />],["Add Evidence", "/evidences", <FolderOpen size={18} />],["Create Remediation", "/company/remediation", <Activity size={18} />],["New Task", "/company/tasks/create", <ListChecks size={18} />]].map(([label, href, icon]) => <Link key={String(label)} href={String(href)} className="flex min-h-24 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-center hover:border-blue-200 hover:bg-blue-50"><div className="mb-2 text-blue-600">{icon}</div><span className="text-[10px] font-semibold">{label}</span></Link>)}</div></div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h3 className="font-bold">Foundation Snapshot</h3><Link href="/company/profile" className="text-[10px] font-semibold text-blue-600">View all</Link></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{[["Processes", "—", "/company/processes"],["Objectives", "—", "/company/objectives"],["Risks", totalRisks, "/risks"],["Standards", standards.length, "/standards"],["Controls", controlsCount || "—", "/controls"],["Locations", "—", "/company/locations"]].map(([label, value, href]) => <Link key={String(label)} href={String(href)} className="rounded-lg border border-slate-100 bg-slate-50 p-3 hover:bg-slate-100"><div className="text-[9px] text-slate-400">{label}</div><div className="mt-1 text-lg font-bold">{value}</div></Link>)}</div></div>
        </section>

        <footer className="mt-5 border-t border-slate-200 pt-4 text-center text-[10px] text-slate-400">© 2026 Compliance OS. All rights reserved.</footer>
      </div>
    </div>
  );
}
