"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  Info,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";

import { apiFetch } from "@/app/lib/api";

type Forecast = {
  risk_id: number;
  model: {
    version: string;
    mode: string;
    training_status: string | null;
  };
  forecast: {
    escalation_probability_30d: number;
    expected_score_delta: number;
  };
  explanation: Record<string, any>;
  created_at: string | null;
};

type Summary = {
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
  latest_forecast_at: string | null;
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
  title: string | null;
  current_score: number | null;
  risk_level: string | null;
  status: string | null;

  escalation_probability_30d: number;
  expected_score_delta: number;

  model_version: string | null;
  forecast_mode: string | null;
  forecast_status: string | null;
  forecast_created_at: string | null;

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

  control_id: number | null;
  control_code: string | null;
  control_title: string | null;

  process_ids: number[];
  process_names: string[];
};

type ExecutiveAlert = {
  risk_id: number;
  title: string | null;
  current_score: number | null;
  risk_level: string | null;

  escalation_probability_30d: number;
  expected_score_delta: number;

  residual_exposure: number;
  unified_score: number;

  model_version: string | null;
  forecast_mode: string | null;
  forecast_status: string | null;
  forecast_created_at: string | null;

  linked_evidence_count: number;
  approved_evidence_count: number;
  is_covered: boolean;

  control_id: number | null;
  control_code: string | null;
  process_names: string[];
};

type Overview = {
  summary: Summary;
  top_risks: TopRisk[];
  top_controls: any[];
  executive_alerts: ExecutiveAlert[];
};

type Explainability = {
  risk_id: number;
  model_version: string | null;
  model_mode: string | null;
  training_status: string | null;
  feature_importance: Record<string, number>;
  features: Record<string, number>;
  reason: string | null;
  train_info: Record<string, any>;
  created_at: string | null;
};

export default function PredictiveInsightsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [selectedRisk, setSelectedRisk] = useState<number | null>(null);
  const [explanation, setExplanation] = useState<Explainability | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [runningForecast, setRunningForecast] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    try {
      setError(null);

      const [overviewRes, forecastRes] = await Promise.all([
        apiFetch("/company/intelligence/overview"),
        apiFetch("/company/risk-forecast/summary"),
      ]);

      if (!overviewRes.ok) {
        throw new Error(
          `Intelligence overview failed (${overviewRes.status})`
        );
      }

      if (!forecastRes.ok) {
        throw new Error(
          `Risk forecast summary failed (${forecastRes.status})`
        );
      }

      const overviewJson = await overviewRes.json();
      const forecastJson = await forecastRes.json();

      setOverview(overviewJson);
      setForecasts(Array.isArray(forecastJson) ? forecastJson : []);

      const firstRisk =
        overviewJson?.top_risks?.[0]?.risk_id ??
        (Array.isArray(forecastJson) ? forecastJson[0]?.risk_id : null);

      if (selectedRisk === null && firstRisk) {
        setSelectedRisk(firstRisk);
      }
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Predictive Insights could not be loaded."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    await loadData();
  }

  async function runForecast() {
    try {
      setRunningForecast(true);
      setError(null);

      const response = await apiFetch(
        "/company/risk-forecast/run",
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          text || `Forecast execution failed (${response.status})`
        );
      }

      await loadData();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Risk forecast execution failed."
      );
    } finally {
      setRunningForecast(false);
    }
  }

  async function loadExplanation(riskId: number) {
    try {
      setSelectedRisk(riskId);
      setExplaining(true);
      setExplanation(null);

      const response = await apiFetch(
        `/company/risk-forecast/explain/${riskId}`
      );

      if (!response.ok) {
        throw new Error(
          `Explainability request failed (${response.status})`
        );
      }

      const json = await response.json();
      setExplanation(json);
    } catch (err) {
      console.error(err);
      setExplanation(null);
    } finally {
      setExplaining(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const latestForecastByRisk = useMemo(() => {
    const map = new Map<number, Forecast>();

    for (const forecast of forecasts) {
      if (!map.has(forecast.risk_id)) {
        map.set(forecast.risk_id, forecast);
      }
    }

    return map;
  }, [forecasts]);

  const probabilityBands = useMemo(() => {
    const counts = {
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0,
    };

    for (const forecast of forecasts) {
      const probability =
        forecast.forecast.escalation_probability_30d * 100;

      if (probability >= 75) {
        counts.critical++;
      } else if (probability >= 50) {
        counts.high++;
      } else if (probability >= 25) {
        counts.moderate++;
      } else {
        counts.low++;
      }
    }

    return counts;
  }, [forecasts]);

  const modelPosture = useMemo(() => {
    const ml = forecasts.filter(
      (item) => item.model.mode === "rf"
    ).length;

    const baseline = forecasts.filter(
      (item) => item.model.mode === "baseline"
    ).length;

    return {
      ml,
      baseline,
      total: forecasts.length,
    };
  }, [forecasts]);

  const selectedForecast = selectedRisk
    ? latestForecastByRisk.get(selectedRisk)
    : null;

  if (loading) {
    return <LoadingState />;
  }

  if (error && !overview) {
    return (
      <div className="min-h-screen bg-[#f6f8fc] p-6">
        <div className="mx-auto max-w-[1500px]">
          <div className="rounded-xl border border-red-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3 text-red-700">
              <XCircle size={20} />
              <h2 className="font-semibold">
                Predictive Insights unavailable
              </h2>
            </div>

            <p className="mt-2 text-sm text-slate-500">
              {error}
            </p>

            <button
              type="button"
              onClick={loadData}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#0f2747] px-4 py-2 text-sm font-medium text-white"
            >
              <RefreshCw size={15} />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!overview) {
    return null;
  }

  const summary = overview.summary;

  return (
    <div className="min-h-screen bg-[#f6f8fc] px-4 py-5 text-[#102a43] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">

        <header className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
              <BrainCircuit
                size={21}
                strokeWidth={1.8}
                className="text-[#274c77]"
              />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">
                  Predictive Insights
                </h1>

                <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                  Predictive Intelligence
                </span>
              </div>

              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Forward-looking risk intelligence based on tenant-scoped
                historical risk behaviour, forecast models and current
                exposure signals.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={runForecast}
              disabled={runningForecast}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#0f2747] px-3.5 text-xs font-semibold text-white shadow-sm hover:bg-[#183b63] disabled:opacity-50"
            >
              <BrainCircuit
                size={14}
                className={runningForecast ? "animate-pulse" : ""}
              />
              {runningForecast ? "Running Forecast..." : "Run Forecast"}
            </button>

            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                size={14}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            {error}
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="Forecast Coverage"
            value={`${Number(
              summary.forecast_coverage_percent || 0
            ).toFixed(1)}%`}
            detail={`${summary.forecast_coverage || 0} of ${
              summary.total_risks || 0
            } risks forecasted`}
            icon={<Target size={18} />}
          />

          <MetricCard
            label="High Probability"
            value={String(summary.high_probability_risks || 0)}
            detail="Risks requiring forward attention"
            icon={<ShieldAlert size={18} />}
            critical={summary.high_probability_risks > 0}
          />

          <MetricCard
            label="30D Escalation"
            value={`${Number(
              summary.avg_escalation_probability || 0
            ).toFixed(1)}%`}
            detail="Average escalation probability"
            icon={<TrendingUp size={18} />}
          />

          <MetricCard
            label="Expected Score Δ"
            value={formatDelta(summary.avg_expected_score_delta)}
            detail="Average predicted score movement"
            icon={
              summary.avg_expected_score_delta >= 0 ? (
                <TrendingUp size={18} />
              ) : (
                <TrendingDown size={18} />
              )
            }
            critical={summary.avg_expected_score_delta > 0}
          />

          <MetricCard
            label="Executive Alerts"
            value={String(summary.executive_alerts || 0)}
            detail="Current high-priority signals"
            icon={<AlertTriangle size={18} />}
            critical={summary.executive_alerts > 0}
          />
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_1fr]">

          <Panel
            title="30-Day Risk Outlook"
            subtitle="Current forecast probability distribution"
            icon={<Activity size={17} />}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ProbabilityCard
                label="Critical"
                range="≥ 75%"
                count={probabilityBands.critical}
                tone="critical"
              />

              <ProbabilityCard
                label="High"
                range="50–74.9%"
                count={probabilityBands.high}
                tone="high"
              />

              <ProbabilityCard
                label="Moderate"
                range="25–49.9%"
                count={probabilityBands.moderate}
                tone="moderate"
              />

              <ProbabilityCard
                label="Low"
                range="< 25%"
                count={probabilityBands.low}
                tone="low"
              />
            </div>

            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-[#102a43]">
                    Forecast universe
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    Latest tenant-scoped RiskForecast records
                  </div>
                </div>

                <div className="text-xl font-semibold">
                  {modelPosture.total}
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-[#527aa3]"
                  style={{
                    width: `${
                      modelPosture.total
                        ? (modelPosture.ml / modelPosture.total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>

              <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                <span>
                  ML / Random Forest: {modelPosture.ml}
                </span>
                <span>
                  Baseline: {modelPosture.baseline}
                </span>
              </div>
            </div>
          </Panel>

          <Panel
            title="Model Posture"
            subtitle="Actual forecast engine state"
            icon={<BrainCircuit size={17} />}
          >
            <div className="space-y-3">
              <PostureRow
                label="ML Forecasts"
                value={summary.ml_forecast_risks}
                icon={<BrainCircuit size={15} />}
              />

              <PostureRow
                label="Baseline Forecasts"
                value={summary.baseline_forecast_risks}
                icon={<Database size={15} />}
              />

              <PostureRow
                label="Insufficient History"
                value={summary.insufficient_history_risks}
                icon={<Clock3 size={15} />}
                warning={summary.insufficient_history_risks > 0}
              />

              <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Latest Forecast
                </div>

                <div className="mt-1 text-xs font-medium text-[#102a43]">
                  {summary.latest_forecast_at
                    ? formatDateTime(summary.latest_forecast_at)
                    : "No forecast timestamp available"}
                </div>
              </div>
            </div>
          </Panel>
        </section>

        <section className="mt-5 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <div className="flex items-start gap-2.5">
              <ShieldAlert
                size={17}
                className="mt-0.5 text-[#527aa3]"
              />

              <div>
                <h2 className="text-sm font-semibold">
                  Priority Risk Forecast
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Tenant-scoped risks ranked by the existing intelligence
                  layer and forecast attributes.
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <Th>Risk</Th>
                  <Th>Current</Th>
                  <Th>30D Probability</Th>
                  <Th>Expected Δ</Th>
                  <Th>Unified Exposure</Th>
                  <Th>Evidence</Th>
                  <Th>Model</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>

              <tbody>
                {overview.top_risks.map((risk) => (
                  <RiskRow
                    key={risk.risk_id}
                    risk={risk}
                    onExplain={loadExplanation}
                    selected={selectedRisk === risk.risk_id}
                  />
                ))}

                {!overview.top_risks.length && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-5 py-10 text-center text-xs text-slate-400"
                    >
                      No risk forecast records are available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.25fr]">

          <Panel
            title="Executive Alerts"
            subtitle="Forecast signals surfaced by the intelligence layer"
            icon={<AlertTriangle size={17} />}
          >
            <div className="space-y-3">
              {overview.executive_alerts.length ? (
                overview.executive_alerts.map((alert) => (
                  <AlertRow
                    key={alert.risk_id}
                    alert={alert}
                    onSelect={loadExplanation}
                  />
                ))
              ) : (
                <EmptyState
                  icon={<CheckCircle2 size={18} />}
                  title="No executive alerts"
                  description="No forecast records currently meet the executive alert criteria."
                />
              )}
            </div>
          </Panel>

          <Panel
            title="Explainability"
            subtitle={
              selectedRisk
                ? `Forecast explanation for Risk #${selectedRisk}`
                : "Select a risk to inspect the model evidence"
            }
            icon={<BrainCircuit size={17} />}
          >
            {explaining ? (
              <div className="flex min-h-[250px] items-center justify-center">
                <RefreshCw
                  size={20}
                  className="animate-spin text-slate-400"
                />
              </div>
            ) : explanation ? (
              <ExplainabilityView explanation={explanation} />
            ) : (
              <EmptyState
                icon={<Info size={18} />}
                title="Select a risk"
                description="Use the arrow in the risk table or an executive alert to load the actual stored forecast explanation."
              />
            )}
          </Panel>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-3">

          <Panel
            title="Exposure Posture"
            subtitle="Current exposure values from intelligence overview"
            icon={<ShieldAlert size={17} />}
          >
            <ExposureRow
              label="Inherent Exposure"
              value={summary.total_inherent_exposure}
            />

            <ExposureRow
              label="Residual Exposure"
              value={summary.total_residual_exposure}
            />

            <ExposureRow
              label="Unified Exposure"
              value={summary.total_unified_exposure}
            />

            <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">
                Exposure Δ
              </div>

              <div className="mt-1 flex items-center gap-2">
                {summary.exposure_delta >= 0 ? (
                  <TrendingUp size={15} className="text-amber-600" />
                ) : (
                  <TrendingDown size={15} className="text-emerald-600" />
                )}

                <span className="text-sm font-semibold">
                  {formatDelta(summary.exposure_delta)}
                </span>

                <span className="text-[10px] text-slate-400">
                  ({formatPercent(summary.exposure_delta_percent)})
                </span>
              </div>
            </div>
          </Panel>

          <Panel
            title="Evidence Posture"
            subtitle="Coverage supporting the risk universe"
            icon={<ShieldCheck size={17} />}
          >
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-semibold">
                  {Number(summary.coverage_percent || 0).toFixed(1)}%
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  Risk coverage
                </div>
              </div>

              <div className="text-right text-xs text-slate-500">
                <div>
                  Covered:{" "}
                  <strong>{summary.covered_risks}</strong>
                </div>
                <div>
                  Uncovered:{" "}
                  <strong>{summary.uncovered_risks}</strong>
                </div>
              </div>
            </div>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#527aa3]"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(0, Number(summary.coverage_percent || 0))
                  )}%`,
                }}
              />
            </div>
          </Panel>

          <Panel
            title="Prediction Integrity"
            subtitle="How the platform handles model limitations"
            icon={<CheckCircle2 size={17} />}
          >
            <IntegrityItem
              good
              title="Tenant scoped"
              description="Forecast data is filtered by authenticated tenant scope."
            />

            <IntegrityItem
              good
              title="No fabricated history"
              description="The UI displays stored forecasts only."
            />

            <IntegrityItem
              good={summary.baseline_forecast_risks === 0}
              title="Model fallback visible"
              description={
                summary.baseline_forecast_risks
                  ? `${summary.baseline_forecast_risks} forecast(s) currently use baseline mode.`
                  : "No baseline forecasts currently reported."
              }
            />

            <IntegrityItem
              good={summary.insufficient_history_risks === 0}
              title="Historical sufficiency"
              description={
                summary.insufficient_history_risks
                  ? `${summary.insufficient_history_risks} risk(s) have insufficient training history.`
                  : "No insufficient-history condition reported."
              }
            />
          </Panel>
        </section>

        <footer className="mt-5 flex flex-col gap-2 border-t border-slate-200 pt-4 text-[10px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Predictive Insights · tenant-scoped intelligence
          </span>

          <span>
            Forecast horizon: 30 days · model outputs are not compliance decisions
          </span>
        </footer>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  critical = false,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  critical?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            {label}
          </div>

          <div
            className={`mt-2 text-2xl font-semibold tracking-tight ${
              critical ? "text-amber-700" : "text-[#102a43]"
            }`}
          >
            {value}
          </div>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-[#527aa3]">
          {icon}
        </div>
      </div>

      <div className="mt-3 text-[10px] text-slate-400">
        {detail}
      </div>
    </div>
  );
}

function ProbabilityCard({
  label,
  range,
  count,
  tone,
}: {
  label: string;
  range: string;
  count: number;
  tone: "critical" | "high" | "moderate" | "low";
}) {
  const styles = {
    critical: "border-red-100 bg-red-50 text-red-700",
    high: "border-amber-100 bg-amber-50 text-amber-700",
    moderate: "border-blue-100 bg-blue-50 text-blue-700",
    low: "border-emerald-100 bg-emerald-50 text-emerald-700",
  }[tone];

  return (
    <div className={`rounded-lg border p-3 ${styles}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide">
        {label}
      </div>

      <div className="mt-2 text-2xl font-semibold">
        {count}
      </div>

      <div className="mt-1 text-[10px] opacity-70">
        {range}
      </div>
    </div>
  );
}

function PostureRow({
  label,
  value,
  icon,
  warning = false,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  warning?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-3">
      <div className="flex items-center gap-2">
        <span className={warning ? "text-amber-600" : "text-[#527aa3]"}>
          {icon}
        </span>

        <span className="text-xs font-medium text-slate-600">
          {label}
        </span>
      </div>

      <span
        className={`text-sm font-semibold ${
          warning ? "text-amber-700" : "text-[#102a43]"
        }`}
      >
        {value || 0}
      </span>
    </div>
  );
}

function RiskRow({
  risk,
  onExplain,
  selected,
}: {
  risk: TopRisk;
  onExplain: (riskId: number) => void;
  selected: boolean;
}) {
  const probability = Number(
    risk.escalation_probability_30d || 0
  ) * 100;

  return (
    <tr
      className={`border-b border-slate-100 transition ${
        selected ? "bg-blue-50/40" : "hover:bg-slate-50/70"
      }`}
    >
      <td className="px-5 py-3">
        <div className="max-w-[240px]">
          <div className="truncate text-xs font-semibold text-[#102a43]">
            {risk.title || `Risk #${risk.risk_id}`}
          </div>

          <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
            <span>#{risk.risk_id}</span>

            {risk.risk_level && (
              <span className="capitalize">
                {risk.risk_level}
              </span>
            )}
          </div>
        </div>
      </td>

      <td className="px-3 py-3">
        <span className="text-xs font-semibold">
          {risk.current_score ?? "—"}
        </span>
      </td>

      <td className="px-3 py-3">
        <ProbabilityBadge value={probability} />
      </td>

      <td className="px-3 py-3">
        <span
          className={`inline-flex items-center gap-1 text-xs font-semibold ${
            risk.expected_score_delta > 0
              ? "text-amber-700"
              : risk.expected_score_delta < 0
              ? "text-emerald-700"
              : "text-slate-500"
          }`}
        >
          {risk.expected_score_delta > 0 ? (
            <TrendingUp size={13} />
          ) : risk.expected_score_delta < 0 ? (
            <TrendingDown size={13} />
          ) : null}

          {formatDelta(risk.expected_score_delta)}
        </span>
      </td>

      <td className="px-3 py-3">
        <span className="text-xs font-medium">
          {Number(risk.unified_score || 0).toFixed(1)}
        </span>
      </td>

      <td className="px-3 py-3">
        <div className="text-[10px] text-slate-500">
          {risk.approved_evidence_count}/
          {risk.linked_evidence_count}
        </div>

        <div className="mt-1 text-[9px] text-slate-400">
          {risk.is_covered ? "Covered" : "Uncovered"}
        </div>
      </td>

      <td className="px-3 py-3">
        <div className="text-[10px] font-semibold uppercase text-slate-600">
          {risk.forecast_mode || "unknown"}
        </div>

        <div className="mt-1 text-[9px] text-slate-400">
          {risk.model_version || "—"}
        </div>
      </td>

      <td className="px-3 py-3">
        <StatusBadge
          status={risk.forecast_status || "available"}
        />
      </td>

      <td className="px-3 py-3">
        <button
          type="button"
          onClick={() => onExplain(risk.risk_id)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
          title="Explain forecast"
        >
          <ChevronRight size={15} />
        </button>
      </td>
    </tr>
  );
}

function ProbabilityBadge({ value }: { value: number }) {
  const tone =
    value >= 75
      ? "border-red-200 bg-red-50 text-red-700"
      : value >= 50
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : value >= 25
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <span
      className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${tone}`}
    >
      {value.toFixed(1)}%
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();

  const positive =
    normalized.includes("trained") ||
    normalized.includes("available") ||
    normalized.includes("active");

  return (
    <span
      className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-semibold ${
        positive
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      {status}
    </span>
  );
}

function AlertRow({
  alert,
  onSelect,
}: {
  alert: ExecutiveAlert;
  onSelect: (riskId: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(alert.risk_id)}
      className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-[#102a43]">
            {alert.title || `Risk #${alert.risk_id}`}
          </div>

          <div className="mt-1 text-[10px] text-slate-400">
            Risk #{alert.risk_id}
            {alert.control_code
              ? ` · ${alert.control_code}`
              : ""}
          </div>
        </div>

        <ProbabilityBadge
          value={alert.escalation_probability_30d * 100}
        />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
        <div>
          <div className="text-slate-400">Expected Δ</div>
          <div className="mt-1 font-semibold">
            {formatDelta(alert.expected_score_delta)}
          </div>
        </div>

        <div>
          <div className="text-slate-400">Exposure</div>
          <div className="mt-1 font-semibold">
            {Number(alert.unified_score || 0).toFixed(1)}
          </div>
        </div>

        <div>
          <div className="text-slate-400">Evidence</div>
          <div className="mt-1 font-semibold">
            {alert.approved_evidence_count}/
            {alert.linked_evidence_count}
          </div>
        </div>
      </div>
    </button>
  );
}

function ExplainabilityView({
  explanation,
}: {
  explanation: Explainability;
}) {
  const importance = Object.entries(
    explanation.feature_importance || {}
  ).sort((a, b) => b[1] - a[1]);

  const features = Object.entries(
    explanation.features || {}
  );

  return (
    <div className="space-y-4">

      <div className="grid gap-2 sm:grid-cols-3">
        <MiniInfo
          label="Model"
          value={explanation.model_version || "—"}
        />

        <MiniInfo
          label="Mode"
          value={explanation.model_mode || "—"}
        />

        <MiniInfo
          label="Training"
          value={
            explanation.training_status ||
            explanation.train_info?.reason ||
            "trained"
          }
        />
      </div>

      {explanation.reason && (
        <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
            Model note
          </div>

          <p className="mt-1 text-xs leading-5 text-amber-800">
            {explanation.reason}
          </p>
        </div>
      )}

      {importance.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-semibold text-[#102a43]">
            Feature Importance
          </div>

          <div className="space-y-2">
            {importance.map(([name, value]) => (
              <div key={name}>
                <div className="mb-1 flex justify-between text-[10px]">
                  <span className="text-slate-500">
                    {formatFeature(name)}
                  </span>

                  <span className="font-semibold text-slate-700">
                    {(value * 100).toFixed(1)}%
                  </span>
                </div>

                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#527aa3]"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(0, value * 100)
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {features.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-semibold text-[#102a43]">
            Current Feature Values
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {features.map(([name, value]) => (
              <div
                key={name}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <span className="text-[10px] text-slate-500">
                  {formatFeature(name)}
                </span>

                <span className="text-[10px] font-semibold text-[#102a43]">
                  {formatFeatureValue(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!importance.length && !features.length && (
        <EmptyState
          icon={<Info size={18} />}
          title="No explanation payload"
          description="The selected forecast does not currently contain feature-level explanation data."
        />
      )}
    </div>
  );
}

function MiniInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
      <div className="text-[9px] uppercase tracking-wide text-slate-400">
        {label}
      </div>

      <div className="mt-1 truncate text-[11px] font-semibold text-[#102a43]">
        {value}
      </div>
    </div>
  );
}

function ExposureRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="mb-3 flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-3">
      <span className="text-xs text-slate-500">
        {label}
      </span>

      <span className="text-sm font-semibold">
        {Number(value || 0).toFixed(1)}
      </span>
    </div>
  );
}

function IntegrityItem({
  good,
  title,
  description,
}: {
  good: boolean;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-3 flex gap-2.5">
      <div
        className={`mt-0.5 ${
          good ? "text-emerald-600" : "text-amber-600"
        }`}
      >
        {good ? (
          <CheckCircle2 size={15} />
        ) : (
          <Info size={15} />
        )}
      </div>

      <div>
        <div className="text-xs font-semibold text-[#102a43]">
          {title}
        </div>

        <p className="mt-0.5 text-[10px] leading-5 text-slate-400">
          {description}
        </p>
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
      <div className="text-slate-400">{icon}</div>

      <div className="mt-3 text-xs font-semibold text-slate-600">
        {title}
      </div>

      <p className="mt-1 max-w-sm text-[10px] leading-5 text-slate-400">
        {description}
      </p>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-2.5">
        <div className="mt-0.5 text-[#527aa3]">
          {icon}
        </div>

        <div>
          <h2 className="text-sm font-semibold">
            {title}
          </h2>

          <p className="mt-0.5 text-[11px] text-slate-400">
            {subtitle}
          </p>
        </div>
      </div>

      {children}
    </section>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-3 py-3 text-[9px] font-semibold uppercase tracking-wide text-slate-400 first:pl-5">
      {children}
    </th>
  );
}

function formatDelta(value: number | null | undefined) {
  const n = Number(value || 0);

  if (n > 0) return `+${n.toFixed(2)}`;
  return n.toFixed(2);
}

function formatPercent(value: number | null | undefined) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatFeature(name: string) {
  return name
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatFeatureValue(value: unknown) {
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? String(value)
      : value.toFixed(3);
  }

  return String(value ?? "—");
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-[#f6f8fc] p-6">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="h-20 animate-pulse rounded-xl bg-white" />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-32 animate-pulse rounded-xl bg-white"
            />
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <div className="h-80 animate-pulse rounded-xl bg-white" />
          <div className="h-80 animate-pulse rounded-xl bg-white" />
        </div>

        <div className="h-[430px] animate-pulse rounded-xl bg-white" />
      </div>
    </div>
  );
}

