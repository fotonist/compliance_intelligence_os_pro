"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Database,
  FileCheck2,
  BadgeCheck,
  ClipboardCheck,
  Gauge,
  Layers3,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Target,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiFetch } from "@/app/lib/api";

type IntelligenceSummary = {
  total_risks: number;
  open_risks: number;
  forecasted_risks: number;
  high_probability_risks: number;
  executive_alerts: number;
  avg_escalation_probability: number;
  avg_expected_score_delta: number;

  forecast_coverage: number;
  forecast_coverage_percent: number;
  baseline_forecast_risks: number;
  ml_forecast_risks: number;
  insufficient_history_risks: number;
  latest_forecast_at?: string | null;

  total_inherent_exposure: number;
  total_residual_exposure: number;
  total_unified_exposure: number;
  exposure_delta: number;
  exposure_delta_percent: number;

  covered_risks: number;
  uncovered_risks: number;
  coverage_percent: number;
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
  forecast_mode?: string | null;
  forecast_status?: string | null;
  forecast_created_at?: string | null;

  inherent_exposure: number;
  residual_exposure: number;
  unified_score: number;

  evidence_quality: number;
  linked_evidence_count: number;
  approved_evidence_count: number;

  density_factor: number;
  pressure_factor: number;
  velocity_factor: number;

  is_covered: boolean;

  historical_change_count: number;
  changes_90d: number;
  avg_delta_90d: number;
  max_delta_90d: number;

  control_id?: number | null;
  control_code?: string | null;
  control_title?: string | null;

  process_ids: number[];
  process_names: string[];
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

  covered_risk_count: number;
  uncovered_risk_count: number;
  avg_unified_exposure: number;
  max_unified_exposure: number;
};

type ExecutiveAlert = {
  risk_id: number;
  title?: string | null;
  current_score?: number | null;
  risk_level?: string | null;

  escalation_probability_30d: number;
  expected_score_delta: number;

  residual_exposure: number;
  unified_score: number;

  model_version?: string | null;
  forecast_mode?: string | null;
  forecast_status?: string | null;
  forecast_created_at?: string | null;

  linked_evidence_count: number;
  approved_evidence_count: number;
  is_covered: boolean;

  control_id?: number | null;
  control_code?: string | null;
  process_names: string[];
};

type Overview = {
  summary: IntelligenceSummary;
  top_risks: TopRisk[];
  top_controls: TopControl[];
  executive_alerts: ExecutiveAlert[];
};

type ControlHealth = {
  control: {
    control_id: number;
    control_code?: string | null;
    control_title?: string | null;
  };
  health: {
    health_index: number;
    coverage_health: number;
    evidence_quality: number;
    risk_health: number;
    gap_health?: number | null;
    remediation_health?: number | null;
  };
  metrics: {
    evidence_count: number;
    approved_evidence_count: number;
    risk_count: number;
    gap_count: number;
    open_task_count: number;
    worst_risk_score: number;
    worst_gap_severity: number;
  };
  risks: Array<{
    id: number;
    title?: string | null;
    score?: number | null;
    likelihood?: number | null;
    impact?: number | null;
    risk_level?: string | null;
    escalation_probability_30d?: number | null;
  }>;
  gaps: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
};

type EngineStatus = "checking" | "active" | "offline";

const fmtNumber = (value: number | null | undefined, digits = 0) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }

  return Number(value).toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
};

const fmtPercent = (value: number | null | undefined, digits = 0) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }

  return `${(Number(value) * 100).toFixed(digits)}%`;
};

const fmtDateTime = (value?: string | null) => {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const titleCase = (value?: string | null) => {
  if (!value) return "—";

  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

function riskTone(level?: string | null) {
  switch ((level || "").toLowerCase()) {
    case "critical":
      return "border-rose-400/30 bg-rose-400/10 text-rose-300";
    case "high":
      return "border-red-400/30 bg-red-400/10 text-red-300";
    case "medium":
      return "border-amber-400/30 bg-amber-400/10 text-amber-300";
    case "low":
      return "border-emerald-400/30 bg-emerald-600/10 text-emerald-300";
    default:
      return "border-slate-600 bg-slate-100/60 text-slate-500";
  }
}

function probabilityTone(value: number) {
  if (value >= 0.7) return "text-rose-300";
  if (value >= 0.4) return "text-amber-300";
  return "text-emerald-600";
}

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

function CardHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            {eyebrow}
          </div>
        )}

        <h2 className="text-base font-semibold text-slate-900">
          {title}
        </h2>

        {description && (
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {description}
          </p>
        )}
      </div>

      {action && (
        <div className="shrink-0">
          {action}
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  icon,
  tone = "cyan",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: ReactNode;
  tone?: "cyan" | "red" | "amber" | "green" | "violet";
}) {
  const tones = {
    cyan: "border-slate-200 bg-white text-slate-600",
    red: "border-slate-200 bg-white text-rose-500",
    amber: "border-slate-200 bg-white text-amber-500",
    green: "border-slate-200 bg-white text-emerald-600",
    violet: "border-slate-200 bg-white text-slate-600",
  };

  return (
    <div
      className={`rounded-xl border p-4 shadow-sm ${tones[tone]}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-slate-500">
          {label}
        </span>

        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
          {icon}
        </span>
      </div>

      <div className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
        {value}
      </div>

      {sub && (
        <div className="mt-1 truncate text-xs text-slate-500">
          {sub}
        </div>
      )}
    </div>
  );
}

function StatusPill({
  status,
}: {
  status: EngineStatus;
}) {
  const config = {
    checking: {
      label: "CHECKING",
      className: "border-amber-200 bg-amber-50 text-amber-700",
      dot: "bg-amber-500",
    },
    active: {
      label: "INTELLIGENCE ACTIVE",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      dot: "bg-emerald-500",
    },
    offline: {
      label: "ENGINE OFFLINE",
      className: "border-rose-200 bg-rose-50 text-rose-700",
      dot: "bg-rose-500",
    },
  }[status];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold tracking-[0.08em] ${config.className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${config.dot}`}
        aria-hidden="true"
      />
      {config.label}
    </span>
  );
}

function Progress({
  value,
  label,
}: {
  value: number;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, value * 100));

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-slate-500">
          {label}
        </span>

        <span className="font-semibold text-slate-700">
          {pct.toFixed(0)}%
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-emerald-600 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[180px] items-center justify-center px-6 text-center text-xs text-slate-500">
      {message}
    </div>
  );
}

export default function IntelligencePage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [escalation, setEscalation] = useState<
    Array<{ probability_bucket: string; risk_count: number }>
  >([]);
  const [exposure, setExposure] = useState<
    Array<{
      risk_bucket: string;
      coverage_bucket: string;
      risk_count: number;
    }>
  >([]);

  const [controlHealth, setControlHealth] = useState<ControlHealth | null>(
    null,
  );
  const [selectedControl, setSelectedControl] = useState<number | null>(null);

  const [engineStatus, setEngineStatus] =
    useState<EngineStatus>("checking");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async (initial = false) => {
    try {
      setError("");

      if (initial) setLoading(true);
      else setRefreshing(true);

      const [overviewRes, escalationRes, exposureRes] =
        await Promise.all([
          apiFetch("/company/intelligence/overview"),
          apiFetch("/company/intelligence/escalation-distribution"),
          apiFetch("/company/intelligence/exposure-coverage"),
        ]);

      const [overviewData, escalationData, exposureData] =
        await Promise.all([
          overviewRes.json(),
          escalationRes.json(),
          exposureRes.json(),
        ]);

      setOverview(overviewData);
      setEscalation(
        Array.isArray(escalationData) ? escalationData : [],
      );
      setExposure(Array.isArray(exposureData) ? exposureData : []);
    } catch (err) {
      console.error("Intelligence dashboard load error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load intelligence data.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const checkEngine = useCallback(async () => {
    try {
      const res = await apiFetch("/health/intelligence");
      const data = await res.json();
      setEngineStatus(data?.status === "active" ? "active" : "offline");
    } catch {
      setEngineStatus("offline");
    }
  }, []);

  useEffect(() => {
    void loadData(true);
    void checkEngine();

    const interval = window.setInterval(() => {
      void checkEngine();
    }, 15000);

    return () => window.clearInterval(interval);
  }, [loadData, checkEngine]);

  const openControl = async (controlId: number) => {
    setSelectedControl(controlId);
    setControlHealth(null);

    try {
      const res = await apiFetch(
        `/company/intelligence/control-health/${controlId}`,
      );
      setControlHealth(await res.json());
    } catch (err) {
      console.error("Control health load error:", err);
    }
  };

  const summary = overview?.summary;

  const forecastCoverage = summary?.forecast_coverage_percent ?? 0;
  const evidenceCoverage = summary?.coverage_percent ?? 0;

  const modelMix = useMemo(
    () => [
      {
        name: "ML",
        value: summary?.ml_forecast_risks ?? 0,
      },
      {
        name: "Baseline",
        value: summary?.baseline_forecast_risks ?? 0,
      },
    ],
    [summary],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
        <div className="mx-auto max-w-[1600px] animate-pulse">
          <div className="h-20 rounded-xl border border-slate-200 bg-white shadow-sm" />
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl border border-slate-200 bg-white shadow-sm" />
            ))}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="h-96 rounded-xl border border-slate-200 bg-white shadow-sm" />
            <div className="h-96 rounded-xl border border-slate-200 bg-white shadow-sm" />
          </div>
        </div>
      </div>
    );
  }

  if (!overview || !summary) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
        <div className="mx-auto max-w-[900px] rounded-2xl border border-rose-400/20 bg-rose-400/[0.04] p-6">
          <div className="flex items-center gap-3 text-rose-300">
            <AlertTriangle size={20} />
            <span className="font-semibold">
              Intelligence data unavailable
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {error || "The intelligence overview could not be loaded."}
          </p>
          <button
            onClick={() => void loadData(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-white/10"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-5 lg:px-7">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-4 rounded-2xl border border-slate-200 bg-white/95 px-5 py-4 shadow-[0_14px_50px_rgba(0,0,0,0.22)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200/20 bg-emerald-600/[0.06]">
                <BrainCircuit className="text-emerald-600" size={23} />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold tracking-tight">
                    Matrix Intelligence
                  </h1>
                  <StatusPill status={engineStatus} />
                </div>

                <p className="mt-1 text-[11px] text-slate-500">
                  Predictive risk intelligence · tenant-wide governance
                  posture
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden text-right sm:block">
                <div className="text-[9px] uppercase tracking-[0.16em] text-slate-500">
                  Latest forecast
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {fmtDateTime(summary.latest_forecast_at)}
                </div>
              </div>

              <button
                onClick={() => void loadData(false)}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/[0.035] px-3 py-2 text-[10px] font-semibold text-slate-500 transition hover:border-emerald-200/20 hover:text-slate-900 disabled:opacity-50"
              >
                <RefreshCw
                  size={13}
                  className={refreshing ? "animate-spin" : ""}
                />
                Refresh
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-400/20 bg-amber-400/[0.04] px-4 py-3 text-xs text-amber-300">
            <span>{error}</span>
            <button
              onClick={() => setError("")}
              className="text-amber-500 hover:text-amber-300"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          <Metric
            label="Risk Universe"
            value={fmtNumber(summary.total_risks)}
            sub={`${fmtNumber(summary.open_risks)} currently open`}
            icon={<Database size={17} />}
          />

          <Metric
            label="Forecast Coverage"
            value={`${fmtNumber(forecastCoverage)}%`}
            sub={`${fmtNumber(summary.forecast_coverage)} forecasted`}
            icon={<Gauge size={17} />}
            tone="violet"
          />

          <Metric
            label="High Probability"
            value={fmtNumber(summary.high_probability_risks)}
            sub="30-day escalation watch"
            icon={<ShieldAlert size={17} />}
            tone="red"
          />

          <Metric
            label="Executive Alerts"
            value={fmtNumber(summary.executive_alerts)}
            sub="requires attention"
            icon={<AlertTriangle size={17} />}
            tone="amber"
          />

          <Metric
            label="Unified Exposure"
            value={fmtNumber(summary.total_unified_exposure, 1)}
            sub={`Δ ${fmtNumber(summary.exposure_delta, 1)}`}
            icon={<Layers3 size={17} />}
            tone="violet"
          />

          <Metric
            label="Evidence Coverage"
            value={`${fmtNumber(evidenceCoverage)}%`}
            sub={`${fmtNumber(summary.uncovered_risks)} uncovered risks`}
            icon={<ShieldCheck size={17} />}
            tone="green"
          />

          <Metric
            label="Avg Escalation"
            value={fmtPercent(summary.avg_escalation_probability)}
            sub={`Δ score ${fmtNumber(summary.avg_expected_score_delta, 2)}`}
            icon={<Target size={17} />}
            tone="cyan"
          />
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
          <Card>
            <CardHeader
              eyebrow="EXECUTIVE SIGNAL"
              title="Executive Escalation Alerts"
              description="Highest-priority predictive signals across the tenant risk universe."
              action={
                <span className="rounded-full border border-rose-400/15 bg-rose-400/[0.05] px-2.5 py-1 text-[9px] font-semibold text-rose-300">
                  {summary.executive_alerts} alerts
                </span>
              }
            />

            {overview.executive_alerts.length === 0 ? (
              <EmptyState message="No executive escalation alerts detected." />
            ) : (
              <div className="divide-y divide-slate-200">
                {overview.executive_alerts.slice(0, 6).map((alert) => (
                  <div
                    key={alert.risk_id}
                    className="group flex flex-col gap-3 px-5 py-4 transition hover:bg-slate-50 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-400/15 bg-rose-400/[0.05]">
                        <AlertTriangle size={15} className="text-rose-300" />
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-slate-900">
                          {alert.title || `Risk #${alert.risk_id}`}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[9px] text-slate-500">
                          <span>R-{alert.risk_id}</span>
                          {alert.control_code && (
                            <>
                              <span>·</span>
                              <span>{alert.control_code}</span>
                            </>
                          )}
                          <span>·</span>
                          <span>
                            {alert.is_covered ? "Evidence covered" : "Uncovered"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-5 sm:min-w-[320px]">
                      <SignalValue
                        label="Probability"
                        value={fmtPercent(alert.escalation_probability_30d)}
                        className={probabilityTone(
                          alert.escalation_probability_30d,
                        )}
                      />
                      <SignalValue
                        label="Unified"
                        value={fmtNumber(alert.unified_score, 1)}
                      />
                      <SignalValue
                        label="Δ Score"
                        value={fmtNumber(alert.expected_score_delta, 2)}
                        className={
                          alert.expected_score_delta > 0
                            ? "text-rose-300"
                            : "text-emerald-300"
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
  <CardHeader
    eyebrow="MODEL POSTURE"
    title="Forecast Composition"
    description="Distribution of forecasted risks by prediction method."
  />

  <div className="p-5">
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">
          Forecasted
        </div>
        <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          {fmtNumber(summary?.forecast_coverage)}
        </div>
        <div className="mt-1 text-[10px] text-slate-500">
          risks with forecast
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">
          ML
        </div>
        <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          {fmtNumber(summary?.ml_forecast_risks)}
        </div>
        <div className="mt-1 text-[10px] text-slate-500">
          machine learning
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">
          Baseline
        </div>
        <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          {fmtNumber(summary?.baseline_forecast_risks)}
        </div>
        <div className="mt-1 text-[10px] text-slate-500">
          baseline forecast
        </div>
      </div>
    </div>

    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600">
          Forecast coverage
        </span>
        <span className="text-xs font-semibold text-slate-900">
          {fmtNumber(forecastCoverage)}%
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-emerald-600 transition-all"
          style={{
            width: `${Math.max(
              0,
              Math.min(100, Number(forecastCoverage)),
            )}%`,
          }}
        />
      </div>
    </div>

    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600">
          Evidence coverage
        </span>
        <span className="text-xs font-semibold text-slate-900">
          {fmtNumber(evidenceCoverage)}%
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-500 transition-all"
          style={{
            width: `${Math.max(
              0,
              Math.min(100, Number(evidenceCoverage)),
            )}%`,
          }}
        />
      </div>
    </div>

    <div className="mt-5 border-t border-slate-200 pt-4">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">
          Predictive posture
        </span>
        <span className="font-semibold text-slate-700">
          {summary?.ml_forecast_risks
            ? "ML-assisted"
            : summary?.baseline_forecast_risks
              ? "Baseline"
              : "No forecast"}
        </span>
      </div>
    </div>
  </div>
</Card>
        </section>

        <section className="mt-4">
          <Card>
            <CardHeader
              eyebrow="PREDICTIVE RISK"
              title="Escalation Watchlist"
              description="Risks ranked by forward-looking escalation probability and expected score movement."
            />

            {overview.top_risks.length === 0 ? (
              <EmptyState message="No forecasted risks are available." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-[9px] uppercase tracking-[0.12em] text-slate-500">
                      <th className="px-5 py-3 font-medium">Risk</th>
                      <th className="px-3 py-3 font-medium">Level</th>
                      <th className="px-3 py-3 font-medium">Current</th>
                      <th className="px-3 py-3 font-medium">30d Probability</th>
                      <th className="px-3 py-3 font-medium">Unified</th>
                      <th className="px-3 py-3 font-medium">Evidence</th>
                      <th className="px-3 py-3 font-medium">Forecast</th>
                      <th className="px-5 py-3 font-medium">Control</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200">
                    {overview.top_risks.slice(0, 12).map((risk) => (
                      <tr
                        key={risk.risk_id}
                        className="transition hover:bg-slate-50"
                      >
                        <td className="max-w-[280px] px-5 py-3.5">
                          <div className="truncate text-xs font-semibold text-slate-700">
                            {risk.title || `Risk #${risk.risk_id}`}
                          </div>
                          <div className="mt-1 text-[9px] text-slate-500">
                            R-{risk.risk_id}
                          </div>
                        </td>

                        <td className="px-3 py-3.5">
                          <span
                            className={`rounded-md border px-2 py-1 text-[9px] font-semibold uppercase ${riskTone(
                              risk.risk_level,
                            )}`}
                          >
                            {risk.risk_level || "—"}
                          </span>
                        </td>

                        <td className="px-3 py-3.5 text-xs text-slate-500">
                          {fmtNumber(risk.current_score)}
                        </td>

                        <td className="px-3 py-3.5">
                          <div
                            className={`text-xs font-semibold ${probabilityTone(
                              risk.escalation_probability_30d,
                            )}`}
                          >
                            {fmtPercent(risk.escalation_probability_30d)}
                          </div>
                          <div className="mt-1 text-[9px] text-slate-500">
                            Δ {fmtNumber(risk.expected_score_delta, 2)}
                          </div>
                        </td>

                        <td className="px-3 py-3.5 text-xs font-semibold text-slate-700">
                          {fmtNumber(risk.unified_score, 1)}
                        </td>

                        <td className="px-3 py-3.5">
                          <div className="text-xs text-slate-500">
                            {fmtPercent(risk.evidence_quality)}
                          </div>
                          <div className="mt-1 text-[9px] text-slate-500">
                            {risk.approved_evidence_count}/
                            {risk.linked_evidence_count} approved
                          </div>
                        </td>

                        <td className="px-3 py-3.5">
                          <div className="text-[10px] text-slate-500">
                            {titleCase(risk.forecast_mode)}
                          </div>
                          <div className="mt-1 text-[9px] text-slate-500">
                            {titleCase(risk.forecast_status)}
                          </div>
                        </td>

                        <td className="px-5 py-3.5">
                          {risk.control_id ? (
                            <button
                              onClick={() => void openControl(risk.control_id!)}
                              className="group inline-flex max-w-[190px] items-center gap-1.5 text-left text-[10px] text-emerald-600 hover:text-emerald-700"
                            >
                              <span className="truncate">
                                {risk.control_code ||
                                  risk.control_title ||
                                  `Control #${risk.control_id}`}
                              </span>
                              <ChevronRight
                                size={12}
                                className="shrink-0 transition group-hover:translate-x-0.5"
                              />
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-500">
                              Unlinked
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader
              eyebrow="CONTROL POSTURE"
              title="AI Priority Controls"
              description="Controls carrying the highest predictive risk pressure."
            />

            {overview.top_controls.length === 0 ? (
              <EmptyState message="No control intelligence is available." />
            ) : (
              <div className="divide-y divide-slate-200">
                {overview.top_controls.slice(0, 8).map((control, index) => (
                  <button
                    key={control.control_id}
                    onClick={() => void openControl(control.control_id)}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-white/[0.02]"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white/[0.025] text-[10px] font-semibold text-slate-500">
                      {String(index + 1).padStart(2, "0")}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-slate-700">
                        {control.control_code ||
                          control.control_title ||
                          `Control #${control.control_id}`}
                      </div>

                      <div className="mt-1 text-[9px] text-slate-500">
                        {control.risk_count} linked risks ·{" "}
                        {control.uncovered_risk_count} uncovered
                      </div>
                    </div>

                    <div className="hidden text-right sm:block">
                      <div className="text-[9px] uppercase tracking-wider text-slate-500">
                        Priority
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {fmtNumber(control.ai_priority_score, 1)}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[9px] uppercase tracking-wider text-slate-500">
                        Escalation
                      </div>
                      <div
                        className={`mt-1 text-xs font-semibold ${probabilityTone(
                          control.avg_escalation_probability,
                        )}`}
                      >
                        {fmtPercent(control.avg_escalation_probability)}
                      </div>
                    </div>

                    <ChevronRight
                      size={15}
                      className="shrink-0 text-slate-700"
                    />
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              eyebrow="RISK VELOCITY"
              title="Escalation Probability Distribution"
              description="Distribution of forecasted 30-day escalation probability."
            />

            <div className="h-[330px] p-4">
              {escalation.length === 0 ? (
                <EmptyState message="No escalation distribution data." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={escalation}>
                    <CartesianGrid
                      vertical={false}
                      stroke="rgba(148,163,184,0.07)"
                    />
                    <XAxis
                      dataKey="probability_bucket"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#64748b", fontSize: 9 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#64748b", fontSize: 9 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#07111d",
                        border: "1px solid rgba(148,163,184,.12)",
                        borderRadius: 8,
                        fontSize: 10,
                      }}
                    />
                    <Bar
                      dataKey="risk_count"
                      fill="#22d3ee"
                      radius={[5, 5, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </section>

        <section className="mt-4">
          <Card>
            <CardHeader
              eyebrow="EXPOSURE INTELLIGENCE"
              title="Exposure × Coverage Matrix"
              description="Risk exposure posture against evidence/control coverage."
            />

            {exposure.length === 0 ? (
              <EmptyState message="No exposure coverage data is available." />
            ) : (
              <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {exposure.map((cell, index) => (
                  <div
                    key={`${cell.risk_bucket}-${cell.coverage_bucket}-${index}`}
                    className="rounded-xl border border-slate-200 bg-white/[0.018] p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[9px] uppercase tracking-[0.14em] text-slate-500">
                        Risk bucket
                      </span>
                      <span className="text-[10px] font-semibold text-slate-500">
                        {cell.risk_bucket}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-[9px] uppercase tracking-[0.14em] text-slate-500">
                        Coverage
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-600">
                        {cell.coverage_bucket}
                      </span>
                    </div>

                    <div className="mt-4 text-2xl font-semibold text-slate-900">
                      {fmtNumber(cell.risk_count)}
                    </div>

                    <div className="mt-1 text-[9px] text-slate-500">
                      risks in segment
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>

        {selectedControl && (
          <div className="fixed inset-0 z-50">
            <button
              aria-label="Close control health"
              className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
              onClick={() => {
                setSelectedControl(null);
                setControlHealth(null);
              }}
            />

            <aside className="absolute right-0 top-0 h-full w-full max-w-[620px] overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-600/70">
                    CONTROL INTELLIGENCE
                  </div>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">
                    {controlHealth?.control.control_code ||
                      controlHealth?.control.control_title ||
                      `Control #${selectedControl}`}
                  </h2>
                </div>

                <button
                  onClick={() => {
                    setSelectedControl(null);
                    setControlHealth(null);
                  }}
                  className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                >
                  <X size={17} />
                </button>
              </div>

              {!controlHealth ? (
                <div className="flex min-h-[400px] items-center justify-center text-xs text-slate-500">
                  Loading control intelligence…
                </div>
              ) : (
                <div className="space-y-4 p-5">
                  <div className="grid grid-cols-2 gap-3">
                    <Metric
                      label="Linked Risks"
                      value={fmtNumber(
                        controlHealth.metrics.risk_count,
                      )}
                      icon={<Layers3 size={15} />}
                    />
                    <Metric
                      label="Critical"
                      value={fmtNumber(
                        controlHealth.risks.filter(
                          (risk) => risk.risk_level === "CRITICAL",
                        ).length,
                      )}
                      icon={<ShieldAlert size={15} />}
                      tone="red"
                    />
                    <Metric
                      label="High"
                      value={fmtNumber(
                        controlHealth.risks.filter(
                          (risk) => risk.risk_level === "HIGH",
                        ).length,
                      )}
                      icon={<AlertTriangle size={15} />}
                      tone="amber"
                    />
                    <Metric
                      label="Avg Escalation"
                      value={fmtPercent(
                        controlHealth.risks.length
                          ? controlHealth.risks.reduce(
                              (sum, risk) =>
                                sum +
                                Number(
                                  risk.escalation_probability_30d || 0,
                                ),
                              0,
                            ) / controlHealth.risks.length
                          : 0,
                      )}
                      icon={<Target size={15} />}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Metric
                      label="Health Index"
                      value={fmtNumber(
                        controlHealth.health.health_index,
                        2,
                      )}
                      icon={<Activity size={15} />}
                    />
                    <Metric
                      label="Evidence"
                      value={fmtNumber(
                        controlHealth.metrics.evidence_count,
                      )}
                      icon={<FileCheck2 size={15} />}
                    />
                    <Metric
                      label="Approved Evidence"
                      value={fmtNumber(
                        controlHealth.metrics.approved_evidence_count,
                      )}
                      icon={<BadgeCheck size={15} />}
                    />
                    <Metric
                      label="Open Tasks"
                      value={fmtNumber(
                        controlHealth.metrics.open_task_count,
                      )}
                      icon={<ClipboardCheck size={15} />}
                    />
                  </div>



                  <Card>
                    <CardHeader
                      eyebrow="PRIORITY RISKS"
                      title="Top Risks"
                    />

                    <div className="divide-y divide-slate-200">
                      {controlHealth.risks.length === 0 ? (
                        <EmptyState message="No linked forecast risks." />
                      ) : (
                        controlHealth.risks.slice(0, 8).map((risk) => (
                          <div
                            key={risk.id}
                            className="flex items-center gap-3 px-5 py-3"
                          >
                            <CircleDot
                              size={13}
                              className="shrink-0 text-emerald-600"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[11px] font-semibold text-slate-700">
                                {risk.title || `Risk #${risk.id}`}
                              </div>
                              <div className="mt-1 text-[9px] text-slate-500">
                                Score {fmtNumber(risk.score)} ·{" "}
                                {titleCase(risk.risk_level)}
                              </div>
                            </div>
                            <div
                              className={`text-xs font-semibold ${probabilityTone(
                                Number(risk.escalation_probability_30d || 0),
                              )}`}
                            >
                              {fmtPercent(risk.escalation_probability_30d)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </Card>

                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function SignalValue({
  label,
  value,
  className = "text-slate-700",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="text-right">
      <div className="text-[8px] uppercase tracking-[0.14em] text-slate-500">
        {label}
      </div>
      <div className={`mt-1 text-xs font-semibold ${className}`}>{value}</div>
    </div>
  );
}
