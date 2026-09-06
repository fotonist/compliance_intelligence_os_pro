 "use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileWarning,
  ListChecks,
  RefreshCw,
  ShieldAlert,
  Target,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";

type AuditPlan = {
  id?: number;
  reference?: string | null;
  name?: string | null;
  title?: string | null;
  audit_type?: string | null;
  type?: string | null;
  process_id?: number | null;
  process_name?: string | null;
  lead_auditor_id?: number | null;
  lead_auditor?: string | null;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
  standard_version_id?: number | null;
  created_at?: string | null;
};

type ExecutionRecord = {
  id?: number;
  audit_plan_id?: number | null;
  control_id?: number | null;
  process_id?: number | null;
  status?: string | null;
  result?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  conclusion?: string | null;
};

type Finding = {
  id?: number;
  audit_plan_id?: number | null;
  execution_id?: number | null;
  control_id?: number | null;
  title?: string | null;
  description?: string | null;
  severity?: string | null;
  status?: string | null;
  owner?: string | null;
  due_date?: string | null;
  created_at?: string | null;
  manager_review_status?: string | null;
  implementation_status?: string | null;
  verification_status?: string | null;
};

type AuditLog = {
  id?: number;
  action?: string | null;
  event?: string | null;
  entity_type?: string | null;
  entity_id?: number | null;
  message?: string | null;
  description?: string | null;
  created_at?: string | null;
  performed_at?: string | null;
  user_name?: string | null;
  actor?: string | null;
};

function normalizeArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];

  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { items?: unknown }).items)
  ) {
    return (data as { items: T[] }).items;
  }

  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { data?: unknown }).data)
  ) {
    return (data as { data: T[] }).data;
  }

  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { results?: unknown }).results)
  ) {
    return (data as { results: T[] }).results;
  }

  return [];
}

function upper(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

function formatDate(value: unknown): string {
  if (!value) return "-";

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function relativeTime(value: unknown): string {
  if (!value) return "-";

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  return formatDate(value);
}

function statusLabel(value: unknown): string {
  const normalized = upper(value);

  if (!normalized) return "Unknown";

  return normalized
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusClass(value: unknown): string {
  const normalized = upper(value);

  if (["COMPLETED", "CLOSED", "PLAN_APPROVED"].includes(normalized)) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (
    [
      "IN_PROGRESS",
      "OWNER_RESPONSE",
      "SUBMITTED_FOR_REVIEW",
      "READY_FOR_VERIFICATION",
      "ASSIGNED",
    ].includes(normalized)
  ) {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }

  if (
    [
      "EXCEPTION",
      "REVISION_REQUIRED",
      "VERIFICATION_FAILED",
      "OVERDUE",
    ].includes(normalized)
  ) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  if (["OPEN", "CRITICAL", "HIGH"].includes(normalized)) {
    return "bg-red-50 text-red-700 border-red-200";
  }

  return "bg-slate-50 text-slate-600 border-slate-200";
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "slate",
  onClick,
}: {
  label: string;
  value: number;
  detail: string;
  icon: typeof Activity;
  tone?: "slate" | "blue" | "red" | "amber" | "green";
  onClick?: () => void;
}) {
  const toneMap = {
    slate: "bg-slate-50 text-slate-600",
    blue: "bg-blue-50 text-blue-600",
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-600",
    green: "bg-emerald-50 text-emerald-600",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="group min-w-0 rounded-xl border border-slate-200 bg-white p-5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:border-slate-300 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneMap[tone]}`}>
          <Icon size={18} strokeWidth={1.8} />
        </div>

        <ArrowRight
          size={16}
          className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500"
        />
      </div>

      <div className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </div>

      <div className="mt-1 text-sm font-semibold text-slate-800">{label}</div>

      <div className="mt-1 text-xs text-slate-500">{detail}</div>
    </button>
  );
}

function Section({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-start justify-between gap-5 border-b border-slate-100 px-6 py-5">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            {eyebrow}
          </div>
          <h2 className="mt-1 text-base font-semibold text-slate-950">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          ) : null}
        </div>

        {action}
      </div>

      {children}
    </section>
  );
}

export default function AuditDashboardPage() {
  const router = useRouter();

  const [plans, setPlans] = useState<AuditPlan[]>([]);
  const [execution, setExecution] = useState<ExecutionRecord[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadDashboard(showRefresh = false) {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const [plansResponse, findingsResponse, logsResponse] =
        await Promise.all([
          apiFetch("/audit/plans", { method: "GET" }),
          apiFetch("/audit/findings", { method: "GET" }),
          apiFetch("/audit/logs", { method: "GET" }),
        ]);

      if (!plansResponse.ok) {
        throw new Error(`Unable to load audit plans (${plansResponse.status}).`);
      }

      if (!findingsResponse.ok) {
        throw new Error(
          `Unable to load audit findings (${findingsResponse.status}).`
        );
      }

      if (!logsResponse.ok) {
        throw new Error(`Unable to load audit activity (${logsResponse.status}).`);
      }

      const plansData = await plansResponse.json();
      const findingsData = await findingsResponse.json();
      const logsData = await logsResponse.json();

      const resolvedPlans = normalizeArray<AuditPlan>(plansData);
      const resolvedFindings = normalizeArray<Finding>(findingsData);
      const resolvedLogs = normalizeArray<AuditLog>(logsData);

      setPlans(resolvedPlans);
      setFindings(resolvedFindings);
      setLogs(resolvedLogs);

      const executionResults = await Promise.all(
        resolvedPlans
          .filter((plan) => Number.isFinite(Number(plan.id)))
          .map(async (plan) => {
            try {
              const response = await apiFetch(
                `/audit/execution?plan_id=${plan.id}`,
                { method: "GET" }
              );

              if (!response.ok) return [];

              const data = await response.json();
              return normalizeArray<ExecutionRecord>(data);
            } catch {
              return [];
            }
          })
      );

      setExecution(executionResults.flat());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load audit dashboard."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const metrics = useMemo(() => {
    const planStatus = plans.map((item) => upper(item.status));
    const executionStatus = execution.map((item) => upper(item.status));
    const findingStatus = findings.map((item) => upper(item.status));

    const activePlans = planStatus.filter(
      (status) => status === "IN_PROGRESS"
    ).length;

    const completedPlans = planStatus.filter(
      (status) => status === "COMPLETED"
    ).length;

    const openFindings = findingStatus.filter(
      (status) => status !== "CLOSED"
    ).length;

    const criticalFindings = findings.filter((item) =>
      ["CRITICAL", "HIGH"].includes(upper(item.severity))
    ).filter((item) => upper(item.status) !== "CLOSED").length;

    const verificationPending = findingStatus.filter(
      (status) => status === "READY_FOR_VERIFICATION"
    ).length;

    const exceptions = executionStatus.filter(
      (status) => status === "EXCEPTION"
    ).length;

    const inProgressExecution = executionStatus.filter(
      (status) => status === "IN_PROGRESS"
    ).length;

    const completedExecution = executionStatus.filter(
      (status) => status === "COMPLETED"
    ).length;

    const overdueFindings = findings.filter((finding) => {
      if (!finding.due_date) return false;
      if (upper(finding.status) === "CLOSED") return false;

      const due = new Date(String(finding.due_date));

      return !Number.isNaN(due.getTime()) && due.getTime() < Date.now();
    }).length;

    return {
      totalPlans: plans.length,
      activePlans,
      completedPlans,
      openFindings,
      criticalFindings,
      verificationPending,
      exceptions,
      inProgressExecution,
      completedExecution,
      overdueFindings,
    };
  }, [plans, execution, findings]);

  const planStatusRows = useMemo(() => {
    const statuses = [
      "DRAFT",
      "IN_PROGRESS",
      "COMPLETED",
    ];

    return statuses.map((status) => ({
      status,
      count: plans.filter((item) => upper(item.status) === status).length,
    }));
  }, [plans]);

  const executionStatusRows = useMemo(() => {
    const statuses = [
      "READY",
      "IN_PROGRESS",
      "COMPLETED",
      "EXCEPTION",
    ];

    return statuses.map((status) => ({
      status,
      count: execution.filter((item) => upper(item.status) === status).length,
    }));
  }, [execution]);

  const findingStatusRows = useMemo(() => {
    const statuses = [
      "OPEN",
      "ASSIGNED",
      "OWNER_RESPONSE",
      "SUBMITTED_FOR_REVIEW",
      "PLAN_APPROVED",
      "READY_FOR_VERIFICATION",
      "REVISION_REQUIRED",
      "VERIFICATION_FAILED",
      "CLOSED",
    ];

    return statuses
      .map((status) => ({
        status,
        count: findings.filter((item) => upper(item.status) === status).length,
      }))
      .filter((item) => item.count > 0);
  }, [findings]);

  const attentionItems = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      detail: string;
      tone: "red" | "amber" | "blue";
      action: () => void;
    }> = [];

    findings
      .filter((item) => upper(item.status) !== "CLOSED")
      .filter((item) =>
        ["CRITICAL", "HIGH"].includes(upper(item.severity))
      )
      .slice(0, 3)
      .forEach((finding) => {
        items.push({
          id: `finding-${finding.id}`,
          title: finding.title || `Finding #${finding.id ?? "-"}`,
          detail: `${statusLabel(finding.status)} ? ${statusLabel(
            finding.severity
          )}`,
          tone: "red",
          action: () => router.push("/audit/findings"),
        });
      });

    findings
      .filter(
        (item) => upper(item.status) === "READY_FOR_VERIFICATION"
      )
      .slice(0, 2)
      .forEach((finding) => {
        items.push({
          id: `verification-${finding.id}`,
          title: finding.title || `Finding #${finding.id ?? "-"}`,
          detail: "Verification required",
          tone: "amber",
          action: () => router.push("/audit/findings"),
        });
      });

    findings
      .filter((finding) => {
        if (!finding.due_date) return false;
        if (upper(finding.status) === "CLOSED") return false;

        const due = new Date(String(finding.due_date));

        return !Number.isNaN(due.getTime()) && due.getTime() < Date.now();
      })
      .slice(0, 2)
      .forEach((finding) => {
        items.push({
          id: `overdue-${finding.id}`,
          title: finding.title || `Finding #${finding.id ?? "-"}`,
          detail: `Due ${formatDate(finding.due_date)}`,
          tone: "amber",
          action: () => router.push("/audit/findings"),
        });
      });

    if (metrics.exceptions > 0) {
      items.push({
        id: "execution-exceptions",
        title: "Execution exceptions require review",
        detail: `${metrics.exceptions} exception record${
          metrics.exceptions === 1 ? "" : "s"
        }`,
        tone: "amber",
        action: () => router.push("/audit/execution"),
      });
    }

    return items.slice(0, 6);
  }, [findings, metrics.exceptions, router]);

  const recentPlans = useMemo(() => {
    return [...plans]
      .sort((a, b) => {
        const ad = new Date(String(a.created_at || "")).getTime();
        const bd = new Date(String(b.created_at || "")).getTime();

        return bd - ad;
      })
      .slice(0, 6);
  }, [plans]);

  const maxPlanCount = Math.max(
    1,
    ...planStatusRows.map((item) => item.count)
  );

  const maxExecutionCount = Math.max(
    1,
    ...executionStatusRows.map((item) => item.count)
  );

  const maxFindingCount = Math.max(
    1,
    ...findingStatusRows.map((item) => item.count)
  );

  if (loading) {
    return (
      <main className="min-h-full bg-slate-50">
        <div className="mx-auto max-w-[1600px] px-6 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-64 rounded bg-slate-200" />
            <div className="h-4 w-96 rounded bg-slate-200" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-40 rounded-xl bg-white border border-slate-200" />
              ))}
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-[1600px] px-6 py-7">
        <header className="mb-7 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              <ClipboardCheck size={14} />
              Internal Audit
            </div>

            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Audit Dashboard
            </h1>

            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Audit posture, execution health and finding remediation across
              the current tenant.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadDashboard(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={15}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => router.push("/audit/planning")}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <CalendarDays size={15} />
              Audit Planning
            </button>
          </div>
        </header>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
            <div className="flex items-start gap-3">
              <XCircle size={18} className="mt-0.5 text-red-600" />
              <div>
                <div className="text-sm font-semibold text-red-800">
                  Audit dashboard could not load
                </div>
                <div className="mt-1 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Audit Plans"
            value={metrics.totalPlans}
            detail={`${metrics.completedPlans} completed`}
            icon={ClipboardCheck}
            tone="slate"
            onClick={() => router.push("/audit/planning")}
          />

          <MetricCard
            label="Active Audits"
            value={metrics.activePlans}
            detail={`${metrics.inProgressExecution} execution records in progress`}
            icon={Activity}
            tone="blue"
            onClick={() => router.push("/audit/execution")}
          />

          <MetricCard
            label="Open Findings"
            value={metrics.openFindings}
            detail={`${metrics.criticalFindings} critical or high`}
            icon={ShieldAlert}
            tone={metrics.criticalFindings > 0 ? "red" : "slate"}
            onClick={() => router.push("/audit/findings")}
          />

          <MetricCard
            label="Attention Required"
            value={metrics.overdueFindings + metrics.verificationPending + metrics.exceptions}
            detail={`${metrics.overdueFindings} overdue ? ${metrics.verificationPending} verification`}
            icon={FileWarning}
            tone={
              metrics.overdueFindings +
                metrics.verificationPending +
                metrics.exceptions >
              0
                ? "amber"
                : "green"
            }
            onClick={() => router.push("/audit/findings")}
          />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(360px,0.85fr)]">
          <Section
            eyebrow="Audit Portfolio"
            title="Plan posture"
            description="Current audit plans grouped by their operational status."
            action={
              <button
                type="button"
                onClick={() => router.push("/audit/planning")}
                className="text-xs font-semibold text-slate-600 hover:text-slate-950"
              >
                View planning
              </button>
            }
          >
            <div className="space-y-5 px-6 py-6">
              {planStatusRows.map((item) => (
                <div key={item.status}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">
                      {statusLabel(item.status)}
                    </span>
                    <span className="font-semibold text-slate-950">
                      {item.count}
                    </span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-slate-800 transition-all"
                      style={{
                        width: `${(item.count / maxPlanCount) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}

              {plans.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
                  <div className="text-sm font-medium text-slate-700">
                    No audit plans available
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Create an audit plan to begin the audit lifecycle.
                  </div>
                </div>
              ) : null}
            </div>
          </Section>

          <Section
            eyebrow="Attention Required"
            title="Items requiring action"
            description="Open audit conditions that currently need attention."
          >
            <div className="divide-y divide-slate-100">
              {attentionItems.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={item.action}
                  className="flex w-full items-start gap-3 px-6 py-4 text-left transition hover:bg-slate-50"
                >
                  <span
                    className={[
                      "mt-1 h-2 w-2 shrink-0 rounded-full",
                      item.tone === "red"
                        ? "bg-red-500"
                        : item.tone === "amber"
                          ? "bg-amber-500"
                          : "bg-blue-500",
                    ].join(" ")}
                  />

                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-800">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {item.detail}
                    </span>
                  </span>

                  <ArrowRight
                    size={15}
                    className="ml-auto mt-0.5 shrink-0 text-slate-300"
                  />
                </button>
              ))}

              {attentionItems.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <CheckCircle2
                    size={24}
                    className="mx-auto text-emerald-500"
                  />
                  <div className="mt-3 text-sm font-semibold text-slate-800">
                    No immediate attention items
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    The current audit posture has no surfaced exceptions.
                  </div>
                </div>
              ) : null}
            </div>
          </Section>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Section
            eyebrow="Execution Health"
            title="Audit execution"
            description="Execution records reported by the existing audit execution API."
            action={
              <button
                type="button"
                onClick={() => router.push("/audit/execution")}
                className="text-xs font-semibold text-slate-600 hover:text-slate-950"
              >
                Open execution
              </button>
            }
          >
            <div className="space-y-4 px-6 py-6">
              {executionStatusRows.map((item) => (
                <div key={item.status} className="flex items-center gap-4">
                  <div className="w-28 shrink-0 text-xs font-medium text-slate-600">
                    {statusLabel(item.status)}
                  </div>

                  <div className="h-7 flex-1 overflow-hidden rounded-md bg-slate-50">
                    <div
                      className="flex h-full items-center rounded-md bg-slate-700 px-2 text-[11px] font-semibold text-white transition-all"
                      style={{
                        width: `${Math.max(
                          item.count > 0 ? 8 : 0,
                          (item.count / maxExecutionCount) * 100
                        )}%`,
                      }}
                    >
                      {item.count > 0 ? item.count : ""}
                    </div>
                  </div>
                </div>
              ))}

              {execution.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
                  No execution records are currently available.
                </div>
              ) : null}
            </div>
          </Section>

          <Section
            eyebrow="Finding Intelligence"
            title="Finding lifecycle"
            description="Open and closed findings by their controlled workflow status."
            action={
              <button
                type="button"
                onClick={() => router.push("/audit/findings")}
                className="text-xs font-semibold text-slate-600 hover:text-slate-950"
              >
                Open findings
              </button>
            }
          >
            <div className="space-y-3 px-6 py-6">
              {findingStatusRows.map((item) => (
                <div key={item.status} className="flex items-center gap-3">
                  <div className="w-40 shrink-0 truncate text-xs font-medium text-slate-600">
                    {statusLabel(item.status)}
                  </div>

                  <div className="h-6 flex-1 overflow-hidden rounded bg-slate-50">
                    <div
                      className="h-full rounded bg-slate-400 transition-all"
                      style={{
                        width: `${Math.max(
                          item.count > 0 ? 8 : 0,
                          (item.count / maxFindingCount) * 100
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="w-8 text-right text-xs font-semibold text-slate-800">
                    {item.count}
                  </div>
                </div>
              ))}

              {findingStatusRows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
                  No audit findings are currently available.
                </div>
              ) : null}
            </div>
          </Section>
        </div>

        <div className="mt-6">
          <Section
            eyebrow="Audit Portfolio"
            title="Current audit plans"
            description="Live plan records from the tenant-scoped Audit Planning module."
            action={
              <button
                type="button"
                onClick={() => router.push("/audit/planning")}
                className="text-xs font-semibold text-slate-600 hover:text-slate-950"
              >
                Manage plans
              </button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    <th className="px-6 py-3">Reference</th>
                    <th className="px-4 py-3">Audit</th>
                    <th className="px-4 py-3">Process</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Planned End</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {recentPlans.map((plan) => (
                    <tr
                      key={plan.id}
                      className="group transition hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-slate-800">
                          {plan.reference || `AUD-${plan.id ?? "-"}`}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="max-w-[220px] truncate text-sm text-slate-700">
                          {plan.name || plan.title || "Internal Audit"}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="text-sm text-slate-600">
                          {plan.process_name ||
                            (plan.process_id
                              ? `Process #${plan.process_id}`
                              : "-")}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="text-xs font-medium text-slate-500">
                          {plan.audit_type || plan.type || "Internal"}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-semibold ${statusClass(
                            plan.status
                          )}`}
                        >
                          {statusLabel(plan.status)}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-500">
                        {formatDate(
                          plan.planned_end_date || plan.end_date
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            plan.id &&
                            router.push(`/audit/execution?plan_id=${plan.id}`)
                          }
                          className="text-xs font-semibold text-slate-500 opacity-0 transition hover:text-slate-950 group-hover:opacity-100"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}

                  {recentPlans.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-12 text-center text-sm text-slate-500"
                      >
                        No audit plans are available for the current tenant.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <Section
            eyebrow="Activity"
            title="Recent audit activity"
            description="Events returned by the existing audit log endpoint."
            action={
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Clock3 size={13} />
                Live
              </div>
            }
          >
            <div className="divide-y divide-slate-100">
              {logs.slice(0, 7).map((log, index) => (
                <div
                  key={log.id ?? `${log.created_at}-${index}`}
                  className="flex items-start gap-4 px-6 py-4"
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
                    <Activity size={15} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-800">
                      {log.message ||
                        log.description ||
                        log.action ||
                        log.event ||
                        "Audit activity"}
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      {log.user_name ||
                        log.actor ||
                        log.entity_type ||
                        "System activity"}
                      {log.entity_id ? ` ? #${log.entity_id}` : ""}
                    </div>
                  </div>

                  <div className="shrink-0 text-xs text-slate-400">
                    {relativeTime(log.created_at || log.performed_at)}
                  </div>
                </div>
              ))}

              {logs.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-slate-500">
                  No audit activity is currently available.
                </div>
              ) : null}
            </div>
          </Section>

          <Section
            eyebrow="Remediation"
            title="Finding pressure"
            description="Current remediation signals derived from live findings."
          >
            <div className="grid grid-cols-2 gap-px overflow-hidden bg-slate-100">
              <button
                type="button"
                onClick={() => router.push("/audit/findings")}
                className="bg-white p-5 text-left transition hover:bg-slate-50"
              >
                <Target size={17} className="text-red-500" />
                <div className="mt-4 text-2xl font-semibold text-slate-950">
                  {metrics.criticalFindings}
                </div>
                <div className="mt-1 text-xs font-medium text-slate-500">
                  Critical / High
                </div>
              </button>

              <button
                type="button"
                onClick={() => router.push("/audit/findings")}
                className="bg-white p-5 text-left transition hover:bg-slate-50"
              >
                <ListChecks size={17} className="text-blue-500" />
                <div className="mt-4 text-2xl font-semibold text-slate-950">
                  {metrics.verificationPending}
                </div>
                <div className="mt-1 text-xs font-medium text-slate-500">
                  Verification
                </div>
              </button>

              <button
                type="button"
                onClick={() => router.push("/audit/findings")}
                className="bg-white p-5 text-left transition hover:bg-slate-50"
              >
                <Clock3 size={17} className="text-amber-500" />
                <div className="mt-4 text-2xl font-semibold text-slate-950">
                  {metrics.overdueFindings}
                </div>
                <div className="mt-1 text-xs font-medium text-slate-500">
                  Overdue
                </div>
              </button>

              <button
                type="button"
                onClick={() => router.push("/audit/execution")}
                className="bg-white p-5 text-left transition hover:bg-slate-50"
              >
                <XCircle size={17} className="text-amber-500" />
                <div className="mt-4 text-2xl font-semibold text-slate-950">
                  {metrics.exceptions}
                </div>
                <div className="mt-1 text-xs font-medium text-slate-500">
                  Exceptions
                </div>
              </button>
            </div>

            <div className="border-t border-slate-100 px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-800">
                    Audit assurance posture
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Based on current plan, execution and finding records.
                  </div>
                </div>

                <div
                  className={[
                    "rounded-md border px-2.5 py-1 text-xs font-semibold",
                    metrics.criticalFindings === 0 &&
                    metrics.exceptions === 0 &&
                    metrics.verificationPending === 0
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700",
                  ].join(" ")}
                >
                  {metrics.criticalFindings === 0 &&
                  metrics.exceptions === 0 &&
                  metrics.verificationPending === 0
                    ? "Stable"
                    : "Requires Attention"}
                </div>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </main>
  );
}
