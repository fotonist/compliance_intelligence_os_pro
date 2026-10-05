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

type RemediationSummary = {
  total: number;
  active: number;
  overdue: number;
  due_soon: number;
  high_priority: number;
  awaiting_review: number;
  completed: number;
};

type RemediationItem = {
  source: string;
  source_id: number;
  title: string;
  description?: string | null;
  status: string;
  normalized_status: string;
  priority?: string | null;
  priority_score?: number | null;
  severity?: string | null;
  process_id?: number | null;
  control_id?: number | null;
  due_date?: string | null;
  overdue: boolean;
  due_soon: boolean;
  awaiting_review: boolean;
  action_url: string;
};

type RemediationResponse = {
  summary: RemediationSummary;
  items: RemediationItem[];
};

type Evidence = {
  id: number;
  title?: string | null;
  status?: string | null;
  approval_status?: string | null;
  created_at?: string | null;
};

type EvidenceSummary = {
  total: number;
  by_assessment_type: Record<string, number>;
  by_status: Record<string, number>;
  by_framework: Array<{
    standard_id: number | null;
    standard_code: string | null;
    assessment_type: string;
    total: number;
  }>;
};

type Risk = {
  id: number;
  title?: string | null;
  risk_level?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type RiskSummary = {
  total: number;
  open: number;
  by_framework_type: {
    control: number;
    maturity: number;
    unlinked: number;
  };
  by_status: Record<string, number>;
  by_level: Record<string, number>;
  by_framework: Array<{
    standard_id: number;
    standard_code: string;
    standard_type: string;
    total: number;
  }>;
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

type OrganizationSummary = {
  id?: number;
  name?: string | null;
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
  score: number | null;
  assessmentCoverage?: number | null;
  calculatedProcesses?: number;
  totalProcesses?: number;
  totalControls?: number;
  coveredControls?: number;
  partialControls?: number;
  notCoveredControls?: number;
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
  const [activeStandards, setActiveStandards] = useState<Standard[]>([]);
  const [coverage, setCoverage] = useState<CoverageItem[]>([]);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [evidenceSummary, setEvidenceSummary] = useState<EvidenceSummary | null>(null);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [riskSummary, setRiskSummary] = useState<RiskSummary | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [remediation, setRemediation] = useState<RemediationResponse | null>(null);
  const [standardControlsCount, setStandardControlsCount] = useState(0);
  const [customControlsCount, setCustomControlsCount] = useState(0);
  const [processesCount, setProcessesCount] = useState(0);
  const [objectivesCount, setObjectivesCount] = useState(0);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [organization, setOrganization] =
    useState<OrganizationSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function safeFetch(path: string): Promise<Response | null> {
      try {
        return await apiFetch(path);
      } catch (error) {
        const message =
          error instanceof Error
            ? `${error.name}: ${error.message}${error.cause ? ` | cause=${String(error.cause)}` : ""}`
            : String(error);

        console.log(`[SAFE_FETCH_FAILURE] path=${path} | ${message}`);
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
          adoptionsRes,
          evidenceRes,
          evidenceSummaryRes,
          risksRes,
          riskSummaryRes,
          controlsRes,
          tasksRes,
          remediationRes,
          processesRes,
          objectivesRes,
          trendRes,
          userRes,
          organizationRes,
        ] = await Promise.all([
          safeFetch("/kpi/summary"),
          safeFetch("/company/intelligence/overview"),
          safeFetch("/company/intelligence/gaps"),
          safeFetch("/company/intelligence/control-health"),
          safeFetch("/standards/"),
          safeFetch("/framework/adoptions?status=ACTIVE"),
          safeFetch("/evidences"),
          safeFetch("/evidences/summary"),
          safeFetch("/risks?page=1&page_size=100&status=all"),
          safeFetch("/risks/summary"),
          safeFetch("/controls/?skip=0&limit=1000"),
          safeFetch("/company/tasks/my"),
          safeFetch("/company/remediation"),
          safeFetch("/company/processes"),
          safeFetch("/company/objectives"),
          safeFetch("/dashboard/trends?days=180"),
          safeFetch("/auth/me"),
          safeFetch("/organizations"),
        ]);

        const [
          summaryData,
          overviewData,
          gapsData,
          controlHealthData,
          standardsData,
          adoptionsData,
          evidenceData,
          evidenceSummaryData,
          risksData,
          riskSummaryData,
          controlsData,
          tasksData,
          remediationData,
          processesData,
          objectivesData,
          trendData,
          userData,
          organizationData,
        ] = await Promise.all([
          readJson<UeeSummary>(summaryRes),
          readJson<IntelligenceOverview>(overviewRes),
          readJson<GapResponse>(gapsRes),
          readJson<ControlHealth>(healthRes),
          readJson<any>(standardsRes),
          readJson<any>(adoptionsRes),
          readJson<any>(evidenceRes),
          readJson<EvidenceSummary>(evidenceSummaryRes),
          readJson<any>(risksRes),
          readJson<RiskSummary>(riskSummaryRes),
          readJson<any>(controlsRes),
          readJson<any>(tasksRes),
          readJson<RemediationResponse>(remediationRes),
          readJson<any>(processesRes),
          readJson<any>(objectivesRes),
          readJson<any>(trendRes),
          readJson<CurrentUser>(userRes),
          readJson<OrganizationSummary[]>(organizationRes),
        ]);

        if (!mounted) return;

        if (summaryData) setSummary(summaryData);
        if (overviewData) setOverview(overviewData);
        if (gapsData) setGaps(gapsData);
        if (controlHealthData) setControlHealth(controlHealthData);

        const standardItems = Array.isArray(standardsData)
          ? standardsData
          : Array.isArray(standardsData?.items)
            ? standardsData.items
            : [];
        setStandards(standardItems);

        const adoptionItems = Array.isArray(adoptionsData)
          ? adoptionsData
          : Array.isArray(adoptionsData?.items)
            ? adoptionsData.items
            : [];

        const activeStandardIds = new Set(
          adoptionItems
            .filter(
              (adoption: any) =>
                String(adoption?.status || "").toUpperCase() === "ACTIVE",
            )
            .map((adoption: any) => num(adoption?.standard_id))
            .filter((standardId: number) => standardId > 0),
        );

        const tenantActiveStandards = standardItems.filter(
          (standard: Standard) => activeStandardIds.has(num(standard.id)),
        );

        setActiveStandards(tenantActiveStandards);

        const evidenceItems = Array.isArray(evidenceData)
          ? evidenceData
          : Array.isArray(evidenceData?.items)
            ? evidenceData.items
            : Array.isArray(evidenceData?.evidences)
              ? evidenceData.evidences
              : [];
        setEvidences(evidenceItems);
        setEvidenceSummary(evidenceSummaryData);

        const riskItems = Array.isArray(risksData)
          ? risksData
          : Array.isArray(risksData?.items)
            ? risksData.items
            : Array.isArray(risksData?.risks)
              ? risksData.risks
              : [];
        setRisks(riskItems);
        setRiskSummary(riskSummaryData);

        const controlItems = Array.isArray(controlsData)
          ? controlsData
          : Array.isArray(controlsData?.items)
            ? controlsData.items
            : [];
        setStandardControlsCount(controlItems.filter((control: any) => String(control?.origin || "canonical").toLowerCase() === "canonical").length);
        setCustomControlsCount(controlItems.filter((control: any) => String(control?.origin || "").toLowerCase() === "custom").length);

        const taskItems = Array.isArray(tasksData?.tasks)
          ? tasksData.tasks
          : Array.isArray(tasksData)
            ? tasksData
            : [];
        setTasks(taskItems);
        setRemediation(
          remediationData &&
          typeof remediationData === "object" &&
          remediationData.summary
            ? (remediationData as RemediationResponse)
            : null
        );


        const processItems = Array.isArray(processesData)
          ? processesData
          : Array.isArray(processesData?.items)
            ? processesData.items
            : [];
        setProcessesCount(processItems.length);

        const objectiveItems = Array.isArray(objectivesData)
          ? objectivesData
          : Array.isArray(objectivesData?.items)
            ? objectivesData.items
            : [];
        setObjectivesCount(objectiveItems.length);

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
        if (organizationData && Array.isArray(organizationData)) {
          setOrganization(organizationData[0] ?? null);
        }

        const result = await Promise.all(
          tenantActiveStandards.map(async (standard: Standard) => {
            try {
              const res = await safeFetch(`/matrix/?standard_id=${standard.id}`);

              if (!res?.ok) {
                let errorBody = "";
                try {
                  errorBody = res ? await res.text() : "NO_RESPONSE";
                } catch {
                  errorBody = "UNREADABLE_RESPONSE";
                }

                console.log(
                  "[COMPANY_HOME_MATRIX_ERROR]",
                  {
                    standardId: standard.id,
                    standardCode: standard.code,
                    status: res?.status ?? null,
                    statusText: res?.statusText ?? null,
                    body: errorBody,
                  },
                );

                return null;
              }

              const data = await res.json();

              console.log(
                "[COMPANY_HOME_MATRIX_OK]",
                {
                  standardId: standard.id,
                  standardCode: standard.code,
                  mode: data?.mode,
                  rowCount: Array.isArray(data?.rows) ? data.rows.length : null,
                },
              );
              const rows: MatrixRow[] = Array.isArray(data?.rows) ? data.rows : [];

              if (data?.mode === "maturity" || standard.type === "MATURITY_BASED") {
                const kpiRes = await safeFetch(
                  `/matrix/kpi?standard_id=${standard.id}`,
                );

                if (!kpiRes?.ok) {
                  return {
                    id: standard.id,
                    code: standard.code,
                    type: standard.type,
                    score: null,
                    assessmentCoverage: null,
                    calculatedProcesses: 0,
                    totalProcesses: rows.length,
                  };
                }

                const maturityKpi = await kpiRes.json();

                return {
                  id: standard.id,
                  code: standard.code,
                  type: standard.type,
                  score:
                    maturityKpi?.target_achievement_percentage == null
                      ? null
                      : num(maturityKpi.target_achievement_percentage),
                  assessmentCoverage:
                    maturityKpi?.assessment_coverage_percentage == null
                      ? null
                      : num(maturityKpi.assessment_coverage_percentage),
                  calculatedProcesses:
                    num(maturityKpi?.maturity?.calculated),
                  totalProcesses:
                    num(maturityKpi?.maturity?.total),
                };
              }

              const kpiRes = await safeFetch(
                `/matrix/kpi?standard_id=${standard.id}`,
              );

              if (!kpiRes?.ok) {
                return {
                  id: standard.id,
                  code: standard.code,
                  type: standard.type,
                  score: null,
                };
              }

              const controlKpi = await kpiRes.json();

              return {
                id: standard.id,
                code: standard.code,
                type: standard.type,
                score:
                  controlKpi?.compliance_percentage == null
                    ? null
                    : num(controlKpi.compliance_percentage),
                totalControls: num(controlKpi?.controls?.total),
                coveredControls: num(controlKpi?.controls?.covered),
                partialControls: num(controlKpi?.controls?.partial),
                notCoveredControls: num(controlKpi?.controls?.not_covered),
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
        meta: "My Task",
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

  const exposure = clamp(num(summary?.unified_exposure_score));
  const exposureState = exposureStatus(exposure);

  const canonicalRiskTotal = riskSummary?.total ?? 0;
  const canonicalRiskCritical = riskSummary?.by_level?.CRITICAL ?? 0;
  const canonicalRiskHigh = riskSummary?.by_level?.HIGH ?? 0;
  const canonicalRiskMedium = riskSummary?.by_level?.MEDIUM ?? 0;
  const canonicalRiskLow =
    (riskSummary?.by_level?.LOW ?? 0) +
    (riskSummary?.by_level?.VERY_LOW ?? 0);

  const remediationSummary = remediation?.summary;
  const remediationTotal = num(remediationSummary?.total);
  const remediationActive = num(remediationSummary?.active);
  const remediationCompleted = num(remediationSummary?.completed);
  const remediationOverdue = num(remediationSummary?.overdue);
  const remediationDueSoon = num(remediationSummary?.due_soon);
  const remediationHighPriority = num(remediationSummary?.high_priority);
  const remediationAwaitingReview = num(remediationSummary?.awaiting_review);
  const executiveAlerts = dashboardOverview.executive_alerts ?? [];
  const topRisks = dashboardOverview.top_risks ?? [];
  const topControls = dashboardOverview.top_controls ?? [];
  const controlBasedFrameworks = activeStandards.filter(
    (standard) => standard.type === "CONTROL_BASED",
  );

  const maturityBasedFrameworks = activeStandards.filter(
    (standard) => standard.type === "MATURITY_BASED",
  );

  const activeControlCount = coverage
    .filter((item) => item.type === "CONTROL_BASED")
    .reduce((sum, item) => sum + (item.totalControls ?? 0), 0);

  const activeMaturityProcessCount = coverage
    .filter((item) => item.type === "MATURITY_BASED")
    .reduce((sum, item) => sum + (item.totalProcesses ?? 0), 0);



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
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium">{organization?.name || "Company"}</div>
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
              Reporting Period <span className="ml-2 font-semibold">Aug 2026</span>
            </div>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-8">
          <KpiCard
            title="Enterprise Health"
            value="N/A"
            subtitle="Unified posture not calculated"
            icon={<ShieldCheck size={20} />}
            href="/dashboard"
            tone="bg-emerald-50 text-emerald-600"
          />

          <KpiCard
            title="Active Frameworks"
            value={activeStandards.length}
            subtitle={
              <>
                {controlBasedFrameworks.length} Control
                <span className="mx-1">&middot;</span>
                {maturityBasedFrameworks.length} Maturity
              </>
            }
            icon={<BookOpen size={20} />}
            href="/standards"
            tone="bg-blue-50 text-blue-600"
          />

          <KpiCard
            title="Control-Based"
            value={controlBasedFrameworks.length}
            subtitle={`${activeControlCount} controls`}
            icon={<ClipboardCheck size={20} />}
            href="/matrix"
            tone="bg-violet-50 text-violet-600"
          />

          <KpiCard
            title="Maturity-Based"
            value={maturityBasedFrameworks.length}
            subtitle={`${activeMaturityProcessCount} processes`}
            icon={<Workflow size={20} />}
            href="/matrix"
            tone="bg-indigo-50 text-indigo-600"
          />

          <KpiCard
            title="Custom Controls"
            value={customControlsCount}
            subtitle="Tenant-defined controls"
            icon={<ShieldCheck size={20} />}
            href="/controls"
            tone="bg-slate-50 text-slate-600"
          />

          <KpiCard
            title="Risks"
            value={riskSummary?.total ?? 0}
            subtitle={
              <>
                {riskSummary?.by_framework_type?.control ?? 0} Control
                <span className="mx-1">&middot;</span>
                {riskSummary?.by_framework_type?.maturity ?? 0} Maturity
                {(riskSummary?.by_framework_type?.unlinked ?? 0) > 0 && (
                  <>
                    <span className="mx-1">&middot;</span>
                    {riskSummary?.by_framework_type?.unlinked ?? 0} Unlinked
                  </>
                )}
              </>
            }
            icon={<AlertTriangle size={20} />}
            href="/risks"
            tone="bg-red-50 text-red-600"
          />

          <KpiCard
            title="Evidence"
            value={evidenceSummary?.total ?? 0}
            subtitle={
              <>
                {evidenceSummary?.by_assessment_type?.control ?? 0} Control
                <span className="ml-1 text-violet-600">
                  {evidenceSummary?.by_assessment_type?.maturity ?? 0} Maturity
                </span>
              </>
            }
            icon={<FileCheck2 size={20} />}
            href="/evidences"
            tone="bg-cyan-50 text-cyan-600"
          />

          <KpiCard
            title="Remediation"
            value={remediationActive}
            subtitle={`${remediationOverdue} overdue / ${remediationTotal} total`}
            icon={<Target size={20} />}
            href="/company/remediation"
            tone="bg-amber-50 text-amber-600"
          />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <Section
            title="Enterprise Intelligence"
            subtitle="Current enterprise signals - no synthetic framework averaging"
            className="xl:col-span-1"
          >
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Enterprise Health
                </div>
                <div className="mt-1 text-2xl font-bold text-slate-700">N/A</div>
                <div className="mt-1 text-[10px] text-slate-500">
                  Unified posture is not calculated until maturity is semantically integrated into UEE.
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Evidence Strength</span>
                  <strong>{Math.round(num(summary?.indices?.evidence))}%</strong>
                </div>
                <Bar value={num(summary?.indices?.evidence)} tone="bg-violet-500" />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Risk Exposure</span>
                  <strong>{Math.round(exposure)}%</strong>
                </div>
                <Bar value={exposure} tone="bg-red-500" />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Active Remediation</span>
                  <strong>{remediationActive}</strong>
                </div>
                <Bar
                  value={
                    remediationTotal
                      ? (remediationActive / remediationTotal) * 100
                      : 0
                  }
                  tone="bg-amber-500"
                />
              </div>

              <div className="rounded-lg border border-slate-200 p-3 text-[10px] text-slate-500">
                Framework posture remains separated below. Control compliance and maturity achievement are not merged into an enterprise percentage.
              </div>
            </div>
          </Section>

          <Section
            title="Framework Posture"
            subtitle="Canonical posture by active framework"
            className="xl:col-span-2"
          >
            <div className="grid gap-4 lg:grid-cols-2">
              {coverage.length > 0 ? (
                coverage.map((item) => {
                  const isMaturity = item.type === "MATURITY_BASED";

                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-200 bg-white p-4"
                    >
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-800">
                            {item.code}
                          </div>
                          <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            {item.type}
                          </div>
                        </div>

                        <span
                          className={`rounded-md px-2 py-1 text-[10px] font-semibold ${
                            isMaturity
                              ? "bg-indigo-50 text-indigo-600"
                              : "bg-blue-50 text-blue-600"
                          }`}
                        >
                          {isMaturity ? "Maturity" : "Control"}
                        </span>
                      </div>

                      {isMaturity ? (
                        <div className="space-y-4">
                          <div>
                            <div className="mb-1 flex justify-between text-xs">
                              <span>Target Achievement</span>
                              <strong>
                                {item.score == null
                                  ? "N/A"
                                  : `${item.score.toFixed(1)}%`}
                              </strong>
                            </div>
                            {item.score != null ? (
                              <Bar value={item.score} tone="bg-indigo-500" />
                            ) : (
                              <div className="h-2 rounded-full bg-slate-100" />
                            )}
                          </div>

                          <div>
                            <div className="mb-1 flex justify-between text-xs">
                              <span>Assessment Coverage</span>
                              <strong>
                                {item.assessmentCoverage == null
                                  ? "N/A"
                                  : `${item.assessmentCoverage.toFixed(1)}%`}
                              </strong>
                            </div>
                            {item.assessmentCoverage != null ? (
                              <Bar
                                value={item.assessmentCoverage}
                                tone="bg-violet-500"
                              />
                            ) : (
                              <div className="h-2 rounded-full bg-slate-100" />
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
                            <div>
                              <div className="text-[10px] text-slate-400">Processes</div>
                              <div className="text-lg font-bold">
                                {item.totalProcesses ?? 0}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-400">Calculated</div>
                              <div className="text-lg font-bold">
                                {item.calculatedProcesses ?? 0}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-400">Unassessed</div>
                              <div className="text-lg font-bold">
                                {Math.max(
                                  0,
                                  (item.totalProcesses ?? 0) -
                                    (item.calculatedProcesses ?? 0),
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div>
                            <div className="mb-1 flex justify-between text-xs">
                              <span>Compliance</span>
                              <strong>
                                {item.score == null
                                  ? "N/A"
                                  : `${item.score.toFixed(1)}%`}
                              </strong>
                            </div>
                            {item.score != null ? (
                              <Bar value={item.score} tone="bg-blue-500" />
                            ) : (
                              <div className="h-2 rounded-full bg-slate-100" />
                            )}
                          </div>

                          <div className="grid grid-cols-4 gap-2 border-t border-slate-100 pt-3">
                            <div>
                              <div className="text-[10px] text-slate-400">Controls</div>
                              <div className="text-lg font-bold">
                                {item.totalControls ?? 0}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-400">Covered</div>
                              <div className="text-lg font-bold text-emerald-600">
                                {item.coveredControls ?? 0}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-400">Partial</div>
                              <div className="text-lg font-bold text-amber-600">
                                {item.partialControls ?? 0}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-400">Not Covered</div>
                              <div className="text-lg font-bold text-red-600">
                                {item.notCoveredControls ?? 0}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="rounded-lg bg-slate-50 p-4 text-xs text-slate-500 lg:col-span-2">
                  Framework posture data is not available yet.
                </div>
              )}
            </div>

            <Link
              href="/matrix"
              className="mt-5 inline-flex text-xs font-semibold text-blue-600"
            >
              Open framework matrix
            </Link>
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
                      <div className="text-[11px] text-slate-500">{item.control_code || "Risk Intelligence"} Ã‚Â· {item.risk_level || "Risk"}</div>
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
          <Section title="Risk Summary" subtitle={`Total Risks: ${canonicalRiskTotal}`}>
            <div className="flex items-center gap-4">
              <Donut
                value={
                  canonicalRiskTotal
                    ? (canonicalRiskCritical / canonicalRiskTotal) * 100
                    : 0
                }
                label="Critical"
                tone="#ef4444"
              />
              <div className="flex-1 space-y-2 text-xs">
                <div className="flex justify-between"><span>Critical</span><strong>{canonicalRiskCritical}</strong></div>
                <div className="flex justify-between"><span>High</span><strong>{canonicalRiskHigh}</strong></div>
                <div className="flex justify-between"><span>Medium</span><strong>{canonicalRiskMedium}</strong></div>
                <div className="flex justify-between"><span>Low / Very Low</span><strong>{canonicalRiskLow}</strong></div>
              </div>
            </div>
            <Link href="/risks" className="mt-4 inline-flex text-xs font-semibold text-blue-600">View all risks</Link>
          </Section>

          <Section title="Evidence Status" subtitle={`Total Evidence: ${evidenceSummary?.total ?? 0}`}>
            <div className="flex items-center gap-4">
              <Donut
                value={
                  evidenceSummary?.total
                    ? ((evidenceSummary.by_status?.uploaded ?? 0) / evidenceSummary.total) * 100
                    : 0
                }
                label="Uploaded"
                tone="#22c55e"
              />
              <div className="flex-1 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span>Uploaded</span>
                  <strong>{evidenceSummary?.by_status?.uploaded ?? 0}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Draft</span>
                  <strong>{evidenceSummary?.by_status?.draft ?? 0}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Control Evidence</span>
                  <strong>{evidenceSummary?.by_assessment_type?.control ?? 0}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Maturity Evidence</span>
                  <strong>{evidenceSummary?.by_assessment_type?.maturity ?? 0}</strong>
                </div>
              </div>
            </div>
            <Link href="/evidences" className="mt-4 inline-flex text-xs font-semibold text-blue-600">View all evidence</Link>
          </Section>

          <Section
            title="Remediation Status"
            subtitle={`Enterprise remediation: ${remediationTotal} items`}
          >
            <div className="space-y-3 text-xs">
              <div>
                <div className="mb-1 flex justify-between">
                  <span>Active</span>
                  <strong>{remediationActive}</strong>
                </div>
                <Bar
                  value={remediationTotal ? (remediationActive / remediationTotal) * 100 : 0}
                  tone="bg-blue-500"
                />
              </div>

              <div>
                <div className="mb-1 flex justify-between">
                  <span>Completed</span>
                  <strong>{remediationCompleted}</strong>
                </div>
                <Bar
                  value={remediationTotal ? (remediationCompleted / remediationTotal) * 100 : 0}
                />
              </div>

              <div>
                <div className="mb-1 flex justify-between">
                  <span>Overdue</span>
                  <strong className="text-red-600">{remediationOverdue}</strong>
                </div>
                <Bar
                  value={remediationTotal ? (remediationOverdue / remediationTotal) * 100 : 0}
                  tone="bg-red-500"
                />
              </div>

              <div>
                <div className="mb-1 flex justify-between">
                  <span>Awaiting Review</span>
                  <strong>{remediationAwaitingReview}</strong>
                </div>
                <Bar
                  value={
                    remediationTotal
                      ? (remediationAwaitingReview / remediationTotal) * 100
                      : 0
                  }
                  tone="bg-amber-500"
                />
              </div>
            </div>

            <Link
              href="/company/remediation"
              className="mt-4 inline-flex text-xs font-semibold text-blue-600"
            >
              View remediation center
            </Link>
          </Section>

          <Section
            title="Remediation Pressure"
            subtitle="Current enterprise remediation workload"
          >
            <div className="grid min-h-28 grid-cols-2 gap-3">
              <div className="flex flex-col items-center justify-center rounded-xl bg-red-50 p-3">
                <div className="text-3xl font-bold text-red-500">
                  {remediationOverdue}
                </div>
                <div className="mt-1 text-[10px] font-semibold text-red-600">
                  Overdue
                </div>
              </div>

              <div className="flex flex-col items-center justify-center rounded-xl bg-amber-50 p-3">
                <div className="text-3xl font-bold text-amber-600">
                  {remediationHighPriority}
                </div>
                <div className="mt-1 text-[10px] font-semibold text-amber-700">
                  High Priority
                </div>
              </div>
            </div>

            <div className="mt-3 flex justify-between text-[10px] text-slate-400">
              <span>Due soon: {remediationDueSoon}</span>
              <span>Active: {remediationActive}</span>
            </div>

            <Link
              href="/company/remediation"
              className="mt-4 inline-flex text-xs font-semibold text-blue-600"
            >
              View remediation center
            </Link>
          </Section>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <Section title="Quick Actions" subtitle="Common executive workflows" className="xl:col-span-2">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {[
                ["New Risk", "/risks/create", <AlertTriangle size={20} />],
                ["New Objective", "/company/objectives", <Target size={20} />],
                ["New Process", "/company/processes", <Workflow size={20} />],
                ["Add Standard", "/standards", <BookOpen size={20} />],
                ["Add Evidence", "/evidences", <FolderOpen size={20} />],
                ["Remediation Center", "/company/remediation", <ListChecks size={20} />],
                ["New Task", "/company/tasks/create", <CheckCircle2 size={20} />],
              ].map(([label, href, icon]) => (
                <Link key={String(label)} href={String(href)} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-center transition hover:border-slate-300 hover:bg-slate-50">
                  <span className="text-blue-600">{icon}</span>
                  <span className="text-[11px] font-semibold text-slate-700">{label}</span>
                </Link>
              ))}
            </div>
          </Section>

          <Section title="Foundation Snapshot" subtitle="Canonical enterprise inventory">
            <div className="grid grid-cols-3 gap-2">
              <Link href="/company/processes" className="rounded-lg border border-slate-200 p-3"><Workflow size={16} className="text-emerald-600" /><div className="mt-2 text-[10px] text-slate-500">Processes</div><div className="text-lg font-bold">{processesCount}</div></Link>
              <Link href="/company/objectives" className="rounded-lg border border-slate-200 p-3"><Target size={16} className="text-blue-600" /><div className="mt-2 text-[10px] text-slate-500">Objectives</div><div className="text-lg font-bold">{objectivesCount}</div></Link>
              <Link href="/risks" className="rounded-lg border border-slate-200 p-3"><AlertTriangle size={16} className="text-red-500" /><div className="mt-2 text-[10px] text-slate-500">Risks</div><div className="text-lg font-bold">{canonicalRiskTotal}</div></Link>
              <Link href="/standards" className="rounded-lg border border-slate-200 p-3"><BookOpen size={16} className="text-violet-600" /><div className="mt-2 text-[10px] text-slate-500">Active Frameworks</div><div className="text-lg font-bold">{activeStandards.length}</div></Link>
              <Link href="/matrix" className="rounded-lg border border-slate-200 p-3"><ClipboardCheck size={16} className="text-violet-600" /><div className="mt-2 text-[10px] text-slate-500">Active Controls</div><div className="text-lg font-bold">{activeControlCount}</div></Link>
              <Link href="/controls" className="rounded-lg border border-slate-200 p-3"><ShieldCheck size={16} className="text-slate-600" /><div className="mt-2 text-[10px] text-slate-500">Custom Controls</div><div className="text-lg font-bold">{customControlsCount}</div></Link>
              <Link href="/evidences" className="rounded-lg border border-slate-200 p-3"><MapPin size={16} className="text-orange-600" /><div className="mt-2 text-[10px] text-slate-500">Evidence</div><div className="text-lg font-bold">{evidenceSummary?.total ?? 0}</div></Link>
              <Link href="/company/remediation" className="rounded-lg border border-slate-200 p-3"><ListChecks size={16} className="text-amber-600" /><div className="mt-2 text-[10px] text-slate-500">Active Remediation</div><div className="text-lg font-bold">{remediationActive}</div></Link>
              <div className="rounded-lg border border-slate-200 p-3"><Workflow size={16} className="text-indigo-600" /><div className="mt-2 text-[10px] text-slate-500">Maturity Processes</div><div className="text-lg font-bold">{activeMaturityProcessCount}</div></div>
            </div>
          </Section>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <Section title="Recent Activities" subtitle="Latest evidence, risk and personal task events" className="xl:col-span-2">
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

          <Section title="Management Signals" subtitle="Framework-aware operational signals">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Risk Exposure</span>
                  <strong className="text-sm">{Math.round(exposure)}%</strong>
                </div>
                <Bar value={exposure} tone="bg-red-500" />
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Framework Posture
                </div>
                <div className="space-y-2">
                  {coverage.slice(0, 4).map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">
                        {item.code}
                        <span className="ml-1 text-[9px] text-slate-400">
                          {item.type === "MATURITY_BASED"
                            ? "Target Achievement"
                            : "Compliance"}
                        </span>
                      </span>
                      <strong>
                        {item.score == null ? "N/A" : `${item.score.toFixed(1)}%`}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Enterprise Inventory
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Evidence Uploaded</span>
                    <strong>{evidenceSummary?.by_status?.uploaded ?? 0}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Open Remediation</span>
                    <strong>{remediationActive}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Critical Risks</span>
                    <strong>{canonicalRiskCritical}</strong>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <div className="font-semibold">Risk posture</div>
                <div className="mt-1 text-slate-500">
                  {statusText(exposureState)} exposure with {canonicalRiskCritical} critical risks.
                </div>
              </div>
            </div>
          </Section>
        </div>

        <footer className="py-5 text-center text-[10px] text-slate-400">Ã‚Â© 2026 Compliance OS. All rights reserved.</footer>
      </div>
    </div>
  );
}

