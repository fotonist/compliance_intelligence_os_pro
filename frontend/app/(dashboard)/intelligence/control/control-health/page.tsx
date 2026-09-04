"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  FileCheck2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Target,
  XCircle,
} from "lucide-react";
import { apiFetch } from "@/app/lib/api";

type ControlHealthRow = {
  control_id: number;
  control_code: string | null;
  control_title: string | null;
  health_index: number;
  status: "Healthy" | "Partial" | "Weak" | "No Evidence" | string;
  gap_count: number;
  worst_severity: number;
  risk_count: number;
  evidence_count: number;
};

type HealthResponse = {
  summary: {
    total_controls: number;
    healthy_controls: number;
    partial_controls: number;
    weak_controls: number;
    no_evidence_controls: number;
    average_health: number;
  };
  controls: ControlHealthRow[];
};

const FILTERS = [
  "All",
  "Healthy",
  "Partial",
  "Weak",
  "No Evidence",
] as const;

type Filter = (typeof FILTERS)[number];

function healthTone(value: number) {
  if (value >= 80) {
    return {
      text: "text-emerald-400",
      bar: "bg-emerald-500",
      ring: "border-emerald-500/30",
      soft: "bg-emerald-500/10",
    };
  }

  if (value >= 55) {
    return {
      text: "text-amber-400",
      bar: "bg-amber-500",
      ring: "border-amber-500/30",
      soft: "bg-amber-500/10",
    };
  }

  return {
    text: "text-red-400",
    bar: "bg-red-500",
    ring: "border-red-500/30",
    soft: "bg-red-500/10",
  };
}

function statusMeta(status: string) {
  switch (status) {
    case "Healthy":
      return {
        icon: CheckCircle2,
        text: "text-emerald-400",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/20",
      };

    case "Partial":
      return {
        icon: CircleAlert,
        text: "text-amber-400",
        bg: "bg-amber-500/10",
        border: "border-amber-500/20",
      };

    case "Weak":
      return {
        icon: XCircle,
        text: "text-red-400",
        bg: "bg-red-500/10",
        border: "border-red-500/20",
      };

    default:
      return {
        icon: FileCheck2,
        text: "text-slate-600",
        bg: "bg-slate-500/10",
        border: "border-slate-500/20",
      };
  }
}

function severityMeta(value: number) {
  if (value >= 80) {
    return "text-red-400";
  }

  if (value >= 50) {
    return "text-amber-400";
  }

  return "text-slate-700";
}

export default function ControlHealthPage() {
  const router = useRouter();
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("All");
  const [search, setSearch] = useState("");
  const [customControlsCount, setCustomControlsCount] = useState(0);

  const load = useCallback(async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      const res = await apiFetch("/api/intelligence/control-health");

      if (!res.ok) {
        throw new Error(
          `Control Health request failed (${res.status}).`
        );
      }

      const json: HealthResponse = await res.json();
      setData(json);

      // Control Health metrics are standard/canonical control metrics.
      // Custom controls are displayed separately and are excluded from
      // the standard health distribution.
      try {
        const controlsResponse = await apiFetch("/controls");

        if (controlsResponse.ok) {
          const controlsPayload = await controlsResponse.json();
          const controlItems = Array.isArray(controlsPayload)
            ? controlsPayload
            : Array.isArray(controlsPayload?.items)
              ? controlsPayload.items
              : [];

          setCustomControlsCount(
            controlItems.filter(
              (control: any) =>
                String(control?.origin || "").toLowerCase() === "custom"
            ).length
          );
        }
      } catch (controlsError) {
        console.warn("Custom control count unavailable:", controlsError);
      }
    } catch (err) {
      console.error("Control Health load error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load Control Health."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredControls = useMemo(() => {
    if (!data?.controls) return [];

    const query = search.trim().toLowerCase();

    return data.controls.filter((control) => {
      const matchesFilter =
        filter === "All" || control.status === filter;

      if (!matchesFilter) return false;

      if (!query) return true;

      return (
        String(control.control_code || "")
          .toLowerCase()
          .includes(query) ||
        String(control.control_title || "")
          .toLowerCase()
          .includes(query)
      );
    });
  }, [data, filter, search]);

  const distribution = useMemo(() => {
    if (!data) return [];

    const total = Math.max(data.summary.total_controls, 1);

    return [
      {
        label: "Healthy",
        value: data.summary.healthy_controls,
        percent: (data.summary.healthy_controls / total) * 100,
        color: "bg-emerald-500",
      },
      {
        label: "Partial",
        value: data.summary.partial_controls,
        percent: (data.summary.partial_controls / total) * 100,
        color: "bg-amber-500",
      },
      {
        label: "Weak",
        value: data.summary.weak_controls,
        percent: (data.summary.weak_controls / total) * 100,
        color: "bg-red-500",
      },
      {
        label: "No Evidence",
        value: data.summary.no_evidence_controls,
        percent:
          (data.summary.no_evidence_controls / total) * 100,
        color: "bg-slate-500",
      },
    ];
  }, [data]);

  if (loading) {
    return <LoadingState />;
  }

  if (error || !data) {
    return (
      <div className="min-h-full p-6 lg:p-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="rounded-2xl border border-red-500/20 bg-red-950/20 p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-red-400" />
              <div>
                <div className="font-semibold text-slate-900">
                  Control Health unavailable
                </div>
                <div className="mt-1 text-sm text-red-300/80">
                  {error || "Failed to load Control Health."}
                </div>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const summary = data.summary;
  const tone = healthTone(summary.average_health);

  return (
    <div className="min-h-full bg-slate-50 p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-6">

        {/* Header */}
        <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
              <Activity className="h-4 w-4" />
              Intelligence / Control Analytics
            </div>

            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 lg:text-3xl">
              Control Health
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Enterprise control-level health assessment across
              evidence coverage, risk exposure, gaps and remediation.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-200 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                refreshing ? "animate-spin" : ""
              }`}
            />
            Refresh
          </button>
        </section>

        {/* Executive KPI row */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <MetricCard
            icon={Target}
            label="Standard Controls"
            value={summary.total_controls}
            description="Canonical controls in active tenant scope"
          />

          <MetricCard
            icon={ShieldCheck}
            label="Custom Controls"
            value={customControlsCount}
            description="Tenant-defined controls"
          />

          <MetricCard
            icon={ShieldCheck}
            label="Healthy"
            value={summary.healthy_controls}
            valueClass="text-emerald-400"
            description="Health index ≥ 80"
          />

          <MetricCard
            icon={CircleAlert}
            label="Partial"
            value={summary.partial_controls}
            valueClass="text-amber-400"
            description="Health index 55–79.9"
          />

          <MetricCard
            icon={ShieldAlert}
            label="Weak"
            value={summary.weak_controls}
            valueClass="text-red-400"
            description="Health index below 55"
          />

          <MetricCard
            icon={FileCheck2}
            label="No Evidence"
            value={summary.no_evidence_controls}
            valueClass="text-slate-700"
            description="No evidence attached"
          />
        </section>

        {/* Executive health panel */}
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_1fr]">

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Enterprise Control Health
                </div>

                <div className={`mt-2 text-5xl font-semibold tracking-tight ${tone.text}`}>
                  {summary.average_health.toFixed(1)}
                </div>

                <div className="mt-2 text-sm text-slate-600">
                  Weighted average across {summary.total_controls} controls
                </div>
              </div>

              <div
                className={`flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-8 ${tone.ring} ${tone.soft}`}
              >
                <div className="text-center">
                  <div className={`text-2xl font-semibold ${tone.text}`}>
                    {summary.average_health.toFixed(0)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">
                    / 100
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-7">
              <div className="mb-2 flex justify-between text-xs">
                <span className="text-slate-500">
                  Overall health index
                </span>
                <span className={tone.text}>
                  {summary.average_health.toFixed(1)}%
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all ${tone.bar}`}
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(0, summary.average_health)
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Health Distribution
            </div>

            <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-slate-100">
              {distribution.map((item) => (
                <div
                  key={item.label}
                  className={`${item.color} transition-all`}
                  style={{
                    width: `${item.percent}%`,
                  }}
                  title={`${item.label}: ${item.value}`}
                />
              ))}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4">
              {distribution.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${item.color}`}
                    />
                    <span className="text-xs text-slate-600">
                      {item.label}
                    </span>
                  </div>

                  <div className="text-sm font-semibold text-slate-900">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Controls */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

          <div className="border-b border-slate-200 p-5 lg:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Control Health Register
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {filteredControls.length} of {data.controls.length} controls displayed
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search controls..."
                    className="h-10 w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-slate-500 sm:w-64"
                  />
                </div>

                <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                  {FILTERS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setFilter(item)}
                      className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                        filter === item
                          ? "bg-slate-100 text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="bg-white">
                <tr className="border-b border-slate-200">
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Control
                  </th>

                  <th className="w-48 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Health Index
                  </th>

                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Status
                  </th>

                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Evidence
                  </th>

                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Risks
                  </th>

                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Gaps
                  </th>

                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Severity
                  </th>

                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>

              <tbody>
                {filteredControls.map((control) => {
                  const tone = healthTone(control.health_index);
                  const meta = statusMeta(control.status);
                  const StatusIcon = meta.icon;

                  return (
                    <tr
                      key={control.control_id}
                      onClick={() =>
                        router.push(`/intelligence/control/${control.control_id}`)
                      }
                      className="group cursor-pointer border-b border-slate-200 transition hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
                            <ShieldCheck className="h-4 w-4" />
                          </div>

                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900">
                              {control.control_code || "—"}
                            </div>

                            <div className="mt-1 max-w-[420px] truncate text-xs text-slate-500">
                              {control.control_title || "Untitled control"}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex justify-between">
                              <span className={`text-sm font-semibold ${tone.text}`}>
                                {control.health_index.toFixed(1)}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                /100
                              </span>
                            </div>

                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full ${tone.bar}`}
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.max(
                                      0,
                                      control.health_index
                                    )
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${meta.bg} ${meta.border} ${meta.text}`}
                        >
                          <StatusIcon className="h-3.5 w-3.5" />
                          {control.status}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-right">
                        <MetricCell
                          value={control.evidence_count}
                          icon={FileCheck2}
                        />
                      </td>

                      <td className="px-4 py-4 text-right">
                        <MetricCell
                          value={control.risk_count}
                          icon={ShieldAlert}
                        />
                      </td>

                      <td className="px-4 py-4 text-right">
                        <MetricCell
                          value={control.gap_count}
                          icon={AlertTriangle}
                        />
                      </td>

                      <td className="px-4 py-4 text-right">
                        <span
                          className={`font-semibold ${severityMeta(
                            control.worst_severity
                          )}`}
                        >
                          {control.worst_severity.toFixed(1)}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <button
                          type="button"
                          title="Control details"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition group-hover:bg-slate-100 group-hover:text-slate-900"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredControls.length === 0 && (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
                <Search className="h-5 w-5 text-slate-500" />
              </div>

              <div className="mt-4 text-sm font-medium text-slate-700">
                No controls found
              </div>

              <div className="mt-1 text-xs text-slate-500">
                Try changing the filter or search criteria.
              </div>
            </div>
          )}
        </section>

        {/* Calculation note */}
        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <div className="flex items-start gap-3">
            <Activity className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" />

            <div>
              <div className="text-xs font-semibold text-slate-700">
                Canonical Control Health Model
              </div>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Health scores are calculated by the canonical Control Health
                Engine using the active tenant intelligence configuration.
                Higher scores indicate stronger control health.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  description,
  valueClass = "text-slate-900",
}: {
  icon: typeof Activity;
  label: string;
  value: number;
  description: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div className="text-xs font-medium text-slate-500">
          {label}
        </div>

        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
          <Icon className="h-4 w-4 text-slate-500" />
        </div>
      </div>

      <div className={`mt-4 text-2xl font-semibold ${valueClass}`}>
        {value}
      </div>

      <div className="mt-1 text-[11px] text-slate-500">
        {description}
      </div>
    </div>
  );
}

function MetricCell({
  value,
  icon: Icon,
}: {
  value: number;
  icon: typeof Activity;
}) {
  return (
    <span className="inline-flex items-center justify-end gap-2 text-slate-700">
      <Icon className="h-3.5 w-3.5 text-slate-500" />
      {value}
    </span>
  );
}

function LoadingState() {
  return (
    <div className="min-h-full bg-slate-50 p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="h-16 w-96 animate-pulse rounded-xl bg-white" />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-32 animate-pulse rounded-2xl bg-white"
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="h-64 animate-pulse rounded-2xl bg-white" />
          <div className="h-64 animate-pulse rounded-2xl bg-white" />
        </div>

        <div className="h-[500px] animate-pulse rounded-2xl bg-white" />
      </div>
    </div>
  );
}
