"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  Database,
  Gauge,
  Info,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiFetch } from "@/app/lib/api";

type TrendPoint = {
  date: string;
  count: number;
};

type RiskPoint = {
  date: string;
  risk_exposure_pct: number;
};

type TrendsResponse = {
  period_days: number;
  evidence_approvals_daily: TrendPoint[];
  risk_exposure_trend: RiskPoint[];
  current: {
    risk_exposure_pct: number;
    total_risks: number;
  };
};

type KpiSummary = {
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
  warnings?: string[];
  source_stats?: Record<
    string,
    {
      row_count?: number;
    }
  >;
};

const RANGE_OPTIONS = [30, 90, 180, 365];

export default function TrendsPage() {
  const [days, setDays] = useState(90);
  const [data, setData] = useState<TrendsResponse | null>(null);
  const [summary, setSummary] = useState<KpiSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load(showRefresh = false) {
    try {
      setError(null);

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [trendRes, summaryRes] = await Promise.all([
        apiFetch(`/kpi/trends?days=${days}`),
        apiFetch("/kpi/summary"),
      ]);

      const [trendJson, summaryJson] = await Promise.all([
        trendRes.json(),
        summaryRes.json(),
      ]);

      setData(trendJson);
      setSummary(summaryJson);
    } catch (err) {
      console.error("Trend Analysis load error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Trend Analysis data could not be loaded."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, [days]);

  const approvalStats = useMemo(() => {
    const points = data?.evidence_approvals_daily || [];

    const total = points.reduce(
      (sum, point) => sum + Number(point.count || 0),
      0
    );

    const average = points.length ? total / points.length : 0;

    const recent = points.slice(-7);
    const previous = points.slice(-14, -7);

    const recentTotal = recent.reduce(
      (sum, point) => sum + Number(point.count || 0),
      0
    );

    const previousTotal = previous.reduce(
      (sum, point) => sum + Number(point.count || 0),
      0
    );

    let direction: "up" | "down" | "flat" = "flat";

    if (recentTotal > previousTotal) {
      direction = "up";
    } else if (recentTotal < previousTotal) {
      direction = "down";
    }

    return {
      total,
      average,
      recentTotal,
      previousTotal,
      direction,
    };
  }, [data]);

  const strategicSignals = useMemo(() => {
    if (!summary) return [];

    const signals: {
      title: string;
      description: string;
      tone: "positive" | "warning" | "neutral";
      icon: "up" | "down" | "alert" | "check";
    }[] = [];

    if (summary.compliance_health_index >= 75) {
      signals.push({
        title: "Compliance posture is strong",
        description:
          "The current compliance health index is in the healthy operating range.",
        tone: "positive",
        icon: "check",
      });
    } else if (summary.compliance_health_index >= 50) {
      signals.push({
        title: "Compliance posture requires attention",
        description:
          "The current health index is below the preferred enterprise threshold.",
        tone: "warning",
        icon: "alert",
      });
    } else {
      signals.push({
        title: "Compliance posture is under pressure",
        description:
          "The current health index indicates elevated compliance exposure.",
        tone: "warning",
        icon: "alert",
      });
    }

    if (summary.unified_exposure_score <= 25) {
      signals.push({
        title: "Exposure remains controlled",
        description:
          "Unified exposure is within the preferred control range.",
        tone: "positive",
        icon: "check",
      });
    } else if (summary.unified_exposure_score <= 50) {
      signals.push({
        title: "Exposure requires monitoring",
        description:
          "Unified exposure is above the preferred range and should be monitored.",
        tone: "warning",
        icon: "alert",
      });
    } else {
      signals.push({
        title: "Exposure is elevated",
        description:
          "Unified exposure is materially above the preferred operating range.",
        tone: "warning",
        icon: "alert",
      });
    }

    if (approvalStats.direction === "up") {
      signals.push({
        title: "Evidence throughput improving",
        description:
          "Recent approval activity is higher than the preceding comparison window.",
        tone: "positive",
        icon: "up",
      });
    } else if (approvalStats.direction === "down") {
      signals.push({
        title: "Evidence throughput declining",
        description:
          "Recent approval activity is lower than the preceding comparison window.",
        tone: "warning",
        icon: "down",
      });
    }

    return signals;
  }, [summary, approvalStats]);

  const approvalChartData = useMemo(() => {
    return (data?.evidence_approvals_daily || []).map((point) => ({
      date: formatDate(point.date),
      approvals: Number(point.count || 0),
    }));
  }, [data]);

  const riskChartData = useMemo(() => {
    return (data?.risk_exposure_trend || []).map((point) => ({
      date: formatDate(point.date),
      exposure: Number(point.risk_exposure_pct || 0),
    }));
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f8fc] p-6">
        <div className="mx-auto max-w-[1500px]">
          <LoadingState />
        </div>
      </div>
    );
  }

  if (error || !data || !summary) {
    return (
      <div className="min-h-screen bg-[#f6f8fc] p-6">
        <div className="mx-auto max-w-[1500px]">
          <div className="rounded-xl border border-red-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3 text-red-700">
              <ShieldAlert size={20} />
              <h2 className="font-semibold">
                Trend Analysis unavailable
              </h2>
            </div>

            <p className="mt-2 text-sm text-slate-500">
              {error || "No trend data was returned by the intelligence layer."}
            </p>

            <button
              type="button"
              onClick={() => load()}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#0f2747] px-4 py-2 text-sm font-medium text-white hover:bg-[#183b63]"
            >
              <RefreshCw size={15} />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const health = Number(summary.compliance_health_index || 0);
  const exposure = Number(summary.unified_exposure_score || 0);
  const riskExposure = Number(
    data.current?.risk_exposure_pct ?? summary.exposure_indices?.risk ?? 0
  );

  return (
    <div className="min-h-screen bg-[#f6f8fc] px-4 py-5 text-[#102a43] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
              <TrendingUp
                size={21}
                strokeWidth={1.8}
                className="text-[#274c77]"
              />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-[#102a43]">
                  Trend Analysis
                </h1>

                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                  Tenant Intelligence
                </span>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                Strategic compliance performance, exposure movement and
                operational signals.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
              <CalendarRange size={15} className="ml-2 text-slate-400" />

              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setDays(option)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    days === option
                      ? "bg-[#eaf1fb] text-[#0f2747]"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {option}D
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => load(true)}
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

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            label="Compliance Health"
            value={`${health.toFixed(1)}%`}
            description="Current health-oriented index"
            icon={<Gauge size={18} />}
            status={
              health >= 75
                ? "Healthy"
                : health >= 50
                ? "Watch"
                : "Critical"
            }
            tone={
              health >= 75
                ? "positive"
                : health >= 50
                ? "warning"
                : "critical"
            }
          />

          <KpiCard
            label="Unified Exposure"
            value={exposure.toFixed(1)}
            description="Lower is better"
            icon={<ShieldAlert size={18} />}
            status={
              exposure <= 25
                ? "Controlled"
                : exposure <= 50
                ? "Watch"
                : "Elevated"
            }
            tone={
              exposure <= 25
                ? "positive"
                : exposure <= 50
                ? "warning"
                : "critical"
            }
          />

          <KpiCard
            label="Risk Exposure"
            value={`${riskExposure.toFixed(1)}%`}
            description={`${data.current.total_risks || 0} risks in universe`}
            icon={<AlertTriangle size={18} />}
            status="Current"
            tone="neutral"
          />

          <KpiCard
            label="Evidence Approvals"
            value={approvalStats.total.toLocaleString()}
            description={`Across selected ${days}-day window`}
            icon={<CheckCircle2 size={18} />}
            status={
              approvalStats.direction === "up"
                ? "Increasing"
                : approvalStats.direction === "down"
                ? "Decreasing"
                : "Stable"
            }
            tone={
              approvalStats.direction === "up"
                ? "positive"
                : approvalStats.direction === "down"
                ? "warning"
                : "neutral"
            }
          />

          <KpiCard
            label="Avg Daily Approvals"
            value={approvalStats.average.toFixed(1)}
            description="Based on days with approval events"
            icon={<Activity size={18} />}
            status="Operational"
            tone="neutral"
          />
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.65fr_1fr]">
          <Panel
            title="Evidence Approval Velocity"
            subtitle={`Daily approved evidence events · last ${days} days`}
            icon={<BarChart3 size={17} />}
            action={
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                Operational trend
              </span>
            }
          >
            <div className="h-[310px] w-full">
              {approvalChartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={approvalChartData}
                    margin={{ top: 12, right: 8, left: -20, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e7edf4"
                    />

                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={24}
                    />

                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      tickLine={false}
                      axisLine={false}
                    />

                    <Tooltip
                      cursor={{ fill: "#f8fafc" }}
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 8px 24px rgba(15,39,71,0.08)",
                        fontSize: 12,
                      }}
                    />

                    <ReferenceLine
                      y={approvalStats.average}
                      stroke="#94a3b8"
                      strokeDasharray="4 4"
                    />

                    <Bar
                      dataKey="approvals"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={22}
                    >
                      {approvalChartData.map((_, index) => (
                        <Cell key={index} fill="#527aa3" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message="No evidence approval events were recorded in this period." />
              )}
            </div>
          </Panel>

          <Panel
            title="Risk Exposure"
            subtitle="Tenant-scoped current exposure signal"
            icon={<ShieldAlert size={17} />}
            action={
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700">
                Data-aware
              </span>
            }
          >
            <div className="h-[310px]">
              {riskChartData.length === 1 ? (
                <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                    <Info size={20} className="text-slate-500" />
                  </div>

                  <div className="mt-4 text-3xl font-semibold text-[#102a43]">
                    {riskExposure.toFixed(1)}%
                  </div>

                  <div className="mt-1 text-sm font-medium text-slate-600">
                    Current risk exposure
                  </div>

                  <p className="mt-3 max-w-sm text-xs leading-5 text-slate-500">
                    Historical risk snapshots are not available for this
                    tenant. The system therefore does not fabricate a
                    historical series and displays only the verified current
                    exposure point.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={riskChartData}
                    margin={{ top: 12, right: 8, left: -20, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e7edf4"
                    />

                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      tickLine={false}
                      axisLine={false}
                    />

                    <YAxis
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      tickLine={false}
                      axisLine={false}
                    />

                    <Tooltip
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid #e2e8f0",
                        fontSize: 12,
                      }}
                      formatter={(value) => [
                        `${Number(value).toFixed(1)}%`,
                        "Exposure",
                      ]}
                    />

                    <Bar
                      dataKey="exposure"
                      fill="#c17c32"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={34}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Panel>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.35fr]">
          <Panel
            title="Strategic Index Snapshot"
            subtitle="Current enterprise health and exposure dimensions"
            icon={<Gauge size={17} />}
          >
            <div className="space-y-4">
              <IndexRow
                label="Risk Health"
                value={summary.indices?.risk ?? 0}
                detail="Risk exposure converted to health"
              />

              <IndexRow
                label="Coverage Health"
                value={summary.indices?.coverage ?? 0}
                detail="Control and compliance coverage"
              />

              <IndexRow
                label="Maturity Health"
                value={summary.indices?.maturity ?? 0}
                detail="Governance maturity signal"
              />

              <IndexRow
                label="Evidence Health"
                value={summary.indices?.evidence ?? 0}
                detail="Evidence quality and availability"
              />

              <IndexRow
                label="Task Pressure Health"
                value={summary.indices?.task_pressure ?? 0}
                detail="Operational task pressure"
              />
            </div>
          </Panel>

          <Panel
            title="Trend Signals"
            subtitle="System-generated interpretation of the current movement"
            icon={<Activity size={17} />}
          >
            <div className="grid gap-3 md:grid-cols-2">
              {strategicSignals.length ? (
                strategicSignals.map((signal) => (
                  <SignalCard key={signal.title} {...signal} />
                ))
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No strategic signals are currently available.
                </div>
              )}
            </div>
          </Panel>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-3">
          <Panel
            title="Trend Interpretation"
            subtitle="Executive reading of the selected period"
            icon={<TrendingUp size={17} />}
          >
            <div className="space-y-3 text-sm leading-6 text-slate-600">
              <p>
                The selected window contains{" "}
                <strong className="text-[#102a43]">
                  {approvalStats.total.toLocaleString()}
                </strong>{" "}
                recorded evidence approval events.
              </p>

              <p>
                Average approval throughput is{" "}
                <strong className="text-[#102a43]">
                  {approvalStats.average.toFixed(1)}
                </strong>{" "}
                events per active day.
              </p>

              <p>
                Current unified exposure is{" "}
                <strong className="text-[#102a43]">
                  {exposure.toFixed(1)}
                </strong>
                , while compliance health is{" "}
                <strong className="text-[#102a43]">
                  {health.toFixed(1)}%
                </strong>
                .
              </p>
            </div>
          </Panel>

          <Panel
            title="Data Coverage"
            subtitle="Source availability used by intelligence"
            icon={<Database size={17} />}
          >
            <div className="space-y-2">
              {Object.entries(summary.source_stats || {}).map(
                ([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                  >
                    <span className="text-xs font-medium capitalize text-slate-600">
                      {key.replaceAll("_", " ")}
                    </span>

                    <span className="text-xs font-semibold text-[#102a43]">
                      {Number(value?.row_count || 0).toLocaleString()}
                    </span>
                  </div>
                )
              )}

              {!Object.keys(summary.source_stats || {}).length && (
                <div className="text-xs text-slate-500">
                  Source statistics were not returned.
                </div>
              )}
            </div>
          </Panel>

          <Panel
            title="Intelligence Integrity"
            subtitle="How this screen handles incomplete history"
            icon={<ShieldCheck size={17} />}
          >
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                <CheckCircle2 size={16} />
                No fabricated historical data
              </div>

              <p className="mt-2 text-xs leading-5 text-emerald-700">
                Historical risk movement is shown only when verified snapshots
                exist. Missing history is explicitly surfaced instead of being
                reconstructed from the current value.
              </p>
            </div>

            {summary.warnings?.length ? (
              <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-3">
                <div className="text-xs font-semibold text-amber-800">
                  Intelligence warnings
                </div>

                <ul className="mt-2 space-y-1 text-xs text-amber-700">
                  {summary.warnings.map((warning, index) => (
                    <li key={index}>• {warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Panel>
        </section>

        <footer className="mt-5 flex flex-col gap-2 border-t border-slate-200 pt-4 text-[10px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Trend Analysis · {days}-day analytical window
          </span>

          <span>
            Computed from tenant-scoped intelligence sources
          </span>
        </footer>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  description,
  icon,
  status,
  tone,
}: {
  label: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  status: string;
  tone: "positive" | "warning" | "critical" | "neutral";
}) {
  const toneClass = {
    positive: "text-emerald-700 bg-emerald-50 border-emerald-100",
    warning: "text-amber-700 bg-amber-50 border-amber-100",
    critical: "text-red-700 bg-red-50 border-red-100",
    neutral: "text-slate-600 bg-slate-50 border-slate-200",
  }[tone];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {label}
          </div>

          <div className="mt-2 text-2xl font-semibold tracking-tight text-[#102a43]">
            {value}
          </div>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f1f5f9] text-[#527aa3]">
          {icon}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-slate-400">
          {description}
        </span>

        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold ${toneClass}`}
        >
          {status}
        </span>
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  icon,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="mt-0.5 text-[#527aa3]">{icon}</div>

          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[#102a43]">
              {title}
            </h2>

            <p className="mt-0.5 text-[11px] text-slate-400">
              {subtitle}
            </p>
          </div>
        </div>

        {action}
      </div>

      {children}
    </section>
  );
}

function IndexRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  const normalized = Math.max(0, Math.min(100, Number(value || 0)));

  return (
    <div>
      <div className="mb-1.5 flex items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-[#102a43]">
            {label}
          </div>

          <div className="text-[10px] text-slate-400">
            {detail}
          </div>
        </div>

        <div className="text-sm font-semibold text-[#102a43]">
          {normalized.toFixed(1)}%
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-[#527aa3] transition-all"
          style={{ width: `${normalized}%` }}
        />
      </div>
    </div>
  );
}

function SignalCard({
  title,
  description,
  tone,
  icon,
}: {
  title: string;
  description: string;
  tone: "positive" | "warning" | "neutral";
  icon: "up" | "down" | "alert" | "check";
}) {
  const styles = {
    positive:
      "border-emerald-100 bg-emerald-50/60 text-emerald-800",
    warning:
      "border-amber-100 bg-amber-50/60 text-amber-800",
    neutral:
      "border-slate-200 bg-slate-50 text-slate-700",
  }[tone];

  const Icon =
    icon === "up"
      ? TrendingUp
      : icon === "down"
      ? TrendingDown
      : icon === "check"
      ? CheckCircle2
      : AlertTriangle;

  return (
    <div className={`rounded-lg border p-4 ${styles}`}>
      <div className="flex items-start gap-2">
        <Icon size={16} className="mt-0.5 shrink-0" />

        <div>
          <div className="text-xs font-semibold">{title}</div>

          <p className="mt-1 text-[11px] leading-5 opacity-80">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-xs text-slate-400">
      {message}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-5">
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
        <div className="h-[390px] animate-pulse rounded-xl bg-white" />
        <div className="h-[390px] animate-pulse rounded-xl bg-white" />
      </div>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}
