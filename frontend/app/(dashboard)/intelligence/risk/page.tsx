"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BrainCircuit,
  CircleAlert,
  Database,
  Gauge,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  Workflow,
} from "lucide-react";
import { apiFetch } from "@/app/lib/api";

type Risk = {
  risk_id: number;
  title?: string | null;
  current_score?: number | null;
  risk_level?: string | null;
  status?: string | null;

  escalation_probability_30d?: number | null;
  expected_score_delta?: number | null;

  model_version?: string | null;
  forecast_mode?: string | null;
  forecast_status?: string | null;
  forecast_created_at?: string | null;

  inherent_exposure?: number | null;
  residual_exposure?: number | null;
  unified_score?: number | null;

  evidence_quality?: number | null;
  linked_evidence_count?: number | null;
  approved_evidence_count?: number | null;

  density_factor?: number | null;
  pressure_factor?: number | null;
  velocity_factor?: number | null;

  is_covered?: boolean;

  historical_change_count?: number | null;
  changes_90d?: number | null;
  avg_delta_90d?: number | null;
  max_delta_90d?: number | null;

  control_id?: number | null;
  control_code?: string | null;
  control_title?: string | null;

  process_ids?: number[];
  process_names?: string[];
};

type Control = {
  control_id: number;
  control_code?: string | null;
  control_title?: string | null;

  risk_count: number;

  avg_escalation_probability: number;
  max_escalation_probability: number;
  expected_score_delta_sum: number;

  ai_priority_score: number;

  covered_risk_count?: number;
  uncovered_risk_count?: number;

  avg_unified_exposure?: number;
  max_unified_exposure?: number;
};

type Summary = {
  total_risks?: number;
  open_risks?: number;
  forecasted_risks?: number;
  high_probability_risks?: number;
  executive_alerts?: number;

  avg_escalation_probability?: number;
  avg_expected_score_delta?: number;

  forecast_coverage?: number;
  forecast_coverage_percent?: number;

  baseline_forecast_risks?: number;
  ml_forecast_risks?: number;
  insufficient_history_risks?: number;

  latest_forecast_at?: string | null;

  total_inherent_exposure?: number;
  total_residual_exposure?: number;
  total_unified_exposure?: number;

  exposure_delta?: number;
  exposure_delta_percent?: number;

  covered_risks?: number;
  uncovered_risks?: number;
  coverage_percent?: number;
};

type Overview = {
  summary?: Summary;
  top_risks?: Risk[];
  top_controls?: Control[];
  executive_alerts?: Risk[];
};

type Severity = "critical" | "high" | "medium" | "low" | "unknown";

function normalizeSeverity(level?: string | null): Severity {
  const value = String(level || "").toLowerCase();

  if (value === "critical") return "critical";
  if (value === "high") return "high";
  if (value === "medium") return "medium";
  if (value === "low") return "low";

  return "unknown";
}

function severityLabel(level?: string | null) {
  switch (normalizeSeverity(level)) {
    case "critical":
      return "Critical";
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
    default:
      return "Unclassified";
  }
}

function severityClasses(level?: string | null) {
  switch (normalizeSeverity(level)) {
    case "critical":
      return "border-red-500/25 bg-red-500/10 text-red-300";
    case "high":
      return "border-orange-500/25 bg-orange-500/10 text-orange-300";
    case "medium":
      return "border-amber-500/25 bg-amber-500/10 text-amber-300";
    case "low":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
    default:
      return "border-slate-300 bg-slate-200/60 text-slate-500";
  }
}

function scoreTone(score?: number | null) {
  const value = Number(score ?? 0);

  if (value >= 17) return "text-red-300";
  if (value >= 10) return "text-orange-300";
  if (value >= 5) return "text-amber-300";

  return "text-emerald-300";
}

function formatNumber(value?: number | null, decimals = 2) {
  return Number(value ?? 0).toFixed(decimals);
}

function formatPercentage(value?: number | null) {
  const numeric = Number(value ?? 0);

  if (numeric <= 1) {
    return Math.round(numeric * 100);
  }

  return Math.round(numeric);
}

function formatDelta(value?: number | null) {
  const numeric = Number(value ?? 0);

  return `${numeric >= 0 ? "+" : ""}${numeric.toFixed(2)}`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RiskIntelligencePage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setError(null);

    try {
      const res = await apiFetch("/company/intelligence/overview", {
        method: "GET",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const payload = await res.json();
      setData(payload);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load risk intelligence.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const summary = data?.summary ?? {};
  const topRisks = data?.top_risks ?? [];
  const topControls = data?.top_controls ?? [];
  const executiveAlerts = data?.executive_alerts ?? [];

  const avgEscalation = formatPercentage(
    summary.avg_escalation_probability,
  );

  const scoreDelta = Number(summary.avg_expected_score_delta ?? 0);

  const highestRisk = useMemo(() => {
    if (!topRisks.length) return null;

    return [...topRisks].sort(
      (a, b) =>
        Number(b.unified_score ?? 0) -
        Number(a.unified_score ?? 0),
    )[0];
  }, [topRisks]);

  const highestEscalationRisk = useMemo(() => {
    if (!topRisks.length) return null;

    return [...topRisks].sort(
      (a, b) =>
        Number(b.escalation_probability_30d ?? 0) -
        Number(a.escalation_probability_30d ?? 0),
    )[0];
  }, [topRisks]);

  const criticalCount = useMemo(
    () =>
      topRisks.filter(
        (risk) =>
          normalizeSeverity(risk.risk_level) === "critical",
      ).length,
    [topRisks],
  );

  const highCount = useMemo(
    () =>
      topRisks.filter(
        (risk) =>
          normalizeSeverity(risk.risk_level) === "high",
      ).length,
    [topRisks],
  );

  const baselineForecasts = Number(
    summary.baseline_forecast_risks ?? 0,
  );

  const mlForecasts = Number(summary.ml_forecast_risks ?? 0);

  const insufficientHistory = Number(
    summary.insufficient_history_risks ?? 0,
  );

  const coveredRisks = Number(summary.covered_risks ?? 0);
  const uncoveredRisks = Number(summary.uncovered_risks ?? 0);

  const exposureDelta = Number(summary.exposure_delta ?? 0);
  const exposureDeltaPercent = Number(
    summary.exposure_delta_percent ?? 0,
  );

  if (loading) {
    return (
      <div className="min-h-full bg-[#F6F8FB] text-slate-900">
        <div className="mx-auto max-w-[1700px] p-6 lg:p-8">
          <div className="animate-pulse space-y-6">
            <div className="h-16 rounded-2xl bg-white" />

            <div className="grid grid-cols-2 gap-4 xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-28 rounded-2xl bg-white"
                />
              ))}
            </div>

            <div className="h-80 rounded-2xl bg-white" />

            <div className="h-72 rounded-2xl bg-white" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full bg-[#F6F8FB] text-slate-900">
        <div className="mx-auto max-w-[1700px] p-6 lg:p-8">
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10">
                <CircleAlert className="h-5 w-5 text-red-300" />
              </div>

              <div className="min-w-0 flex-1">
                <h1 className="text-sm font-semibold text-red-200">
                  Risk Intelligence unavailable
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  {error}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  void load();
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#F6F8FB] text-slate-900">
      <div className="mx-auto max-w-[1700px] p-6 lg:p-8">

        {/* =====================================================
            HEADER
        ====================================================== */}
        <header className="mb-7 border-b border-slate-200 pb-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10">
                <BrainCircuit className="h-6 w-6 text-cyan-300" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                    Risk Intelligence
                  </h1>

                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                    Intelligence
                  </span>

                  {summary.forecast_coverage_percent !== undefined && (
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                      Forecast coverage{" "}
                      {formatNumber(
                        summary.forecast_coverage_percent,
                        0,
                      )}
                      %
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  Predictive risk exposure, escalation pressure and
                  emerging risk signals
                </p>

                {summary.latest_forecast_at && (
                  <p className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">
                    Latest intelligence run{" "}
                    {formatDate(summary.latest_forecast_at)}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              disabled={refreshing}
              onClick={() => {
                setRefreshing(true);
                void load();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:border-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  refreshing ? "animate-spin" : ""
                }`}
              />
              Refresh Intelligence
            </button>
          </div>
        </header>

        {/* =====================================================
            EXECUTIVE KPI STRIP
        ====================================================== */}
        <section className="grid grid-cols-2 gap-4 xl:grid-cols-6">
          <Metric
            label="Risk Universe"
            value={summary.total_risks ?? 0}
            caption="Total identified risks"
            icon={<Target className="h-4 w-4" />}
          />

          <Metric
            label="Open Risks"
            value={summary.open_risks ?? 0}
            caption="Currently active"
            icon={<ShieldAlert className="h-4 w-4" />}
          />

          <Metric
            label="Unified Exposure"
            value={formatNumber(summary.total_unified_exposure)}
            caption="Aggregated intelligence exposure"
            icon={<Gauge className="h-4 w-4" />}
          />

          <Metric
            label="Residual Exposure"
            value={formatNumber(summary.total_residual_exposure)}
            caption="Post-control exposure"
            danger={exposureDelta > 0}
            positive={exposureDelta < 0}
            icon={
              exposureDelta > 0 ? (
                <ArrowUpRight className="h-4 w-4" />
              ) : (
                <ArrowDownRight className="h-4 w-4" />
              )
            }
          />

          <Metric
            label="30d Escalation"
            value={`${avgEscalation}%`}
            caption="Average escalation probability"
            danger={avgEscalation >= 70}
            positive={avgEscalation < 30}
            icon={<TrendingUp className="h-4 w-4" />}
          />

          <Metric
            label="Forecast Coverage"
            value={`${formatNumber(
              summary.forecast_coverage_percent,
              0,
            )}%`}
            caption={`${summary.forecast_coverage ?? 0} of ${
              summary.total_risks ?? 0
            } risks forecasted`}
            icon={<Database className="h-4 w-4" />}
          />
        </section>

        {/* =====================================================
            EXECUTIVE POSTURE
        ====================================================== */}
        <section className="mt-6 grid gap-6 xl:grid-cols-3">
          <Panel
            title="Executive Risk Posture"
            subtitle="Current exposure, escalation pressure and risk movement"
            icon={
              <ShieldAlert className="h-5 w-5 text-orange-300" />
            }
            className="xl:col-span-2"
          >
            <div className="grid gap-4 md:grid-cols-4">
              <PostureCard
                label="Critical Risks"
                value={criticalCount}
                description={
                  criticalCount > 0
                    ? "Immediate executive attention"
                    : "No critical signals"
                }
                tone={
                  criticalCount > 0 ? "danger" : "safe"
                }
              />

              <PostureCard
                label="High Risks"
                value={highCount}
                description={
                  highCount > 0
                    ? "Elevated exposure"
                    : "No high-severity signals"
                }
                tone={highCount > 0 ? "warning" : "safe"}
              />

              <PostureCard
                label="Exposure Delta"
                value={`${formatDelta(exposureDelta)} / ${exposureDeltaPercent >= 0 ? "+" : ""}${exposureDeltaPercent.toFixed(2)}%`}
                description={
                  exposureDelta > 0
                    ? "Exposure has increased"
                    : exposureDelta < 0
                      ? "Exposure has reduced"
                      : "No exposure movement"
                }
                tone={
                  exposureDelta > 0
                    ? "danger"
                    : exposureDelta < 0
                      ? "safe"
                      : "neutral"
                }
              />

              <PostureCard
                label="Risk Coverage"
                value={`${formatNumber(
                  summary.coverage_percent,
                  0,
                )}%`}
                description={`${coveredRisks} covered / ${uncoveredRisks} uncovered`}
                tone={
                  Number(summary.coverage_percent ?? 0) >= 80
                    ? "safe"
                    : Number(summary.coverage_percent ?? 0) >= 50
                      ? "warning"
                      : "danger"
                }
              />
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Risk pressure
                  </div>

                  <div className="mt-1 text-sm leading-6 text-slate-500">
                    {highestEscalationRisk
                      ? `${highestEscalationRisk.title || `Risk #${highestEscalationRisk.risk_id}`} currently has the highest 30-day escalation probability in the intelligence set.`
                      : "No escalation signal is currently available."}
                  </div>
                </div>

                <div className="shrink-0 text-left lg:text-right">
                  <div className="text-3xl font-semibold text-cyan-300">
                    {highestEscalationRisk
                      ? `${formatPercentage(
                          highestEscalationRisk.escalation_probability_30d,
                        )}%`
                      : "—"}
                  </div>

                  <div className="text-[10px] uppercase tracking-wider text-slate-500">
                    30d probability
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          {/* ===================================================
              EXECUTIVE ATTENTION
          ==================================================== */}
          <Panel
            title="Executive Attention"
            subtitle="Highest current unified risk signal"
            icon={
              <CircleAlert className="h-5 w-5 text-red-300" />
            }
          >
            {highestRisk ? (
              <div className="space-y-5">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${severityClasses(
                        highestRisk.risk_level,
                      )}`}
                    >
                      {severityLabel(highestRisk.risk_level)}
                    </span>

                    <span
                      className={`text-2xl font-semibold ${scoreTone(
                        highestRisk.current_score,
                      )}`}
                    >
                      {highestRisk.current_score ?? "—"}
                    </span>
                  </div>

                  <h3 className="mt-4 text-base font-semibold leading-6 text-slate-900">
                    {highestRisk.title ||
                      `Risk #${highestRisk.risk_id}`}
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <SignalValue
                    label="Unified Exposure"
                    value={formatNumber(
                      highestRisk.unified_score,
                    )}
                  />

                  <SignalValue
                    label="Escalation"
                    value={`${formatPercentage(
                      highestRisk.escalation_probability_30d,
                    )}%`}
                  />

                  <SignalValue
                    label="Residual"
                    value={formatNumber(
                      highestRisk.residual_exposure,
                    )}
                  />

                  <SignalValue
                    label="Evidence"
                    value={`${highestRisk.approved_evidence_count ?? 0}/${highestRisk.linked_evidence_count ?? 0}`}
                  />
                </div>

                <div className="border-t border-slate-200 pt-4 space-y-3">
                  <InfoLine
                    label="Control"
                    value={
                      highestRisk.control_code ||
                      "No control linked"
                    }
                  />

                  <InfoLine
                    label="Process"
                    value={
                      highestRisk.process_names?.length
                        ? highestRisk.process_names.join(", ")
                        : "No process linked"
                    }
                  />

                  <InfoLine
                    label="Forecast"
                    value={
                      highestRisk.forecast_mode
                        ? `${highestRisk.forecast_mode} · ${
                            highestRisk.forecast_status ||
                            "available"
                          }`
                        : "—"
                    }
                  />
                </div>
              </div>
            ) : (
              <EmptyState message="No risk signal available for executive attention." />
            )}
          </Panel>
        </section>

        {/* =====================================================
            MODEL + COVERAGE POSTURE
        ====================================================== */}
        <section className="mt-6 grid gap-6 xl:grid-cols-3">
          <Panel
            title="Forecast Model Posture"
            subtitle="Model coverage and training readiness"
            icon={
              <BrainCircuit className="h-5 w-5 text-cyan-300" />
            }
          >
            <div className="grid grid-cols-2 gap-3">
              <MiniMetric
                label="Coverage"
                value={`${formatNumber(
                  summary.forecast_coverage_percent,
                  0,
                )}%`}
              />

              <MiniMetric
                label="Forecasted"
                value={summary.forecast_coverage ?? 0}
              />

              <MiniMetric
                label="Baseline"
                value={baselineForecasts}
              />

              <MiniMetric
                label="ML"
                value={mlForecasts}
              />
            </div>

            <div className="mt-4 rounded-xl border border-amber-400/10 bg-amber-400/[0.035] p-4">
              <div className="text-xs font-semibold text-amber-200">
                Model posture
              </div>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                {insufficientHistory > 0
                  ? `${insufficientHistory} risk${insufficientHistory === 1 ? "" : "s"} currently use baseline forecasting because historical training data is insufficient.`
                  : "Forecasting has sufficient historical data for the current intelligence set."}
              </p>
            </div>
          </Panel>

          <Panel
            title="Exposure Posture"
            subtitle="Inherent, residual and unified exposure"
            icon={
              <Gauge className="h-5 w-5 text-orange-300" />
            }
          >
            <div className="space-y-4">
              <ExposureBar
                label="Inherent Exposure"
                value={Number(
                  summary.total_inherent_exposure ?? 0,
                )}
                maximum={Math.max(
                  Number(summary.total_residual_exposure ?? 0),
                  Number(summary.total_inherent_exposure ?? 0),
                  1,
                )}
              />

              <ExposureBar
                label="Residual Exposure"
                value={Number(
                  summary.total_residual_exposure ?? 0,
                )}
                maximum={Math.max(
                  Number(summary.total_residual_exposure ?? 0),
                  Number(summary.total_inherent_exposure ?? 0),
                  1,
                )}
              />

              <ExposureBar
                label="Unified Exposure"
                value={Number(
                  summary.total_unified_exposure ?? 0,
                )}
                maximum={Math.max(
                  Number(summary.total_residual_exposure ?? 0),
                  Number(summary.total_inherent_exposure ?? 0),
                  1,
                )}
              />
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
              <span className="text-xs text-slate-500">
                Exposure movement
              </span>

              <span
                className={`text-sm font-semibold ${
                  exposureDelta > 0
                    ? "text-orange-300"
                    : exposureDelta < 0
                      ? "text-emerald-300"
                      : "text-slate-500"
                }`}
              >
                {formatDelta(exposureDelta)} (
                {exposureDeltaPercent >= 0 ? "+" : ""}
                {exposureDeltaPercent.toFixed(2)}%)
              </span>
            </div>
          </Panel>

          <Panel
            title="Evidence & Coverage"
            subtitle="Risk coverage posture derived from evidence intelligence"
            icon={
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
            }
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-semibold text-slate-900">
                  {formatNumber(summary.coverage_percent, 0)}%
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  Risk coverage
                </div>
              </div>

              <div className="h-16 w-16 rounded-full border-4 border-slate-200 flex items-center justify-center">
                <span className="text-xs font-semibold text-cyan-300">
                  {formatNumber(summary.coverage_percent, 0)}%
                </span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <MiniMetric
                label="Covered"
                value={coveredRisks}
              />

              <MiniMetric
                label="Uncovered"
                value={uncoveredRisks}
                danger={uncoveredRisks > 0}
              />
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">
                Approved evidence does not currently provide coverage
                for{" "}
                <span className="font-semibold text-slate-900">
                  {uncoveredRisks}
                </span>{" "}
                open risk
                {uncoveredRisks === 1 ? "" : "s"}.
              </div>
            </div>
          </Panel>
        </section>

        {/* =====================================================
            WATCHLIST
        ====================================================== */}
        <section className="mt-6">
          <Panel
            title="Risk Escalation Watchlist"
            subtitle="Risk signals requiring monitoring based on current intelligence"
            icon={
              <ShieldAlert className="h-5 w-5 text-orange-300" />
            }
          >
            {topRisks.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1450px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left">
                      <TableHeader>Risk</TableHeader>
                      <TableHeader>Score</TableHeader>
                      <TableHeader>Level</TableHeader>
                      <TableHeader>Unified</TableHeader>
                      <TableHeader>Escalation</TableHeader>
                      <TableHeader>Evidence</TableHeader>
                      <TableHeader>Forecast</TableHeader>
                      <TableHeader>Control</TableHeader>
                      <TableHeader>Process</TableHeader>
                    </tr>
                  </thead>

                  <tbody>
                    {topRisks.map((risk) => {
                      const escalationValue = formatPercentage(
                        risk.escalation_probability_30d,
                      );

                      return (
                        <tr
                          key={risk.risk_id}
                          className="border-b border-slate-200 transition hover:bg-slate-50"
                        >
                          <td className="px-3 py-4">
                            <div className="flex items-start gap-3">
                              <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white">
                                <ShieldAlert className="h-3.5 w-3.5 text-slate-500" />
                              </div>

                              <div className="min-w-0">
                                <div className="font-medium text-slate-900">
                                  {risk.title ||
                                    `Risk #${risk.risk_id}`}
                                </div>

                                <div className="mt-1 text-[11px] text-slate-500">
                                  ID {risk.risk_id}
                                  {risk.status
                                    ? ` · ${risk.status}`
                                    : ""}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-3 py-4">
                            <span
                              className={`font-semibold ${scoreTone(
                                risk.current_score,
                              )}`}
                            >
                              {risk.current_score ?? "—"}
                            </span>
                          </td>

                          <td className="px-3 py-4">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${severityClasses(
                                risk.risk_level,
                              )}`}
                            >
                              {severityLabel(risk.risk_level)}
                            </span>
                          </td>

                          <td className="px-3 py-4">
                            <span className="font-semibold text-cyan-300">
                              {formatNumber(risk.unified_score)}
                            </span>
                          </td>

                          <td className="px-3 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
                                <div
                                  className="h-full rounded-full bg-cyan-400"
                                  style={{
                                    width: `${Math.min(
                                      escalationValue,
                                      100,
                                    )}%`,
                                  }}
                                />
                              </div>

                              <span className="font-medium text-cyan-300">
                                {escalationValue}%
                              </span>
                            </div>
                          </td>

                          <td className="px-3 py-4">
                            <div className="text-xs text-slate-500">
                              {risk.approved_evidence_count ?? 0}/
                              {risk.linked_evidence_count ?? 0}
                            </div>

                            <div
                              className={`mt-1 text-[10px] ${
                                risk.is_covered
                                  ? "text-emerald-300"
                                  : "text-orange-300"
                              }`}
                            >
                              {risk.is_covered
                                ? "Covered"
                                : "Uncovered"}
                            </div>
                          </td>

                          <td className="px-3 py-4">
                            <div className="text-xs font-medium text-slate-500">
                              {risk.forecast_mode || "—"}
                            </div>

                            <div className="mt-1 text-[10px] text-slate-500">
                              {risk.forecast_status ||
                                risk.model_version ||
                                "—"}
                            </div>
                          </td>

                          <td className="px-3 py-4 text-slate-500">
                            {risk.control_code || "—"}
                          </td>

                          <td className="max-w-[240px] px-3 py-4 text-slate-500">
                            {risk.process_names?.length
                              ? risk.process_names.join(", ")
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState message="No risk signals are currently available." />
            )}
          </Panel>
        </section>

        {/* =====================================================
            CONTROL INTELLIGENCE
        ====================================================== */}
        <section className="mt-6">
          <Panel
            title="Control Intelligence"
            subtitle="Controls receiving the highest aggregated risk and forecast pressure"
            icon={
              <Workflow className="h-5 w-5 text-cyan-300" />
            }
          >
            {topControls.length ? (
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {topControls.map((control) => (
                  <div
                    key={control.control_id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-cyan-400/20 hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                          {control.control_code ||
                            `Control #${control.control_id}`}
                        </div>

                        <div className="mt-2 text-sm font-semibold leading-5 text-slate-900">
                          {control.control_title ||
                            "Unnamed control"}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-xl font-semibold text-cyan-300">
                          {formatNumber(
                            control.ai_priority_score,
                          )}
                        </div>

                        <div className="text-[9px] uppercase tracking-wider text-slate-500">
                          Priority
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <SignalValue
                        label="Risks"
                        value={String(control.risk_count)}
                      />

                      <SignalValue
                        label="Max Escalation"
                        value={`${formatPercentage(
                          control.max_escalation_probability,
                        )}%`}
                      />

                      <SignalValue
                        label="Avg Unified"
                        value={formatNumber(
                          control.avg_unified_exposure,
                        )}
                      />

                      <SignalValue
                        label="Coverage"
                        value={`${control.covered_risk_count ?? 0}/${control.risk_count}`}
                      />
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 text-[10px]">
                      <span className="text-slate-500">
                        Uncovered risks
                      </span>

                      <span
                        className={
                          Number(
                            control.uncovered_risk_count ?? 0,
                          ) > 0
                            ? "font-semibold text-orange-300"
                            : "font-semibold text-emerald-300"
                        }
                      >
                        {control.uncovered_risk_count ?? 0}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="No control-level intelligence is currently available." />
            )}
          </Panel>
        </section>

        {/* =====================================================
            ALERTS + INTELLIGENCE INTERPRETATION
        ====================================================== */}
        <section className="mt-6 grid gap-6 xl:grid-cols-2">
          <Panel
            title="Executive Risk Alerts"
            subtitle="Highest-priority signals surfaced by the current intelligence dataset"
            icon={
              <AlertTriangle className="h-5 w-5 text-red-300" />
            }
          >
            {executiveAlerts.length ? (
              <div className="space-y-3">
                {executiveAlerts.slice(0, 6).map((risk) => (
                  <div
                    key={risk.risk_id}
                    className="rounded-xl border border-red-500/15 bg-red-500/[0.035] p-4 transition hover:border-red-500/25 hover:bg-red-500/[0.055]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${severityClasses(
                              risk.risk_level,
                            )}`}
                          >
                            {severityLabel(risk.risk_level)}
                          </span>

                          <span className="text-[10px] text-slate-500">
                            Risk #{risk.risk_id}
                          </span>
                        </div>

                        <div className="mt-2 font-medium text-slate-900">
                          {risk.title ||
                            `Risk #${risk.risk_id}`}
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          Unified{" "}
                          {formatNumber(risk.unified_score)}
                          {" · "}
                          Residual{" "}
                          {formatNumber(
                            risk.residual_exposure,
                          )}
                          {" · "}
                          Evidence{" "}
                          {risk.approved_evidence_count ?? 0}/
                          {risk.linked_evidence_count ?? 0}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-lg font-semibold text-red-300">
                          {formatPercentage(
                            risk.escalation_probability_30d,
                          )}
                          %
                        </div>

                        <div className="text-[9px] uppercase tracking-wider text-slate-500">
                          Escalation
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="No executive risk alerts are currently available." />
            )}
          </Panel>

          <Panel
            title="Risk Intelligence Signals"
            subtitle="Decision-support interpretation of the available risk metrics"
            icon={
              <TrendingUp className="h-5 w-5 text-cyan-300" />
            }
          >
            <div className="space-y-3">
              <InsightRow
                label="Risk universe"
                value={`${summary.total_risks ?? 0} risks`}
                description="Total risks represented in the current intelligence dataset."
              />

              <InsightRow
                label="Unified exposure"
                value={formatNumber(
                  summary.total_unified_exposure,
                )}
                description="Aggregated exposure after the intelligence weighting model."
              />

              <InsightRow
                label="Residual exposure"
                value={formatNumber(
                  summary.total_residual_exposure,
                )}
                description="Current exposure after the available control posture."
                emphasis={
                  Number(summary.total_residual_exposure ?? 0) >
                  Number(summary.total_inherent_exposure ?? 0)
                }
              />

              <InsightRow
                label="Escalation pressure"
                value={`${avgEscalation}%`}
                description="Average 30-day escalation probability."
                emphasis={avgEscalation >= 60}
              />

              <InsightRow
                label="Risk coverage"
                value={`${formatNumber(
                  summary.coverage_percent,
                  0,
                )}%`}
                description="Percentage of risks currently covered by approved evidence."
                emphasis={
                  Number(summary.coverage_percent ?? 0) < 50
                }
              />

              <InsightRow
                label="Forecast posture"
                value={
                  mlForecasts > 0
                    ? `${mlForecasts} ML / ${baselineForecasts} baseline`
                    : `${baselineForecasts} baseline`
                }
                description="Current model composition behind the forecast dataset."
                emphasis={insufficientHistory > 0}
              />

              <div className="mt-4 rounded-xl border border-cyan-400/10 bg-cyan-400/[0.035] p-4">
                <div className="flex items-start gap-3">
                  <BrainCircuit className="mt-0.5 h-4 w-4 text-cyan-300" />

                  <div>
                    <div className="text-xs font-semibold text-cyan-200">
                      Intelligence interpretation
                    </div>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Risk Intelligence combines current risk posture,
                      historical movement, evidence coverage, control
                      relationships and forecast signals. It is a
                      decision-support layer over application data and
                      does not represent an independent generative-AI
                      assessment.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        </section>
      </div>
    </div>
  );
}

/* =============================================================
   UI COMPONENTS
============================================================= */

function Metric({
  label,
  value,
  caption,
  icon,
  danger,
  positive,
}: {
  label: string;
  value: string | number;
  caption: string;
  icon: ReactNode;
  danger?: boolean;
  positive?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        danger
          ? "border-red-500/20 bg-red-500/[0.035]"
          : positive
            ? "border-emerald-500/20 bg-emerald-500/[0.035]"
            : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={
            danger
              ? "text-red-300"
              : positive
                ? "text-emerald-300"
                : "text-cyan-300"
          }
        >
          {icon}
        </span>

        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </span>
      </div>

      <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
        {value}
      </div>

      <div className="mt-1 text-[11px] text-slate-500">
        {caption}
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  icon,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-5 ${className}`}
    >
      <div className="mb-5 flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{icon}</div>

        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            {title}
          </h2>

          {subtitle && (
            <p className="mt-1 text-xs text-slate-500">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {children}
    </div>
  );
}

function PostureCard({
  label,
  value,
  description,
  tone,
}: {
  label: string;
  value: string | number;
  description: string;
  tone: "safe" | "warning" | "danger" | "neutral";
}) {
  const valueClass =
    tone === "danger"
      ? "text-red-300"
      : tone === "warning"
        ? "text-orange-300"
        : tone === "safe"
          ? "text-emerald-300"
          : "text-cyan-300";

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>

      <div className={`mt-2 text-2xl font-semibold ${valueClass}`}>
        {value}
      </div>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  danger,
}: {
  label: string;
  value: string | number;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>

      <div
        className={`mt-1 text-xl font-semibold ${
          danger ? "text-orange-300" : "text-cyan-300"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function SignalValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>

      <div className="mt-1 text-sm font-semibold text-slate-800">
        {value}
      </div>
    </div>
  );
}

function InfoLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>

      <span className="truncate text-xs text-slate-500">
        {value}
      </span>
    </div>
  );
}

function ExposureBar({
  label,
  value,
  maximum,
}: {
  label: string;
  value: number;
  maximum: number;
}) {
  const percentage = Math.min(
    Math.max((value / maximum) * 100, 0),
    100,
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {label}
        </span>

        <span className="text-xs font-semibold text-slate-800">
          {value.toFixed(2)}
        </span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-cyan-400"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function InsightRow({
  label,
  value,
  description,
  emphasis,
}: {
  label: string;
  value: string;
  description: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-5 border-b border-slate-200/80 pb-3">
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-500">
          {label}
        </div>

        <div className="mt-1 text-[11px] leading-5 text-slate-500">
          {description}
        </div>
      </div>

      <div
        className={`shrink-0 text-sm font-semibold ${
          emphasis ? "text-orange-300" : "text-cyan-300"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function EmptyState({
  message,
}: {
  message: string;
}) {
  return (
    <div className="flex min-h-[160px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6">
      <div className="text-center">
        <ShieldCheck className="mx-auto h-6 w-6 text-slate-500" />

        <p className="mt-3 text-sm text-slate-500">
          {message}
        </p>
      </div>
    </div>
  );
}

function TableHeader({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </th>
  );
}

