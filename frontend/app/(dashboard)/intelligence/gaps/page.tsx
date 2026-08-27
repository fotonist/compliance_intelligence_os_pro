"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/app/lib/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type GapItem = {
  gap_id: number;
  severity_score: number | null;
  status: string | null;
  task_id?: number | null;
  task_status?: string | null;
};

type RiskNode = {
  risk_id: number;
  risk_title: string | null;
  risk_level: string | null;
  exposure_score: number | null;
  escalation_probability: number | null;
  gap_count: number;
  worst_severity: number;
  gaps: GapItem[];
};

type ControlNode = {
  control_id: number;
  control_code: string | null;
  control_title: string | null;
  gap_count: number;
  worst_severity: number;
  ai_priority_score: number | null;
  risks: RiskNode[];
};

type GapResponse = {
  summary?: {
    gaps_total: number;
    uncovered: number;
    partial: number;
    worst_severity_score: number | null;
  };
  controls: ControlNode[];
};

type TrendPoint = {
  day?: string;
  gap_count?: number;
  health_index?: number;
};

function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function severityLabel(score: number) {
  if (score >= 25) return "Critical";
  if (score >= 10) return "High";
  if (score >= 5) return "Medium";
  return "Low";
}

function severityClasses(score: number) {
  if (score >= 25) {
    return {
      text: "text-red-700",
      bg: "bg-red-50",
      border: "border-red-200",
      dot: "bg-red-500",
    };
  }

  if (score >= 10) {
    return {
      text: "text-orange-700",
      bg: "bg-orange-50",
      border: "border-orange-200",
      dot: "bg-orange-500",
    };
  }

  if (score >= 5) {
    return {
      text: "text-amber-700",
      bg: "bg-amber-50",
      border: "border-amber-200",
      dot: "bg-amber-500",
    };
  }

  return {
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  };
}

function controlHealthIndex(worstSeverity: number) {
  return Math.max(0, Math.round(100 - Math.min(worstSeverity, 100)));
}

function priorityLabel(score: number) {
  if (score >= 75) return "Critical";
  if (score >= 50) return "High";
  if (score >= 25) return "Medium";
  return "Low";
}

function priorityClasses(score: number) {
  if (score >= 75) {
    return "bg-red-50 text-red-700 border-red-200";
  }

  if (score >= 50) {
    return "bg-orange-50 text-orange-700 border-orange-200";
  }

  if (score >= 25) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

function formatStatus(status: string | null | undefined) {
  if (!status) return "Unknown";

  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value: string | undefined) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

export default function GapIntelligencePage() {
  const router = useRouter();

  const [data, setData] = useState<GapResponse | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [openControl, setOpenControl] = useState<number | null>(null);
  const [openRisk, setOpenRisk] = useState<number | null>(null);

  const [taskModalGapId, setTaskModalGapId] = useState<number | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskOwner, setTaskOwner] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskError, setTaskError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [gapResponse, trendResponse] = await Promise.all([
        apiFetch("/company/intelligence/gaps", {
          method: "GET",
        }),
        apiFetch("/company/intelligence/gaps/trend", {
          method: "GET",
        }),
      ]);

      if (!gapResponse.ok) {
        throw new Error(`Gap Intelligence request failed (${gapResponse.status})`);
      }

      const gapJson = await gapResponse.json();
      const trendJson = trendResponse.ok
        ? await trendResponse.json()
        : [];

      setData(gapJson);
      setTrend(Array.isArray(trendJson) ? trendJson : []);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load Gap Intelligence."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function submitTask() {
    if (!taskModalGapId) return;

    if (!taskTitle.trim()) {
      setTaskError("Task title is required.");
      return;
    }

    if (!taskOwner.trim()) {
      setTaskError("Owner role is required.");
      return;
    }

    if (!taskDueDate) {
      setTaskError("Due date is required.");
      return;
    }

    setTaskSaving(true);
    setTaskError("");

    try {
      const response = await apiFetch(
        `/company/intelligence/gaps/${taskModalGapId}/create-task`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: taskTitle.trim(),
            description: taskDescription.trim(),
            owner_role: taskOwner.trim(),
            due_date: taskDueDate,
          }),
        }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json?.detail ||
            json?.message ||
            `Unable to create remediation task (${response.status}).`
        );
      }

      setTaskModalGapId(null);
      setTaskTitle("");
      setTaskDescription("");
      setTaskOwner("");
      setTaskDueDate("");

      await loadData();

      if (json?.task_id) {
        router.push(`/company/tasks/${json.task_id}`);
      }
    } catch (err) {
      console.error(err);

      setTaskError(
        err instanceof Error
          ? err.message
          : "Unable to create remediation task."
      );
    } finally {
      setTaskSaving(false);
    }
  }

  const summary = data?.summary || {
    gaps_total: 0,
    uncovered: 0,
    partial: 0,
    worst_severity_score: 0,
  };

  const controls = data?.controls || [];

  const executiveMetrics = useMemo(() => {
    const totalControls = controls.length;

    const totalRisks = controls.reduce(
      (sum, control) => sum + (control.risks?.length || 0),
      0
    );

    const linkedTasks = controls.reduce(
      (sum, control) =>
        sum +
        (control.risks || []).reduce(
          (riskSum, risk) =>
            riskSum +
            (risk.gaps || []).filter((gap) => gap.task_id).length,
          0
        ),
      0
    );

    const openGaps = controls.reduce(
      (sum, control) =>
        sum +
        (control.risks || []).reduce(
          (riskSum, risk) =>
            riskSum +
            (risk.gaps || []).filter(
              (gap) =>
                gap.status !== "closed" &&
                gap.status !== "resolved"
            ).length,
          0
        ),
      0
    );

    const averagePriority =
      totalControls > 0
        ? controls.reduce(
            (sum, control) =>
              sum + safeNumber(control.ai_priority_score),
            0
          ) / totalControls
        : 0;

    const health = controlHealthIndex(
      safeNumber(summary.worst_severity_score)
    );

    return {
      totalControls,
      totalRisks,
      linkedTasks,
      openGaps,
      averagePriority,
      health,
    };
  }, [controls, summary.worst_severity_score]);

  const criticalControls = useMemo(() => {
    return [...controls]
      .sort(
        (a, b) =>
          safeNumber(b.ai_priority_score) -
          safeNumber(a.ai_priority_score)
      )
      .slice(0, 5);
  }, [controls]);

  const chartData = trend.map((point) => ({
    ...point,
    displayDay: formatDate(point.day),
    gap_count: safeNumber(point.gap_count),
    health_index: safeNumber(point.health_index),
  }));

  if (loading) {
    return (
      <div className="min-h-full bg-slate-50 p-6">
        <div className="mx-auto max-w-[1600px] space-y-6">
          <div className="h-20 animate-pulse rounded-2xl bg-white shadow-sm" />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-2xl bg-white shadow-sm"
              />
            ))}
          </div>

          <div className="h-80 animate-pulse rounded-2xl bg-white shadow-sm" />

          <div className="h-96 animate-pulse rounded-2xl bg-white shadow-sm" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full bg-slate-50 p-6">
        <div className="mx-auto max-w-[1600px]">
          <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                !
              </div>

              <div className="flex-1">
                <h2 className="text-lg font-semibold text-slate-900">
                  Gap Intelligence unavailable
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {error}
                </p>

                <button
                  type="button"
                  onClick={loadData}
                  className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-[1600px] space-y-6 p-6 lg:p-8">

        {/* HEADER */}
        <section className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-cyan-300">
                <svg
                  width="23"
                  height="23"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M12 3v18" />
                  <path d="M5 7h14" />
                  <path d="M7 7l-3 5a3 3 0 0 0 6 0L7 7Z" />
                  <path d="M17 7l-3 5a3 3 0 0 0 6 0l-3-5Z" />
                </svg>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                    Gap Intelligence
                  </h1>

                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Executive View
                  </span>
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  Enterprise view of compliance gaps, risk exposure,
                  remediation priority and execution pressure.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Intelligence Scope
                </div>
                <div className="mt-0.5 text-sm font-semibold text-slate-800">
                  Current Tenant
                </div>
              </div>

              <button
                type="button"
                onClick={loadData}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M20 11a8.1 8.1 0 0 0-15.5-3" />
                  <path d="M4 4v4h4" />
                  <path d="M4 13a8.1 8.1 0 0 0 15.5 3" />
                  <path d="M20 20v-4h-4" />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </section>

        {/* KPI STRIP */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="Total Gaps"
            value={summary.gaps_total}
            caption="Identified compliance gaps"
            icon="gap"
          />

          <MetricCard
            label="Uncovered"
            value={summary.uncovered}
            caption="Controls without adequate coverage"
            icon="uncovered"
            emphasis={summary.uncovered > 0 ? "danger" : "success"}
          />

          <MetricCard
            label="Partial"
            value={summary.partial}
            caption="Controls requiring improvement"
            icon="partial"
            emphasis={summary.partial > 0 ? "warning" : "success"}
          />

          <MetricCard
            label="Worst Severity"
            value={safeNumber(summary.worst_severity_score).toFixed(1)}
            caption={severityLabel(
              safeNumber(summary.worst_severity_score)
            )}
            icon="severity"
            emphasis={
              safeNumber(summary.worst_severity_score) >= 25
                ? "danger"
                : safeNumber(summary.worst_severity_score) >= 10
                ? "warning"
                : "success"
            }
          />

          <MetricCard
            label="Global Health Index"
            value={`${executiveMetrics.health}%`}
            caption="Derived control health"
            icon="health"
            emphasis={
              executiveMetrics.health < 50
                ? "danger"
                : executiveMetrics.health < 80
                ? "warning"
                : "success"
            }
          />
        </section>

        {/* EXECUTIVE SIGNALS */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Executive Exposure Trend
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Daily gap volume and control health trajectory.
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-cyan-500" />
                  Gap Count
                </div>

                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Health Index
                </div>
              </div>
            </div>

            <div className="mt-5 h-[280px]">
              {chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
                  <div className="text-center">
                    <div className="text-sm font-semibold text-slate-700">
                      No trend data available
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      Historical GAP data will appear here when available.
                    </div>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{
                      top: 10,
                      right: 15,
                      left: -15,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid
                      stroke="#e2e8f0"
                      strokeDasharray="3 3"
                    />

                    <XAxis
                      dataKey="displayDay"
                      tick={{
                        fill: "#64748b",
                        fontSize: 11,
                      }}
                      axisLine={{
                        stroke: "#cbd5e1",
                      }}
                      tickLine={false}
                    />

                    <YAxis
                      tick={{
                        fill: "#64748b",
                        fontSize: 11,
                      }}
                      axisLine={false}
                      tickLine={false}
                    />

                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #e2e8f0",
                        boxShadow:
                          "0 10px 30px rgba(15,23,42,0.10)",
                      }}
                      labelStyle={{
                        color: "#0f172a",
                        fontWeight: 600,
                      }}
                    />

                    <Line
                      type="monotone"
                      dataKey="gap_count"
                      name="Gap Count"
                      stroke="#0891b2"
                      strokeWidth={2.5}
                      dot={false}
                    />

                    <Line
                      type="monotone"
                      dataKey="health_index"
                      name="Health Index"
                      stroke="#16a34a"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Executive Exposure
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Current remediation and risk pressure.
              </p>
            </div>

            <div className="mt-6 space-y-5">
              <ExecutiveSignal
                label="Open Gaps"
                value={executiveMetrics.openGaps}
                status={
                  executiveMetrics.openGaps > 0
                    ? "Attention Required"
                    : "Controlled"
                }
                danger={executiveMetrics.openGaps > 0}
              />

              <ExecutiveSignal
                label="Risk Nodes"
                value={executiveMetrics.totalRisks}
                status="Linked to GAP intelligence"
              />

              <ExecutiveSignal
                label="Remediation Tasks"
                value={executiveMetrics.linkedTasks}
                status={
                  executiveMetrics.linkedTasks > 0
                    ? "Execution underway"
                    : "No tasks linked"
                }
              />

              <ExecutiveSignal
                label="Average AI Priority"
                value={executiveMetrics.averagePriority.toFixed(1)}
                status={priorityLabel(
                  executiveMetrics.averagePriority
                )}
              />
            </div>
          </div>
        </section>

        {/* PRIORITY CONTROLS */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Priority Control Exposure
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Controls ranked by the existing AI priority score.
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                Top {criticalControls.length}
              </span>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {criticalControls.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-500">
                No control exposure data available.
              </div>
            ) : (
              criticalControls.map((control, index) => {
                const aiScore = safeNumber(
                  control.ai_priority_score
                );
                const severity = safeNumber(
                  control.worst_severity
                );
                const health = controlHealthIndex(severity);

                return (
                  <div
                    key={control.control_id}
                    className="grid grid-cols-1 gap-5 px-6 py-5 lg:grid-cols-[48px_minmax(0,1fr)_180px_150px_120px] lg:items-center"
                  >
                    <div className="hidden lg:flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500">
                      {String(index + 1).padStart(2, "0")}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold tracking-wide text-cyan-700">
                          {control.control_code || "CONTROL"}
                        </span>

                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${priorityClasses(
                            aiScore
                          )}`}
                        >
                          {priorityLabel(aiScore)}
                        </span>
                      </div>

                      <div className="mt-1 truncate text-sm font-semibold text-slate-900">
                        {control.control_title || "Untitled control"}
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        {control.gap_count} gap
                        {control.gap_count === 1 ? "" : "s"} ·{" "}
                        {control.risks?.length || 0} linked risk
                        {(control.risks?.length || 0) === 1
                          ? ""
                          : "s"}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">
                          AI Priority
                        </span>
                        <span className="font-bold text-slate-900">
                          {aiScore.toFixed(1)}
                        </span>
                      </div>

                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-cyan-600"
                          style={{
                            width: `${Math.min(
                              Math.max(aiScore, 0),
                              100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500">
                        Worst Severity
                      </div>

                      <div
                        className={`mt-1 text-sm font-bold ${
                          severityClasses(severity).text
                        }`}
                      >
                        {severity.toFixed(1)}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500">
                        Health
                      </div>

                      <div
                        className={`mt-1 text-sm font-bold ${
                          health >= 80
                            ? "text-emerald-600"
                            : health >= 50
                            ? "text-amber-600"
                            : "text-red-600"
                        }`}
                      >
                        {health}%
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* GAP HIERARCHY */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Gap Resolution Hierarchy
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Control → Risk → Gap → Remediation Task
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <LegendItem label="Critical" className="bg-red-500" />
                <LegendItem label="High" className="bg-orange-500" />
                <LegendItem label="Medium" className="bg-amber-500" />
                <LegendItem label="Low" className="bg-emerald-500" />
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-200">
            {controls.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="text-sm font-semibold text-slate-700">
                  No GAP records
                </div>

                <div className="mt-1 text-xs text-slate-400">
                  No control-level GAP intelligence is currently
                  available for this tenant.
                </div>
              </div>
            ) : (
              controls.map((control) => {
                const aiScore = safeNumber(
                  control.ai_priority_score
                );
                const worst = safeNumber(
                  control.worst_severity
                );
                const health = controlHealthIndex(worst);
                const isOpen =
                  openControl === control.control_id;

                return (
                  <div key={control.control_id}>
                    <button
                      type="button"
                      className="w-full px-6 py-5 text-left transition hover:bg-slate-50"
                      onClick={() =>
                        setOpenControl(
                          isOpen
                            ? null
                            : control.control_id
                        )
                      }
                    >
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_140px_140px_120px_24px] lg:items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold tracking-wide text-cyan-700">
                              {control.control_code || "CONTROL"}
                            </span>

                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${priorityClasses(
                                aiScore
                              )}`}
                            >
                              AI {aiScore.toFixed(1)}
                            </span>
                          </div>

                          <div className="mt-1 truncate text-sm font-semibold text-slate-900">
                            {control.control_title ||
                              "Untitled control"}
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {control.gap_count} gap
                            {control.gap_count === 1
                              ? ""
                              : "s"}{" "}
                            · {control.risks?.length || 0} risk
                            {(control.risks?.length || 0) ===
                            1
                              ? ""
                              : "s"}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            Severity
                          </div>

                          <div
                            className={`mt-1 text-sm font-bold ${
                              severityClasses(worst).text
                            }`}
                          >
                            {worst.toFixed(1)}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            Health
                          </div>

                          <div
                            className={`mt-1 text-sm font-bold ${
                              health >= 80
                                ? "text-emerald-600"
                                : health >= 50
                                ? "text-amber-600"
                                : "text-red-600"
                            }`}
                          >
                            {health}%
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            Priority
                          </div>

                          <div className="mt-1 text-sm font-semibold text-slate-800">
                            {priorityLabel(aiScore)}
                          </div>
                        </div>

                        <div className="text-right text-slate-400">
                          {isOpen ? "−" : "+"}
                        </div>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-4">
                        <div className="space-y-3">
                          {(control.risks || []).map((risk) => {
                            const exposure = safeNumber(
                              risk.exposure_score
                            );
                            const escalation = safeNumber(
                              risk.escalation_probability
                            );
                            const riskWorst = safeNumber(
                              risk.worst_severity
                            );
                            const riskOpen =
                              openRisk === risk.risk_id;

                            return (
                              <div
                                key={risk.risk_id}
                                className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                              >
                                <button
                                  type="button"
                                  className="w-full px-5 py-4 text-left transition hover:bg-slate-50"
                                  onClick={() =>
                                    setOpenRisk(
                                      riskOpen
                                        ? null
                                        : risk.risk_id
                                    )
                                  }
                                >
                                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_130px_130px_24px] lg:items-center">
                                    <div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
                                          Risk #{risk.risk_id}
                                        </span>

                                        {risk.risk_level && (
                                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                                            {formatStatus(
                                              risk.risk_level
                                            )}
                                          </span>
                                        )}
                                      </div>

                                      <div className="mt-1 text-sm font-semibold text-slate-900">
                                        {risk.risk_title ||
                                          "Unnamed Risk"}
                                      </div>

                                      <div className="mt-1 text-xs text-slate-500">
                                        {risk.gap_count} gap
                                        {risk.gap_count === 1
                                          ? ""
                                          : "s"}
                                      </div>
                                    </div>

                                    <div>
                                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                        Exposure
                                      </div>

                                      <div className="mt-1 text-sm font-bold text-slate-900">
                                        {exposure.toFixed(1)}
                                      </div>
                                    </div>

                                    <div>
                                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                        Escalation
                                      </div>

                                      <div className="mt-1 text-sm font-bold text-slate-900">
                                        {(escalation * 100).toFixed(
                                          1
                                        )}
                                        %
                                      </div>
                                    </div>

                                    <div className="text-right text-slate-400">
                                      {riskOpen ? "−" : "+"}
                                    </div>
                                  </div>
                                </button>

                                {riskOpen && (
                                  <div className="border-t border-slate-100 bg-slate-50 p-4">
                                    <div className="space-y-2">
                                      {(risk.gaps || []).map(
                                        (gap) => {
                                          const severity =
                                            safeNumber(
                                              gap.severity_score
                                            );
                                          const severityStyle =
                                            severityClasses(
                                              severity
                                            );

                                          return (
                                            <div
                                              key={gap.gap_id}
                                              className="rounded-xl border border-slate-200 bg-white p-4"
                                            >
                                              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                                <div>
                                                  <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-sm font-semibold text-slate-900">
                                                      Gap #
                                                      {gap.gap_id}
                                                    </span>

                                                    <span
                                                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${severityStyle.bg} ${severityStyle.border} ${severityStyle.text}`}
                                                    >
                                                      {severityLabel(
                                                        severity
                                                      )}
                                                    </span>
                                                  </div>

                                                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                                    <span>
                                                      Severity:{" "}
                                                      <strong
                                                        className={
                                                          severityStyle.text
                                                        }
                                                      >
                                                        {severity.toFixed(
                                                          1
                                                        )}
                                                      </strong>
                                                    </span>

                                                    <span>
                                                      Status:{" "}
                                                      <strong className="text-slate-700">
                                                        {formatStatus(
                                                          gap.status
                                                        )}
                                                      </strong>
                                                    </span>

                                                    {gap.task_status && (
                                                      <span>
                                                        Task:{" "}
                                                        <strong className="text-slate-700">
                                                          {formatStatus(
                                                            gap.task_status
                                                          )}
                                                        </strong>
                                                      </span>
                                                    )}
                                                  </div>
                                                </div>

                                                <div className="flex shrink-0 items-center gap-2">
                                                  {gap.task_id ? (
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        router.push(
                                                          `/company/tasks/${gap.task_id}`
                                                        )
                                                      }
                                                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                                                    >
                                                      View Task #
                                                      {gap.task_id}
                                                    </button>
                                                  ) : (
                                                    <button
                                                      type="button"
                                                      onClick={(
                                                        event
                                                      ) => {
                                                        event.stopPropagation();
                                                        setTaskError(
                                                          ""
                                                        );
                                                        setTaskModalGapId(
                                                          gap.gap_id
                                                        );
                                                      }}
                                                      className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                                                    >
                                                      Create Remediation
                                                    </button>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        }
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* FOOTER NOTE */}
        <section className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <div>
              Gap Intelligence is derived from the current compliance,
              risk and remediation data available to the tenant.
            </div>

            <div className="font-medium text-slate-600">
              {executiveMetrics.totalControls} controls ·{" "}
              {executiveMetrics.totalRisks} risks ·{" "}
              {summary.gaps_total} gaps
            </div>
          </div>
        </section>
      </div>

      {/* REMEDIATION TASK MODAL */}
      {taskModalGapId !== null && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={() => {
            if (!taskSaving) {
              setTaskModalGapId(null);
            }
          }}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-cyan-700">
                    Remediation Management
                  </div>

                  <h2 className="mt-1 text-lg font-semibold text-slate-950">
                    Create Remediation Task
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Create an execution task for Gap #{taskModalGapId}.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={taskSaving}
                  onClick={() => setTaskModalGapId(null)}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="space-y-5 p-6">
              {taskError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {taskError}
                </div>
              )}

              <FormInput
                label="Task Title"
                required
                value={taskTitle}
                onChange={setTaskTitle}
                placeholder="e.g. Remediate privileged access control gap"
              />

              <FormTextarea
                label="Description"
                value={taskDescription}
                onChange={setTaskDescription}
                placeholder="Describe the remediation action, expected result and relevant context."
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormInput
                  label="Owner Role"
                  required
                  value={taskOwner}
                  onChange={setTaskOwner}
                  placeholder="e.g. Information Security Manager"
                />

                <FormInput
                  label="Due Date"
                  required
                  type="date"
                  value={taskDueDate}
                  onChange={setTaskDueDate}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                disabled={taskSaving}
                onClick={() => setTaskModalGapId(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={taskSaving}
                onClick={submitTask}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {taskSaving
                  ? "Creating..."
                  : "Create Remediation Task"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   COMPONENTS
   ============================================================ */

function MetricCard({
  label,
  value,
  caption,
  icon,
  emphasis = "neutral",
}: {
  label: string;
  value: string | number;
  caption: string;
  icon: "gap" | "uncovered" | "partial" | "severity" | "health";
  emphasis?: "neutral" | "danger" | "warning" | "success";
}) {
  const iconMap = {
    gap: "◈",
    uncovered: "!",
    partial: "◐",
    severity: "▲",
    health: "✓",
  };

  const emphasisClasses = {
    neutral: "bg-slate-50 text-slate-600",
    danger: "bg-red-50 text-red-600",
    warning: "bg-amber-50 text-amber-600",
    success: "bg-emerald-50 text-emerald-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {label}
          </div>

          <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            {value}
          </div>
        </div>

        <div
          className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold ${emphasisClasses[emphasis]}`}
        >
          {iconMap[icon]}
        </div>
      </div>

      <div className="mt-3 text-xs text-slate-500">
        {caption}
      </div>
    </div>
  );
}

function ExecutiveSignal({
  label,
  value,
  status,
  danger = false,
}: {
  label: string;
  value: string | number;
  status: string;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-4 last:border-0 last:pb-0">
      <div>
        <div className="text-xs font-semibold text-slate-700">
          {label}
        </div>

        <div
          className={`mt-1 text-xs ${
            danger ? "text-red-600" : "text-slate-400"
          }`}
        >
          {status}
        </div>
      </div>

      <div
        className={`text-2xl font-semibold ${
          danger ? "text-red-600" : "text-slate-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function LegendItem({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-500">
      <span className={`h-2 w-2 rounded-full ${className}`} />
      {label}
    </span>
  );
}

function FormInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {required && (
          <span className="ml-1 text-red-500">*</span>
        )}
      </label>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
      />
    </div>
  );
}

function FormTextarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
      />
    </div>
  );
}
