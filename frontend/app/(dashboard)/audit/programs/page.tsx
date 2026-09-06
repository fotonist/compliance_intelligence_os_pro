"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileSearch,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  Users,
  XCircle,
} from "lucide-react";
import { apiFetch } from "@/app/lib/api";

type ProcessRow = {
  id: number;
  code?: string | null;
  name?: string | null;
};

type AuditPlan = {
  id: number;
  reference: string;
  name: string;
  audit_type: string;
  status: string;
  process_id?: number | null;
  standard_id?: number | null;
  standard_version_id?: number | null;
  lead_auditor_id?: number | null;
  planned_start?: string | null;
  planned_end?: string | null;
  objective?: string | null;
  scope?: string | null;
};

type ExecutionRecord = {
  id: number;
  audit_plan_id: number;
  process_id?: number | null;
  control_id: number;
  status?: string | null;
  result?: string | null;
};

type Finding = {
  id: number;
  audit_plan_id?: number | null;
  control_id?: number | null;
  status?: string | null;
  severity?: string | null;
};

type ProgramHealth = {
  plan: AuditPlan;
  executions: ExecutionRecord[];
  findings: Finding[];
};

function normalizeArray<T>(value: any): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.results)) return value.results;
  return [];
}

function safeText(value: any): string {
  if (typeof value === "string") return value;
  return "Request failed";
}

function statusLabel(value?: string | null): string {
  const normalized = String(value || "UNKNOWN").replace(/_/g, " ");
  return normalized
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(value?: string | null): string {
  const normalized = String(value || "").toUpperCase();

  if (normalized === "COMPLETED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (normalized === "IN_PROGRESS") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (normalized === "DRAFT") {
    return "border-slate-200 bg-slate-100 text-slate-600";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function auditTypeLabel(value?: string | null): string {
  return String(value || "internal")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateLabel(value?: string | null): string {
  if (!value) return "Not scheduled";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isOverdue(plan: AuditPlan): boolean {
  if (!plan.planned_end) return false;
  if (String(plan.status).toUpperCase() === "COMPLETED") return false;

  const end = new Date(plan.planned_end);
  if (Number.isNaN(end.getTime())) return false;

  return end.getTime() < Date.now();
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: React.ReactNode;
  tone?: "slate" | "blue" | "amber" | "emerald" | "rose";
}) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-700",
    blue: "border-blue-200 bg-blue-50/40 text-blue-700",
    amber: "border-amber-200 bg-amber-50/40 text-amber-700",
    emerald: "border-emerald-200 bg-emerald-50/40 text-emerald-700",
    rose: "border-rose-200 bg-rose-50/40 text-rose-700",
  };

  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {label}
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {value}
          </div>
          <div className="mt-1 text-xs text-slate-500">{detail}</div>
        </div>
        <div className="rounded-lg border border-white/80 bg-white p-2 shadow-sm">
          {icon}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

export default function AuditProgramsPage() {
  const router = useRouter();

  const [plans, setPlans] = useState<AuditPlan[]>([]);
  const [processes, setProcesses] = useState<ProcessRow[]>([]);
  const [health, setHealth] = useState<ProgramHealth[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const selectedPlan = useMemo(
    () => plans.find((item) => item.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  const selectedHealth = useMemo(
    () => health.find((item) => item.plan.id === selectedPlanId) ?? null,
    [health, selectedPlanId],
  );

  const processMap = useMemo(
    () =>
      new Map(
        processes.map((process) => [
          process.id,
          process,
        ]),
      ),
    [processes],
  );

  const filteredPlans = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return plans.filter((plan) => {
      const matchesStatus =
        statusFilter === "ALL" ||
        String(plan.status || "").toUpperCase() === statusFilter;

      const process = plan.process_id
        ? processMap.get(plan.process_id)
        : null;

      const haystack = [
        plan.reference,
        plan.name,
        plan.audit_type,
        plan.objective,
        plan.scope,
        process?.code,
        process?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [plans, query, statusFilter, processMap]);

  const metrics = useMemo(() => {
    const active = plans.filter(
      (plan) => String(plan.status).toUpperCase() === "IN_PROGRESS",
    ).length;

    const completed = plans.filter(
      (plan) => String(plan.status).toUpperCase() === "COMPLETED",
    ).length;

    const draft = plans.filter(
      (plan) => String(plan.status).toUpperCase() === "DRAFT",
    ).length;

    const overdue = plans.filter(isOverdue).length;

    const openFindings = health.reduce(
      (sum, item) =>
        sum +
        item.findings.filter(
          (finding) =>
            String(finding.status || "").toUpperCase() !== "CLOSED",
        ).length,
      0,
    );

    const criticalFindings = health.reduce(
      (sum, item) =>
        sum +
        item.findings.filter((finding) => {
          const severity = String(finding.severity || "").toUpperCase();
          return severity === "CRITICAL";
        }).length,
      0,
    );

    const executionExceptions = health.reduce(
      (sum, item) =>
        sum +
        item.executions.filter(
          (record) =>
            String(record.status || "").toUpperCase() === "EXCEPTION",
        ).length,
      0,
    );

    return {
      total: plans.length,
      active,
      completed,
      draft,
      overdue,
      openFindings,
      criticalFindings,
      executionExceptions,
    };
  }, [plans, health]);

  useEffect(() => {
    loadWorkspace();
  }, []);

  async function loadWorkspace() {
    setLoading(true);
    setError(null);

    try {
      const [plansRes, processesRes] = await Promise.all([
        apiFetch("/audit/plans", { method: "GET" }),
        apiFetch("/company/processes", { method: "GET" }),
      ]);

      if (!plansRes.ok) {
        throw new Error(await safeText(plansRes));
      }

      if (!processesRes.ok) {
        throw new Error(await safeText(processesRes));
      }

      const planRows = normalizeArray<AuditPlan>(await plansRes.json());
      const processRows = normalizeArray<ProcessRow>(
        await processesRes.json(),
      );

      setPlans(planRows);
      setProcesses(processRows);

      setSelectedPlanId((current) => {
        if (current && planRows.some((plan) => plan.id === current)) {
          return current;
        }

        return planRows[0]?.id ?? null;
      });

      await loadHealth(planRows);
    } catch (e: any) {
      setPlans([]);
      setProcesses([]);
      setHealth([]);
      setSelectedPlanId(null);
      setError(e?.message || "Failed to load audit programs.");
    } finally {
      setLoading(false);
    }
  }

  async function loadHealth(planRows: AuditPlan[]) {
    setLoadingHealth(true);

    try {
      const rows = await Promise.all(
        planRows.map(async (plan) => {
          const [executionRes, findingsRes] = await Promise.allSettled([
            apiFetch(`/audit/execution?plan_id=${plan.id}`, {
              method: "GET",
            }),
            apiFetch(`/audit/findings?plan_id=${plan.id}`, {
              method: "GET",
            }),
          ]);

          let executions: ExecutionRecord[] = [];
          let findings: Finding[] = [];

          if (
            executionRes.status === "fulfilled" &&
            executionRes.value.ok
          ) {
            executions = normalizeArray<ExecutionRecord>(
              await executionRes.value.json(),
            );
          }

          if (
            findingsRes.status === "fulfilled" &&
            findingsRes.value.ok
          ) {
            findings = normalizeArray<Finding>(
              await findingsRes.value.json(),
            );
          }

          return {
            plan,
            executions,
            findings,
          };
        }),
      );

      setHealth(rows);
    } finally {
      setLoadingHealth(false);
    }
  }

  function selectPlan(planId: number) {
    setSelectedPlanId(planId);
  }

  function openPlanning() {
    if (!selectedPlan) {
      router.push("/audit/planning");
      return;
    }

    router.push(`/audit/planning?plan_id=${selectedPlan.id}`);
  }

  function openExecution() {
    if (!selectedPlan) return;
    router.push(`/audit/execution?plan_id=${selectedPlan.id}`);
  }

  function openFindings() {
    if (!selectedPlan) return;
    router.push(`/audit/findings?plan_id=${selectedPlan.id}`);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-3 w-28 rounded bg-slate-200" />
            <div className="h-8 w-72 rounded bg-slate-200" />
            <div className="h-4 w-[520px] max-w-full rounded bg-slate-100" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full space-y-6 pb-10">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-5 border-b border-slate-200 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
              <ClipboardCheck size={21} />
            </div>

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Internal Audit
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                Audit Programs
              </h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                Enterprise audit program portfolio across planning,
                execution, findings and remediation posture.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadWorkspace}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCw size={14} />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => router.push("/audit/planning")}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
            >
              <ClipboardList size={14} />
              Audit Planning
            </button>
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Audit Programs"
            value={metrics.total}
            detail={`${metrics.draft} draft`}
            icon={<ClipboardList size={16} />}
          />
          <MetricCard
            label="Active"
            value={metrics.active}
            detail={`${metrics.completed} completed`}
            icon={<Activity size={16} />}
            tone="blue"
          />
          <MetricCard
            label="Open Findings"
            value={metrics.openFindings}
            detail={`${metrics.criticalFindings} critical`}
            icon={<AlertTriangle size={16} />}
            tone={metrics.criticalFindings > 0 ? "rose" : "amber"}
          />
          <MetricCard
            label="Program Risk"
            value={metrics.overdue + metrics.executionExceptions}
            detail={`${metrics.overdue} overdue / ${metrics.executionExceptions} exceptions`}
            icon={<ShieldCheck size={16} />}
            tone={
              metrics.overdue + metrics.executionExceptions > 0
                ? "amber"
                : "emerald"
            }
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <SectionHeader
              title="Program Portfolio"
              subtitle="Persistent audit plans currently available to the authenticated tenant."
            />

            <div className="mt-4 flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search reference, name, process or scope..."
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-500"
                />
              </div>

              <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                {["ALL", "DRAFT", "IN_PROGRESS", "COMPLETED"].map(
                  (status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setStatusFilter(status)}
                      className={`rounded-md px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] transition ${
                        statusFilter === status
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {status === "IN_PROGRESS"
                        ? "Active"
                        : status === "ALL"
                          ? "All"
                          : statusLabel(status)}
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>

          <div className="max-h-[620px] overflow-auto">
            {filteredPlans.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <ClipboardList
                  size={28}
                  className="mx-auto text-slate-300"
                />
                <div className="mt-3 text-sm font-semibold text-slate-800">
                  No audit programs found
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  No persisted audit plan matches the current filters.
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredPlans.map((plan) => {
                  const selected = plan.id === selectedPlanId;
                  const process = plan.process_id
                    ? processMap.get(plan.process_id)
                    : null;
                  const itemHealth = health.find(
                    (item) => item.plan.id === plan.id,
                  );

                  const executionCount =
                    itemHealth?.executions.length ?? 0;

                  const completedExecution =
                    itemHealth?.executions.filter(
                      (record) =>
                        String(record.status || "").toUpperCase() ===
                        "COMPLETED",
                    ).length ?? 0;

                  const findingCount =
                    itemHealth?.findings.filter(
                      (finding) =>
                        String(finding.status || "").toUpperCase() !==
                        "CLOSED",
                    ).length ?? 0;

                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => selectPlan(plan.id)}
                      className={`w-full px-5 py-4 text-left transition ${
                        selected
                          ? "bg-blue-50/50"
                          : "bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                            selected
                              ? "border-blue-200 bg-blue-100 text-blue-700"
                              : "border-slate-200 bg-slate-50 text-slate-500"
                          }`}
                        >
                          <ClipboardCheck size={16} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[11px] font-semibold text-slate-500">
                              {plan.reference}
                            </span>

                            <span
                              className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] ${statusClass(plan.status)}`}
                            >
                              {statusLabel(plan.status)}
                            </span>

                            {isOverdue(plan) ? (
                              <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-rose-700">
                                Overdue
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-1 truncate text-sm font-semibold text-slate-900">
                            {plan.name}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-500">
                            <span>
                              {auditTypeLabel(plan.audit_type)}
                            </span>
                            <span>
                              {process?.code || "No process"}
                            </span>
                            <span>
                              {dateLabel(plan.planned_start)}
                            </span>
                            <span>
                              {dateLabel(plan.planned_end)}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px]">
                            <span className="inline-flex items-center gap-1.5 text-slate-500">
                              <Target size={12} />
                              {executionCount} execution
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-slate-500">
                              <CheckCircle2 size={12} />
                              {completedExecution} completed
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-slate-500">
                              <AlertTriangle size={12} />
                              {findingCount} open findings
                            </span>
                          </div>
                        </div>

                        <ArrowRight
                          size={16}
                          className={`mt-2 shrink-0 ${
                            selected
                              ? "text-blue-600"
                              : "text-slate-300"
                          }`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <SectionHeader
                title="Program Command Center"
                subtitle="Selected audit plan posture and next operational actions."
              />
            </div>

            {!selectedPlan ? (
              <div className="px-6 py-16 text-center">
                <FileSearch
                  size={28}
                  className="mx-auto text-slate-300"
                />
                <div className="mt-3 text-sm font-semibold text-slate-800">
                  Select an audit program
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Program details will appear here.
                </div>
              </div>
            ) : (
              <div className="p-5">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    {selectedPlan.reference}
                  </div>
                  <div className="mt-1 text-base font-semibold text-slate-900">
                    {selectedPlan.name}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] ${statusClass(selectedPlan.status)}`}
                    >
                      {statusLabel(selectedPlan.status)}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      {auditTypeLabel(selectedPlan.audit_type)}
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 p-3">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                      Process
                    </div>
                    <div className="mt-1 text-xs font-semibold text-slate-800">
                      {selectedPlan.process_id
                        ? processMap.get(selectedPlan.process_id)?.name ||
                          `Process ${selectedPlan.process_id}`
                        : "Not assigned"}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-3">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                      Auditor
                    </div>
                    <div className="mt-1 text-xs font-semibold text-slate-800">
                      {selectedPlan.lead_auditor_id
                        ? `User ${selectedPlan.lead_auditor_id}`
                        : "Not assigned"}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-3">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                      Planned Start
                    </div>
                    <div className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                      <CalendarDays size={12} />
                      {dateLabel(selectedPlan.planned_start)}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-3">
                    <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                      Planned End
                    </div>
                    <div className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                      <Clock3 size={12} />
                      {dateLabel(selectedPlan.planned_end)}
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Objective
                  </div>
                  <div className="mt-2 text-xs leading-5 text-slate-600">
                    {selectedPlan.objective || "No objective defined."}
                  </div>
                </div>

                <div className="mt-5">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Scope
                  </div>
                  <div className="mt-2 text-xs leading-5 text-slate-600">
                    {selectedPlan.scope || "No scope description defined."}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
                    <div className="text-lg font-semibold text-slate-900">
                      {selectedHealth?.executions.length ?? 0}
                    </div>
                    <div className="text-[9px] uppercase tracking-[0.08em] text-slate-400">
                      Execution
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
                    <div className="text-lg font-semibold text-slate-900">
                      {selectedHealth?.findings.length ?? 0}
                    </div>
                    <div className="text-[9px] uppercase tracking-[0.08em] text-slate-400">
                      Findings
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
                    <div className="text-lg font-semibold text-slate-900">
                      {selectedHealth?.findings.filter(
                        (finding) =>
                          String(finding.status || "").toUpperCase() !==
                          "CLOSED",
                      ).length ?? 0}
                    </div>
                    <div className="text-[9px] uppercase tracking-[0.08em] text-slate-400">
                      Open
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-2">
                  <button
                    type="button"
                    onClick={openPlanning}
                    className="flex items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <span className="inline-flex items-center gap-2">
                      <ClipboardList size={14} />
                      Open Planning
                    </span>
                    <ArrowRight size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={openExecution}
                    className="flex items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Target size={14} />
                      Open Execution
                    </span>
                    <ArrowRight size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={openFindings}
                    className="flex items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <span className="inline-flex items-center gap-2">
                      <AlertTriangle size={14} />
                      Open Findings
                    </span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <SectionHeader
                title="Portfolio Signals"
                subtitle="Derived from persisted audit plan, execution and finding records."
              />
            </div>

            <div className="grid grid-cols-2 gap-3 p-5">
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center gap-2 text-slate-500">
                  <CalendarDays size={13} />
                  <span className="text-[9px] font-semibold uppercase tracking-[0.1em]">
                    Overdue
                  </span>
                </div>
                <div className="mt-2 text-xl font-semibold text-slate-900">
                  {metrics.overdue}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center gap-2 text-slate-500">
                  <XCircle size={13} />
                  <span className="text-[9px] font-semibold uppercase tracking-[0.1em]">
                    Exceptions
                  </span>
                </div>
                <div className="mt-2 text-xl font-semibold text-slate-900">
                  {metrics.executionExceptions}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center gap-2 text-slate-500">
                  <AlertTriangle size={13} />
                  <span className="text-[9px] font-semibold uppercase tracking-[0.1em]">
                    Critical
                  </span>
                </div>
                <div className="mt-2 text-xl font-semibold text-slate-900">
                  {metrics.criticalFindings}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center gap-2 text-slate-500">
                  <Users size={13} />
                  <span className="text-[9px] font-semibold uppercase tracking-[0.1em]">
                    Lead Auditors
                  </span>
                </div>
                <div className="mt-2 text-xl font-semibold text-slate-900">
                  {
                    new Set(
                      plans
                        .map((plan) => plan.lead_auditor_id)
                        .filter(Boolean),
                    ).size
                  }
                </div>
              </div>
            </div>

            {loadingHealth ? (
              <div className="border-t border-slate-200 px-5 py-3 text-[10px] text-slate-400">
                Loading execution and finding posture...
              </div>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
