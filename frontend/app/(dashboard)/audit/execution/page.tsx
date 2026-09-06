"use client";

import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  FileSearch,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  Target,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../../lib/api";

type AnyRecord = Record<string, any>;

type AuditPlan = {
  id: number;
  reference?: string | null;
  name?: string | null;
  audit_type?: string | null;
  status?: string | null;
  process_id?: number | null;
  standard_id?: number | null;
  standard_version_id?: number | null;
  lead_auditor_id?: number | null;
  lead_auditor_name?: string | null;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  objective?: string | null;
  scope?: string | null;
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
  created_at?: string | null;
  updated_at?: string | null;
};

type RiskAction = {
  id?: number;
  control_id?: number | null;
  control_code?: string | null;
  control_title?: string | null;
  title?: string | null;
  description?: string | null;
  priority?: string | null;
  risk_level?: string | null;
  severity?: string | null;
  expected_score_change?: number | null;
  escalation_probability?: number | null;
  score?: number | null;
  ai_priority_score?: number | null;
  status?: string | null;
  highest_risk_level?: string | null;
  max_risk_score?: number | null;
  standard_code?: string | null;
  clause_code?: string | null;
  requirement_code?: string | null;
  [key: string]: any;
};

type RiskPlan = {
  process_id?: number;
  total_actions?: number;
  critical_actions?: number;
  actions?: RiskAction[];
};

type Finding = {
  id?: number;
  audit_plan_id?: number | null;
  execution_id?: number | null;
  control_id?: number | null;
  title?: string | null;
  severity?: string | null;
  status?: string | null;
};

type ProcessRow = {
  id: number;
  code?: string | null;
  name?: string | null;
};

function asArray<T = any>(value: any): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.results)) return value.results;
  return [];
}

function text(value: any, fallback = "-") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  return String(value);
}

function numberValue(value: any, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeStatus(value: any) {
  return String(value || "READY").toUpperCase();
}

function statusLabel(value: any) {
  return normalizeStatus(value).replaceAll("_", " ");
}

function formatDate(value: any) {
  if (!value) return "Not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: any) {
  if (!value) return "Not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusClasses(value: any) {
  const status = normalizeStatus(value);

  if (status === "COMPLETED" || status === "CLOSED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "IN_PROGRESS" || status === "OWNER_RESPONSE") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (
    status === "EXCEPTION" ||
    status === "REVISION_REQUIRED" ||
    status === "VERIFICATION_FAILED"
  ) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-slate-200 bg-slate-100 text-slate-600";
}

function priorityClasses(value: any) {
  const priority = String(value || "").toUpperCase();

  if (priority === "CRITICAL") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (priority === "HIGH") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  if (priority === "MEDIUM") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function resultClasses(value: any) {
  const result = String(value || "").toUpperCase();

  if (result === "CONFORMITY" || result === "EFFECTIVE") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (result === "PARTIAL_CONFORMITY" || result === "OBSERVATION") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (
    result === "NON_CONFORMITY" ||
    result === "MAJOR_NON_CONFORMITY" ||
    result === "INEFFECTIVE"
  ) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function priorityLabel(action: RiskAction | undefined) {
  if (!action) return "UNASSESSED";

  const level =
    action.highest_risk_level ||
    action.risk_level ||
    action.priority ||
    "";

  if (level) {
    return String(level).toUpperCase();
  }

  const score = numberValue(
    action.ai_priority_score ?? action.score,
    0,
  );

  if (score >= 75) return "CRITICAL";
  if (score >= 55) return "HIGH";
  if (score >= 35) return "MEDIUM";
  return "LOW";
}

function Badge({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${className}`}
    >
      {children}
    </span>
  );
}

function Metric({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            {label}
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            {value}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {detail}
          </div>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function AuditExecutionPage() {
  const router = useRouter();

  const [plans, setPlans] = useState<AuditPlan[]>([]);
  const [processes, setProcesses] = useState<ProcessRow[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(
    null,
  );
  const [selectedPlan, setSelectedPlan] =
    useState<AuditPlan | null>(null);

  const [execution, setExecution] = useState<ExecutionRecord[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [riskPlan, setRiskPlan] = useState<RiskPlan | null>(null);

  const [selectedControlId, setSelectedControlId] =
    useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [result, setResult] = useState("");
  const [notes, setNotes] = useState("");
  const [conclusion, setConclusion] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingExecution, setLoadingExecution] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rawPlanId = params.get("plan_id");
  const rawControlId = params.get("control_id");

    if (rawPlanId) {
      const parsed = Number(rawPlanId);

      if (Number.isFinite(parsed) && parsed > 0) {
        setSelectedPlanId(parsed);
      }

  if (rawControlId) {
    const parsedControlId = Number(rawControlId);

    if (
      Number.isFinite(parsedControlId) &&
      parsedControlId > 0
    ) {
      setSelectedControlId(parsedControlId);
    }
  }
    }
  }, []);

  async function readError(response: Response) {
    try {
      const body = await response.json();

      if (typeof body?.detail === "string") {
        return body.detail;
      }

      if (typeof body?.message === "string") {
        return body.message;
      }

      return JSON.stringify(body);
    } catch {
      return `Request failed with status ${response.status}.`;
    }
  }

  async function loadPlans() {
    const response = await apiFetch("/audit/plans", {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(await readError(response));
    }

    return asArray<AuditPlan>(await response.json());
  }

  async function loadProcesses() {
    const response = await apiFetch("/company/processes", {
      method: "GET",
    });

    if (!response.ok) {
      return [];
    }

    return asArray<ProcessRow>(await response.json());
  }

  async function loadPlan(planId: number) {
    const response = await apiFetch(`/audit/plans/${planId}`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(await readError(response));
    }

    return (await response.json()) as AuditPlan;
  }

  async function loadExecution(plan: AuditPlan) {
    if (!plan.id) return;

    setLoadingExecution(true);
    setError("");

    const executionPromise = apiFetch(
      `/audit/execution?plan_id=${plan.id}`,
      { method: "GET" },
    );

    const findingsPromise = apiFetch(
      `/audit/findings?plan_id=${plan.id}`,
      { method: "GET" },
    );

    const riskPromise = plan.process_id
      ? apiFetch(
          `/company/coverage/processes/${plan.process_id}/audit-plan`,
          { method: "GET" },
        )
      : Promise.resolve(null);

    const [
      executionResult,
      findingsResult,
      riskResult,
    ] = await Promise.allSettled([
      executionPromise,
      findingsPromise,
      riskPromise,
    ]);

    if (
      executionResult.status === "fulfilled" &&
      executionResult.value.ok
    ) {
      setExecution(
        asArray<ExecutionRecord>(
          await executionResult.value.json(),
        ),
      );
    } else {
      setExecution([]);
      setError("Execution records could not be loaded.");
    }

    if (
      findingsResult.status === "fulfilled" &&
      findingsResult.value.ok
    ) {
      setFindings(
        asArray<Finding>(
          await findingsResult.value.json(),
        ),
      );
    } else {
      setFindings([]);
    }

    if (
      riskResult.status === "fulfilled" &&
      riskResult.value &&
      riskResult.value.ok
    ) {
      setRiskPlan(
        (await riskResult.value.json()) as RiskPlan,
      );
    } else {
      setRiskPlan(null);
    }

    setLoadingExecution(false);
  }

  async function loadAll() {
    setLoading(true);
    setError("");

    try {
      const [planRows, processRows] = await Promise.all([
        loadPlans(),
        loadProcesses(),
      ]);

      setPlans(planRows);
      setProcesses(processRows);

      const requestedPlanId = selectedPlanId;

      const firstPlan = requestedPlanId
        ? planRows.find(
            (item) => Number(item.id) === requestedPlanId,
          )
        : planRows[0];

      if (!firstPlan) {
        setSelectedPlan(null);
        setExecution([]);
        setFindings([]);
        setRiskPlan(null);
        setSelectedControlId(null);
        return;
      }

      setSelectedPlanId(Number(firstPlan.id));

      const detailedPlan = await loadPlan(
        Number(firstPlan.id),
      );

      setSelectedPlan(detailedPlan);

      await loadExecution(detailedPlan);
    } catch (loadError: any) {
      setError(
        loadError?.message ||
          "Audit execution workspace could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [selectedPlanId]);

  useEffect(() => {
    if (!selectedControlId) {
      setResult("");
      setNotes("");
      setConclusion("");
      return;
    }

    const record = execution.find(
      (item) =>
        Number(item.control_id) ===
        Number(selectedControlId),
    );

    setResult(record?.result || "");
    setNotes(record?.notes || "");
    setConclusion(record?.conclusion || "");
  }, [selectedControlId, execution]);

  const actions = useMemo(() => {
    return asArray<RiskAction>(riskPlan?.actions);
  }, [riskPlan]);

  const actionByControl = useMemo(() => {
    const map = new Map<number, RiskAction>();

    actions.forEach((item) => {
      if (item.control_id == null) return;

      map.set(Number(item.control_id), item);
    });

    return map;
  }, [actions]);

  const executionByControl = useMemo(() => {
    const map = new Map<number, ExecutionRecord>();

    execution.forEach((item) => {
      if (item.control_id == null) return;

      map.set(Number(item.control_id), item);
    });

    return map;
  }, [execution]);

  const findingByControl = useMemo(() => {
    const map = new Map<number, Finding[]>();

    findings.forEach((item) => {
      if (item.control_id == null) return;

      const id = Number(item.control_id);
      const current = map.get(id) || [];

      current.push(item);
      map.set(id, current);
    });

    return map;
  }, [findings]);

  const queue = useMemo(() => {
    const ids = new Set<number>();

    actions.forEach((item) => {
      if (item.control_id != null) {
        ids.add(Number(item.control_id));
      }
    });

    execution.forEach((item) => {
      if (item.control_id != null) {
        ids.add(Number(item.control_id));
      }
    });

    return Array.from(ids).map((controlId) => {
      const action = actionByControl.get(controlId);
      const record = executionByControl.get(controlId);
      const linkedFindings =
        findingByControl.get(controlId) || [];

      return {
        controlId,
        action,
        record,
        findings: linkedFindings,
        priority: priorityLabel(action),
      };
    });
  }, [
    actions,
    execution,
    actionByControl,
    executionByControl,
    findingByControl,
  ]);

  const filteredQueue = useMemo(() => {
    const query = search.trim().toLowerCase();

    return queue.filter((row) => {
      const action = row.action;
      const record = row.record;

      const searchable = [
        row.controlId,
        action?.control_code,
        action?.control_title,
        action?.title,
        action?.description,
        action?.standard_code,
        action?.clause_code,
        action?.requirement_code,
        action?.risk_level,
        action?.highest_risk_level,
        record?.status,
        record?.result,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (query && !searchable.includes(query)) {
        return false;
      }

      if (
        priorityFilter !== "ALL" &&
        row.priority !== priorityFilter
      ) {
        return false;
      }

      if (
        statusFilter !== "ALL" &&
        normalizeStatus(record?.status) !== statusFilter
      ) {
        return false;
      }

      return true;
    });
  }, [
    queue,
    search,
    priorityFilter,
    statusFilter,
  ]);

  const selectedRow = useMemo(() => {
    if (!selectedControlId) return null;

    return (
      queue.find(
        (item) =>
          Number(item.controlId) ===
          Number(selectedControlId),
      ) || null
    );
  }, [queue, selectedControlId]);

  const completedCount = execution.filter(
    (item) =>
      normalizeStatus(item.status) === "COMPLETED",
  ).length;

  const inProgressCount = execution.filter(
    (item) =>
      normalizeStatus(item.status) === "IN_PROGRESS",
  ).length;

  const exceptionCount = execution.filter(
    (item) =>
      normalizeStatus(item.status) === "EXCEPTION",
  ).length;

  const openFindingCount = findings.filter(
    (item) =>
      normalizeStatus(item.status) !== "CLOSED",
  ).length;

  const process = processes.find(
    (item) =>
      Number(item.id) ===
      Number(selectedPlan?.process_id),
  );

  function selectPlan(planId: number) {
    setSelectedPlanId(planId);
    setSelectedControlId(null);

    const params = new URLSearchParams(
      window.location.search,
    );

    params.set("plan_id", String(planId));

    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${params.toString()}`,
    );
  }

  async function saveExecution() {
    if (!selectedPlan?.id || !selectedControlId) {
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const existing =
        executionByControl.get(selectedControlId);

      const payload: AnyRecord = {
        audit_plan_id: selectedPlan.id,
        control_id: selectedControlId,
        status: result ? "COMPLETED" : "IN_PROGRESS",
        result: result || null,
        notes: notes || null,
        conclusion: conclusion || null,
      };

      if (selectedPlan.process_id != null) {
        payload.process_id = selectedPlan.process_id;
      }

      const response = await apiFetch(
        "/audit/execution",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      setNotice("Execution record saved.");

      await loadExecution(selectedPlan);
    } catch (saveError: any) {
      setError(
        saveError?.message ||
          "Execution record could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  function openFindings(controlId: number) {
    router.push(
      `/audit/findings?plan_id=${selectedPlan?.id || ""}&control_id=${controlId}`,
    );
  }

  function openExecution(controlId: number) {
    setSelectedControlId(controlId);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  if (loading) {
    return (
      <div className="min-h-[70vh] bg-slate-50 p-6">
        <div className="mx-auto max-w-[1600px]">
          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <RefreshCw
                size={16}
                className="animate-spin"
              />
              Loading audit execution workspace...
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
          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <ClipboardCheck size={20} />
              </div>

              <div>
                <h1 className="text-lg font-semibold text-slate-950">
                  Audit Execution
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  No audit plans are currently available for
                  execution.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1600px] px-6 py-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <button
              type="button"
              onClick={() =>
                router.push("/audit/planning")
              }
              className="mb-3 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft size={14} />
              Back to Audit Planning
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white">
                <ClipboardCheck size={20} />
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Internal Audit
                </div>

                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
                  Audit Execution
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Execute controls against the approved audit
                  scope and capture auditable conclusions.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadAll()}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw size={14} />
              Refresh
            </button>

            <button
              type="button"
              onClick={() =>
                selectedControlId &&
                openExecution(selectedControlId)
              }
              disabled={!selectedControlId}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Play size={14} />
              Continue Execution
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle
              size={17}
              className="mt-0.5 shrink-0"
            />
            <span>{error}</span>
          </div>
        ) : null}

        {notice ? (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2
              size={17}
              className="mt-0.5 shrink-0"
            />
            <span>{notice}</span>
          </div>
        ) : null}

        <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px_240px]">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Active Audit Plan
              </div>

              <select
                value={selectedPlanId || ""}
                onChange={(event) =>
                  selectPlan(Number(event.target.value))
                }
                className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-400"
              >
                {plans.map((plan) => (
                  <option
                    key={plan.id}
                    value={plan.id}
                  >
                    {text(
                      plan.reference,
                      `PLAN-${plan.id}`,
                    )}{" "}
                    -{" "}
                    {text(
                      plan.name,
                      "Untitled Audit",
                    )}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                Process Scope
              </div>

              <div className="mt-1 text-sm font-semibold text-slate-900">
                {text(
                  process?.name,
                  "Process not resolved",
                )}
              </div>

              <div className="mt-1 font-mono text-[10px] text-slate-400">
                {text(process?.code)}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                Audit Status
              </div>

              <div className="mt-2">
                <Badge
                  className={statusClasses(
                    selectedPlan?.status,
                  )}
                >
                  {statusLabel(
                    selectedPlan?.status,
                  )}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Metric
            label="Execution Scope"
            value={queue.length}
            detail="Controls in current audit scope"
            icon={<Target size={17} />}
          />

          <Metric
            label="Completed"
            value={completedCount}
            detail="Execution records completed"
            icon={<CheckCircle2 size={17} />}
          />

          <Metric
            label="In Progress"
            value={inProgressCount}
            detail="Execution records underway"
            icon={<Clock3 size={17} />}
          />

          <Metric
            label="Exceptions"
            value={exceptionCount}
            detail="Records requiring attention"
            icon={<XCircle size={17} />}
          />

          <Metric
            label="Open Findings"
            value={openFindingCount}
            detail="Findings not yet closed"
            icon={<ShieldAlert size={17} />}
          />
        </div>

        <div className="mb-5 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Execution Scope
              </div>

              <div className="mt-1 text-sm font-semibold text-slate-900">
                {filteredQueue.length} of {queue.length} controls
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Find a control by code or title..."
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-slate-400 sm:w-[280px]"
                />
              </div>

              <select
                value={priorityFilter}
                onChange={(event) =>
                  setPriorityFilter(event.target.value)
                }
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none"
              >
                <option value="ALL">
                  All priorities
                </option>
                <option value="CRITICAL">
                  Critical
                </option>
                <option value="HIGH">
                  High
                </option>
                <option value="MEDIUM">
                  Medium
                </option>
                <option value="LOW">
                  Low
                </option>
              </select>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none"
              >
                <option value="ALL">
                  All statuses
                </option>
                <option value="READY">
                  Ready
                </option>
                <option value="IN_PROGRESS">
                  In progress
                </option>
                <option value="COMPLETED">
                  Completed
                </option>
                <option value="EXCEPTION">
                  Exception
                </option>
              </select>
            </div>
          </div>

          <div className="max-h-[520px] overflow-auto">
            <table className="min-w-full text-left">
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Control
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Priority
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Risk
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Execution
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Findings
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredQueue.map((row) => {
                  const selected =
                    Number(row.controlId) ===
                    Number(selectedControlId);

                  return (
                    <tr
                      key={row.controlId}
                      className={
                        selected
                          ? "bg-slate-50"
                          : "bg-white hover:bg-slate-50"
                      }
                    >
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedControlId(
                              row.controlId,
                            )
                          }
                          className="text-left"
                        >
                          <div className="font-mono text-xs font-bold text-slate-900">
                            {text(
                              row.action?.control_code,
                              `CONTROL-${row.controlId}`,
                            )}
                          </div>

                          <div className="mt-1 max-w-[380px] text-xs font-medium text-slate-700">
                            {text(
                              row.action?.control_title ||
                                row.action?.title,
                              "Control definition unavailable",
                            )}
                          </div>

                          <div className="mt-1 text-[10px] text-slate-400">
                            {text(
                              row.action?.standard_code,
                            )}
                            {row.action?.clause_code
                              ? ` / ${row.action.clause_code}`
                              : ""}
                            {row.action?.requirement_code
                              ? ` / ${row.action.requirement_code}`
                              : ""}
                          </div>
                        </button>
                      </td>

                      <td className="px-4 py-4">
                        <Badge
                          className={priorityClasses(
                            row.priority,
                          )}
                        >
                          {row.priority}
                        </Badge>
                      </td>

                      <td className="px-4 py-4">
                        <div className="text-xs font-semibold text-slate-800">
                          {text(
                            row.action
                              ?.highest_risk_level ||
                              row.action?.risk_level,
                            "UNASSESSED",
                          )}
                        </div>

                        <div className="mt-1 text-[10px] text-slate-400">
                          Score{" "}
                          {row.action?.max_risk_score !=
                          null
                            ? row.action.max_risk_score
                            : "-"}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <Badge
                          className={statusClasses(
                            row.record?.status,
                          )}
                        >
                          {statusLabel(
                            row.record?.status,
                          )}
                        </Badge>

                        {row.record?.completed_at ? (
                          <div className="mt-1 text-[10px] text-slate-400">
                            {formatDateTime(
                              row.record.completed_at,
                            )}
                          </div>
                        ) : null}
                      </td>

                      <td className="px-4 py-4">
                        <div className="text-sm font-semibold text-slate-900">
                          {row.findings.length}
                        </div>

                        <div className="mt-1 text-[10px] text-slate-400">
                          {
                            row.findings.filter(
                              (item) =>
                                normalizeStatus(
                                  item.status,
                                ) !== "CLOSED",
                            ).length
                          }{" "}
                          open
                        </div>
                      </td>

                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedControlId(
                              row.controlId,
                            )
                          }
                          className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          Execute
                          <ChevronDown
                            size={13}
                            className="rotate-[-90deg]"
                          />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {!loadingExecution &&
                !filteredQueue.length ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center"
                    >
                      <div className="text-sm font-semibold text-slate-800">
                        No controls match the current
                        filters.
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        Search within this audit scope or
                        reset the filters.
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Execution Record
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-slate-950">
                  {text(
                    selectedRow?.action?.control_code,
                    "Select a control",
                  )}
                </h2>

                {selectedRow ? (
                  <Badge
                    className={priorityClasses(
                      selectedRow.priority,
                    )}
                  >
                    {selectedRow.priority}
                  </Badge>
                ) : null}
              </div>

              <p className="mt-1 text-xs text-slate-500">
                Record objective evidence, conclusion and
                execution result against the selected audit
                control.
              </p>
            </div>

            {selectedRow ? (
              <div className="p-5">
                <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Control
                  </div>

                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {text(
                      selectedRow.action
                        ?.control_title ||
                        selectedRow.action?.title,
                      "Control definition unavailable",
                    )}
                  </div>

                  {selectedRow.action?.description ? (
                    <div className="mt-2 text-xs leading-5 text-slate-600">
                      {selectedRow.action.description}
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedRow.action?.standard_code ? (
                      <Badge>
                        {
                          selectedRow.action
                            .standard_code
                        }
                      </Badge>
                    ) : null}

                    {selectedRow.action?.clause_code ? (
                      <Badge>
                        {
                          selectedRow.action
                            .clause_code
                        }
                      </Badge>
                    ) : null}

                    {selectedRow.action
                      ?.requirement_code ? (
                      <Badge>
                        {
                          selectedRow.action
                            .requirement_code
                        }
                      </Badge>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <div>
                    <label
                      htmlFor="execution-result"
                      className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400"
                    >
                      Result
                    </label>

                    <select
                      id="execution-result"
                      value={result}
                      onChange={(event) =>
                        setResult(event.target.value)
                      }
                      className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-slate-400"
                    >
                      <option value="">
                        Select result
                      </option>
                      <option value="CONFORMITY">
                        Conformity
                      </option>
                      <option value="PARTIAL_CONFORMITY">
                        Partial conformity
                      </option>
                      <option value="NON_CONFORMITY">
                        Non-conformity
                      </option>
                      <option value="MAJOR_NON_CONFORMITY">
                        Major non-conformity
                      </option>
                      <option value="OBSERVATION">
                        Observation
                      </option>
                      <option value="EFFECTIVE">
                        Effective
                      </option>
                      <option value="INEFFECTIVE">
                        Ineffective
                      </option>
                    </select>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      Current Status
                    </div>

                    <div className="mt-2">
                      <Badge
                        className={statusClasses(
                          selectedRow.record
                            ?.status,
                        )}
                      >
                        {statusLabel(
                          selectedRow.record
                            ?.status,
                        )}
                      </Badge>
                    </div>

                    {selectedRow.record
                      ?.completed_at ? (
                      <div className="mt-2 text-xs text-slate-500">
                        Completed{" "}
                        {formatDateTime(
                          selectedRow.record
                            .completed_at,
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5">
                  <label
                    htmlFor="execution-notes"
                    className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400"
                  >
                    Execution Notes
                  </label>

                  <textarea
                    id="execution-notes"
                    value={notes}
                    onChange={(event) =>
                      setNotes(event.target.value)
                    }
                    rows={6}
                    placeholder="Record the evidence reviewed, testing performed and relevant observations."
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-slate-400"
                  />
                </div>

                <div className="mt-5">
                  <label
                    htmlFor="execution-conclusion"
                    className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400"
                  >
                    Conclusion
                  </label>

                  <textarea
                    id="execution-conclusion"
                    value={conclusion}
                    onChange={(event) =>
                      setConclusion(event.target.value)
                    }
                    rows={4}
                    placeholder="Document the auditor conclusion for this control."
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-slate-400"
                  />
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
                  <div className="text-xs text-slate-500">
                    {selectedRow.record
                      ?.updated_at
                      ? `Last updated ${formatDateTime(
                          selectedRow.record
                            .updated_at,
                        )}`
                      : "No execution update recorded yet."}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void saveExecution()
                    }
                    disabled={saving}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? (
                      <RefreshCw
                        size={14}
                        className="animate-spin"
                      />
                    ) : (
                      <CheckCircle2 size={14} />
                    )}
                    Save Execution
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[360px] items-center justify-center p-8 text-center">
                <div>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                    <ClipboardCheck size={21} />
                  </div>

                  <div className="mt-4 text-sm font-semibold text-slate-800">
                    Select a control from the execution
                    queue
                  </div>

                  <div className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">
                    The selected control will open here
                    with its risk context, execution state
                    and finding linkage.
                  </div>
                </div>
              </div>
            )}
          </section>

          <aside className="space-y-5">
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Execution Posture
                </div>

                <div className="mt-1 text-sm font-bold text-slate-950">
                  Current Audit Signal
                </div>
              </div>

              <div className="space-y-4 p-5">
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      Completion
                    </span>

                    <span className="font-semibold text-slate-900">
                      {queue.length
                        ? Math.round(
                            (completedCount /
                              queue.length) *
                              100,
                          )
                        : 0}
                      %
                    </span>
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-slate-950"
                      style={{
                        width: `${
                          queue.length
                            ? Math.min(
                                100,
                                Math.round(
                                  (completedCount /
                                    queue.length) *
                                    100,
                                ),
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Critical
                    </div>

                    <div className="mt-1 text-lg font-bold text-slate-950">
                      {
                        queue.filter(
                          (item) =>
                            item.priority ===
                            "CRITICAL",
                        ).length
                      }
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      High
                    </div>

                    <div className="mt-1 text-lg font-bold text-slate-950">
                      {
                        queue.filter(
                          (item) =>
                            item.priority === "HIGH",
                        ).length
                      }
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Selected Control
                </div>

                <div className="mt-1 text-base font-bold text-slate-950">
                  {text(
                    selectedRow?.action?.control_code,
                    "Select a control",
                  )}
                </div>
              </div>

              {selectedRow ? (
                <div className="space-y-5 p-5">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      Risk Context
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <Badge
                        className={priorityClasses(
                          selectedRow.priority,
                        )}
                      >
                        {selectedRow.priority}
                      </Badge>

                      <Badge
                        className={resultClasses(
                          selectedRow.record
                            ?.result,
                        )}
                      >
                        {text(
                          selectedRow.record?.result,
                          "NOT RECORDED",
                        )}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      Findings
                    </div>

                    <div className="mt-2 flex items-end justify-between">
                      <div>
                        <div className="text-2xl font-bold text-slate-950">
                          {selectedRow.findings.length}
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          linked findings
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          openFindings(
                            selectedRow.controlId,
                          )
                        }
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-950"
                      >
                        View findings
                        <ExternalLink size={12} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      Execution Timeline
                    </div>

                    <div className="mt-3 space-y-3">
                      <div className="flex gap-3">
                        <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-950" />

                        <div>
                          <div className="text-xs font-semibold text-slate-800">
                            Record created
                          </div>

                          <div className="mt-1 text-[10px] text-slate-400">
                            {formatDateTime(
                              selectedRow.record
                                ?.created_at,
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-300" />

                        <div>
                          <div className="text-xs font-semibold text-slate-800">
                            Last update
                          </div>

                          <div className="mt-1 text-[10px] text-slate-400">
                            {formatDateTime(
                              selectedRow.record
                                ?.updated_at,
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-300" />

                        <div>
                          <div className="text-xs font-semibold text-slate-800">
                            Completion
                          </div>

                          <div className="mt-1 text-[10px] text-slate-400">
                            {formatDateTime(
                              selectedRow.record
                                ?.completed_at,
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      openFindings(
                        selectedRow.controlId,
                      )
                    }
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <FileSearch size={14} />
                    Open Finding Context
                  </button>
                </div>
              ) : (
                <div className="p-5 text-xs leading-5 text-slate-500">
                  Select a control to inspect its execution
                  state, risk signal and linked finding
                  pressure.
                </div>
              )}
            </section>

            {selectedPlan ? (
              <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Audit Context
                  </div>

                  <div className="mt-1 text-sm font-bold text-slate-950">
                    {text(
                      selectedPlan.reference,
                      `PLAN-${selectedPlan.id}`,
                    )}
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                      Objective
                    </div>

                    <div className="mt-1 text-xs leading-5 text-slate-600">
                      {text(
                        selectedPlan.objective,
                        "No objective recorded.",
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                      Planned Window
                    </div>

                    <div className="mt-1 text-xs font-medium text-slate-700">
                      {formatDate(
                        selectedPlan.planned_start_date,
                      )}{" "}
                      -{" "}
                      {formatDate(
                        selectedPlan.planned_end_date,
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                      Scope
                    </div>

                    <div className="mt-1 text-xs leading-5 text-slate-600">
                      {text(
                        selectedPlan.scope,
                        "No scope description recorded.",
                      )}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
