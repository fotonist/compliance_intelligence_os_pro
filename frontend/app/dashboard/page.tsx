"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  FolderOpen,
  Gauge,
  Layers3,
  ListChecks,
  Network,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import AIInsightBox from "../components/AIInsightBox";
import { apiFetch } from "../lib/api";

type Status = "ok" | "warning" | "critical";

type UeeSummary = {
  indices?: {
    risk?: number;
    coverage?: number;
    maturity?: number;
    evidence?: number;
    task_pressure?: number;
  };
  unified_exposure_score: number;
  compliance_health_index: number;
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

type MatrixResponse = {
  mode?: "control" | "maturity";
  rows?: MatrixRow[];
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
    current_score?: number | null;
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
  linked_risks?: number;
  high_risks?: number;
  critical_risks?: number;
  open_tasks?: number;
  evidence_count?: number;
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

type AIInsight = {
  summary: string;
  root_causes: string[];
  warnings: string[];
  actions: string[];
};

type StandardCoverage = {
  id: number;
  code: string;
  title?: string;
  type: Standard["type"];
  score: number;
};

type ActivityItem = {
  id: string;
  title: string;
  meta: string;
  time: string;
  icon: "evidence" | "risk";
};

function safeNum(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function classifyHealth(value: number): Status {
  if (value >= 75) return "ok";
  if (value >= 50) return "warning";
  return "critical";
}

function classifyExposure(value: number): Status {
  if (value <= 25) return "ok";
  if (value <= 50) return "warning";
  return "critical";
}

function statusClasses(status: Status) {
  if (status === "critical") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (status === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function progressClass(value: number) {
  if (value >= 75) return "bg-emerald-500";
  if (value >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function formatTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Donut({ value, label }: { value: number; label: string }) {
  const safe = clamp(value);
  return (
    <div
      className="relative h-28 w-28 rounded-full"
      style={{
        background: `conic-gradient(#22c55e ${safe * 3.6}deg, #e5e7eb 0deg)`,
      }}
    >
      <div className="absolute inset-[11px] flex flex-col items-center justify-center rounded-full bg-white">
        <span className="text-xl font-bold text-slate-800">{Math.round(safe)}</span>
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
  status,
  accent,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  href?: string;
  status?: Status;
  accent: string;
}) {
  const content = (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}>
          {icon}
        </div>
        {status && (
          <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ${statusClasses(status)}`}>
            {status}
          </span>
        )}
      </div>
      <div className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </div>
      <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
      {href && (
        <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600">
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
  const [standardCoverage, setStandardCoverage] = useState<StandardCoverage[]>([]);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [aiInsight, setAiInsight] = useState<AIInsight | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const [summaryRes, overviewRes, gapsRes, healthRes, standardsRes, evidenceRes, risksRes] =
          await Promise.all([
            apiFetch("/kpi/summary"),
            apiFetch("/company/intelligence/overview"),
            apiFetch("/company/intelligence/gaps"),
            apiFetch("/company/intelligence/control-health"),
            apiFetch("/standards/"),
            apiFetch("/evidences"),
            apiFetch("/risks?page=1&page_size=100&status=all"),
          ]);

        const [summaryData, overviewData, gapsData, healthData, standardsData, evidenceData, risksData] =
          await Promise.all([
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
        setControlHealth(healthData || null);
        setStandards(Array.isArray(standardsData) ? standardsData : []);
        setEvidences(Array.isArray(evidenceData) ? evidenceData : []);
        setRisks(Array.isArray(risksData?.items) ? risksData.items : []);

        const loadedStandards: Standard[] = Array.isArray(standardsData) ? standardsData : [];
        const coverage = await Promise.all(
          loadedStandards.map(async (standard) => {
            try {
              const res = await apiFetch(`/matrix?standard_id=${standard.id}`);
              if (!res.ok) return null;
              const data: MatrixResponse = await res.json();
              const rows = Array.isArray(data.rows) ? data.rows : [];
              if (!rows.length) {
                return { id: standard.id, code: standard.code, title: standard.title, type: standard.type, score: 0 };
              }

              if (data.mode === "maturity" || standard.type === "MATURITY_BASED") {
                const valid = rows.filter(
                  (row) => safeNum(row.target_level) > 0
                );
                const score = valid.length
                  ? valid.reduce(
                      (sum, row) =>
                        sum + clamp((safeNum(row.achieved_level) / safeNum(row.target_level)) * 100),
                      0
                    ) / valid.length
                  : 0;
                return { id: standard.id, code: standard.code, title: standard.title, type: standard.type, score: Math.round(score) };
              }

              const covered = rows.filter((row) => {
                const status = String(row.coverage_status || "").toUpperCase();
                return status === "COVERED" || status === "ACHIEVED";
              }).length;

              return {
                id: standard.id,
                code: standard.code,
                title: standard.title,
                type: standard.type,
                score: Math.round((covered / rows.length) * 100),
              };
            } catch {
              return null;
            }
          })
        );

        if (mounted) setStandardCoverage(coverage.filter(Boolean) as StandardCoverage[]);
      } catch (error) {
        console.error("Company Home load failed:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!summary || !overview || !controlHealth) return;

    let mounted = true;
    setAiLoading(true);

    apiFetch("/ai/dashboard/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        period_days: 30,
        uee: summary,
        intelligence: overview,
        gaps,
        control_health: controlHealth,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (mounted) setAiInsight(data || null);
      })
      .catch((error) => console.error("AI dashboard insight failed:", error))
      .finally(() => {
        if (mounted) setAiLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [summary, overview, gaps, controlHealth]);

  const evidenceStats = useMemo(() => {
    const result = { approved: 0, pending: 0, rejected: 0, other: 0 };
    for (const evidence of evidences) {
      const status = String(evidence.status || "").toLowerCase();
      if (status.includes("approved")) result.approved += 1;
      else if (status.includes("reject")) result.rejected += 1;
      else if (status.includes("pending") || status.includes("review") || status.includes("upload")) result.pending += 1;
      else result.other += 1;
    }
    return result;
  }, [evidences]);

  const riskStats = useMemo(() => {
    const result = { critical: 0, high: 0, other: 0 };
    for (const risk of risks) {
      const level = String(risk.risk_level || "").toLowerCase();
      if (level === "critical") result.critical += 1;
      else if (level === "high") result.high += 1;
      else result.other += 1;
    }
    return result;
  }, [risks]);

  const activities = useMemo<ActivityItem[]>(() => {
    const evidenceItems = evidences.slice(0, 5).map((item) => ({
      id: `e-${item.id}`,
      title: `Evidence ${item.title || `#${item.id}`} updated`,
      meta: "Evidence Management",
      time: formatTime(item.created_at),
      icon: "evidence" as const,
    }));

    const riskItems = risks.slice(0, 5).map((item) => ({
      id: `r-${item.id}`,
      title: `Risk ${item.title || `#${item.id}`} updated`,
      meta: `${item.risk_level || "Risk"} Risk`,
      time: formatTime(item.created_at),
      icon: "risk" as const,
    }));

    return [...evidenceItems, ...riskItems]
      .sort((a, b) => (a.time < b.time ? 1 : -1))
      .slice(0, 7);
  }, [evidences, risks]);

  if (loading || !summary || !overview) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 text-slate-500">
        Loading Company Home…
      </div>
    );
  }

  const health = safeNum(summary.compliance_health_index);
  const exposure = safeNum(summary.unified_exposure_score);
  const healthStatus = classifyHealth(health);
  const exposureStatus = classifyExposure(exposure);
  const totalRisks = safeNum(overview.summary.total_risks);
  const openRisks = safeNum(overview.summary.open_risks);
  const totalGaps = safeNum(gaps?.summary?.gaps_total);
  const criticalActions = overview.executive_alerts?.length || 0;
  const openTasks = safeNum(controlHealth?.open_tasks);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1600px] space-y-6 p-5 lg:p-7">
        {/* HEADER */}
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
              <ShieldCheck size={15} /> Compliance Intelligence OS
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Company Home</h1>
            <p className="mt-1 text-sm text-slate-500">
              Your compliance, risk, evidence and remediation overview.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
              Demo Company A.Ş.
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
              Reporting Period: <span className="font-semibold text-slate-900">Current</span>
            </div>
            <Link href="/settings/scoring" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Gauge size={15} /> Customize Dashboard
            </Link>
          </div>
        </header>

        {/* HEALTH BANNER */}
        <div className={`flex flex-col gap-2 rounded-xl border px-5 py-3 text-sm lg:flex-row lg:items-center lg:justify-between ${statusClasses(exposureStatus)}`}>
          <div className="flex items-center gap-2 font-semibold">
            {exposureStatus === "critical" ? <ShieldAlert size={17} /> : exposureStatus === "warning" ? <TriangleAlert size={17} /> : <CheckCircle2 size={17} />}
            {exposureStatus === "critical"
              ? "Unified exposure is critical. Immediate remediation is required."
              : exposureStatus === "warning"
                ? "Unified exposure is in the warning zone. Monitoring and remediation are recommended."
                : "Key compliance indicators are within acceptable thresholds."}
          </div>
          <div className="text-xs font-medium opacity-80">
            Exposure {exposure.toFixed(1)} · Health {health.toFixed(1)}
          </div>
        </div>

        {/* KPI ROW */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <KpiCard
            title="Compliance Health"
            value={`${Math.round(health)}%`}
            subtitle="Unified compliance health index"
            icon={<ShieldCheck size={20} className="text-emerald-600" />}
            status={healthStatus}
            accent="bg-emerald-50"
          />
          <KpiCard
            title="Standards"
            value={standards.length}
            subtitle="Active standards"
            icon={<BookOpen size={20} className="text-blue-600" />}
            href="/standards"
            accent="bg-blue-50"
          />
          <KpiCard
            title="Controls"
            value={standardCoverage.filter((x) => x.type === "CONTROL_BASED").reduce((sum, x) => sum + Math.round((x.score / 100) * 100), 0) || "—"}
            subtitle="Control-based framework rows"
            icon={<Layers3 size={20} className="text-violet-600" />}
            href="/matrix"
            accent="bg-violet-50"
          />
          <KpiCard
            title="Risks"
            value={totalRisks}
            subtitle={`${openRisks} open · ${overview.summary.high_probability_risks} high probability`}
            icon={<AlertTriangle size={20} className="text-amber-600" />}
            href="/risks"
            accent="bg-amber-50"
          />
          <KpiCard
            title="Evidence"
            value={evidences.length}
            subtitle={`${evidenceStats.approved} approved · ${evidenceStats.pending} pending`}
            icon={<FolderOpen size={20} className="text-cyan-600" />}
            href="/evidences"
            accent="bg-cyan-50"
          />
          <KpiCard
            title="Gaps"
            value={totalGaps}
            subtitle={`${safeNum(gaps?.summary?.uncovered)} uncovered · ${safeNum(gaps?.summary?.partial)} partial`}
            icon={<Target size={20} className="text-rose-600" />}
            href="/intelligence/gaps"
            accent="bg-rose-50"
          />
        </section>

        {/* AI INSIGHTS */}
        <section className="rounded-xl border border-indigo-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-indigo-100 bg-indigo-50/60 px-5 py-3">
            <BarChart3 size={17} className="text-indigo-600" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-indigo-700">AI Executive Insights</div>
              <div className="text-xs text-slate-500">Cross-module intelligence from risk, coverage, evidence and remediation signals.</div>
            </div>
          </div>
          <div className="p-5">
            <AIInsightBox insight={aiInsight} loading={aiLoading} />
          </div>
        </section>

        {/* MAIN INTELLIGENCE GRID */}
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.35fr_0.9fr_1fr]">
          {/* DRIVERS */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900">Compliance Intelligence Drivers</h2>
                <p className="mt-1 text-xs text-slate-500">Current factors influencing the unified exposure score.</p>
              </div>
              <Link href="/intelligence" className="text-xs font-semibold text-blue-600">View intelligence</Link>
            </div>

            <div className="mt-6 space-y-5">
              {[
                ["Risk Pressure", safeNum(summary.indices?.risk)],
                ["Control Coverage", safeNum(summary.indices?.coverage)],
                ["Maturity Pressure", safeNum(summary.indices?.maturity)],
                ["Evidence Pressure", safeNum(summary.indices?.evidence)],
                ["Task Pressure", safeNum(summary.indices?.task_pressure)],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-600">{label}</span>
                    <span className="font-bold text-slate-900">{safeNum(value).toFixed(1)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${progressClass(safeNum(value))}`} style={{ width: `${clamp(safeNum(value))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* STANDARD COVERAGE */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900">Compliance by Standard</h2>
                <p className="mt-1 text-xs text-slate-500">Calculated from the current compliance matrix.</p>
              </div>
              <Link href="/matrix" className="text-xs font-semibold text-blue-600">View all</Link>
            </div>

            <div className="mt-5 space-y-5">
              {standardCoverage.length === 0 ? (
                <div className="rounded-lg bg-slate-50 p-4 text-xs text-slate-500">No matrix coverage data available.</div>
              ) : (
                standardCoverage.map((item) => (
                  <div key={item.id}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                      <span className="font-semibold text-slate-700">{item.code}</span>
                      <span className="font-bold text-slate-900">{item.score}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${progressClass(item.score)}`} style={{ width: `${item.score}%` }} />
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400">{item.type === "MATURITY_BASED" ? "Maturity achievement" : "Control coverage"}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* CRITICAL ACTIONS */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900">Critical Actions</h2>
                <p className="mt-1 text-xs text-slate-500">Executive alerts requiring attention.</p>
              </div>
              <Link href="/intelligence" className="text-xs font-semibold text-blue-600">View all</Link>
            </div>

            <div className="mt-4 space-y-2">
              {(overview.executive_alerts || []).slice(0, 5).map((alert) => (
                <Link key={alert.risk_id} href={`/risks/${alert.risk_id}`} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-3 hover:bg-slate-50">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                    <AlertTriangle size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-slate-800">{alert.title || `Risk #${alert.risk_id}`}</div>
                    <div className="mt-1 text-[10px] text-slate-500">
                      {alert.control_code || "No linked control"} · {Math.round(alert.escalation_probability_30d * 100)}% escalation probability
                    </div>
                  </div>
                  <ArrowUpRight size={13} className="text-slate-400" />
                </Link>
              ))}

              {criticalActions === 0 && (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-xs text-emerald-700">No executive alerts currently require action.</div>
              )}
            </div>
          </div>
        </section>

        {/* LOWER SUMMARY */}
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr_1fr_0.7fr_1.2fr]">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-slate-900">Risk Summary</h3>
            <div className="mt-5 flex items-center gap-5">
              <Donut value={totalRisks ? (riskStats.critical / totalRisks) * 100 : 0} label="Critical" />
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between gap-5"><span className="text-slate-500">Critical</span><b>{riskStats.critical}</b></div>
                <div className="flex items-center justify-between gap-5"><span className="text-slate-500">High</span><b>{riskStats.high}</b></div>
                <div className="flex items-center justify-between gap-5"><span className="text-slate-500">Other</span><b>{riskStats.other}</b></div>
              </div>
            </div>
            <Link href="/risks" className="mt-4 inline-flex text-xs font-semibold text-blue-600">View all risks</Link>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-slate-900">Evidence Status</h3>
            <div className="mt-5 flex items-center gap-5">
              <Donut value={evidences.length ? (evidenceStats.approved / evidences.length) * 100 : 0} label="Approved" />
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between gap-5"><span className="text-slate-500">Approved</span><b>{evidenceStats.approved}</b></div>
                <div className="flex items-center justify-between gap-5"><span className="text-slate-500">Pending</span><b>{evidenceStats.pending}</b></div>
                <div className="flex items-center justify-between gap-5"><span className="text-slate-500">Rejected</span><b>{evidenceStats.rejected}</b></div>
              </div>
            </div>
            <Link href="/evidences" className="mt-4 inline-flex text-xs font-semibold text-blue-600">View all evidence</Link>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-slate-900">Remediation Status</h3>
            <div className="mt-5 flex items-center gap-5">
              <Donut value={openTasks ? 100 - Math.min(100, openTasks * 5) : 100} label="Health" />
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between gap-5"><span className="text-slate-500">Open tasks</span><b>{openTasks}</b></div>
                <div className="flex items-center justify-between gap-5"><span className="text-slate-500">Open gaps</span><b>{totalGaps}</b></div>
                <div className="flex items-center justify-between gap-5"><span className="text-slate-500">Worst gap</span><b>{safeNum(gaps?.summary?.worst_severity_score).toFixed(1)}</b></div>
              </div>
            </div>
            <Link href="/company/remediation" className="mt-4 inline-flex text-xs font-semibold text-blue-600">View remediation center</Link>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-slate-900">Exposure</h3>
            <div className="mt-5 flex flex-col items-center">
              <Donut value={100 - exposure} label="Health" />
              <div className={`mt-3 rounded-full border px-3 py-1 text-[10px] font-bold uppercase ${statusClasses(exposureStatus)}`}>
                {exposureStatus}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Recent Activities</h3>
              <Link href="/admin/logs" className="text-xs font-semibold text-blue-600">View all</Link>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {activities.length === 0 ? (
                <div className="py-4 text-xs text-slate-500">No recent activity available.</div>
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="flex items-center gap-3 py-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
                      {activity.icon === "evidence" ? <FileCheck2 size={14} /> : <AlertTriangle size={14} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium text-slate-700">{activity.title}</div>
                      <div className="text-[10px] text-slate-400">{activity.meta}</div>
                    </div>
                    <span className="whitespace-nowrap text-[10px] text-slate-400">{activity.time}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* QUICK ACTIONS + FOUNDATION */}
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">Quick Actions</h2>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {[
                ["New Risk", "/risks/create", <ShieldAlert size={18} />],
                ["New Objective", "/company/objectives", <Target size={18} />],
                ["New Process", "/company/processes", <Network size={18} />],
                ["Add Standard", "/standards", <BookOpen size={18} />],
                ["Add Evidence", "/evidences", <FolderOpen size={18} />],
                ["Remediation", "/company/remediation", <Activity size={18} />],
                ["New Task", "/company/tasks/create", <ListChecks size={18} />],
              ].map(([label, href, icon]) => (
                <Link key={String(label)} href={String(href)} className="flex min-h-24 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-2 text-center hover:border-blue-200 hover:bg-blue-50">
                  <div className="mb-2 text-blue-600">{icon}</div>
                  <span className="text-[11px] font-semibold text-slate-700">{label}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900">Foundation Snapshot</h2>
                <p className="mt-1 text-xs text-slate-500">Core governance objects available to the company.</p>
              </div>
              <Link href="/company/profile" className="text-xs font-semibold text-blue-600">View all</Link>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Link href="/company/processes" className="rounded-lg border border-slate-100 bg-slate-50 p-3"><Network size={15} className="text-emerald-600" /><div className="mt-2 text-lg font-bold">—</div><div className="text-[10px] text-slate-500">Processes</div></Link>
              <Link href="/standards" className="rounded-lg border border-slate-100 bg-slate-50 p-3"><BookOpen size={15} className="text-blue-600" /><div className="mt-2 text-lg font-bold">{standards.length}</div><div className="text-[10px] text-slate-500">Standards</div></Link>
              <Link href="/risks" className="rounded-lg border border-slate-100 bg-slate-50 p-3"><AlertTriangle size={15} className="text-amber-600" /><div className="mt-2 text-lg font-bold">{totalRisks}</div><div className="text-[10px] text-slate-500">Open risk universe</div></Link>
              <Link href="/evidences" className="rounded-lg border border-slate-100 bg-slate-50 p-3"><FolderOpen size={15} className="text-cyan-600" /><div className="mt-2 text-lg font-bold">{evidences.length}</div><div className="text-[10px] text-slate-500">Evidence</div></Link>
              <Link href="/matrix" className="rounded-lg border border-slate-100 bg-slate-50 p-3"><Layers3 size={15} className="text-violet-600" /><div className="mt-2 text-lg font-bold">{standardCoverage.length}</div><div className="text-[10px] text-slate-500">Frameworks evaluated</div></Link>
              <Link href="/intelligence/gaps" className="rounded-lg border border-slate-100 bg-slate-50 p-3"><TriangleAlert size={15} className="text-rose-600" /><div className="mt-2 text-lg font-bold">{totalGaps}</div><div className="text-[10px] text-slate-500">Open gaps</div></Link>
            </div>
          </div>
        </section>

        <footer className="border-t border-slate-200 pt-4 text-center text-[10px] text-slate-400">
          © 2026 Compliance OS. All rights reserved.
        </footer>
      </div>
    </div>
  );
}
