"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FolderOpen,
  Gauge,
  ListChecks,
  MapPin,
  Network,
  ShieldAlert,
  ShieldCheck,
  Target,
  Users,
  Workflow,
  XCircle,
} from "lucide-react";
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
    current_score?: number | null;
    risk_level?: string | null;
    status?: string | null;
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
  approval_status?: string | null;
  created_at?: string | null;
};

type Risk = {
  id: number;
  title?: string | null;
  risk_level?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type Task = {
  id: number;
  title?: string | null;
  status?: string | null;
  priority_score?: number | null;
  due_date?: string | null;
  created_at?: string | null;
};

type CurrentUser = {
  full_name?: string | null;
  username?: string | null;
  role?: string | null;
};

type TrendPoint = {
  date: string;
  risk_exposure_pct?: number;
  approvals?: number;
};

type CoverageItem = {
  id: number;
  code: string;
  type: Standard["type"];
  score: number;
};

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value: number): number {
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

function statusText(status: Status): string {
  return status === "good" ? "Good" : status === "warning" ? "Warning" : "Critical";
}

function formatDate(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Bar({ value, tone = "bg-emerald-500" }: { value: number; tone?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${clamp(value)}%` }} />
    </div>
  );
}

function Donut({ value, label, tone = "#22c55e" }: { value: number; label: string; tone?: string }) {
  const safe = clamp(value);
  return (
    <div
      className="relative h-28 w-28 shrink-0 rounded-full"
      style={{ background: `conic-gradient(${tone} ${safe * 3.6}deg, #e5e7eb 0deg)` }}
    >
      <div className="absolute inset-[10px] flex flex-col items-center justify-center rounded-full bg-white">
        <span className="text-xl font-bold text-slate-900">{Math.round(safe)}</span>
        <span className="text-[10px] text-slate-500">{label}</span>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  href,
  tone,
  accent,
}: {
  title: string;
  value: string | number;
  subtitle: ReactNode;
  icon: ReactNode;
  href?: string;
  tone: string;
  accent?: string;
}) {
  const content = (
    <div className="h-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>{icon}</div>
        {accent && <span className="text-[10px] font-semibold text-emerald-600">{accent}</span>}
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
  const [controlHealth, setControlHealth] = useState<ControlHealth | null>(null);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [coverage, setCoverage] = useState<CoverageItem[]>([]);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
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
        const [
          summaryRes,
          overviewRes,
          gapsRes,
          healthRes,
          standardsRes,
          evidenceRes,
          risksRes,
          controlsRes,
          tasksRes,
          trendRes,
          userRes,
        ] = await Promise.all([
          safeFetch("/matrix/kpi"),
          safeFetch("/company/intelligence/overview"),
          safeFetch("/company/intelligence/gaps"),
          safeFetch("/company/intelligence/control-health"),
          safeFetch("/standards/"),
          safeFetch("/evidences"),
          safeFetch("/risks?page=1&page_size=100&status=all"),
          safeFetch("/controls/?skip=0&limit=1000"),
          safeFetch("/company/tasks/my"),
          safeFetch("/dashboard/trends?days=180"),
          safeFetch("/auth/me"),
        ]);

        const [
          summaryData,
          overviewData,
          gapsData,
          healthData,
          standardsData,
          evidenceData,
          risksData,
          controlsData,
          tasksData,
          trendData,
          userData,
        ] = await Promise.all([
          readJson<UeeSummary>(summaryRes),
          readJson<IntelligenceOverview>(overviewRes),
          readJson<GapResponse>(gapsRes),
          readJson<ControlHealth>(healthRes),
          readJson<any>(standardsRes),
          readJson<any>(evidenceRes),
          readJson<any>(risksRes),
          readJson<any>(controlsRes),
          readJson<any>(tasksRes),
          readJson<any>(trendRes),
          readJson<CurrentUser>(userRes),
        ]);

        if (!mounted) return;

        if (summaryData) setSummary(summaryData);
        if (overviewData) setOverview(overviewData);
        if (gapsData) setGaps(gapsData);
        if (healthData) setControlHealth(healthData);

        const standardItems = Array.isArray(standardsData)
          ? standardsData
          : Array.isArray(standardsData?.items)
            ? standardsData.items
            : [];
        setStandards(standardItems);

        const evidenceItems = Array.isArray(evidenceData)
          ? evidenceData
          : Array.isArray(evidenceData?.items)
            ? evidenceData.items
            : Array.isArray(evidenceData?.evidences)
              ? evidenceData.evidences
              : [];
        setEvidences(evidenceItems);

        const riskItems = Array.isArray(risksData)
          ? risksData
          : Array.isArray(risksData?.items)
            ? risksData.items
            : Array.isArray(risksData?.risks)
              ? risksData.risks
              : [];
        setRisks(riskItems);

        const controlItems = Array.isArray(controlsData)
          ? controlsData
          : Array.isArray(controlsData?.items)
            ? controlsData.items
            : [];
        setControlsCount(controlItems.length);

        const taskItems = Array.isArray(tasksData?.tasks)
          ? tasksData.tasks
          : Array.isArray(tasksData)
            ? tasksData
            : [];
        setTasks(taskItems);

        if (trendData) {
          const approvals = Array.isArray(trendData.evidence_approvals_daily)
            ? trendData.evidence_approvals_daily
            : [];
          const exposure = Array.isArray(trendData.risk_exposure_trend)
            ? trendData.risk_exposure_trend
            : [];
          const byDate = new Map<string, TrendPoint>();
          for (const item of exposure) {
            byDate.set(item.date, {
              date: item.date,
              risk_exposure_pct: num(item.risk_exposure_pct),
            });
          }
          for (const item of approvals) {
            const existing = byDate.get(item.date);
            if (existing) existing.approvals = num(item.count);
            else byDate.set(item.date, { date: item.date, approvals: num(item.count) });
          }
          setTrend(Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date)));
        }

        if (userData) setUser(userData);

        const result = await Promise.all(
          standardItems.map(async (standard: Standard) => {
            try {
              const res = await safeFetch(`/matrix?standard_id=${standard.id}`);
              if (!res?.ok) return null;
              const data = await res.json();
              const rows: MatrixRow[] = Array.isArray(data?.rows) ? data.rows : [];
              if (!rows.length) {
                return { id: standard.id, code: standard.code, type: standard.type, score: 0 };
              }
              if (data?.mode === "maturity" || standard.type === "MATURITY_BASED") {
                const valid = rows.filter((row) => num(row.target_level) > 0);
                const score = valid.length
                  ? valid.reduce(
                      (sum, row) => sum + clamp((num(row.achieved_level) / num(row.target_level)) * 100),
                      0,
                    ) / valid.length
                  : 0;
                return { id: standard.id, code: standard.code, type: standard.type, score: Math.round(score) };
              }
              const covered = rows.filter((row) =>
                ["COVERED", "ACHIEVED", "PARTIAL", "PARTIALLY_ACHIEVED"].includes(
                  String(row.coverage_status || "").toUpperCase(),
                ),
              ).length;
              return {
                id: standard.id,
                code: standard.code,
                type: standard.type,
                score: Math.round((covered / rows.length) * 100),
              };
            } catch {
              return null;
            }
          }),
        );

        if (mounted) setCoverage(result.filter(Boolean) as CoverageItem[]);
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
      const status = String(evidence.approval_status || evidence.status || "").toLowerCase();
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

  const taskStats = useMemo(() => {
    const result = { completed: 0, inProgress: 0, overdue: 0, notStarted: 0 };
    const now = Date.now();
    for (const task of tasks) {
      const status = String(task.status || "").toLowerCase();
      if (["closed", "completed", "done", "resolved"].includes(status)) result.completed += 1;
      else if (task.due_date && new Date(task.due_date).getTime() < now) result.overdue += 1;
      else if (["in_progress", "in progress", "working"].includes(status)) result.inProgress += 1;
      else result.notStarted += 1;
    }
    return result;
  }, [tasks]);

  const activities = useMemo(() => {
    const items = [
      ...evidences.slice(0, 4).map((item) => ({
        id: `e-${item.id}`,
        title: `Evidence ${item.title || `#${item.id}`} updated`,
        meta: "Evidence Management",
        time: formatDate(item.created_at),
        icon: "evidence" as const,
      })),
      ...risks.slice(0, 4).map((item) => ({
        id: `r-${item.id}`,
        title: `Risk ${item.title || `#${item.id}`} was updated`,
        meta: `${item.risk_level || "Risk"} Risk`,
        time: formatDate(item.created_at),
        icon: "risk" as const,
      })),
      ...tasks.slice(0, 3).map((item) => ({
        id: `t-${item.id}`,
        title: `Task ${item.title || `#${item.id}`} updated`,
        meta: "Remediation",
        time: formatDate(item.created_at),
        icon: "task" as const,
      })),
    ];
    return items.slice(0, 8);
  }, [evidences, risks, tasks]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 text-sm text-slate-500">
        Loading Company Home...
      </div>
    );
  }

  const dashboardOverview: IntelligenceOverview = overview ?? {
    summary: {
      total_risks: risks.length,
      open_risks: risks.filter((r) => String(r.status || "").toLowerCase() === "open").length,
      forecasted_risks: 0,
      high_probability_risks: 0,
      executive_alerts: 0,
      avg_escalation_probability: 0,
    },
    top_risks: [],
    top_controls: [],
    executive_alerts: [],
  };

  const complianceHealth = clamp(num(summary?.compliance_health_index));
  const exposure = clamp(num(summary?.unified_exposure_score));
  const complianceStatus = healthStatus(complianceHealth);
  const exposureState = exposureStatus(exposure);
  const totalRisks = num(dashboardOverview.summary.total_risks, risks.length);
  const openRisks = num(dashboardOverview.summary.open_risks, totalRisks);
  const totalGaps = num(gaps?.summary?.gaps_total);
  const openTasks = num(controlHealth?.open_tasks, tasks.length);
  const executiveAlerts = dashboardOverview.executive_alerts ?? [];
  const topRisks = dashboardOverview.top_risks ?? [];
  const topControls = dashboardOverview.top_controls ?? [];
  const chartData = trend.slice(-6);
  const latestExposure = chartData.length ? num(chartData[chartData.length - 1].risk_exposure_pct) : exposure;
  const standardAverage = coverage.length
    ? Math.round(coverage.reduce((sum, item) => sum + item.score, 0) / coverage.length)
    : num(summary?.indices?.coverage);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1700px] p-5 lg:p-6">
        <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Company Home</h1>
            <p className="mt-1 text-sm text-slate-500">
              Welcome back, {user?.full_name || user?.username || "User"}! Here is your compliance overview.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium">Demo Company A.Ş.</div>
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
              Reporting Period <span className="ml-2 font-semibold">Aug 2026</span>
            </div>
            <Link href="/settings/scoring" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
              Scoring
            </Link>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <KpiCard
            title="Compliance Health"
            value={`${Math.round(complianceHealth)}%`}
            subtitle={`${statusText(complianceStatus)} compliance health`}
            icon={<ShieldCheck size={20} />}
            href="/dashboard"
            tone="bg-emerald-50 text-emerald-600"
          />
          <KpiCard
            title="Standards"
            value={standards.length}
            subtitle="Active standards"
            icon={<BookOpen size={20} />}
            href="/standards"
            tone="bg-blue-50 text-blue-600"
          />
          <KpiCard
            title="Controls"
            value={controlsCount}
            subtitle="Active controls"
            icon={<ClipboardCheck size={20} />}
            href="/controls"
            tone="bg-violet-50 text-violet-600"
          />
          <KpiCard
            title="Risks"
            value={openRisks}
            subtitle={<>{totalRisks} total risks {riskStats.critical > 0 && <span className="ml-1 text-red-500">{riskStats.critical} Critical</span>}</>}
            icon={<AlertTriangle size={20} />}
            href="/risks"
            tone="bg-red-50 text-red-600"
          />
          <KpiCard
            title="Evidence"
            value={evidences.length}
            subtitle={<>{evidenceStats.approved} Approved <span className="ml-1 text-amber-600">{evidenceStats.pending} Pending</span></>}
            icon={<FileCheck2 size={20} />}
            href="/evidences"
            tone="bg-cyan-50 text-cyan-600"
          />
          <KpiCard
            title="Gaps"
            value={totalGaps}
            subtitle={<>{openTasks} remediation tasks</>}
            icon={<Target size={20} />}
            href="/gaps"
            tone="bg-amber-50 text-amber-600"
          />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <Section title="Compliance Health Trend" subtitle="Overall compliance posture over the selected period" className="xl:col-span-2">
            <div className="mb-4 flex flex-wrap gap-4 text-[11px] text-slate-500">
              <span className="flex items-center gap-2"><i className="h-2 w-5 rounded-full bg-emerald-500" /> Overall Compliance</span>
              <span className="flex items-center gap-2"><i className="h-2 w-5 rounded-full bg-blue-500" /> Control Coverage</span>
              <span className="flex items-center gap-2"><i className="h-2 w-5 rounded-full bg-violet-500" /> Evidence Strength</span>
              <span className="flex items-center gap-2"><i className="h-2 w-5 rounded-full bg-red-500" /> Risk Exposure</span>
            </div>
            <div className="space-y-4">
              <div>
                <div className="mb-1 flex justify-between text-xs"><span>Overall Compliance</span><strong>{Math.round(complianceHealth)}%</strong></div>
                <Bar value={complianceHealth} tone="bg-emerald-500" />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs"><span>Control Coverage</span><strong>{Math.round(num(summary?.indices?.coverage, standardAverage))}%</strong></div>
                <Bar value={num(summary?.indices?.coverage, standardAverage)} tone="bg-blue-500" />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs"><span>Evidence Strength</span><strong>{Math.round(num(summary?.indices?.evidence))}%</strong></div>
                <Bar value={num(summary?.indices?.evidence)} tone="bg-violet-500" />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs"><span>Risk Exposure</span><strong>{Math.round(latestExposure)}%</strong></div>
                <Bar value={latestExposure} tone="bg-red-500" />
              </div>
            </div>
            {chartData.length > 0 && (
              <div className="mt-5 grid grid-cols-6 gap-2 border-t border-slate-100 pt-4">
                {chartData.map((point) => (
                  <div key={point.date} className="text-center">
                    <div className="mx-auto mb-2 flex h-20 items-end justify-center gap-1">
                      <div className="w-2 rounded-t bg-emerald-500" style={{ height: `${Math.max(6, complianceHealth * 0.7)}%` }} />
                      <div className="w-2 rounded-t bg-blue-500" style={{ height: `${Math.max(6, num(summary?.indices?.coverage) * 0.7)}%` }} />
                      <div className="w-2 rounded-t bg-red-400" style={{ height: `${Math.max(6, num(point.risk_exposure_pct) * 0.7)}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-400">{formatDate(point.date)}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Compliance by Standard" subtitle="Current coverage / maturity posture">
            <div className="space-y-4">
              {coverage.length > 0 ? coverage.slice(0, 6).map((item) => (
                <div key={item.id}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">{item.code}</span>
                    <strong>{item.score}%</strong>
                  </div>
                  <Bar value={item.score} tone={item.score >= 75 ? "bg-emerald-500" : "bg-amber-500"} />
                </div>
              )) : (
                <div className="rounded-lg bg-slate-50 p-4 text-xs text-slate-500">Standard coverage data is not available yet.</div>
              )}
            </div>
            <Link href="/standards" className="mt-5 inline-flex text-xs font-semibold text-blue-600">View all</Link>
          </Section>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <Section title="Critical Actions" subtitle="Executive attention items" className="xl:col-span-2">
            <div className="space-y-2">
              {(executiveAlerts.length > 0 ? executiveAlerts : topRisks.slice(0, 5)).slice(0, 5).map((item: any, index) => (
                <Link key={`${item.risk_id}-${index}`} href={`/risks/${item.risk_id}`} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 transition hover:border-slate-300 hover:bg-slate-50">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded-lg bg-red-50 p-2 text-red-500"><AlertTriangle size={16} /></div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{item.title || `Risk #${item.risk_id}`}</div>
                      <div className="text-[11px] text-slate-500">{item.control_code || "Risk Intelligence"} · {item.risk_level || "Risk"}</div>
                    </div>
                  </div>
                  <span className="ml-3 shrink-0 rounded-md bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-600">{Math.round(num(item.escalation_probability_30d) * 100)}% probability</span>
                </Link>
              ))}
              {executiveAlerts.length === 0 && topRisks.length === 0 && <div className="p-4 text-xs text-slate-500">No critical actions currently identified.</div>}
            </div>
          </Section>

          <Section title="AI Executive Intelligence" subtitle="Forecast and escalation signals">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 p-3"><div className="text-[10px] text-slate-500">Forecasted Risks</div><div className="mt-1 text-xl font-bold">{dashboardOverview.summary.forecasted_risks}</div></div>
              <div className="rounded-lg bg-slate-50 p-3"><div className="text-[10px] text-slate-500">High Probability</div><div className="mt-1 text-xl font-bold">{dashboardOverview.summary.high_probability_risks}</div></div>
              <div className="rounded-lg bg-slate-50 p-3"><div className="text-[10px] text-slate-500">Executive Alerts</div><div className="mt-1 text-xl font-bold text-red-600">{dashboardOverview.summary.executive_alerts}</div></div>
              <div className="rounded-lg bg-slate-50 p-3"><div className="text-[10px] text-slate-500">Avg. Escalation</div><div className="mt-1 text-xl font-bold">{Math.round(num(dashboardOverview.summary.avg_escalation_probability) * 100)}%</div></div>
            </div>
            <div className="mt-4 rounded-lg border border-slate-200 p-3">
              <div className="mb-2 text-xs font-semibold">AI Priority Controls</div>
              <div className="space-y-2">
                {topControls.slice(0, 3).map((control) => (
                  <div key={control.control_id} className="flex items-center justify-between text-xs">
                    <span>{control.control_code || `Control #${control.control_id}`}</span>
                    <strong>{num(control.ai_priority_score).toFixed(1)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </Section>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-4">
          <Section title="Risk Summary" subtitle={`Total Risks: ${totalRisks}`}>
            <div className="flex items-center gap-4">
              <Donut value={totalRisks ? (riskStats.critical / totalRisks) * 100 : 0} label="Critical" tone="#ef4444" />
              <div className="flex-1 space-y-2 text-xs">
                <div className="flex justify-between"><span>Critical</span><strong>{riskStats.critical}</strong></div>
                <div className="flex justify-between"><span>High</span><strong>{riskStats.high}</strong></div>
                <div className="flex justify-between"><span>Medium</span><strong>{riskStats.medium}</strong></div>
                <div className="flex justify-between"><span>Low</span><strong>{riskStats.low}</strong></div>
              </div>
            </div>
            <Link href="/risks" className="mt-4 inline-flex text-xs font-semibold text-blue-600">View all risks</Link>
          </Section>

          <Section title="Evidence Status" subtitle={`Total Evidence: ${evidences.length}`}>
            <div className="flex items-center gap-4">
              <Donut value={evidences.length ? (evidenceStats.approved / evidences.length) * 100 : 0} label="Approved" tone="#22c55e" />
              <div className="flex-1 space-y-2 text-xs">
                <div className="flex justify-between"><span>Approved</span><strong>{evidenceStats.approved}</strong></div>
                <div className="flex justify-between"><span>Pending</span><strong>{evidenceStats.pending}</strong></div>
                <div className="flex justify-between"><span>Rejected</span><strong>{evidenceStats.rejected}</strong></div>
                <div className="flex justify-between"><span>Draft</span><strong>{evidenceStats.draft}</strong></div>
              </div>
            </div>
            <Link href="/evidences" className="mt-4 inline-flex text-xs font-semibold text-blue-600">View all evidence</Link>
          </Section>

          <Section title="Remediation Status" subtitle={`Total Tasks: ${tasks.length}`}>
            <div className="space-y-3 text-xs">
              <div><div className="mb-1 flex justify-between"><span>Completed</span><strong>{taskStats.completed}</strong></div><Bar value={tasks.length ? (taskStats.completed / tasks.length) * 100 : 0} /></div>
              <div><div className="mb-1 flex justify-between"><span>In Progress</span><strong>{taskStats.inProgress}</strong></div><Bar value={tasks.length ? (taskStats.inProgress / tasks.length) * 100 : 0} tone="bg-blue-500" /></div>
              <div><div className="mb-1 flex justify-between"><span>Overdue</span><strong className="text-red-600">{taskStats.overdue}</strong></div><Bar value={tasks.length ? (taskStats.overdue / tasks.length) * 100 : 0} tone="bg-red-500" /></div>
              <div><div className="mb-1 flex justify-between"><span>Not Started</span><strong>{taskStats.notStarted}</strong></div><Bar value={tasks.length ? (taskStats.notStarted / tasks.length) * 100 : 0} tone="bg-slate-400" /></div>
            </div>
            <Link href="/company/tasks" className="mt-4 inline-flex text-xs font-semibold text-blue-600">View remediation center</Link>
          </Section>

          <Section title="Overdue Tasks" subtitle="Current remediation pressure">
            <div className="flex min-h-28 flex-col items-center justify-center">
              <div className="text-4xl font-bold text-red-500">{taskStats.overdue}</div>
              <div className="mt-1 text-xs font-semibold text-red-600">High Priority Overdue Tasks</div>
              <div className="mt-2 text-[10px] text-slate-400">Open tasks: {openTasks}</div>
            </div>
            <Link href="/company/tasks" className="mt-4 inline-flex text-xs font-semibold text-blue-600">View tasks</Link>
          </Section>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <Section title="Quick Actions" subtitle="Common executive workflows" className="xl:col-span-2">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {[
                ["New Risk", "/risks/create", <AlertTriangle size={20} />],
                ["New Objective", "/objectives/create", <Target size={20} />],
                ["New Process", "/processes/create", <Workflow size={20} />],
                ["Add Standard", "/standards/create", <BookOpen size={20} />],
                ["Add Evidence", "/evidences", <FolderOpen size={20} />],
                ["Create Remediation", "/company/tasks/create", <ListChecks size={20} />],
                ["New Task", "/company/tasks/create", <CheckCircle2 size={20} />],
              ].map(([label, href, icon]) => (
                <Link key={String(label)} href={String(href)} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-center transition hover:border-slate-300 hover:bg-slate-50">
                  <span className="text-blue-600">{icon}</span>
                  <span className="text-[11px] font-semibold text-slate-700">{label}</span>
                </Link>
              ))}
            </div>
          </Section>

          <Section title="Foundation Snapshot" subtitle="Current enterprise structure">
            <div className="grid grid-cols-3 gap-2">
              <Link href="/processes" className="rounded-lg border border-slate-200 p-3"><Workflow size={16} className="text-emerald-600" /><div className="mt-2 text-[10px] text-slate-500">Processes</div><div className="text-lg font-bold">—</div></Link>
              <Link href="/objectives" className="rounded-lg border border-slate-200 p-3"><Target size={16} className="text-blue-600" /><div className="mt-2 text-[10px] text-slate-500">Objectives</div><div className="text-lg font-bold">—</div></Link>
              <Link href="/risks" className="rounded-lg border border-slate-200 p-3"><AlertTriangle size={16} className="text-red-500" /><div className="mt-2 text-[10px] text-slate-500">Risks</div><div className="text-lg font-bold">{totalRisks}</div></Link>
              <Link href="/standards" className="rounded-lg border border-slate-200 p-3"><BookOpen size={16} className="text-violet-600" /><div className="mt-2 text-[10px] text-slate-500">Standards</div><div className="text-lg font-bold">{standards.length}</div></Link>
              <div className="rounded-lg border border-slate-200 p-3"><Users size={16} className="text-cyan-600" /><div className="mt-2 text-[10px] text-slate-500">Controls</div><div className="text-lg font-bold">{controlsCount}</div></div>
              <div className="rounded-lg border border-slate-200 p-3"><MapPin size={16} className="text-orange-600" /><div className="mt-2 text-[10px] text-slate-500">Evidence</div><div className="text-lg font-bold">{evidences.length}</div></div>
            </div>
          </Section>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <Section title="Recent Activities" subtitle="Latest evidence, risk and remediation events" className="xl:col-span-2">
            <div className="divide-y divide-slate-100">
              {activities.map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="rounded-lg bg-slate-50 p-2 text-slate-500">
                    {item.icon === "evidence" ? <FileCheck2 size={16} /> : item.icon === "risk" ? <AlertTriangle size={16} /> : <ListChecks size={16} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-slate-800">{item.title}</div>
                    <div className="text-[10px] text-slate-400">{item.meta}</div>
                  </div>
                  <span className="shrink-0 text-[10px] text-slate-400">{item.time}</span>
                </div>
              ))}
              {activities.length === 0 && <div className="py-6 text-xs text-slate-500">No recent activities available.</div>}
            </div>
          </Section>

          <Section title="Management Signals" subtitle="At-a-glance intelligence">
            <div className="space-y-4">
              <div className="flex items-center justify-between"><span className="text-xs text-slate-500">Exposure Control</span><strong className="text-sm">{Math.round(100 - exposure)}%</strong></div>
              <Bar value={100 - exposure} />
              <div className="flex items-center justify-between"><span className="text-xs text-slate-500">Standard Coverage</span><strong className="text-sm">{standardAverage}%</strong></div>
              <Bar value={standardAverage} tone="bg-blue-500" />
              <div className="flex items-center justify-between"><span className="text-xs text-slate-500">Evidence Approval</span><strong className="text-sm">{evidences.length ? Math.round((evidenceStats.approved / evidences.length) * 100) : 0}%</strong></div>
              <Bar value={evidences.length ? (evidenceStats.approved / evidences.length) * 100 : 0} tone="bg-violet-500" />
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <div className="font-semibold">Risk posture</div>
                <div className="mt-1 text-slate-500">{statusText(exposureState)} exposure with {riskStats.critical} critical risks.</div>
              </div>
            </div>
          </Section>
        </div>

        <footer className="py-5 text-center text-[10px] text-slate-400">© 2026 Compliance OS. All rights reserved.</footer>
      </div>
    </div>
  );
}
