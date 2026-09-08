 "use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  RefreshCw,
  ShieldAlert,
  Target,
  XCircle,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/app/lib/api";

type AnyRecord = Record<string, any>;

type AuditPlan = {
  id: number;
  reference?: string | null;
  name?: string | null;
  audit_type?: string | null;
  objective?: string | null;
  scope?: string | null;
  process_id?: number | null;
  standard_id?: number | null;
  standard_version_id?: number | null;
  lead_auditor_id?: number | null;
  planned_start?: string | null;
  planned_end?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ExecutionRecord = {
  id?: number;
  audit_plan_id?: number | null;
  process_id?: number | null;
  control_id?: number | null;
  status?: string | null;
  result?: string | null;
  notes?: string | null;
  conclusion?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
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
  assigned_owner_id?: number | null;
  process_manager_id?: number | null;
  due_date?: string | null;
  root_cause?: string | null;
  owner_response?: string | null;
  correction?: string | null;
  corrective_action_plan?: string | null;
  implementation_status?: string | null;
  verification_status?: string | null;
  implementation_evidence?: string | null;
  verification_comment?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type Risk = {
  id?: number;
  title?: string | null;
  description?: string | null;
  score?: number | null;
  risk_level?: string | null;
};

type AuditAction = {
  control_id?: number | null;
  control_code?: string | null;
  control_title?: string | null;
  control_description?: string | null;
  requirement_code?: string | null;
  requirement_title?: string | null;
  requirement_description?: string | null;
  clause_code?: string | null;
  standard_code?: string | null;
  standard_title?: string | null;
  risks?: Risk[];
  risk_count?: number | null;
  max_risk_score?: number | null;
  highest_risk_level?: string | null;
  priority?: string | null;
  ai_priority_score?: number | null;
};

type AuditPlanResponse = {
  process_id?: number | null;
  total_actions?: number;
  critical_actions?: number;
  actions?: AuditAction[];
};

type Process = {
  id: number;
  code?: string | null;
  name?: string | null;
  owner?: string | null;
  status?: string | null;
};

type AuditLog = {
  id?: number;
  user_email?: string | null;
  actor_role?: string | null;
  action?: string | null;
  entity?: string | null;
  entity_type?: string | null;
  entity_id?: number | null;
  timestamp?: string | null;
  created_at?: string | null;
  old_value?: AnyRecord | null;
  new_value?: AnyRecord | null;
};

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function text(value: unknown, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function dateText(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function statusLabel(value?: string | null) {
  return text(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalize(value?: string | null) {
  return String(value || "").trim().toUpperCase();
}

function isClosed(status?: string | null) {
  return normalize(status) === "CLOSED";
}

function isOverdue(finding: Finding) {
  if (!finding.due_date || isClosed(finding.status)) return false;
  const due = new Date(finding.due_date);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < Date.now();
}

function severityRank(value?: string | null) {
  const v = normalize(value);
  if (v === "CRITICAL") return 4;
  if (v === "HIGH") return 3;
  if (v === "MEDIUM") return 2;
  if (v === "LOW") return 1;
  return 0;
}

function severityTone(value?: string | null) {
  const v = normalize(value);
  if (v === "CRITICAL") return "bg-red-50 text-red-700 border-red-200";
  if (v === "HIGH") return "bg-orange-50 text-orange-700 border-orange-200";
  if (v === "MEDIUM") return "bg-amber-50 text-amber-700 border-amber-200";
  if (v === "LOW") return "bg-slate-50 text-slate-600 border-slate-200";
  return "bg-slate-50 text-slate-500 border-slate-200";
}

function executionTone(value?: string | null) {
  const v = normalize(value);
  if (v === "COMPLETED") return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (v === "EXCEPTION") return "text-red-700 bg-red-50 border-red-200";
  if (v === "IN_PROGRESS") return "text-blue-700 bg-blue-50 border-blue-200";
  return "text-slate-600 bg-slate-50 border-slate-200";
}

function KpiCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          {label}
        </div>
        <div className="text-slate-400">{icon}</div>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </div>
      <div className="mt-1 text-xs text-slate-500">{detail}</div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function AuditReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const requestedPlanId = Number(searchParams.get("plan_id") || 0);

  const [plans, setPlans] = useState<AuditPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(
    requestedPlanId > 0 ? requestedPlanId : null,
  );
  const [selectedPlan, setSelectedPlan] = useState<AuditPlan | null>(null);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [execution, setExecution] = useState<ExecutionRecord[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [riskPlan, setRiskPlan] = useState<AuditPlanResponse | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function readError(response: Response) {
    try {
      const body = await response.json();
      if (typeof body?.detail === "string") return body.detail;
      return JSON.stringify(body);
    } catch {
      return response.statusText || "Request failed";
    }
  }

  async function getJson<T>(url: string): Promise<T> {
    const response = await apiFetch(url, { method: "GET" });
    if (!response.ok) throw new Error(await readError(response));
    return (await response.json()) as T;
  }

  async function loadReport(planId?: number | null) {
    const rows = await getJson<AuditPlan[]>("/audit/plans");
    const planRows = asArray<AuditPlan>(rows);
    setPlans(planRows);

    const resolvedId =
      planId && planId > 0
        ? planId
        : planRows.length
          ? Number(planRows[0].id)
          : null;

    if (!resolvedId) {
      setSelectedPlan(null);
      setExecution([]);
      setFindings([]);
      setRiskPlan(null);
      setLogs([]);
      return;
    }

    const detailed = await getJson<AuditPlan>(`/audit/plans/${resolvedId}`);
    setSelectedPlan(detailed);
    setSelectedPlanId(resolvedId);

    const processRows = await getJson<Process[]>("/company/processes");
    setProcesses(asArray<Process>(processRows));

    const [executionResult, findingsResult, logsResult] =
      await Promise.allSettled([
        getJson<ExecutionRecord[]>(
          `/audit/execution?plan_id=${resolvedId}`,
        ),
        getJson<Finding[]>(`/audit/findings?plan_id=${resolvedId}`),
        getJson<AuditLog[]>("/audit/logs"),
      ]);

    setExecution(
      executionResult.status === "fulfilled"
        ? asArray<ExecutionRecord>(executionResult.value)
        : [],
    );

    setFindings(
      findingsResult.status === "fulfilled"
        ? asArray<Finding>(findingsResult.value)
        : [],
    );

    setLogs(
      logsResult.status === "fulfilled"
        ? asArray<AuditLog>(logsResult.value)
        : [],
    );

    if (detailed.process_id) {
      const riskResult = await Promise.allSettled([
        getJson<AuditPlanResponse>(
          `/company/coverage/processes/${detailed.process_id}/audit-plan`,
        ),
      ]);

      setRiskPlan(
        riskResult[0].status === "fulfilled"
          ? riskResult[0].value
          : null,
      );
    } else {
      setRiskPlan(null);
    }
  }

  async function refresh() {
    setRefreshing(true);
    setError("");

    try {
      await loadReport(selectedPlanId);
    } catch (e: any) {
      setError(e?.message || "Audit report could not be loaded.");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [selectedPlanId]);

  const process = useMemo(
    () =>
      processes.find(
        (item) => Number(item.id) === Number(selectedPlan?.process_id),
      ) || null,
    [processes, selectedPlan],
  );

  const actions = useMemo(
    () => asArray<AuditAction>(riskPlan?.actions),
    [riskPlan],
  );

  const actionByControl = useMemo(() => {
    const map = new Map<number, AuditAction>();
    actions.forEach((item) => {
      if (item.control_id != null) {
        map.set(Number(item.control_id), item);
      }
    });
    return map;
  }, [actions]);

  const executionByControl = useMemo(() => {
    const map = new Map<number, ExecutionRecord>();
    execution.forEach((item) => {
      if (item.control_id != null) {
        map.set(Number(item.control_id), item);
      }
    });
    return map;
  }, [execution]);

  const findingsByControl = useMemo(() => {
    const map = new Map<number, Finding[]>();

    findings.forEach((finding) => {
      if (finding.control_id == null) return;

      const id = Number(finding.control_id);
      const current = map.get(id) || [];
      current.push(finding);
      map.set(id, current);
    });

    return map;
  }, [findings]);

  const reportRows = useMemo(() => {
    const controlIds = new Set<number>();

    actions.forEach((item) => {
      if (item.control_id != null) controlIds.add(Number(item.control_id));
    });

    execution.forEach((item) => {
      if (item.control_id != null) controlIds.add(Number(item.control_id));
    });

    findings.forEach((item) => {
      if (item.control_id != null) controlIds.add(Number(item.control_id));
    });

    return Array.from(controlIds)
      .map((controlId) => {
        const action = actionByControl.get(controlId);
        const record = executionByControl.get(controlId);
        const linkedFindings = findingsByControl.get(controlId) || [];

        return {
          controlId,
          action,
          record,
          findings: linkedFindings,
        };
      })
      .sort(
        (a, b) =>
          severityRank(b.action?.highest_risk_level) -
          severityRank(a.action?.highest_risk_level),
      );
  }, [
    actions,
    execution,
    findings,
    actionByControl,
    executionByControl,
    findingsByControl,
  ]);

  const metrics = useMemo(() => {
    const total = reportRows.length;
    const completed = execution.filter(
      (item) => normalize(item.status) === "COMPLETED",
    ).length;
    const inProgress = execution.filter(
      (item) => normalize(item.status) === "IN_PROGRESS",
    ).length;
    const exceptions = execution.filter(
      (item) => normalize(item.status) === "EXCEPTION",
    ).length;
    const openFindings = findings.filter(
      (item) => !isClosed(item.status),
    ).length;
    const critical = findings.filter(
      (item) => normalize(item.severity) === "CRITICAL" && !isClosed(item.status),
    ).length;
    const high = findings.filter(
      (item) => normalize(item.severity) === "HIGH" && !isClosed(item.status),
    ).length;
    const overdue = findings.filter(isOverdue).length;
    const verification = findings.filter(
      (item) => normalize(item.status) === "READY_FOR_VERIFICATION",
    ).length;

    return {
      total,
      completed,
      inProgress,
      exceptions,
      openFindings,
      critical,
      high,
      overdue,
      verification,
      completion: total
        ? Math.round((completed / total) * 100)
        : 0,
    };
  }, [reportRows, execution, findings]);

  const lifecycle = useMemo(() => {
    const counts = new Map<string, number>();

    findings.forEach((finding) => {
      const key = normalize(finding.status) || "UNKNOWN";
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [findings]);

  const riskSummary = useMemo(() => {
    const counts = new Map<string, number>();

    actions.forEach((action) => {
      const level = normalize(
        action.highest_risk_level || action.priority,
      ) || "UNASSESSED";

      counts.set(level, (counts.get(level) || 0) + 1);
    });

    return Array.from(counts.entries()).sort(
      (a, b) =>
        severityRank(b[0]) - severityRank(a[0]),
    );
  }, [actions]);

  const latestLogs = useMemo(
    () =>
      [...logs]
        .filter((log) => {
          if (!selectedPlan?.id) return false;
          const entityId = Number(log.entity_id);
          const newValue = JSON.stringify(log.new_value || {});
          const oldValue = JSON.stringify(log.old_value || {});

          return (
            entityId === Number(selectedPlan.id) ||
            newValue.includes(`"audit_plan_id":${selectedPlan.id}`) ||
            newValue.includes(`"audit_plan_id": ${selectedPlan.id}`) ||
            oldValue.includes(`"audit_plan_id":${selectedPlan.id}`) ||
            oldValue.includes(`"audit_plan_id": ${selectedPlan.id}`)
          );
        })
        .slice(0, 12),
    [logs, selectedPlan],
  );

  function selectPlan(id: number) {
    setSelectedPlanId(id);

    const params = new URLSearchParams(window.location.search);
    params.set("plan_id", String(id));

    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${params.toString()}`,
    );
  }

  if (loading) {
    return (
      <div className="min-h-[70vh] bg-slate-50 p-6">
        <div className="mx-auto max-w-[1600px]">
          <div className="border border-slate-200 bg-white p-8">
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <RefreshCw size={16} className="animate-spin" />
              Loading audit report...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!plans.length) {
    return (
      <div className="min-h-[70vh] bg-slate-50 p-6">
        <div className="mx-auto max-w-[1600px]">
          <div className="border border-slate-200 bg-white p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center bg-slate-100 text-slate-500">
                <ClipboardCheck size={20} />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-950">
                  Audit Report
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  No audit plans are currently available for reporting.
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/audit/planning")}
                  className="mt-5 inline-flex h-10 items-center gap-2 bg-slate-950 px-4 text-sm font-semibold text-white"
                >
                  Open Audit Planning
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1600px] space-y-6 px-6 py-6 xl:px-8">
        <header className="border-b border-slate-200 pb-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-600">
                <FileText size={14} />
                Internal Audit / Reporting
              </div>

              <h1 className="mt-3 text-[28px] font-semibold tracking-tight text-slate-950">
                Audit Report
              </h1>

              <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-500">
                Executive audit reporting derived from the selected audit
                engagement, persisted execution records, findings, risk
                intelligence, and audit trace data.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => router.push("/audit/checklists")}
                className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Audit Checklist
              </button>

              <button
                type="button"
                onClick={() => router.push("/audit/findings")}
                className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Findings
              </button>

              <button
                type="button"
                onClick={() => router.push("/audit/planning")}
                className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Planning
              </button>

              <button
                type="button"
                onClick={() => void refresh()}
                disabled={refreshing}
                className="inline-flex h-10 items-center gap-2 bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <RefreshCw
                  size={14}
                  className={refreshing ? "animate-spin" : ""}
                />
                Refresh
              </button>
            </div>
          </div>
        </header>

        {error ? (
          <div className="border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="border border-slate-200 bg-white">
          <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Audit Engagement
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <select
                  value={selectedPlanId || ""}
                  onChange={(event) =>
                    selectPlan(Number(event.target.value))
                  }
                  className="h-10 min-w-[280px] border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none"
                >
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {text(plan.reference, `PLAN-${plan.id}`)} -{" "}
                      {text(plan.name, "Audit Plan")}
                    </option>
                  ))}
                </select>

                <span className="border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                  {statusLabel(selectedPlan?.status)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-right md:grid-cols-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">
                  Reference
                </div>
                <div className="mt-1 font-mono text-xs font-semibold text-slate-800">
                  {text(selectedPlan?.reference)}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">
                  Audit Type
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-800">
                  {statusLabel(selectedPlan?.audit_type)}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">
                  Planned Start
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-800">
                  {dateText(selectedPlan?.planned_start)}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">
                  Planned End
                </div>
                <div className="mt-1 text-xs font-semibold text-slate-800">
                  {dateText(selectedPlan?.planned_end)}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-px border border-slate-200 bg-slate-200 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Controls in Scope"
            value={String(metrics.total)}
            detail={`${actions.length} risk intelligence actions`}
            icon={<Target size={17} />}
          />
          <KpiCard
            label="Execution Completion"
            value={`${metrics.completion}%`}
            detail={`${metrics.completed} completed / ${metrics.total} scoped`}
            icon={<CheckCircle2 size={17} />}
          />
          <KpiCard
            label="Open Findings"
            value={String(metrics.openFindings)}
            detail={`${metrics.critical} critical / ${metrics.high} high`}
            icon={<ShieldAlert size={17} />}
          />
          <KpiCard
            label="Overdue Findings"
            value={String(metrics.overdue)}
            detail={`${metrics.verification} awaiting verification`}
            icon={<Clock3 size={17} />}
          />
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <Section
              title="Executive Summary"
              subtitle="Current engagement position derived from persisted audit data."
            >
              <div className="grid grid-cols-2 gap-px bg-slate-200 md:grid-cols-4">
                <div className="bg-white p-5">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">
                    In Progress
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-blue-700">
                    {metrics.inProgress}
                  </div>
                </div>

                <div className="bg-white p-5">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">
                    Exceptions
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-red-700">
                    {metrics.exceptions}
                  </div>
                </div>

                <div className="bg-white p-5">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">
                    Critical Findings
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-red-700">
                    {metrics.critical}
                  </div>
                </div>

                <div className="bg-white p-5">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">
                    High Findings
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-orange-700">
                    {metrics.high}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 p-5 md:grid-cols-2">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Audit Objective
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {text(selectedPlan?.objective)}
                  </p>
                </div>

                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Audit Scope
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {text(selectedPlan?.scope)}
                  </p>
                </div>
              </div>
            </Section>
          </div>

          <Section
            title="Engagement Context"
            subtitle="Identifiers resolved from existing domain relationships."
          >
            <div className="divide-y divide-slate-100">
              <div className="p-5">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">
                  Process
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  {process
                    ? `${text(process.code)} - ${text(process.name)}`
                    : text(selectedPlan?.process_id)}
                </div>
              </div>

              <div className="p-5">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">
                  Standard Version
                </div>
                <div className="mt-2 font-mono text-sm font-semibold text-slate-900">
                  {text(selectedPlan?.standard_version_id)}
                </div>
              </div>

              <div className="p-5">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">
                  Lead Auditor
                </div>
                <div className="mt-2 font-mono text-sm font-semibold text-slate-900">
                  {text(selectedPlan?.lead_auditor_id)}
                </div>
              </div>

              <div className="p-5">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">
                  Current Plan Status
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  {statusLabel(selectedPlan?.status)}
                </div>
              </div>
            </div>
          </Section>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Section
            title="Risk Profile"
            subtitle="Risk levels attached to the current audit scope."
          >
            <div className="divide-y divide-slate-100">
              {riskSummary.length ? (
                riskSummary.map(([level, count]) => (
                  <div
                    key={level}
                    className="flex items-center justify-between px-5 py-4"
                  >
                    <span
                      className={`inline-flex border px-2 py-1 text-[10px] font-semibold uppercase ${severityTone(level)}`}
                    >
                      {level}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">
                      {count}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-5 text-sm text-slate-500">
                  No risk intelligence is available for the current scope.
                </div>
              )}
            </div>
          </Section>

          <Section
            title="Finding Lifecycle"
            subtitle="Persisted finding workflow distribution."
          >
            <div className="divide-y divide-slate-100">
              {lifecycle.length ? (
                lifecycle.map(([status, count]) => (
                  <div
                    key={status}
                    className="flex items-center justify-between px-5 py-4"
                  >
                    <span className="text-xs font-semibold text-slate-700">
                      {statusLabel(status)}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">
                      {count}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-5 text-sm text-slate-500">
                  No findings are associated with this audit plan.
                </div>
              )}
            </div>
          </Section>

          <Section
            title="Control Outcome"
            subtitle="Execution state across the reported scope."
          >
            <div className="space-y-4 p-5">
              <div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Completed</span>
                  <span className="font-semibold text-slate-800">
                    {metrics.completed}
                  </span>
                </div>
                <div className="mt-2 h-2 bg-slate-100">
                  <div
                    className="h-2 bg-emerald-500"
                    style={{
                      width: `${Math.min(metrics.completion, 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock3 size={14} />
                  In Progress
                </span>
                <span className="font-semibold text-blue-700">
                  {metrics.inProgress}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs text-slate-500">
                  <XCircle size={14} />
                  Exceptions
                </span>
                <span className="font-semibold text-red-700">
                  {metrics.exceptions}
                </span>
              </div>
            </div>
          </Section>
        </section>

        <Section
          title="Control Assessment & Traceability"
          subtitle="Standard, requirement, control, risk, execution, and finding relationships."
        >
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Control
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Requirement
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Risk
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Execution
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Findings
                  </th>
                </tr>
              </thead>

              <tbody>
                {reportRows.length ? (
                  reportRows.map((row) => {
                    const action = row.action;
                    const record = row.record;

                    return (
                      <tr
                        key={row.controlId}
                        className="border-b border-slate-100 align-top hover:bg-slate-50"
                      >
                        <td className="px-4 py-4">
                          <div className="font-mono text-xs font-semibold text-slate-900">
                            {text(
                              action?.control_code,
                              `CONTROL-${row.controlId}`,
                            )}
                          </div>
                          <div className="mt-1 max-w-[300px] text-xs font-medium text-slate-800">
                            {text(action?.control_title)}
                          </div>
                          <div className="mt-1 max-w-[340px] text-[11px] leading-5 text-slate-500">
                            {text(action?.control_description)}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="font-mono text-[11px] font-semibold text-slate-700">
                            {text(action?.requirement_code)}
                          </div>
                          <div className="mt-1 max-w-[260px] text-xs text-slate-600">
                            {text(action?.requirement_title)}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1">
                            {action?.highest_risk_level ? (
                              <span
                                className={`inline-flex border px-2 py-1 text-[10px] font-semibold uppercase ${severityTone(action.highest_risk_level)}`}
                              >
                                {action.highest_risk_level}
                              </span>
                            ) : null}

                            <span className="border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600">
                              {text(action?.risk_count, "0")} risks
                            </span>
                          </div>

                          {action?.max_risk_score != null ? (
                            <div className="mt-2 text-[11px] text-slate-500">
                              Max score:{" "}
                              <span className="font-semibold text-slate-800">
                                {action.max_risk_score}
                              </span>
                            </div>
                          ) : null}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex border px-2 py-1 text-[10px] font-semibold uppercase ${executionTone(record?.status)}`}
                          >
                            {statusLabel(record?.status)}
                          </span>

                          <div className="mt-2 text-xs font-semibold text-slate-800">
                            {text(record?.result)}
                          </div>

                          <div className="mt-1 max-w-[260px] text-[11px] leading-5 text-slate-500">
                            {text(record?.conclusion)}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          {row.findings.length ? (
                            <div className="space-y-2">
                              {row.findings.map((finding) => (
                                <button
                                  type="button"
                                  key={finding.id}
                                  onClick={() =>
                                    router.push(
                                      `/audit/findings?plan_id=${selectedPlan?.id || ""}&control_id=${row.controlId}`,
                                    )
                                  }
                                  className="block w-full border border-slate-200 bg-white p-3 text-left hover:bg-slate-50"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-semibold text-slate-900">
                                      {text(finding.title)}
                                    </span>
                                    <span
                                      className={`border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${severityTone(finding.severity)}`}
                                    >
                                      {text(finding.severity)}
                                    </span>
                                  </div>
                                  <div className="mt-1 text-[10px] text-slate-500">
                                    {statusLabel(finding.status)}
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">
                              No findings
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-14 text-center text-sm text-slate-500"
                    >
                      No reportable control records are currently available
                      for this audit plan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Section
            title="Findings Register"
            subtitle="Current findings requiring management attention or verification."
          >
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500">
                      Finding
                    </th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500">
                      Severity
                    </th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500">
                      Due
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {findings.length ? (
                    [...findings]
                      .sort(
                        (a, b) =>
                          severityRank(b.severity) -
                          severityRank(a.severity),
                      )
                      .map((finding) => (
                        <tr
                          key={finding.id}
                          className="border-b border-slate-100"
                        >
                          <td className="px-4 py-4">
                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  `/audit/findings?plan_id=${selectedPlan?.id || ""}&control_id=${finding.control_id || ""}`,
                                )
                              }
                              className="text-left"
                            >
                              <div className="text-xs font-semibold text-slate-900 hover:text-blue-700">
                                {text(finding.title)}
                              </div>
                              <div className="mt-1 max-w-[340px] truncate text-[10px] text-slate-500">
                                {text(finding.description)}
                              </div>
                            </button>
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`border px-2 py-1 text-[10px] font-semibold uppercase ${severityTone(finding.severity)}`}
                            >
                              {text(finding.severity)}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-xs font-semibold text-slate-700">
                            {statusLabel(finding.status)}
                          </td>
                          <td
                            className={`px-4 py-4 text-xs font-semibold ${isOverdue(finding) ? "text-red-700" : "text-slate-700"}`}
                          >
                            {dateText(finding.due_date)}
                          </td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-12 text-center text-sm text-slate-500"
                      >
                        No findings are associated with this audit plan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <Section
            title="Remediation & Verification"
            subtitle="Current corrective action and verification state."
          >
            <div className="divide-y divide-slate-100">
              {findings.length ? (
                findings.map((finding) => (
                  <div key={finding.id} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-slate-900">
                          {text(finding.title)}
                        </div>
                        <div className="mt-1 text-[10px] uppercase tracking-wider text-slate-400">
                          Finding #{text(finding.id)}
                        </div>
                      </div>

                      <span className="border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-semibold uppercase text-slate-600">
                        {statusLabel(finding.implementation_status)}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400">
                          Root Cause
                        </div>
                        <div className="mt-1 text-xs leading-5 text-slate-600">
                          {text(finding.root_cause)}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400">
                          Corrective Action Plan
                        </div>
                        <div className="mt-1 text-xs leading-5 text-slate-600">
                          {text(finding.corrective_action_plan)}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400">
                          Implementation Evidence
                        </div>
                        <div className="mt-1 text-xs leading-5 text-slate-600">
                          {text(finding.implementation_evidence)}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400">
                          Verification
                        </div>
                        <div className="mt-1 text-xs leading-5 text-slate-600">
                          {text(finding.verification_comment)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-sm text-slate-500">
                  No remediation records are available.
                </div>
              )}
            </div>
          </Section>
        </section>

        <Section
          title="Audit Trail"
          subtitle="Audit log entries attributable to the selected engagement."
        >
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500">
                    Time
                  </th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500">
                    Actor
                  </th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500">
                    Action
                  </th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-slate-500">
                    Entity
                  </th>
                </tr>
              </thead>

              <tbody>
                {latestLogs.length ? (
                  latestLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-slate-100"
                    >
                      <td className="px-4 py-4 text-xs text-slate-500">
                        {dateText(log.timestamp || log.created_at)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-xs font-semibold text-slate-800">
                          {text(log.user_email)}
                        </div>
                        <div className="mt-1 text-[10px] uppercase text-slate-400">
                          {text(log.actor_role)}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs font-semibold text-slate-800">
                        {text(log.action)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-xs text-slate-700">
                          {text(log.entity_type || log.entity)}
                        </div>
                        <div className="mt-1 font-mono text-[10px] text-slate-400">
                          {text(log.entity_id)}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-5 py-12 text-center text-sm text-slate-500"
                    >
                      No attributable audit log entries were returned for
                      this engagement.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>

        <footer className="flex flex-col gap-3 border-t border-slate-200 py-5 text-[10px] uppercase tracking-wider text-slate-400 md:flex-row md:items-center md:justify-between">
          <span>
            Audit Report / {text(selectedPlan?.reference)}
          </span>
          <span>
            Source: persisted audit plan, execution, findings and audit
            intelligence APIs
          </span>
        </footer>
      </div>
    </div>
  );
}
export default function AuditReportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
          Loading audit report...
        </div>
      }
    >
      <AuditReportContent />
    </Suspense>
  );
}
