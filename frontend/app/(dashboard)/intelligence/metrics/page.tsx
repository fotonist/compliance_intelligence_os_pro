"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Gauge,
  Layers3,
  ShieldCheck,
  Target,
  TrendingUp,
} from "lucide-react";
import { apiFetch } from "@/app/lib/api";

type KPIResponse = {
  tenant_id: number;
  computed_at: string;
  indices: {
    risk: number;
    coverage: number;
    maturity: number;
    evidence: number;
    task_pressure: number;
  };
  exposure_indices: {
    risk: number;
    coverage: number;
    maturity: number;
    evidence: number;
    task_pressure: number;
  };
  unified_exposure_score: number;
  compliance_health_index: number;
  weights: Record<string, number>;
  components: Record<string, number>;
  source_stats: {
    risk?: {
      row_count?: number;
      avg_risk_score?: number;
      normalized_risk_exposure?: number;
      source?: string;
    };
    evidence?: {
      total_files?: number;
      approved_files?: number;
      evidence_quality?: number;
      evidence_exposure?: number;
      source?: string;
    };
    maturity?: {
      row_count?: number;
      source?: string;
    };
    coverage?: {
      total_controls?: number;
      covered_controls?: number;
      partial_controls?: number;
      uncovered_controls?: number;
      coverage_health?: number;
    };
    task_pressure?: {
      row_count?: number;
      open_count?: number;
      overdue_count?: number;
      open_ratio?: number;
      overdue_ratio?: number;
    };
    control_health?: number;
    raw_health?: number;
  };
  warnings: string[];
};

type TrendResponse = {
  period_days: number;
  evidence_approvals_daily: Array<{
    date: string;
    count: number;
  }>;
  risk_exposure_trend: Array<{
    date: string;
    risk_exposure_pct: number;
  }>;
  current: {
    risk_exposure_pct: number;
    total_risks: number;
  };
};
type OperationalKPIResponse = {
  mttrTrend: Array<{
    date: string;
    avg_hours: number;
  }>;
  mttrDetails: Array<{
    evidence_id: number;
    rejected_at: string;
    approved_at: string;
    recovery_hours: number;
  }>;
  rejectedTrend: Array<{
    date: string;
    rejected_count: number;
  }>;
  pendingAging: {
    awaiting_review: number;
    avg_days: number;
    oldest_days: number;
  };
};

function pct(value: number | undefined | null) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "-";
  }

  return `${value.toFixed(1)}%`;
}

function number(value: number | undefined | null) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "-";
  }

  return value.toLocaleString();
}

function statusForHealth(value: number) {
  if (value >= 75) return "Healthy";
  if (value >= 50) return "Watch";
  return "Critical";
}

function statusForExposure(value: number) {
  if (value <= 25) return "Low";
  if (value <= 50) return "Moderate";
  return "High";
}

function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  description: string;
  icon: typeof Activity;
  tone?: "default" | "positive" | "warning" | "critical";
}) {
  const toneClass = {
    default: "border-slate-200",
    positive: "border-emerald-200",
    warning: "border-amber-200",
    critical: "border-red-200",
  }[tone];

  return (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm ${toneClass}`}>
      <div className="mb-4 flex items-center justify-between">
        <div className="rounded-xl bg-slate-100 p-2.5">
          <Icon size={18} className="text-slate-700" />
        </div>
      </div>

      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </div>

      <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
        {value}
      </div>

      <div className="mt-2 text-xs text-slate-500">{description}</div>
    </div>
  );
}

function ExposureBar({
  label,
  exposure,
  weight,
}: {
  label: string;
  exposure: number;
  weight: number;
}) {
  const health = Math.max(0, Math.min(100, 100 - exposure));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-800">{label}</div>
          <div className="text-xs text-slate-500">
            Weight {(weight * 100).toFixed(0)}%
          </div>
        </div>

        <div className="text-right">
          <div className="text-sm font-bold text-slate-900">{pct(health)}</div>
          <div className="text-[11px] text-slate-400">health</div>
        </div>
      </div>

      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-700 transition-all"
          style={{ width: `${health}%` }}
        />
      </div>
    </div>
  );
}

export default function MetricsPage() {
  const [data, setData] = useState<KPIResponse | null>(null);
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operational, setOperational] =
    useState<OperationalKPIResponse>({
      mttrTrend: [],
      mttrDetails: [],
      rejectedTrend: [],
      pendingAging: {
        awaiting_review: 0,
        avg_days: 0,
        oldest_days: 0,
      },
    });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [
          kpiRes,
          trendsRes,
          mttrTrendRes,
          mttrDetailsRes,
          rejectedTrendRes,
          pendingAgingRes,
        ] = await Promise.all([
          apiFetch("/kpi/summary"),
          apiFetch("/kpi/trends?days=90"),
          apiFetch("/kpi/operations/mttr-trend?range=30"),
          apiFetch("/kpi/operations/mttr-details"),
          apiFetch("/kpi/operations/rejected-trend?range=30"),
          apiFetch("/kpi/operations/pending-aging"),
        ]);

        const [
          kpi,
          trends,
          mttrTrend,
          mttrDetails,
          rejectedTrend,
          pendingAging,
        ] = await Promise.all([
          kpiRes.json(),
          trendsRes.json(),
          mttrTrendRes.json(),
          mttrDetailsRes.json(),
          rejectedTrendRes.json(),
          pendingAgingRes.json(),
        ]);

        if (cancelled) return;

        setData(kpi as KPIResponse);
        setTrend(trends as TrendResponse);

        setOperational({
          mttrTrend: Array.isArray(mttrTrend) ? mttrTrend : [],
          mttrDetails: Array.isArray(mttrDetails) ? mttrDetails : [],
          rejectedTrend: Array.isArray(rejectedTrend) ? rejectedTrend : [],
          pendingAging: pendingAging ?? {
            awaiting_review: 0,
            avg_days: 0,
            oldest_days: 0,
          },
        });
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load KPI data.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const evidenceQuality = data?.source_stats?.evidence?.evidence_quality;
  const coverageHealth = data?.source_stats?.coverage?.coverage_health;
  const controlHealth = data?.source_stats?.control_health;
  const maturityAssessed =
    !(data?.warnings ?? []).includes("maturity:no_active_assessment");

  const totalControls = data?.source_stats?.coverage?.total_controls ?? 0;
  const coveredControls =
    data?.source_stats?.coverage?.covered_controls ?? 0;
  const partialControls =
    data?.source_stats?.coverage?.partial_controls ?? 0;
  const uncoveredControls =
    data?.source_stats?.coverage?.uncovered_controls ?? 0;

  const totalEvidence = data?.source_stats?.evidence?.total_files ?? 0;
  const approvedEvidence =
    data?.source_stats?.evidence?.approved_files ?? 0;

  const totalTasks = data?.source_stats?.task_pressure?.row_count ?? 0;
  const openTasks = data?.source_stats?.task_pressure?.open_count ?? 0;
  const overdueTasks =
    data?.source_stats?.task_pressure?.overdue_count ?? 0;

  const riskCount = data?.source_stats?.risk?.row_count ?? trend?.current?.total_risks ?? 0;

  const evidenceAcceptanceRate =
    totalEvidence > 0
      ? (approvedEvidence / totalEvidence) * 100
      : 0;

  const rejectedFiles = operational.rejectedTrend.reduce(
    (sum, row) => sum + Number(row.rejected_count || 0),
    0,
  );

  const averageMttr =
    operational.mttrTrend.length > 0
      ? operational.mttrTrend.reduce(
          (sum, row) => sum + Number(row.avg_hours || 0),
          0,
        ) / operational.mttrTrend.length
      : 0;

  const maxRejectedDay = Math.max(
    1,
    ...operational.rejectedTrend.map((row) =>
      Number(row.rejected_count || 0),
    ),
  );

  const maxMttrDay = Math.max(
    1,
    ...operational.mttrTrend.map((row) =>
      Number(row.avg_hours || 0),
    ),
  );
  const maxApproval = useMemo(() => {
    if (!trend?.evidence_approvals_daily?.length) return 1;

    return Math.max(
      ...trend.evidence_approvals_daily.map((item) => item.count),
      1,
    );
  }, [trend]);

  if (loading) {
    return (
      <main className="min-h-full bg-slate-50 p-6 lg:p-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="h-8 w-72 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-4 w-[30rem] max-w-full animate-pulse rounded bg-slate-200" />

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-36 animate-pulse rounded-2xl bg-white shadow-sm"
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-full bg-slate-50 p-6 lg:p-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <div className="flex items-center gap-3 text-red-800">
              <AlertTriangle size={20} />
              <span className="font-semibold">KPI data unavailable</span>
            </div>
            <p className="mt-2 text-sm text-red-700">
              {error ?? "No KPI response was returned by the API."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const health = data.compliance_health_index;
  const exposure = data.unified_exposure_score;

  return (
    <main className="min-h-full bg-slate-50 p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px]">
        <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              <BarChart3 size={14} />
              Intelligence
            </div>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              KPI &amp; Metrics
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Enterprise compliance performance measured directly from the
              tenant-scoped compliance data model.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Last calculated
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-800">
              {new Date(data.computed_at).toLocaleString()}
            </div>
          </div>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="Compliance Health"
            value={pct(health)}
            description={statusForHealth(health)}
            icon={ShieldCheck}
            tone={health >= 75 ? "positive" : health >= 50 ? "warning" : "critical"}
          />

          <MetricCard
            label="Unified Exposure"
            value={pct(exposure)}
            description={`${statusForExposure(exposure)} exposure`}
            icon={Gauge}
            tone={exposure <= 25 ? "positive" : exposure <= 50 ? "warning" : "critical"}
          />

          <MetricCard
            label="Control Coverage"
            value={pct(coverageHealth)}
            description={`${number(coveredControls)} of ${number(totalControls)} covered`}
            icon={Target}
            tone="default"
          />

          <MetricCard
            label="Evidence Assurance"
            value={pct(evidenceQuality)}
            description={`${number(approvedEvidence)} approved of ${number(totalEvidence)}`}
            icon={FileCheck2}
            tone="default"
          />

          <MetricCard
            label="Task Pressure"
            value={pct(data.indices?.task_pressure ?? 0)}
            description={`${number(overdueTasks)} overdue / ${number(openTasks)} open`}
            icon={Clock3}
            tone={data.indices?.task_pressure ?? 0 <= 25 ? "positive" : "warning"}
          />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  Unified Exposure Model
                </div>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  Exposure components
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Lower exposure is better. Effective weights are supplied by
                  the backend calculation engine.
                </p>
              </div>

              <Layers3 size={20} className="text-slate-400" />
            </div>

            <div className="mt-6 space-y-6">
              <ExposureBar
                label="Risk"
                exposure={data.exposure_indices.risk}
                weight={data.weights.risk}
              />

              <ExposureBar
                label="Control Coverage"
                exposure={data.exposure_indices.coverage}
                weight={data.weights.coverage}
              />

              <ExposureBar
                label="Maturity"
                exposure={data.exposure_indices.maturity}
                weight={data.weights.maturity}
              />

              <ExposureBar
                label="Evidence"
                exposure={data.exposure_indices.evidence}
                weight={data.weights.evidence}
              />

              <ExposureBar
                label="Task Pressure"
                exposure={data.exposure_indices.task_pressure}
                weight={data.weights.task_pressure}
              />
            </div>

            {!maturityAssessed && (
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex gap-3">
                  <AlertTriangle
                    size={17}
                    className="mt-0.5 shrink-0 text-amber-600"
                  />
                  <div>
                    <div className="text-sm font-semibold text-amber-900">
                      Maturity is not currently assessed
                    </div>
                    <div className="mt-1 text-xs leading-5 text-amber-800">
                      The backend excluded the maturity dimension from the
                      effective composite weighting rather than treating
                      unassessed maturity as a healthy score.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              Control Health Gate
            </div>

            <div className="mt-4 flex items-end gap-3">
              <div className="text-5xl font-bold tracking-tight text-slate-950">
                {pct(controlHealth)}
              </div>
            </div>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Compliance Health cannot exceed the tenant's actual control
              coverage health.
            </p>

            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Control scope
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-800">
                {number(totalControls)} controls
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Covered</span>
                <span className="font-semibold text-slate-900">
                  {number(coveredControls)}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Partial</span>
                <span className="font-semibold text-slate-900">
                  {number(partialControls)}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Uncovered</span>
                <span className="font-semibold text-slate-900">
                  {number(uncoveredControls)}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Activity size={19} className="text-slate-500" />
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  Risk
                </div>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  Risk exposure
                </h2>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-500">Risk records</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">
                  {number(riskCount)}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500">Average score</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">
                  {data.source_stats.risk?.avg_risk_score?.toFixed(1) ?? "-"}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Normalized exposure</div>
              <div className="mt-1 text-xl font-bold text-slate-900">
                {pct(data.source_stats.risk?.normalized_risk_exposure)}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <FileCheck2 size={19} className="text-slate-500" />
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  Evidence
                </div>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  Evidence assurance
                </h2>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-3xl font-bold text-slate-900">
                    {pct(evidenceQuality)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    approved / total
                  </div>
                </div>

                <div className="text-right text-xs text-slate-500">
                  <div>{number(approvedEvidence)} approved</div>
                  <div>{number(totalEvidence)} total</div>
                </div>
              </div>

              <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-slate-700"
                  style={{ width: `${evidenceQuality ?? 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={19} className="text-slate-500" />
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  Tasks
                </div>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  Task pressure
                </h2>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-[11px] text-slate-500">Total</div>
                <div className="mt-1 text-xl font-bold text-slate-900">
                  {number(totalTasks)}
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-[11px] text-slate-500">Open</div>
                <div className="mt-1 text-xl font-bold text-slate-900">
                  {number(openTasks)}
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-[11px] text-slate-500">Overdue</div>
                <div className="mt-1 text-xl font-bold text-slate-900">
                  {number(overdueTasks)}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-4">
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              Evidence Operations
            </div>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              Evidence processing performance
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Operational indicators for evidence acceptance, rejection,
              recovery and pending workload.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Acceptance Rate"
              value={pct(evidenceAcceptanceRate)}
              description={`${number(approvedEvidence)} approved of ${number(totalEvidence)} files`}
              icon={CheckCircle2}
              tone={
                evidenceAcceptanceRate >= 80
                  ? "positive"
                  : evidenceAcceptanceRate >= 50
                    ? "warning"
                    : "critical"
              }
            />

            <MetricCard
              label="Rejected Files"
              value={number(rejectedFiles)}
              description="Rejected in the last 30 days"
              icon={AlertTriangle}
              tone={rejectedFiles === 0 ? "positive" : "warning"}
            />

            <MetricCard
              label="Avg. Recovery Time"
              value={averageMttr > 0 ? `${averageMttr.toFixed(1)} h` : "-"}
              description="Average rejection-to-approval recovery"
              icon={Clock3}
              tone={
                averageMttr === 0
                  ? "default"
                  : averageMttr <= 24
                    ? "positive"
                    : averageMttr <= 72
                      ? "warning"
                      : "critical"
              }
            />

            <MetricCard
              label="Pending Evidence"
              value={number(operational.pendingAging.awaiting_review)}
              description={
                operational.pendingAging.awaiting_review > 0
                  ? `Avg. ${operational.pendingAging.avg_days.toFixed(1)} days awaiting review`
                  : "No evidence awaiting review"
              }
              icon={FileCheck2}
              tone={
                operational.pendingAging.oldest_days <= 2
                  ? "positive"
                  : operational.pendingAging.oldest_days <= 7
                    ? "warning"
                    : "critical"
              }
            />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                    Rejection Trend
                  </div>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">
                    Rejected evidence - last 30 days
                  </h3>
                </div>
                <AlertTriangle size={19} className="text-slate-400" />
              </div>

              {operational.rejectedTrend.length > 0 ? (
                <div className="mt-6 flex h-40 items-end gap-1 overflow-hidden">
                  {operational.rejectedTrend.map((item) => (
                    <div
                      key={item.date}
                      className="group relative flex min-w-0 flex-1 items-end"
                      title={`${item.date}: ${item.rejected_count} rejected`}
                    >
                      <div
                        className="w-full rounded-t bg-red-400 transition-opacity group-hover:opacity-70"
                        style={{
                          height: `${Math.max(
                            4,
                            (Number(item.rejected_count || 0) /
                              maxRejectedDay) *
                              100,
                          )}%`,
                        }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-6 flex h-40 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-500">
                  No rejected evidence activity was returned.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                    Recovery Performance
                  </div>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">
                    Average recovery time - last 30 days
                  </h3>
                </div>
                <Clock3 size={19} className="text-slate-400" />
              </div>

              {operational.mttrTrend.length > 0 ? (
                <div className="mt-6 flex h-40 items-end gap-1 overflow-hidden">
                  {operational.mttrTrend.map((item) => (
                    <div
                      key={item.date}
                      className="group relative flex min-w-0 flex-1 items-end"
                      title={`${item.date}: ${Number(item.avg_hours || 0).toFixed(1)} hours`}
                    >
                      <div
                        className="w-full rounded-t bg-slate-700 transition-opacity group-hover:opacity-70"
                        style={{
                          height: `${Math.max(
                            4,
                            (Number(item.avg_hours || 0) / maxMttrDay) *
                              100,
                          )}%`,
                        }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-6 flex h-40 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-500">
                  No recovery data was returned.
                </div>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-xs">
                <span className="text-slate-500">Average recovery</span>
                <span className="font-semibold text-slate-900">
                  {averageMttr > 0 ? `${averageMttr.toFixed(1)} hours` : "-"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  Pending Aging
                </div>
                <h3 className="mt-1 text-lg font-bold text-slate-900">
                  Evidence waiting time
                </h3>
              </div>
              <Clock3 size={19} className="text-slate-400" />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-xs text-slate-500">Average pending time</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">
                  {operational.pendingAging.avg_days.toFixed(1)} days
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-xs text-slate-500">Oldest pending</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">
                  {number(operational.pendingAging.oldest_days)} days
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-xs text-slate-500">Awaiting review</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">
                  {number(operational.pendingAging.awaiting_review)}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  Evidence Activity
                </div>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  Approval activity - last 90 days
                </h2>
              </div>
              <TrendingUp size={19} className="text-slate-400" />
            </div>

            {trend?.evidence_approvals_daily?.length ? (
              <div className="mt-6 flex h-40 items-end gap-1 overflow-hidden">
                {trend.evidence_approvals_daily.map((item) => (
                  <div
                    key={item.date}
                    className="group relative flex min-w-0 flex-1 items-end"
                    title={`${item.date}: ${item.count}`}
                  >
                    <div
                      className="w-full rounded-t bg-slate-700 transition-opacity group-hover:opacity-70"
                      style={{
                        height: `${Math.max(
                          4,
                          (item.count / maxApproval) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 flex h-40 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-500">
                No evidence approval activity was returned for this period.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  Data Quality
                </div>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  Calculation warnings
                </h2>
              </div>
              <AlertTriangle size={19} className="text-slate-400" />
            </div>

            {data.warnings.length ? (
              <div className="mt-5 space-y-2">
                {data.warnings.map((warning) => (
                  <div
                    key={warning}
                    className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"
                  >
                    {warning}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
                <CheckCircle2 size={15} />
                No calculation warnings returned by the KPI engine.
              </div>
            )}

            <div className="mt-6 border-t border-slate-100 pt-5">
              <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                Source lineage
              </div>

              <div className="mt-3 space-y-2 text-xs text-slate-600">
                <div>Risk: {data.source_stats.risk?.source ?? "-"}</div>
                <div>
                  Evidence: {data.source_stats.evidence?.source ?? "-"}
                </div>
                <div>
                  Maturity: {data.source_stats.maturity?.source ?? "-"}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
