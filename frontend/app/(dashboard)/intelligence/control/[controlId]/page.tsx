"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { apiFetch } from "@/app/lib/api";

type ControlDetailResponse = {
  control: {
    control_id: number;
    control_code: string | null;
    control_title: string | null;
  };

  health: {
    health_index: number;
    coverage_health: number;
    evidence_quality: number;
    risk_health: number;
    gap_health: number;
    remediation_health: number;
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

  risks: LinkedRisk[];
  gaps: GapItem[];
  tasks: ComplianceTask[];
};

type LinkedRisk = {
  id: number;
  title: string;
  score: number | null;
  likelihood: number | null;
  impact: number | null;
  risk_level: string | null;
  escalation_probability_30d: number | null;
};

type GapItem = {
  id: number;
  risk_id: number | null;
  severity_score: number | null;
  status: string | null;
  created_at: string | null;
};

type ComplianceTask = {
  id: number;
  title: string;
  description: string | null;
  status: string | null;
  owner_role: string | null;
  due_date: string | null;
  created_at: string | null;
};

function healthTone(value: number) {
  if (value >= 80) {
    return {
      text: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      bar: "bg-emerald-500",
    };
  }

  if (value >= 55) {
    return {
      text: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
      bar: "bg-amber-500",
    };
  }

  return {
    text: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    bar: "bg-red-500",
  };
}

function statusMeta(status: string | null) {
  const value = String(status || "").toLowerCase();

  if (
    value === "resolved" ||
    value === "closed" ||
    value === "accepted" ||
    value === "completed"
  ) {
    return {
      icon: CheckCircle2,
      text: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
    };
  }

  if (
    value === "open" ||
    value === "in_progress" ||
    value === "in progress"
  ) {
    return {
      icon: CircleAlert,
      text: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
    };
  }

  return {
    icon: AlertTriangle,
    text: "text-slate-500",
    bg: "bg-slate-50",
    border: "border-slate-200",
  };
}

export default function ControlDetailPage() {
  const params = useParams();
  const router = useRouter();

  const controlId = String(params.controlId || "");

  const [data, setData] = useState<ControlDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await apiFetch(
          `/api/intelligence/control-health/${controlId}`
        );

        const json: ControlDetailResponse = await res.json();

        if (!mounted) return;

        setData(json);
      } catch (err) {
        console.error("Control detail load error:", err);

        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load control detail."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    if (controlId) {
      void load();
    }

    return () => {
      mounted = false;
    };
  }, [controlId]);

  if (loading) {
    return (
      <div className="min-h-full bg-slate-50 p-6 lg:p-8">
        <div className="mx-auto max-w-[1600px] text-sm text-slate-500">
          Loading control detail...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-full bg-slate-50 p-6 lg:p-8">
        <div className="mx-auto max-w-[1600px]">
          <button
            type="button"
            onClick={() =>
              router.push("/intelligence/control/control-health")
            }
            className="mb-5 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Control Health
          </button>

          <div className="rounded-2xl border border-red-200 bg-white p-6">
            <div className="text-lg font-semibold text-slate-900">
              Control detail unavailable
            </div>

            <div className="mt-2 text-sm text-red-600">
              {error || "Control not found."}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const health = data.health;
  const metrics = data.metrics;
  const tone = healthTone(health.health_index);

  return (
    <div className="min-h-full bg-slate-50 p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-6">

        {/* HEADER */}
        <section>
          <button
            type="button"
            onClick={() =>
              router.push("/intelligence/control/control-health")
            }
            className="mb-5 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Control Health
          </button>

          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
            Intelligence / Control Analytics
          </div>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 lg:text-3xl">
            {data.control.control_code || "Control"}
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            {data.control.control_title ||
              "Control Intelligence Detail"}
          </p>
        </section>

        {/* HEALTH */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">

          <MetricCard
            title="Health Index"
            value={health.health_index.toFixed(1)}
            highlight
            tone={tone}
          />

          <MetricCard
            title="Evidence"
            value={metrics.evidence_count}
            description={`${metrics.approved_evidence_count} approved`}
          />

          <MetricCard
            title="Linked Risks"
            value={metrics.risk_count}
            description={`Worst ${metrics.worst_risk_score.toFixed(1)}`}
          />

          <MetricCard
            title="Open Gaps"
            value={metrics.gap_count}
            description={`Worst ${metrics.worst_gap_severity.toFixed(1)}`}
          />

          <MetricCard
            title="Open Tasks"
            value={metrics.open_task_count}
            description="Remediation workload"
          />

        </section>

        {/* HEALTH COMPONENTS */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 lg:p-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Health Components
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Component scores used by the Control Health engine.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">

            <HealthComponent
              label="Coverage"
              value={health.coverage_health}
            />

            <HealthComponent
              label="Evidence Quality"
              value={health.evidence_quality}
            />

            <HealthComponent
              label="Risk Health"
              value={health.risk_health}
            />

            <HealthComponent
              label="Gap Health"
              value={health.gap_health}
            />

            <HealthComponent
              label="Remediation"
              value={health.remediation_health}
            />

          </div>
        </section>

        {/* LINKED RISKS */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

          <div className="border-b border-slate-200 p-5">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-500" />

              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Linked Risks
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Risks directly linked to this control.
                </p>
              </div>
            </div>
          </div>

          {data.risks.length === 0 ? (
            <EmptyState message="No risks are linked to this control." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">

                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <Th>Risk</Th>
                    <Th>Score</Th>
                    <Th>Likelihood</Th>
                    <Th>Impact</Th>
                    <Th>Level</Th>
                    <Th>Escalation</Th>
                  </tr>
                </thead>

                <tbody>
                  {data.risks.map((risk) => (
                    <tr
                      key={risk.id}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <Td>
                        <div className="font-medium text-slate-900">
                          {risk.title}
                        </div>
                      </Td>

                      <Td>
                        <ScoreBadge value={risk.score} />
                      </Td>

                      <Td>{risk.likelihood ?? "—"}</Td>

                      <Td>{risk.impact ?? "—"}</Td>

                      <Td>
                        {risk.risk_level || "—"}
                      </Td>

                      <Td>
                        {risk.escalation_probability_30d != null
                          ? `${risk.escalation_probability_30d.toFixed(1)}%`
                          : "—"}
                      </Td>
                    </tr>
                  ))}
                </tbody>

              </table>
            </div>
          )}
        </section>

        {/* GAPS */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

          <div className="border-b border-slate-200 p-5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />

              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Control Gaps
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Gaps associated with this control.
                </p>
              </div>
            </div>
          </div>

          {data.gaps.length === 0 ? (
            <EmptyState message="No gaps are recorded for this control." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">

                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <Th>ID</Th>
                    <Th>Severity</Th>
                    <Th>Status</Th>
                    <Th>Created</Th>
                  </tr>
                </thead>

                <tbody>
                  {data.gaps.map((gap) => {
                    const meta = statusMeta(gap.status);
                    const StatusIcon = meta.icon;

                    return (
                      <tr
                        key={gap.id}
                        className="border-b border-slate-100 hover:bg-slate-50"
                      >
                        <Td>#{gap.id}</Td>

                        <Td>
                          <ScoreBadge value={gap.severity_score} />
                        </Td>

                        <Td>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${meta.bg} ${meta.border} ${meta.text}`}
                          >
                            <StatusIcon className="h-3.5 w-3.5" />
                            {gap.status || "Unknown"}
                          </span>
                        </Td>

                        <Td>
                          {gap.created_at
                            ? new Date(gap.created_at).toLocaleDateString()
                            : "—"}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>

              </table>
            </div>
          )}
        </section>

        {/* TASKS */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

          <div className="border-b border-slate-200 p-5">
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-cyan-600" />

              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Remediation Tasks
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Tasks associated with this control.
                </p>
              </div>
            </div>
          </div>

          {data.tasks.length === 0 ? (
            <EmptyState message="No remediation tasks are linked to this control." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">

                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <Th>Task</Th>
                    <Th>Status</Th>
                    <Th>Owner</Th>
                    <Th>Due Date</Th>
                  </tr>
                </thead>

                <tbody>
                  {data.tasks.map((task) => {
                    const meta = statusMeta(task.status);
                    const StatusIcon = meta.icon;

                    return (
                      <tr
                        key={task.id}
                        className="border-b border-slate-100 hover:bg-slate-50"
                      >
                        <Td>
                          <div className="font-medium text-slate-900">
                            {task.title}
                          </div>

                          {task.description && (
                            <div className="mt-1 max-w-[600px] truncate text-xs text-slate-500">
                              {task.description}
                            </div>
                          )}
                        </Td>

                        <Td>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${meta.bg} ${meta.border} ${meta.text}`}
                          >
                            <StatusIcon className="h-3.5 w-3.5" />
                            {task.status || "Unknown"}
                          </span>
                        </Td>

                        <Td>{task.owner_role || "—"}</Td>

                        <Td>
                          {task.due_date
                            ? new Date(task.due_date).toLocaleDateString()
                            : "—"}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>

              </table>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  description,
  highlight = false,
  tone,
}: {
  title: string;
  value: string | number;
  description?: string;
  highlight?: boolean;
  tone?: ReturnType<typeof healthTone>;
}) {
  return (
    <div
      className={`rounded-2xl border bg-white p-5 ${
        highlight && tone
          ? `${tone.border} ${tone.bg}`
          : "border-slate-200"
      }`}
    >
      <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
        {title}
      </div>

      <div
        className={`mt-2 text-2xl font-semibold ${
          highlight && tone ? tone.text : "text-slate-900"
        }`}
      >
        {value}
      </div>

      {description && (
        <div className="mt-1 text-xs text-slate-500">
          {description}
        </div>
      )}
    </div>
  );
}

function HealthComponent({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  const tone = value == null ? { text: "text-slate-400", bar: "bg-slate-300" } : healthTone(value);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600">
          {label}
        </span>

        <span className={`text-sm font-semibold ${tone.text}`}>
          {value == null ? "N/A" : value.toFixed(1)}
        </span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full ${tone.bar}`}
          style={{
            width: `${Math.min(100, Math.max(0, value))}%`,
          }}
        />
      </div>
    </div>
  );
}

function ScoreBadge({
  value,
}: {
  value: number | null;
}) {
  if (value == null) {
    return <span className="text-slate-400">—</span>;
  }

  let classes =
    "bg-emerald-50 text-emerald-700 border-emerald-200";

  if (value >= 70) {
    classes = "bg-red-50 text-red-700 border-red-200";
  } else if (value >= 40) {
    classes = "bg-amber-50 text-amber-700 border-amber-200";
  }

  return (
    <span
      className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-semibold ${classes}`}
    >
      {value == null ? "N/A" : value.toFixed(1)}
    </span>
  );
}

function Th({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </th>
  );
}

function Td({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <td className="px-5 py-4 text-slate-700">
      {children}
    </td>
  );
}

function EmptyState({
  message,
}: {
  message: string;
}) {
  return (
    <div className="p-8 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

