"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/api";

type ReadinessRow = {
  process_id: number;
  process_code?: string;
  process_name: string;
  readiness_score: number;
  coverage_percentage: number;
  critical_risk_count?: number;
  critical_risks?: number;
  escalation_probability: number;
  trend_delta?: number;
  trend_30d?: number;
};

const STANDARD_OPTIONS = [
  { value: "", label: "All Standards" },
  { value: "5", label: "ISO 27001" },
  { value: "7", label: "ISO 9001" },
  { value: "13", label: "ISO 20000-1" },
  { value: "22", label: "ISO 14001" },
];

type ReadinessFilter = "all" | "critical" | "attention" | "healthy";

function normalizePercentage(value: number | undefined | null): number {
  if (value == null || Number.isNaN(Number(value))) return 0;

  const numeric = Number(value);

  if (numeric <= 1) {
    return Math.round(numeric * 100);
  }

  return Math.round(numeric);
}

function readinessLevel(value: number) {
  if (value >= 80) {
    return {
      label: "Healthy",
      text: "text-emerald-700",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      bar: "bg-emerald-500",
    };
  }

  if (value >= 60) {
    return {
      label: "Watch",
      text: "text-amber-700",
      bg: "bg-amber-50",
      border: "border-amber-200",
      bar: "bg-amber-500",
    };
  }

  return {
    label: "Critical",
    text: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    bar: "bg-red-500",
  };
}

function getCriticalRiskCount(row: ReadinessRow) {
  return row.critical_risk_count ?? row.critical_risks ?? 0;
}

function getTrend(row: ReadinessRow) {
  return row.trend_delta ?? row.trend_30d ?? 0;
}

function formatTrend(value: number) {
  const numeric = Number(value || 0);

  if (numeric === 0) return "0%";

  return numeric > 0
    ? `+${Math.round(numeric)}%`
    : `${Math.round(numeric)}%`;
}

function getTrendClass(value: number) {
  if (value > 0) return "text-emerald-700";
  if (value < 0) return "text-red-700";
  return "text-slate-500";
}

function getEscalationPercentage(value: number) {
  return normalizePercentage(value);
}

export default function ExecutiveReadinessProcessesPage() {
  const [rows, setRows] = useState<ReadinessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [standardId, setStandardId] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ReadinessFilter>("all");

  const load = useCallback(
    async (showRefreshState = false) => {
      if (showRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const url = standardId
          ? `/analytics/process_readiness?standard_id=${standardId}`
          : "/analytics/process_readiness";

        const response = await apiFetch(url, {
          method: "GET",
        });

        if (!response.ok) {
          let message = `Unable to load process readiness data (${response.status}).`;

          try {
            const payload = await response.json();

            if (payload?.detail) {
              message = payload.detail;
            }
          } catch {
            // Keep the fallback message.
          }

          throw new Error(message);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("Process readiness API returned an invalid response.");
        }

        setRows(data);
      } catch (err) {
        setRows([]);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load process readiness data.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [standardId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      const code =
        row.process_code ||
        `PRC-${String(row.process_id).padStart(3, "0")}`;

      const matchesSearch =
        !query ||
        code.toLowerCase().includes(query) ||
        row.process_name.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      const readiness = Number(row.readiness_score || 0);
      const criticalRiskCount = getCriticalRiskCount(row);
      const escalation = getEscalationPercentage(
        row.escalation_probability,
      );

      if (filter === "critical") {
        return readiness < 60 || criticalRiskCount > 0 || escalation >= 60;
      }

      if (filter === "attention") {
        return (
          (readiness >= 60 && readiness < 80) ||
          escalation >= 30 ||
          criticalRiskCount > 0
        );
      }

      if (filter === "healthy") {
        return readiness >= 80 && criticalRiskCount === 0 && escalation < 30;
      }

      return true;
    });
  }, [rows, search, filter]);

  const summary = useMemo(() => {
    if (rows.length === 0) {
      return {
        total: 0,
        readiness: 0,
        coverage: 0,
        criticalRisks: 0,
        escalation: 0,
        improving: 0,
        declining: 0,
      };
    }

    const total = rows.length;

    const readiness =
      rows.reduce(
        (sum, row) => sum + Number(row.readiness_score || 0),
        0,
      ) / total;

    const coverage =
      rows.reduce(
        (sum, row) => sum + Number(row.coverage_percentage || 0),
        0,
      ) / total;

    const criticalRisks = rows.reduce(
      (sum, row) => sum + getCriticalRiskCount(row),
      0,
    );

    const escalation =
      rows.reduce(
        (sum, row) =>
          sum + getEscalationPercentage(row.escalation_probability),
        0,
      ) / total;

    const improving = rows.filter((row) => getTrend(row) > 0).length;
    const declining = rows.filter((row) => getTrend(row) < 0).length;

    return {
      total,
      readiness: Math.round(readiness),
      coverage: Math.round(coverage),
      criticalRisks,
      escalation: Math.round(escalation),
      improving,
      declining,
    };
  }, [rows]);

  const overallLevel = readinessLevel(summary.readiness);

  return (
    <main className="min-h-full bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* HEADER */}

        <section className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6 text-slate-700"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M4 19V5" />
                <path d="M4 19h16" />
                <path d="m7 15 4-4 3 2 5-6" />
              </svg>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                  Executive Readiness
                </h1>

                <span
                  className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${overallLevel.bg} ${overallLevel.border} ${overallLevel.text}`}
                >
                  {overallLevel.label}
                </span>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                Process-level compliance posture, control coverage and
                escalation intelligence.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-[220px]">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Standard Scope
              </label>

              <select
                value={standardId}
                onChange={(event) => setStandardId(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
              >
                {STANDARD_OPTIONS.map((option) => (
                  <option
                    key={option.value || "all"}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => void load(true)}
              disabled={loading || refreshing}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg
                viewBox="0 0 24 24"
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4" />
                <path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4" />
              </svg>
              Refresh
            </button>
          </div>
        </section>

        {/* ERROR */}

        {error && (
          <section className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">
                !
              </div>

              <div>
                <div className="text-sm font-semibold text-red-900">
                  Unable to load Executive Readiness
                </div>

                <div className="mt-0.5 text-sm text-red-700">
                  {error}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* KPI GRID */}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            label="Processes"
            value={summary.total}
            description="In current scope"
            icon="process"
          />

          <KpiCard
            label="Avg. Readiness"
            value={`${summary.readiness}%`}
            description="Overall process posture"
            icon="readiness"
            accent={overallLevel.text}
          />

          <KpiCard
            label="Avg. Coverage"
            value={`${summary.coverage}%`}
            description="Control coverage"
            icon="coverage"
          />

          <KpiCard
            label="Critical Risks"
            value={summary.criticalRisks}
            description="Across selected processes"
            icon="risk"
            accent={
              summary.criticalRisks > 0
                ? "text-red-700"
                : "text-emerald-700"
            }
          />

          <KpiCard
            label="Avg. Escalation"
            value={`${summary.escalation}%`}
            description="Escalation probability"
            icon="escalation"
            accent={
              summary.escalation >= 60
                ? "text-red-700"
                : summary.escalation >= 30
                  ? "text-amber-700"
                  : "text-emerald-700"
            }
          />
        </section>

        {/* EXECUTIVE POSTURE */}

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <PostureCard
            title="Readiness Posture"
            value={`${summary.readiness}%`}
            subtitle="Average process readiness"
            progress={summary.readiness}
            level={overallLevel.label}
          />

          <PostureCard
            title="Coverage Posture"
            value={`${summary.coverage}%`}
            subtitle="Average control coverage"
            progress={summary.coverage}
            level={
              summary.coverage >= 80
                ? "Healthy"
                : summary.coverage >= 60
                  ? "Watch"
                  : "Critical"
            }
          />

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">
              Trend Signals
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Improving
                </div>

                <div className="mt-1 text-2xl font-bold text-emerald-800">
                  {summary.improving}
                </div>

                <div className="mt-1 text-xs text-emerald-700">
                  Processes with positive trend
                </div>
              </div>

              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-red-700">
                  Declining
                </div>

                <div className="mt-1 text-2xl font-bold text-red-800">
                  {summary.declining}
                </div>

                <div className="mt-1 text-xs text-red-700">
                  Processes with negative trend
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PROCESS INTELLIGENCE */}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950">
                  Process Readiness Intelligence
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Prioritize processes requiring executive attention.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <svg
                    viewBox="0 0 24 24"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-4-4" />
                  </svg>

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search process..."
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100 sm:w-[240px]"
                  />
                </div>

                <select
                  value={filter}
                  onChange={(event) =>
                    setFilter(event.target.value as ReadinessFilter)
                  }
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                >
                  <option value="all">All Processes</option>
                  <option value="critical">Needs Attention</option>
                  <option value="attention">Watch</option>
                  <option value="healthy">Healthy</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1050px] w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Process
                  </th>

                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Readiness
                  </th>

                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Coverage
                  </th>

                  <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Critical Risks
                  </th>

                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Escalation
                  </th>

                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    30d Trend
                  </th>

                  <th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Executive Signal
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <SkeletonRow key={index} />
                  ))
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-16 text-center"
                    >
                      <div className="mx-auto max-w-md">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                          <svg
                            viewBox="0 0 24 24"
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          >
                            <circle cx="11" cy="11" r="7" />
                            <path d="m20 20-4-4" />
                          </svg>
                        </div>

                        <div className="mt-3 text-sm font-semibold text-slate-900">
                          No process readiness data
                        </div>

                        <div className="mt-1 text-sm text-slate-500">
                          No records match the selected scope and filters.
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const readiness = Math.round(
                      Number(row.readiness_score || 0),
                    );

                    const coverage = Math.round(
                      Number(row.coverage_percentage || 0),
                    );

                    const criticalRisks = getCriticalRiskCount(row);
                    const escalation = getEscalationPercentage(
                      row.escalation_probability,
                    );
                    const trend = getTrend(row);

                    const level = readinessLevel(readiness);

                    const signal =
                      criticalRisks > 0
                        ? "Critical risk exposure"
                        : escalation >= 60
                          ? "High escalation probability"
                          : readiness < 60
                            ? "Readiness below threshold"
                            : readiness < 80 || escalation >= 30
                              ? "Requires monitoring"
                              : "Stable";

                    return (
                      <tr
                        key={row.process_id}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700">
                              {String(
                                row.process_code ||
                                  `PRC-${String(row.process_id).padStart(3, "0")}`,
                              )
                                .replace("PRC-", "")
                                .slice(0, 3)}
                            </div>

                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900">
                                {row.process_code ||
                                  `PRC-${String(row.process_id).padStart(3, "0")}`}
                              </div>

                              <div className="mt-0.5 max-w-[300px] truncate text-xs text-slate-500">
                                {row.process_name}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="min-w-[150px]">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-bold text-slate-900">
                                {readiness}%
                              </span>

                              <span
                                className={`text-[11px] font-semibold ${level.text}`}
                              >
                                {level.label}
                              </span>
                            </div>

                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full ${level.bar}`}
                                style={{
                                  width: `${Math.max(
                                    0,
                                    Math.min(100, readiness),
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="text-sm font-semibold text-slate-800">
                            {coverage}%
                          </div>

                          <div className="mt-1 text-xs text-slate-400">
                            Control coverage
                          </div>
                        </td>

                        <td className="px-4 py-4 text-center">
                          <RiskValue value={criticalRisks} />
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={
                                  escalation >= 60
                                    ? "h-full rounded-full bg-red-500"
                                    : escalation >= 30
                                      ? "h-full rounded-full bg-amber-500"
                                      : "h-full rounded-full bg-emerald-500"
                                }
                                style={{
                                  width: `${Math.max(
                                    0,
                                    Math.min(100, escalation),
                                  )}%`,
                                }}
                              />
                            </div>

                            <span
                              className={`text-sm font-semibold ${
                                escalation >= 60
                                  ? "text-red-700"
                                  : escalation >= 30
                                    ? "text-amber-700"
                                    : "text-emerald-700"
                              }`}
                            >
                              {escalation}%
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center gap-1 text-sm font-semibold ${getTrendClass(
                              trend,
                            )}`}
                          >
                            {trend > 0 ? "↑" : trend < 0 ? "↓" : "→"}
                            {formatTrend(trend)}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                              criticalRisks > 0
                                ? "border-red-200 bg-red-50 text-red-700"
                                : escalation >= 60
                                  ? "border-red-200 bg-red-50 text-red-700"
                                  : readiness < 60
                                    ? "border-amber-200 bg-amber-50 text-amber-700"
                                    : readiness < 80 || escalation >= 30
                                      ? "border-amber-200 bg-amber-50 text-amber-700"
                                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {signal}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {!loading && rows.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Showing {filteredRows.length} of {rows.length} processes
              </span>

              <span>
                Scope:{" "}
                <span className="font-semibold text-slate-700">
                  {STANDARD_OPTIONS.find(
                    (option) => option.value === standardId,
                  )?.label || "All Standards"}
                </span>
              </span>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function KpiCard({
  label,
  value,
  description,
  icon,
  accent = "text-slate-900",
}: {
  label: string;
  value: string | number;
  description: string;
  icon: "process" | "readiness" | "coverage" | "risk" | "escalation";
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </div>

        <KpiIcon type={icon} />
      </div>

      <div className={`mt-3 text-3xl font-bold tracking-tight ${accent}`}>
        {value}
      </div>

      <div className="mt-1 text-xs text-slate-500">{description}</div>
    </div>
  );
}

function KpiIcon({
  type,
}: {
  type: "process" | "readiness" | "coverage" | "risk" | "escalation";
}) {
  const base =
    "flex h-8 w-8 items-center justify-center rounded-lg border";

  if (type === "risk") {
    return (
      <div className={`${base} border-red-200 bg-red-50 text-red-600`}>
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="m12 3 9 16H3L12 3Z" />
          <path d="M12 9v4" />
          <path d="M12 16h.01" />
        </svg>
      </div>
    );
  }

  if (type === "escalation") {
    return (
      <div className={`${base} border-amber-200 bg-amber-50 text-amber-600`}>
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M4 17 10 11l4 4 6-7" />
          <path d="M16 8h4v4" />
        </svg>
      </div>
    );
  }

  if (type === "coverage") {
    return (
      <div className={`${base} border-blue-200 bg-blue-50 text-blue-600`}>
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <circle cx="12" cy="12" r="8" />
          <path d="m8 12 2.5 2.5L16 9" />
        </svg>
      </div>
    );
  }

  if (type === "readiness") {
    return (
      <div
        className={`${base} border-emerald-200 bg-emerald-50 text-emerald-600`}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M4 18V6" />
          <path d="M4 18h16" />
          <path d="m7 14 3-3 3 2 4-5" />
        </svg>
      </div>
    );
  }

  return (
    <div className={`${base} border-slate-200 bg-slate-50 text-slate-600`}>
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="M8 9h8M8 13h5" />
      </svg>
    </div>
  );
}

function PostureCard({
  title,
  value,
  subtitle,
  progress,
  level,
}: {
  title: string;
  value: string;
  subtitle: string;
  progress: number;
  level: string;
}) {
  const bounded = Math.max(0, Math.min(100, progress));

  const levelStyle =
    level === "Healthy"
      ? "text-emerald-700"
      : level === "Watch"
        ? "text-amber-700"
        : "text-red-700";

  const barStyle =
    level === "Healthy"
      ? "bg-emerald-500"
      : level === "Watch"
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">
            {title}
          </div>

          <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
        </div>

        <span className={`text-xs font-bold ${levelStyle}`}>{level}</span>
      </div>

      <div className="mt-5 flex items-end justify-between">
        <span className="text-3xl font-bold tracking-tight text-slate-950">
          {value}
        </span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${barStyle}`}
          style={{ width: `${bounded}%` }}
        />
      </div>
    </div>
  );
}

function RiskValue({ value }: { value: number }) {
  if (value === 0) {
    return (
      <span className="inline-flex min-w-8 justify-center rounded-full bg-emerald-50 px-2.5 py-1 text-sm font-bold text-emerald-700">
        0
      </span>
    );
  }

  return (
    <span
      className={`inline-flex min-w-8 justify-center rounded-full px-2.5 py-1 text-sm font-bold ${
        value <= 2
          ? "bg-amber-50 text-amber-700"
          : "bg-red-50 text-red-700"
      }`}
    >
      {value}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100">
      {Array.from({ length: 7 }).map((_, index) => (
        <td key={index} className="px-6 py-5">
          <div className="h-4 animate-pulse rounded bg-slate-100" />
        </td>
      ))}
    </tr>
  );
}
