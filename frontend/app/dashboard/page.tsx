"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  Gauge,
  ListChecks,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
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
  if (status === "good") return "Healthy";
  if (status === "warning") return "Attention";
  return "Critical";
}

function formatDate(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatDateLong(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ProgressBar({
  value,
  tone = "bg-blue-600",
}: {
  value: number;
  tone?: string;
}) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full transition-all ${tone}`}
        style={{ width: `${clamp(value)}%` }}
      />
    </div>
  );
}

function ScoreRing({
  value,
  label,
  tone = "text-blue-600",
}: {
  value: number;
  label: string;
  tone?: string;
}) {
  const safe = clamp(value);
  const radius = 43;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;

  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg
        className="h-32 w-32 -rotate-90"
        viewBox="0 0 104 104"
        aria-hidden="true"
      >
        <circle
          cx="52"
          cy="52"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-slate-100"
        />
        <circle
          cx="52"
          cy="52"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          className={tone}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tracking-tight text-slate-950">
          {Math.round(safe)}
        </span>
        <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
          {label}
        </span>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-slate-950">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  href,
  tone,
}: {
  label: string;
  value: string | number;
  detail: ReactNode;
  icon: ReactNode;
  href?: string;
  tone: string;
}) {
  const body = (
    <div className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className={`rounded-xl p-2.5 ${tone}`}>{icon}</div>
        {href && (
          <ArrowUpRight
            size={15}
            className="text-slate-300 transition group-hover:text-slate-600"
          />
        )}
      </div>

      <div className="mt-4">
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {label}
        </div>
        <div className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
          {value}
        </div>
        <div className="mt-1 min-h-5 text-[11px] leading-5 text-slate-500">
          {detail}
        </div>
      </div>
    </div>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}

function Signal({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "amber" | "red" | "blue";
}) {
  const classes = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    red: "bg-red-50 text-red-700 border-red-100",
    blue: "bg-blue-50 text-blue-700 border-blue-100",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${classes[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label} {value}
    </span>
  );
}

function TrendChart({
  data,
  compliance,
  coverage,
  evidence,
}: {
  data: TrendPoint[];
  compliance: number;
  coverage: number;
  evidence: number;
}) {
  const width = 900;
  const height = 250;
  const paddingX = 24;
  const paddingY = 22;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const points = data.length
    ? data
    : Array.from({ length: 6 }, (_, index) => ({
        date: `2026-0${Math.min(index + 3, 9)}-01`,
        risk_exposure_pct: 0,
      }));

  const toX = (index: number) =>
    paddingX +
    (points.length === 1
      ? chartWidth / 2
      : (index / (points.length - 1)) * chartWidth);

  const toY = (value: number) =>
    paddingY + ((100 - clamp(value)) / 100) * chartHeight;

  const riskPoints = points.map((point, index) => ({
    x: toX(index),
    y: toY(num(point.risk_exposure_pct)),
  }));

  const compliancePoints = points.map((_, index) => ({
    x: toX(index),
    y: toY(compliance),
  }));

  const coveragePoints = points.map((_, index) => ({
    x: toX(index),
    y: toY(coverage),
  }));

  const evidencePoints = points.map((_, index) => ({
    x: toX(index),
    y: toY(evidence),
  }));

  const makePath = (items: Array<{ x: number; y: number }>) =>
    items.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50/60">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="min-w-[720px] w-full"
          role="img"
          aria-label="Compliance performance trend"
        >
          {[0, 25, 50, 75, 100].map((value) => {
            const y = toY(value);
            return (
              <g key={value}>
                <line
                  x1={paddingX}
                  x2={width - paddingX}
                  y1={y}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="4 5"
                />
                <text
                  x="2"
                  y={y + 4}
                  fontSize="9"
                  fill="#94a3b8"
                >
                  {value}
                </text>
              </g>
            );
          })}

          <path
            d={makePath(compliancePoints)}
            fill="none"
            stroke="#10b981"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <path
            d={makePath(coveragePoints)}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <path
            d={makePath(evidencePoints)}
            fill="none"
            stroke="#8b5cf6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <path
            d={makePath(riskPoints)}
            fill="none"
            stroke="#ef4444"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {riskPoints.map((point, index) => (
            <circle
              key={`risk-${index}`}
              cx={point.x}
              cy={point.y}
              r="3.5"
              fill="white"
              stroke="#ef4444"
              strokeWidth="2"
            />
          ))}

          {points.map((point, index) => (
            <text
              key={`date-${point.date}-${index}`}
              x={toX(index)}
              y={height - 4}
              textAnchor="middle"
              fontSize="9"
              fill="#94a3b8"
            >
              {formatDate(point.date)}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
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
  const [standardControlsCount, setStandardControlsCount] = useState(0);
  const [customControlsCount, setCustomControlsCount] = useState(0);
  const [processesCount, setProcessesCount] = useState(0);
  const [objectivesCount, setObjectivesCount] = useState(0);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [organization, setOrganization] =
    useState<OrganizationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadDashboard(showRefresh = false) {
    if (showRefresh) setRefreshing(true);

    try {
      async function safeFetch(path: string): Promise<Response | null> {
        try {
          return await apiFetch(path);
        } catch (error) {
          console.warn(`Company Home optional request failed: ${path}`, error);
          return null;
        }
      }

      async function readJson<T = any>(
        res: Response | null,
      ): Promise<T | null> {
        if (!res || !res.ok) return null;
        try {
          return (await res.json()) as T;
        } catch {
          return null;
        }
      }

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
        processesRes,
        objectivesRes,
        trendRes,
        userRes,
        organizationRes,
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
        healthData,
        standardsData,
        evidenceData,
        risksData,
        controlsData,
        tasksData,
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
        readJson<any>(evidenceRes),
        readJson<any>(risksRes),
        readJson<any>(controlsRes),
        readJson<any>(tasksRes),
        readJson<any>(processesRes),
        readJson<any>(objectivesRes),
        readJson<any>(trendRes),
        readJson<CurrentUser>(userRes),
        readJson<OrganizationSummary[]>(organizationRes),
      ]);

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

      setStandardControlsCount(
        controlItems.filter(
          (control: any) =>
            String(control?.origin || "canonical").toLowerCase() ===
            "canonical",
        ).length,
      );

      setCustomControlsCount(
        controlItems.filter(
          (control: any) =>
            String(control?.origin || "").toLowerCase() === "custom",
        ).length,
      );

      const taskItems = Array.isArray(tasksData?.tasks)
        ? tasksData.tasks
        : Array.isArray(tasksData)
          ? tasksData
          : [];

      setTasks(taskItems);

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

          if (existing) {
            existing.approvals = num(item.count);
          } else {
            byDate.set(item.date, {
              date: item.date,
              approvals: num(item.count),
            });
          }
        }

        setTrend(
          Array.from(byDate.values()).sort((a, b) =>
            a.date.localeCompare(b.date),
          ),
        );
      }

      if (userData) setUser(userData);

      if (organizationData && Array.isArray(organizationData)) {
        setOrganization(organizationData[0] ?? null);
      }

      const result = await Promise.all(
        standardItems.map(async (standard: Standard) => {
          try {
            const res = await safeFetch(`/matrix?standard_id=${standard.id}`);

            if (!res?.ok) return null;

            const data = await res.json();
            const rows: MatrixRow[] = Array.isArray(data?.rows)
              ? data.rows
              : [];

            if (!rows.length) {
              return {
                id: standard.id,
                code: standard.code,
                type: standard.type,
                score: 0,
              };
            }

            if (
              data?.mode === "maturity" ||
              standard.type === "MATURITY_BASED"
            ) {
              const valid = rows.filter(
                (row) => num(row.target_level) > 0,
              );

              const score = valid.length
                ? valid.reduce(
                    (sum, row) =>
                      sum +
                      clamp(
                        (num(row.achieved_level) /
                          num(row.target_level)) *
                          100,
                      ),
                    0,
                  ) / valid.length
                : 0;

              return {
                id: standard.id,
                code: standard.code,
                type: standard.type,
                score: Math.round(score),
              };
            }

            const covered = rows.filter((row) =>
              [
                "COVERED",
                "ACHIEVED",
                "PARTIAL",
                "PARTIALLY_ACHIEVED",
              ].includes(
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

      setCoverage(result.filter(Boolean) as CoverageItem[]);
    } catch (error) {
      console.error("Company Home load failed", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const evidenceStats = useMemo(() => {
    const result = {
      approved: 0,
      pending: 0,
      rejected: 0,
      draft: 0,
    };

    for (const evidence of evidences) {
      const status = String(
        evidence.approval_status || evidence.status || "",
      ).toLowerCase();

      if (status.includes("approved")) result.approved += 1;
      else if (status.includes("reject")) result.rejected += 1;
      else if (
        status.includes("pending") ||
        status.includes("review") ||
        status.includes("upload")
      )
        result.pending += 1;
      else result.draft += 1;
    }

    return result;
  }, [evidences]);

  const riskStats = useMemo(() => {
    const result = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

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
    const result = {
      completed: 0,
      inProgress: 0,
      overdue: 0,
      notStarted: 0,
    };

    const now = Date.now();

    for (const task of tasks) {
      const status = String(task.status || "").toLowerCase();

      if (
        ["closed", "completed", "done", "resolved"].includes(status)
      ) {
        result.completed += 1;
      } else if (
        task.due_date &&
        new Date(task.due_date).getTime() < now
      ) {
        result.overdue += 1;
      } else if (
        ["in_progress", "in progress", "working"].includes(status)
      ) {
        result.inProgress += 1;
      } else {
        result.notStarted += 1;
      }
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
        title: `Risk ${item.title || `#${item.id}`} updated`,
        meta: `${item.risk_level || "Risk"} Risk`,
        time: formatDate(item.created_at),
        icon: "risk" as const,
      })),
      ...tasks.slice(0, 4).map((item) => ({
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
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-[1680px] p-6 lg:p-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-64 rounded bg-slate-200" />
            <div className="h-4 w-96 rounded bg-slate-200" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="h-36 rounded-2xl bg-white shadow-sm"
                />
              ))}
            </div>
            <div className="h-96 rounded-2xl bg-white shadow-sm" />
          </div>
        </div>
      </div>
    );
  }

  const dashboardOverview: IntelligenceOverview = overview ?? {
    summary: {
      total_risks: risks.length,
      open_risks: risks.filter(
        (risk) =>
          String(risk.status || "").toLowerCase() === "open",
      ).length,
      forecasted_risks: 0,
      high_probability_risks: 0,
      executive_alerts: 0,
      avg_escalation_probability: 0,
    },
    top_risks: [],
    top_controls: [],
    executive_alerts: [],
  };

  const complianceHealth = clamp(
    num(summary?.compliance_health_index),
  );

  const exposure = clamp(
    num(summary?.unified_exposure_score),
  );

  const complianceStatus = healthStatus(complianceHealth);
  const exposureState = exposureStatus(exposure);

  const totalRisks = num(
    dashboardOverview.summary.total_risks,
    risks.length,
  );

  const openRisks = num(
    dashboardOverview.summary.open_risks,
    totalRisks,
  );

  const totalGaps = num(gaps?.summary?.gaps_total);
  const openTasks = num(
    controlHealth?.open_tasks,
    tasks.length,
  );

  const executiveAlerts =
    dashboardOverview.executive_alerts ?? [];

  const topRisks = dashboardOverview.top_risks ?? [];
  const topControls = dashboardOverview.top_controls ?? [];

  const standardAverage = coverage.length
    ? Math.round(
        coverage.reduce(
          (sum, item) => sum + item.score,
          0,
        ) / coverage.length,
      )
    : num(summary?.indices?.coverage);

  const evidenceStrength = clamp(
    num(summary?.indices?.evidence),
  );

  const riskIndex = clamp(
    num(summary?.indices?.risk, 100 - exposure),
  );

  const latestExposure = trend.length
    ? num(trend[trend.length - 1].risk_exposure_pct)
    : exposure;

  const approvalRate = evidences.length
    ? Math.round(
        (evidenceStats.approved / evidences.length) * 100,
      )
    : 0;

  const taskCompletion = tasks.length
    ? Math.round(
        (taskStats.completed / tasks.length) * 100,
      )
    : 0;

  const alertCount =
    dashboardOverview.summary.executive_alerts ||
    executiveAlerts.length ||
    riskStats.critical;

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-slate-900">
      <div className="mx-auto max-w-[1680px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <header className="mb-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">
                <ShieldCheck size={14} />
                Enterprise Compliance Intelligence
              </div>

              <h1 className="text-3xl font-bold tracking-[-0.03em] text-slate-950 sm:text-4xl">
                Company Home
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Executive view of compliance posture, risk exposure,
                control effectiveness and remediation performance.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  Organization
                </div>
                <div className="mt-0.5 text-xs font-semibold text-slate-800">
                  {organization?.name || "Company"}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  Reporting Period
                </div>
                <div className="mt-0.5 text-xs font-semibold text-slate-800">
                  Sep 2026
                </div>
              </div>

              <button
                type="button"
                onClick={() => void loadDashboard(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  size={14}
                  className={refreshing ? "animate-spin" : ""}
                />
                Refresh
              </button>
            </div>
          </div>
        </header>

        <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Compliance Health"
            value={`${Math.round(complianceHealth)}%`}
            detail={
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    complianceStatus === "good"
                      ? "bg-emerald-500"
                      : complianceStatus === "warning"
                        ? "bg-amber-500"
                        : "bg-red-500"
                  }`}
                />
                {statusText(complianceStatus)} posture
              </span>
            }
            icon={<Gauge size={19} />}
            href="/dashboard"
            tone="bg-emerald-50 text-emerald-600"
          />

          <MetricCard
            label="Risk Exposure"
            value={`${Math.round(exposure)}%`}
            detail={
              <span>
                {Math.round(100 - exposure)}% exposure control
              </span>
            }
            icon={<ShieldAlert size={19} />}
            href="/risks"
            tone="bg-red-50 text-red-600"
          />

          <MetricCard
            label="Control Coverage"
            value={`${Math.round(standardAverage)}%`}
            detail={`${standardControlsCount} canonical controls`}
            icon={<ClipboardCheck size={19} />}
            href="/controls"
            tone="bg-blue-50 text-blue-600"
          />

          <MetricCard
            label="Executive Alerts"
            value={alertCount}
            detail={
              <span>
                {riskStats.critical} critical risks require attention
              </span>
            }
            icon={<AlertTriangle size={19} />}
            href="/risks"
            tone="bg-amber-50 text-amber-600"
          />
        </div>

        <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.8fr)]">
          <Section
            title="Compliance Posture"
            subtitle="Current enterprise health across the core compliance dimensions."
            action={
              <Link
                href="/intelligence/executive"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700"
              >
                Executive Intelligence
                <ChevronRight size={13} />
              </Link>
            }
          >
            <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
              <div className="flex items-center gap-5">
                <ScoreRing
                  value={complianceHealth}
                  label="Health"
                  tone="text-emerald-500"
                />

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Overall Status
                  </div>
                  <div className="mt-1 text-xl font-bold text-slate-950">
                    {statusText(complianceStatus)}
                  </div>
                  <div className="mt-1 max-w-[180px] text-[11px] leading-5 text-slate-500">
                    Composite compliance health index.
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-500">
                      Control Coverage
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      {Math.round(standardAverage)}%
                    </span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar
                      value={standardAverage}
                      tone="bg-blue-500"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-500">
                      Evidence Strength
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      {Math.round(evidenceStrength)}%
                    </span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar
                      value={evidenceStrength}
                      tone="bg-violet-500"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-500">
                      Risk Control
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      {Math.round(riskIndex)}%
                    </span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar
                      value={riskIndex}
                      tone="bg-emerald-500"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-500">
                      Remediation Completion
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      {taskCompletion}%
                    </span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar
                      value={taskCompletion}
                      tone="bg-cyan-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </Section>

          <Section
            title="Executive Signal"
            subtitle="Signals requiring management attention."
          >
            <div className="space-y-3">
              <div className="rounded-xl border border-red-100 bg-red-50/60 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-red-100 p-2 text-red-600">
                    <AlertTriangle size={17} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-red-600">
                      Risk Exposure
                    </div>
                    <div className="mt-1 text-lg font-bold text-slate-950">
                      {Math.round(latestExposure)}%
                    </div>
                    <div className="mt-0.5 text-[11px] leading-5 text-slate-500">
                      {statusText(exposureState)} exposure level.
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="text-[10px] font-semibold text-slate-400">
                    Open Risks
                  </div>
                  <div className="mt-1 text-xl font-bold text-slate-950">
                    {openRisks}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="text-[10px] font-semibold text-slate-400">
                    Open Tasks
                  </div>
                  <div className="mt-1 text-xl font-bold text-slate-950">
                    {openTasks}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Signal
                  label="Critical"
                  value={String(riskStats.critical)}
                  tone={riskStats.critical > 0 ? "red" : "green"}
                />
                <Signal
                  label="Gaps"
                  value={String(totalGaps)}
                  tone={totalGaps > 0 ? "amber" : "green"}
                />
                <Signal
                  label="Evidence"
                  value={`${approvalRate}% approved`}
                  tone={approvalRate >= 75 ? "green" : "amber"}
                />
              </div>
            </div>
          </Section>
        </div>

        <div className="mb-5">
          <Section
            title="Compliance Performance Trend"
            subtitle="Enterprise posture trend based on the selected reporting period."
            action={
              <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <i className="h-2 w-5 rounded-full bg-emerald-500" />
                  Compliance
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <i className="h-2 w-5 rounded-full bg-blue-500" />
                  Coverage
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <i className="h-2 w-5 rounded-full bg-violet-500" />
                  Evidence
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <i className="h-2 w-5 rounded-full bg-red-500" />
                  Exposure
                </span>
              </div>
            }
          >
            <TrendChart
              data={trend.slice(-8)}
              compliance={complianceHealth}
              coverage={standardAverage}
              evidence={evidenceStrength}
            />
          </Section>
        </div>

        <div className="mb-5 grid gap-5 xl:grid-cols-3">
          <Section
            title="Compliance by Standard"
            subtitle="Current coverage and maturity posture."
            action={
              <Link
                href="/standards"
                className="text-[11px] font-bold text-blue-600"
              >
                View standards
              </Link>
            }
          >
            <div className="space-y-4">
              {coverage.length > 0 ? (
                coverage.slice(0, 7).map((item) => (
                  <div key={item.id}>
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-bold text-slate-800">
                          {item.code}
                        </div>
                        <div className="text-[9px] uppercase tracking-wider text-slate-400">
                          {item.type === "MATURITY_BASED"
                            ? "Maturity"
                            : "Control based"}
                        </div>
                      </div>

                      <span className="text-xs font-bold text-slate-900">
                        {item.score}%
                      </span>
                    </div>

                    <ProgressBar
                      value={item.score}
                      tone={
                        item.score >= 75
                          ? "bg-emerald-500"
                          : item.score >= 50
                            ? "bg-amber-500"
                            : "bg-red-500"
                      }
                    />
                  </div>
                ))
              ) : (
                <div className="rounded-xl bg-slate-50 p-5 text-xs text-slate-500">
                  Standard coverage data is not available yet.
                </div>
              )}
            </div>
          </Section>

          <Section
            title="Risk Intelligence"
            subtitle="Current risk distribution and forecast signals."
            action={
              <Link
                href="/risks"
                className="text-[11px] font-bold text-blue-600"
              >
                View risks
              </Link>
            }
          >
            <div className="mb-5 flex items-center gap-5">
              <ScoreRing
                value={
                  totalRisks
                    ? (riskStats.critical / totalRisks) * 100
                    : 0
                }
                label="Critical"
                tone="text-red-500"
              />

              <div className="flex-1 space-y-2.5">
                {[
                  ["Critical", riskStats.critical, "bg-red-500"],
                  ["High", riskStats.high, "bg-orange-500"],
                  ["Medium", riskStats.medium, "bg-amber-500"],
                  ["Low", riskStats.low, "bg-slate-400"],
                ].map(([label, count, tone]) => (
                  <div
                    key={String(label)}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="flex items-center gap-2 text-slate-500">
                      <span
                        className={`h-2 w-2 rounded-full ${String(tone)}`}
                      />
                      {label}
                    </span>
                    <strong className="text-slate-900">
                      {count}
                    </strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="text-[10px] text-slate-400">
                  Forecasted
                </div>
                <div className="mt-1 text-lg font-bold">
                  {dashboardOverview.summary.forecasted_risks}
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="text-[10px] text-slate-400">
                  High Probability
                </div>
                <div className="mt-1 text-lg font-bold">
                  {dashboardOverview.summary.high_probability_risks}
                </div>
              </div>
            </div>
          </Section>

          <Section
            title="Evidence Readiness"
            subtitle="Evidence quality and approval pipeline."
            action={
              <Link
                href="/evidences"
                className="text-[11px] font-bold text-blue-600"
              >
                Evidence center
              </Link>
            }
          >
            <div className="flex items-center gap-5">
              <ScoreRing
                value={approvalRate}
                label="Approved"
                tone="text-violet-500"
              />

              <div className="flex-1 space-y-3">
                <div>
                  <div className="mb-1 flex justify-between text-[10px]">
                    <span className="text-slate-500">Approved</span>
                    <strong>{evidenceStats.approved}</strong>
                  </div>
                  <ProgressBar
                    value={
                      evidences.length
                        ? (evidenceStats.approved /
                            evidences.length) *
                          100
                        : 0
                    }
                    tone="bg-emerald-500"
                  />
                </div>

                <div>
                  <div className="mb-1 flex justify-between text-[10px]">
                    <span className="text-slate-500">Pending</span>
                    <strong>{evidenceStats.pending}</strong>
                  </div>
                  <ProgressBar
                    value={
                      evidences.length
                        ? (evidenceStats.pending /
                            evidences.length) *
                          100
                        : 0
                    }
                    tone="bg-amber-500"
                  />
                </div>

                <div>
                  <div className="mb-1 flex justify-between text-[10px]">
                    <span className="text-slate-500">Rejected</span>
                    <strong>{evidenceStats.rejected}</strong>
                  </div>
                  <ProgressBar
                    value={
                      evidences.length
                        ? (evidenceStats.rejected /
                            evidences.length) *
                          100
                        : 0
                    }
                    tone="bg-red-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-slate-50 p-2.5 text-center">
                <div className="text-[9px] text-slate-400">
                  Total
                </div>
                <div className="mt-0.5 text-sm font-bold">
                  {evidences.length}
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 p-2.5 text-center">
                <div className="text-[9px] text-slate-400">
                  Draft
                </div>
                <div className="mt-0.5 text-sm font-bold">
                  {evidenceStats.draft}
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 p-2.5 text-center">
                <div className="text-[9px] text-slate-400">
                  Pending
                </div>
                <div className="mt-0.5 text-sm font-bold">
                  {evidenceStats.pending}
                </div>
              </div>
            </div>
          </Section>
        </div>

        <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(330px,0.8fr)]">
          <Section
            title="Critical Actions"
            subtitle="Items that should remain on the executive radar."
            action={
              <Link
                href="/risks"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600"
              >
                Risk center
                <ChevronRight size={13} />
              </Link>
            }
          >
            <div className="space-y-2">
              {(
                executiveAlerts.length > 0
                  ? executiveAlerts
                  : topRisks
              )
                .slice(0, 6)
                .map((item: any, index) => (
                  <Link
                    key={`${item.risk_id}-${index}`}
                    href={`/risks/${item.risk_id}`}
                    className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 transition hover:border-slate-200 hover:bg-slate-50"
                  >
                    <div className="rounded-lg bg-red-50 p-2 text-red-500">
                      <AlertTriangle size={16} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-bold text-slate-800">
                        {item.title || `Risk #${item.risk_id}`}
                      </div>

                      <div className="mt-0.5 truncate text-[10px] text-slate-400">
                        {item.control_code || "Risk Intelligence"}{" "}
                        | {item.risk_level || "Risk"}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-xs font-bold text-red-600">
                        {Math.round(
                          num(
                            item.escalation_probability_30d,
                          ) * 100,
                        )}
                        %
                      </div>
                      <div className="text-[9px] text-slate-400">
                        escalation
                      </div>
                    </div>

                    <ChevronRight
                      size={15}
                      className="text-slate-300 transition group-hover:text-slate-600"
                    />
                  </Link>
                ))}

              {executiveAlerts.length === 0 &&
                topRisks.length === 0 && (
                  <div className="rounded-xl bg-slate-50 p-6 text-center text-xs text-slate-500">
                    No critical actions currently identified.
                  </div>
                )}
            </div>
          </Section>

          <Section
            title="AI Executive Intelligence"
            subtitle="Forward-looking risk signals."
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="text-[10px] text-slate-400">
                  Forecasted Risks
                </div>
                <div className="mt-1 text-xl font-bold">
                  {dashboardOverview.summary.forecasted_risks}
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="text-[10px] text-slate-400">
                  High Probability
                </div>
                <div className="mt-1 text-xl font-bold">
                  {dashboardOverview.summary.high_probability_risks}
                </div>
              </div>

              <div className="rounded-xl border border-red-100 bg-red-50/50 p-3">
                <div className="text-[10px] text-red-500">
                  Executive Alerts
                </div>
                <div className="mt-1 text-xl font-bold text-red-600">
                  {dashboardOverview.summary.executive_alerts}
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="text-[10px] text-slate-400">
                  Avg Escalation
                </div>
                <div className="mt-1 text-xl font-bold">
                  {Math.round(
                    num(
                      dashboardOverview.summary
                        .avg_escalation_probability,
                    ) * 100,
                  )}
                  %
                </div>
              </div>
            </div>

            {topControls.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    AI Priority Controls
                  </span>
                  <Activity size={14} className="text-blue-500" />
                </div>

                <div className="space-y-2">
                  {topControls.slice(0, 4).map((control) => (
                    <div
                      key={control.control_id}
                      className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                    >
                      <span className="text-[11px] font-semibold text-slate-700">
                        {control.control_code ||
                          `Control #${control.control_id}`}
                      </span>
                      <span className="text-[11px] font-bold text-blue-600">
                        {num(
                          control.ai_priority_score,
                        ).toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>
        </div>

        <div className="mb-5 grid gap-5 lg:grid-cols-4">
          <Section
            title="Remediation"
            subtitle="Current task execution."
          >
            <div className="mb-4 flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold tracking-tight">
                  {taskCompletion}%
                </div>
                <div className="mt-1 text-[10px] text-slate-400">
                  completion rate
                </div>
              </div>

              <CheckCircle2
                size={28}
                className="text-emerald-500"
              />
            </div>

            <ProgressBar
              value={taskCompletion}
              tone="bg-emerald-500"
            />

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-sm font-bold">
                  {taskStats.completed}
                </div>
                <div className="text-[9px] text-slate-400">
                  Done
                </div>
              </div>

              <div>
                <div className="text-sm font-bold">
                  {taskStats.inProgress}
                </div>
                <div className="text-[9px] text-slate-400">
                  Active
                </div>
              </div>

              <div>
                <div className="text-sm font-bold text-red-600">
                  {taskStats.overdue}
                </div>
                <div className="text-[9px] text-slate-400">
                  Overdue
                </div>
              </div>
            </div>

            <Link
              href="/company/tasks"
              className="mt-4 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600"
            >
              Open remediation center
              <ArrowUpRight size={13} />
            </Link>
          </Section>

          <Section
            title="Governance Foundation"
            subtitle="Enterprise structure."
          >
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/company/processes"
                className="rounded-xl border border-slate-100 bg-slate-50 p-3 transition hover:border-slate-200 hover:bg-white"
              >
                <Workflow
                  size={16}
                  className="text-emerald-600"
                />
                <div className="mt-2 text-[9px] text-slate-400">
                  Processes
                </div>
                <div className="text-lg font-bold">
                  {processesCount}
                </div>
              </Link>

              <Link
                href="/company/objectives"
                className="rounded-xl border border-slate-100 bg-slate-50 p-3 transition hover:border-slate-200 hover:bg-white"
              >
                <Target
                  size={16}
                  className="text-blue-600"
                />
                <div className="mt-2 text-[9px] text-slate-400">
                  Objectives
                </div>
                <div className="text-lg font-bold">
                  {objectivesCount}
                </div>
              </Link>

              <Link
                href="/standards"
                className="rounded-xl border border-slate-100 bg-slate-50 p-3 transition hover:border-slate-200 hover:bg-white"
              >
                <BookOpen
                  size={16}
                  className="text-violet-600"
                />
                <div className="mt-2 text-[9px] text-slate-400">
                  Standards
                </div>
                <div className="text-lg font-bold">
                  {standards.length}
                </div>
              </Link>

              <Link
                href="/controls"
                className="rounded-xl border border-slate-100 bg-slate-50 p-3 transition hover:border-slate-200 hover:bg-white"
              >
                <ClipboardCheck
                  size={16}
                  className="text-blue-600"
                />
                <div className="mt-2 text-[9px] text-slate-400">
                  Controls
                </div>
                <div className="text-lg font-bold">
                  {standardControlsCount +
                    customControlsCount}
                </div>
              </Link>
            </div>
          </Section>

          <Section
            title="Portfolio Snapshot"
            subtitle="Core compliance inventory."
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Standard Controls
                </span>
                <strong className="text-xs">
                  {standardControlsCount}
                </strong>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Custom Controls
                </span>
                <strong className="text-xs">
                  {customControlsCount}
                </strong>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Evidence
                </span>
                <strong className="text-xs">
                  {evidences.length}
                </strong>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Risks
                </span>
                <strong className="text-xs">
                  {totalRisks}
                </strong>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Gaps
                </span>
                <strong className="text-xs">
                  {totalGaps}
                </strong>
              </div>
            </div>
          </Section>

          <Section
            title="Management Signals"
            subtitle="Decision support indicators."
          >
            <div className="space-y-4">
              <div>
                <div className="mb-1.5 flex justify-between">
                  <span className="text-[10px] text-slate-500">
                    Exposure Control
                  </span>
                  <strong className="text-[10px]">
                    {Math.round(100 - exposure)}%
                  </strong>
                </div>
                <ProgressBar
                  value={100 - exposure}
                  tone="bg-emerald-500"
                />
              </div>

              <div>
                <div className="mb-1.5 flex justify-between">
                  <span className="text-[10px] text-slate-500">
                    Standard Coverage
                  </span>
                  <strong className="text-[10px]">
                    {standardAverage}%
                  </strong>
                </div>
                <ProgressBar
                  value={standardAverage}
                  tone="bg-blue-500"
                />
              </div>

              <div>
                <div className="mb-1.5 flex justify-between">
                  <span className="text-[10px] text-slate-500">
                    Evidence Approval
                  </span>
                  <strong className="text-[10px]">
                    {approvalRate}%
                  </strong>
                </div>
                <ProgressBar
                  value={approvalRate}
                  tone="bg-violet-500"
                />
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center gap-2">
                  {exposureState === "good" ? (
                    <TrendingDown
                      size={15}
                      className="text-emerald-500"
                    />
                  ) : (
                    <TrendingUp
                      size={15}
                      className="text-red-500"
                    />
                  )}

                  <span className="text-[10px] font-bold text-slate-700">
                    {statusText(exposureState)} exposure posture
                  </span>
                </div>

                <p className="mt-1 text-[10px] leading-4 text-slate-400">
                  Current exposure is {Math.round(exposure)}%.
                </p>
              </div>
            </div>
          </Section>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
          <Section
            title="Recent Activity"
            subtitle="Latest evidence, risk and remediation events."
            action={
              <Link
                href="/audit"
                className="text-[11px] font-bold text-blue-600"
              >
                Audit workspace
              </Link>
            }
          >
            <div className="divide-y divide-slate-100">
              {activities.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="rounded-lg bg-slate-50 p-2 text-slate-500">
                    {item.icon === "evidence" ? (
                      <FileCheck2 size={15} />
                    ) : item.icon === "risk" ? (
                      <AlertTriangle size={15} />
                    ) : (
                      <ListChecks size={15} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-slate-800">
                      {item.title}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-400">
                      {item.meta}
                    </div>
                  </div>

                  <span className="shrink-0 text-[10px] text-slate-400">
                    {item.time}
                  </span>
                </div>
              ))}

              {activities.length === 0 && (
                <div className="py-7 text-center text-xs text-slate-500">
                  No recent activities available.
                </div>
              )}
            </div>
          </Section>

          <Section
            title="Quick Actions"
            subtitle="Frequently used enterprise workflows."
          >
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  label: "Create Risk",
                  href: "/risks/create",
                  icon: <AlertTriangle size={17} />,
                },
                {
                  label: "Add Evidence",
                  href: "/evidences",
                  icon: <FileCheck2 size={17} />,
                },
                {
                  label: "View Standards",
                  href: "/standards",
                  icon: <BookOpen size={17} />,
                },
                {
                  label: "View Controls",
                  href: "/controls",
                  icon: <ClipboardCheck size={17} />,
                },
                {
                  label: "Remediation",
                  href: "/company/tasks",
                  icon: <ListChecks size={17} />,
                },
                {
                  label: "Executive View",
                  href: "/intelligence/executive",
                  icon: <Activity size={17} />,
                },
              ].map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className="group flex min-h-20 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-3 text-center transition hover:border-blue-200 hover:bg-blue-50/40"
                >
                  <span className="text-slate-500 transition group-hover:text-blue-600">
                    {action.icon}
                  </span>
                  <span className="mt-2 text-[10px] font-bold text-slate-700">
                    {action.label}
                  </span>
                </Link>
              ))}
            </div>
          </Section>
        </div>

        <footer className="px-1 py-6 text-[10px] text-slate-400">
          Compliance OS Enterprise Workspace
        </footer>
      </div>
    </main>
  );
}
