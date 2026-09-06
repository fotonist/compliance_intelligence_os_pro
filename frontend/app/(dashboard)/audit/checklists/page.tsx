
'use client';

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileSearch,
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
  Target,
  XCircle,
} from "lucide-react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import { apiFetch } from "@/app/lib/api";

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

type ProcessRow = {
  id: number;
  code?: string | null;
  name?: string | null;
};

type AuditRiskItem = {
  id: number;
  title?: string | null;
  description?: string | null;
  score?: number | null;
  risk_level?: string | null;
};

type Action = {
  control_id: number;
  control_code?: string | null;
  control_title?: string | null;
  control_description?: string | null;
  standard_code?: string | null;
  clause_code?: string | null;
  requirement_code?: string | null;
  requirement_title?: string | null;
  requirement_description?: string | null;
  status?: string | null;
  risk_count?: number | null;
  risks?: AuditRiskItem[];
  highest_risk_level?: string | null;
  max_risk_score?: number | null;
  ai_priority_score?: number | null;
  suggested_owner_role?: string | null;
};

type ExecutionRecord = {
  id: number;
  audit_plan_id?: number | null;
  control_id: number;
  status?: string | null;
  result?: string | null;
  notes?: string | null;
  conclusion?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type Finding = {
  id: number;
  execution_id?: number | null;
  control_id?: number | null;
  status?: string | null;
  severity?: string | null;
  title?: string | null;
};

type ChecklistRow = {
  control_id: number;
  control_code: string;
  control_title: string;
  control_description: string;
  standard_code: string;
  clause_code: string;
  requirement_code: string;
  requirement_title: string;
  requirement_description: string;
  risks: AuditRiskItem[];
  risk_count: number;
  priority: number;
  risk_level: string;
  risk_score: number | null;
  execution: ExecutionRecord | null;
  findingCount: number;
  openFindingCount: number;
};

function normalizeArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

async function readError(response: Response): Promise<string> {
  try {
    const payload = await response.json();

    return (
      payload?.detail ||
      payload?.message ||
      "Request failed."
    );
  } catch {
    return "Request failed.";
  }
}

function formatStatus(value?: string | null): string {
  if (!value) return "-";

  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function riskRank(value?: string | null): number {
  const rank: Record<string, number> = {
    CRITICAL: 5,
    HIGH: 4,
    MEDIUM: 3,
    LOW: 2,
    VERY_LOW: 1,
    UNASSESSED: 0,
  };

  return (
    rank[
      String(value || "UNASSESSED").toUpperCase()
    ] ?? 0
  );
}

function riskClass(value?: string | null): string {
  const level = String(
    value || "UNASSESSED",
  ).toUpperCase();

  if (level === "CRITICAL") {
    return "border-rose-300 bg-rose-50 text-rose-700";
  }

  if (level === "HIGH") {
    return "border-orange-300 bg-orange-50 text-orange-700";
  }

  if (level === "MEDIUM") {
    return "border-amber-300 bg-amber-50 text-amber-700";
  }

  if (level === "LOW") {
    return "border-emerald-300 bg-emerald-50 text-emerald-700";
  }

  if (level === "VERY_LOW") {
    return "border-sky-300 bg-sky-50 text-sky-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-500";
}

const statusClass: Record<string, string> = {
  READY:
    "border-slate-300 bg-slate-50 text-slate-600",
  IN_PROGRESS:
    "border-blue-300 bg-blue-50 text-blue-700",
  COMPLETED:
    "border-emerald-300 bg-emerald-50 text-emerald-700",
  EXCEPTION:
    "border-rose-300 bg-rose-50 text-rose-700",
  DRAFT:
    "border-slate-300 bg-slate-50 text-slate-600",
};

function MetricCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: ReactNode;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <div className="border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
          {label}
        </div>
        <div className="text-slate-400">
          {icon}
        </div>
      </div>

      <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
        {value}
      </div>

      <div className="mt-1 text-xs text-slate-500">
        {helper}
      </div>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          {eyebrow}
        </div>

        <div className="mt-1 text-lg font-semibold text-slate-950">
          {title}
        </div>

        <div className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
          {description}
        </div>
      </div>

      {action ? (
        <div className="shrink-0">
          {action}
        </div>
      ) : null}
    </div>
  );
}

function AuditChecklistsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const requestedPlanId = Number(
    searchParams.get("plan_id") || 0,
  );

  const requestedControlId = Number(
    searchParams.get("control_id") || 0,
  );

  const [plans, setPlans] =
    useState<AuditPlan[]>([]);

  const [processes, setProcesses] =
    useState<ProcessRow[]>([]);

  const [selectedPlanId, setSelectedPlanId] =
    useState<number | null>(
      requestedPlanId || null,
    );

  const [actions, setActions] =
    useState<Action[]>([]);

  const [execution, setExecution] =
    useState<ExecutionRecord[]>([]);

  const [findings, setFindings] =
    useState<Finding[]>([]);

  const [selectedControlId, setSelectedControlId] =
    useState<number | null>(
      requestedControlId || null,
    );

  const [expandedControls, setExpandedControls] =
    useState<Set<number>>(
      () => new Set<number>(),
    );

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("ALL");
  const [riskFilter, setRiskFilter] =
    useState("ALL");

  const [loading, setLoading] =
    useState(true);

  const [loadingScope, setLoadingScope] =
    useState(false);

  const [error, setError] =
    useState("");

  const [scopeError, setScopeError] =
    useState("");

  async function loadPlans(): Promise<AuditPlan[]> {
    const response = await apiFetch(
      "/audit/plans",
      { method: "GET" },
    );

    if (!response.ok) {
      throw new Error(
        await readError(response),
      );
    }

    const rows = normalizeArray(
      await response.json(),
    ) as AuditPlan[];

    setPlans(rows);

    return rows;
  }

  async function loadProcesses() {
    try {
      const response = await apiFetch(
        "/company/processes",
        { method: "GET" },
      );

      if (!response.ok) {
        setProcesses([]);
        return;
      }

      setProcesses(
        normalizeArray(
          await response.json(),
        ) as ProcessRow[],
      );
    } catch {
      setProcesses([]);
    }
  }

  async function loadChecklistData(
    plan: AuditPlan,
  ) {
    setLoadingScope(true);
    setScopeError("");

    try {
      const [
        executionResult,
        findingsResult,
      ] = await Promise.allSettled([
        apiFetch(
          `/audit/execution?plan_id=${plan.id}`,
          { method: "GET" },
        ),
        apiFetch(
          `/audit/findings?plan_id=${plan.id}`,
          { method: "GET" },
        ),
      ]);

      const executionRows: ExecutionRecord[] =
        [];

      const findingRows: Finding[] = [];

      if (
        executionResult.status ===
          "fulfilled" &&
        executionResult.value.ok
      ) {
        executionRows.push(
          ...(normalizeArray(
            await executionResult.value.json(),
          ) as ExecutionRecord[]),
        );
      } else {
        setScopeError(
          "Execution records could not be loaded.",
        );
      }

      if (
        findingsResult.status ===
          "fulfilled" &&
        findingsResult.value.ok
      ) {
        findingRows.push(
          ...(normalizeArray(
            await findingsResult.value.json(),
          ) as Finding[]),
        );
      }

      setExecution(executionRows);
      setFindings(findingRows);

      if (!plan.process_id) {
        setActions([]);
        setScopeError(
          "This audit plan has no process scope.",
        );
        return;
      }

      const response = await apiFetch(
        `/company/coverage/processes/${plan.process_id}/audit-plan`,
        { method: "GET" },
      );

      if (!response.ok) {
        throw new Error(
          await readError(response),
        );
      }

      const generated =
        await response.json();

      setActions(
        normalizeArray(
          generated?.actions,
        ) as Action[],
      );
    } catch (loadError: any) {
      setActions([]);
      setScopeError(
        loadError?.message ||
          "The current audit scope could not be loaded.",
      );
    } finally {
      setLoadingScope(false);
    }
  }

  async function loadAll() {
    setLoading(true);
    setError("");

    try {
      const [loadedPlans] =
        await Promise.all([
          loadPlans(),
          loadProcesses(),
        ]);

      const planId =
        requestedPlanId &&
        loadedPlans.some(
          (item) =>
            item.id === requestedPlanId,
        )
          ? requestedPlanId
          : selectedPlanId &&
              loadedPlans.some(
                (item) =>
                  item.id === selectedPlanId,
              )
            ? selectedPlanId
            : loadedPlans[0]?.id || null;

      setSelectedPlanId(planId);

      if (planId) {
        const plan =
          loadedPlans.find(
            (item) => item.id === planId,
          );

        if (plan) {
          await loadChecklistData(plan);
        }
      } else {
        setActions([]);
        setExecution([]);
        setFindings([]);
      }
    } catch (loadError: any) {
      setError(
        loadError?.message ||
          "Failed to load audit checklist data.",
      );

      setPlans([]);
      setProcesses([]);
      setActions([]);
      setExecution([]);
      setFindings([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!selectedPlanId) return;

    const plan = plans.find(
      (item) =>
        item.id === selectedPlanId,
    );

    if (!plan) return;

    loadChecklistData(plan);
  }, [selectedPlanId]);

  const selectedPlan = useMemo(
    () =>
      plans.find(
        (item) =>
          item.id === selectedPlanId,
      ) || null,
    [plans, selectedPlanId],
  );

  const process = useMemo(
    () =>
      processes.find(
        (item) =>
          item.id ===
          selectedPlan?.process_id,
      ) || null,
    [processes, selectedPlan?.process_id],
  );

  const checklistRows =
    useMemo<ChecklistRow[]>(() => {
      const executionByControl =
        new Map<
          number,
          ExecutionRecord
        >();

      execution.forEach((record) => {
        if (record.control_id == null) {
          return;
        }

        executionByControl.set(
          Number(record.control_id),
          record,
        );
      });

      const findingByControl =
        new Map<
          number,
          Finding[]
        >();

      findings.forEach((finding) => {
        if (finding.control_id == null) {
          return;
        }

        const controlId = Number(
          finding.control_id,
        );

        const current =
          findingByControl.get(
            controlId,
          ) || [];

        current.push(finding);

        findingByControl.set(
          controlId,
          current,
        );
      });

      const rows: ChecklistRow[] =
        actions.map((item) => {
          const controlId = Number(
            item.control_id,
          );

          const risks =
            Array.isArray(item.risks)
              ? item.risks
              : [];

          const linkedFindings =
            findingByControl.get(
              controlId,
            ) || [];

          return {
            control_id: controlId,
            control_code:
              item.control_code ||
              `CONTROL-${controlId}`,
            control_title:
              item.control_title || "",
            control_description:
              item.control_description ||
              "",
            standard_code:
              item.standard_code || "-",
            clause_code:
              item.clause_code || "-",
            requirement_code:
              item.requirement_code ||
              "-",
            requirement_title:
              item.requirement_title ||
              "",
            requirement_description:
              item.requirement_description ||
              "",
            risks,
            risk_count:
              item.risk_count == null
                ? risks.length
                : Number(item.risk_count),
            priority:
              Number(
                item.ai_priority_score || 0,
              ),
            risk_level:
              String(
                item.highest_risk_level ||
                  "UNASSESSED",
              ),
            risk_score:
              item.max_risk_score == null
                ? null
                : Number(
                    item.max_risk_score,
                  ),
            execution:
              executionByControl.get(
                controlId,
              ) || null,
            findingCount:
              linkedFindings.length,
            openFindingCount:
              linkedFindings.filter(
                (finding) =>
                  String(
                    finding.status || "",
                  ).toUpperCase() !==
                  "CLOSED",
              ).length,
          };
        });

      execution.forEach((record) => {
        const controlId = Number(
          record.control_id,
        );

        if (
          rows.some(
            (row) =>
              row.control_id ===
              controlId,
          )
        ) {
          return;
        }

        const linkedFindings =
          findingByControl.get(
            controlId,
          ) || [];

        rows.push({
          control_id: controlId,
          control_code:
            `CONTROL-${controlId}`,
          control_title: "",
          control_description: "",
          standard_code: "-",
          clause_code: "-",
          requirement_code: "-",
          requirement_title: "",
          requirement_description: "",
          risks: [],
          risk_count: 0,
          priority: 0,
          risk_level: "UNASSESSED",
          risk_score: null,
          execution: record,
          findingCount:
            linkedFindings.length,
          openFindingCount:
            linkedFindings.filter(
              (finding) =>
                String(
                  finding.status || "",
                ).toUpperCase() !==
                "CLOSED",
            ).length,
        });
      });

      return rows.sort((a, b) => {
        const risk =
          riskRank(b.risk_level) -
          riskRank(a.risk_level);

        if (risk !== 0) {
          return risk;
        }

        return b.priority - a.priority;
      });
    }, [
      actions,
      execution,
      findings,
    ]);

  const filteredRows =
    useMemo(() => {
      const search =
        query.trim().toLowerCase();

      return checklistRows.filter(
        (row) => {
          const executionStatus =
            String(
              row.execution?.status ||
                "READY",
            ).toUpperCase();

          const searchMatch =
            !search ||
            [
              row.control_code,
              row.control_title,
              row.control_description,
              row.standard_code,
              row.clause_code,
              row.requirement_code,
              row.requirement_title,
              row.requirement_description,
              row.risk_level,
              ...row.risks.map(
                (risk) =>
                  risk.title || "",
              ),
              ...row.risks.map(
                (risk) =>
                  risk.description || "",
              ),
            ]
              .join(" ")
              .toLowerCase()
              .includes(search);

          const statusMatch =
            statusFilter === "ALL" ||
            executionStatus ===
              statusFilter;

          const riskMatch =
            riskFilter === "ALL" ||
            String(
              row.risk_level,
            ).toUpperCase() ===
              riskFilter;

          return (
            searchMatch &&
            statusMatch &&
            riskMatch
          );
        },
      );
    }, [
      checklistRows,
      query,
      statusFilter,
      riskFilter,
    ]);

  const metrics = useMemo(() => {
    const total =
      checklistRows.length;

    const completed =
      checklistRows.filter(
        (row) =>
          String(
            row.execution?.status || "",
          ).toUpperCase() ===
          "COMPLETED",
      ).length;

    const inProgress =
      checklistRows.filter(
        (row) =>
          String(
            row.execution?.status || "",
          ).toUpperCase() ===
          "IN_PROGRESS",
      ).length;

    const exceptions =
      checklistRows.filter(
        (row) =>
          String(
            row.execution?.status || "",
          ).toUpperCase() ===
          "EXCEPTION",
      ).length;

    const openFindings =
      checklistRows.reduce(
        (sum, row) =>
          sum + row.openFindingCount,
        0,
      );

    return {
      total,
      completed,
      inProgress,
      exceptions,
      openFindings,
      completion: total
        ? Math.round(
            (completed / total) *
              100,
          )
        : 0,
    };
  }, [checklistRows]);

  const selectedRow = useMemo(
    () =>
      checklistRows.find(
        (item) =>
          item.control_id ===
          selectedControlId,
      ) || null,
    [
      checklistRows,
      selectedControlId,
    ],
  );

  function toggleExpanded(
    controlId: number,
  ) {
    setExpandedControls((current) => {
      const next = new Set(
        current,
      );

      if (next.has(controlId)) {
        next.delete(controlId);
      } else {
        next.add(controlId);
      }

      return next;
    });
  }

  function openExecution(
    controlId?: number | null,
  ) {
    if (!selectedPlanId) return;

    const params =
      new URLSearchParams();

    params.set(
      "plan_id",
      String(selectedPlanId),
    );

    if (selectedPlan?.process_id) {
      params.set(
        "process_id",
        String(
          selectedPlan.process_id,
        ),
      );
    }

    if (controlId != null) {
      params.set(
        "control_id",
        String(controlId),
      );
    }

    router.push(
      `/audit/execution?${params.toString()}`,
    );
  }

  function openFindings(
    controlId?: number | null,
  ) {
    if (!selectedPlanId) return;

    const params =
      new URLSearchParams();

    params.set(
      "plan_id",
      String(selectedPlanId),
    );

    if (controlId != null) {
      params.set(
        "control_id",
        String(controlId),
      );
    }

    router.push(
      `/audit/findings?${params.toString()}`,
    );
  }

  return (
    <div className="min-h-full bg-slate-50 text-slate-900">
      <div className="space-y-6 p-6 xl:p-8">
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              <ClipboardCheck size={14} />
              Internal Audit
            </div>

            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Audit Checklists
            </h1>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Operational control checklist for the selected audit engagement. The checklist is derived from the current audit scope and persisted execution records.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/audit/planning",
                )
              }
              className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Audit Planning
            </button>

            <button
              type="button"
              onClick={() =>
                openExecution(null)
              }
              disabled={!selectedPlanId}
              className="inline-flex h-10 items-center gap-2 bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileSearch size={15} />
              Open Execution
            </button>

            <button
              type="button"
              onClick={loadAll}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                size={15}
                className={
                  loading
                    ? "animate-spin"
                    : ""
                }
              />
              Refresh
            </button>
          </div>
        </header>

        {error ? (
          <div className="flex items-start gap-3 border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <AlertTriangle
              size={17}
              className="mt-0.5 shrink-0"
            />
            <div>{error}</div>
          </div>
        ) : null}

        <section className="border border-slate-200 bg-white">
          <div className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Audit Engagement
              </div>

              <div className="mt-1 text-lg font-semibold text-slate-950">
                {selectedPlan?.reference ||
                  "No audit plan selected"}
              </div>

              <div className="mt-1 text-sm text-slate-600">
                {selectedPlan?.name ||
                  "Create an audit plan before opening the checklist."}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Plan
              </label>

              <select
                value={
                  selectedPlanId ?? ""
                }
                onChange={(event) => {
                  const id = Number(
                    event.target.value,
                  );

                  setSelectedPlanId(
                    id || null,
                  );

                  setSelectedControlId(
                    null,
                  );

                  setExpandedControls(
                    new Set<number>(),
                  );

                  setQuery("");
                  setStatusFilter(
                    "ALL",
                  );
                  setRiskFilter("ALL");
                }}
                className="h-10 min-w-[300px] border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-500"
              >
                <option value="">
                  Select audit plan
                </option>

                {plans.map((plan) => (
                  <option
                    key={plan.id}
                    value={plan.id}
                  >
                    {plan.reference} -{" "}
                    {plan.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedPlan ? (
            <div className="grid border-t border-slate-200 sm:grid-cols-2 lg:grid-cols-4">
              <div className="border-b border-slate-200 p-4 lg:border-b-0 lg:border-r">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Process
                </div>

                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {process?.code ||
                    "Not scoped"}
                </div>

                <div className="mt-0.5 text-xs text-slate-500">
                  {process?.name ||
                    "Process scope unavailable"}
                </div>
              </div>

              <div className="border-b border-slate-200 p-4 lg:border-b-0 lg:border-r">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Audit Type
                </div>

                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {selectedPlan.audit_type ||
                    "-"}
                </div>
              </div>

              <div className="border-b border-slate-200 p-4 lg:border-b-0 lg:border-r">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Period
                </div>

                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {selectedPlan.planned_start ||
                    "-"}{" "}
                  <span className="font-normal text-slate-400">
                    to
                  </span>{" "}
                  {selectedPlan.planned_end ||
                    "-"}
                </div>
              </div>

              <div className="p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Plan Status
                </div>

                <div className="mt-1">
                  <span
                    className={`inline-flex border px-2.5 py-1 text-xs font-semibold ${
                      statusClass[
                        String(
                          selectedPlan.status ||
                            "",
                        ).toUpperCase()
                      ] ||
                      statusClass.READY
                    }`}
                  >
                    {formatStatus(
                      selectedPlan.status,
                    )}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="Checklist Scope"
            value={metrics.total}
            helper="Controls in the current audit scope"
            icon={<Target size={17} />}
          />

          <MetricCard
            label="Completed"
            value={`${metrics.completed} / ${metrics.total}`}
            helper={`${metrics.completion}% execution completion`}
            icon={
              <CheckCircle2 size={17} />
            }
          />

          <MetricCard
            label="In Progress"
            value={metrics.inProgress}
            helper="Execution records currently active"
            icon={<Clock3 size={17} />}
          />

          <MetricCard
            label="Exceptions"
            value={metrics.exceptions}
            helper="Controls requiring exception handling"
            icon={<XCircle size={17} />}
          />

          <MetricCard
            label="Open Findings"
            value={metrics.openFindings}
            helper="Findings linked to checklist controls"
            icon={
              <ShieldAlert size={17} />
            }
          />
        </section>

        <section className="border border-slate-200 bg-white">
          <SectionHeader
            eyebrow="Checklist Control"
            title="Audit Test Queue"
            description="Review scoped controls, their requirement context, mapped risks, execution state and finding pressure."
            action={
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    value={query}
                    onChange={(event) =>
                      setQuery(
                        event.target.value,
                      )
                    }
                    placeholder="Search controls..."
                    className="h-9 w-56 border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-slate-500"
                  />
                </div>

                <div className="flex items-center gap-1 border border-slate-200 bg-slate-50 px-2">
                  <Filter
                    size={13}
                    className="text-slate-400"
                  />

                  <select
                    value={
                      statusFilter
                    }
                    onChange={(event) =>
                      setStatusFilter(
                        event.target.value,
                      )
                    }
                    className="h-8 bg-transparent text-xs font-medium text-slate-700 outline-none"
                  >
                    <option value="ALL">
                      All status
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

                <select
                  value={riskFilter}
                  onChange={(event) =>
                    setRiskFilter(
                      event.target.value,
                    )
                  }
                  className="h-9 border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 outline-none"
                >
                  <option value="ALL">
                    All risk
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
                  <option value="VERY_LOW">
                    Very low
                  </option>
                  <option value="UNASSESSED">
                    Unassessed
                  </option>
                </select>
              </div>
            }
          />

          {scopeError ? (
            <div className="mx-6 mt-5 flex items-start gap-3 border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              <AlertTriangle
                size={15}
                className="mt-0.5 shrink-0"
              />
              <div>{scopeError}</div>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px]">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="w-12 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    #
                  </th>

                  <th className="w-[300px] px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Control
                  </th>

                  <th className="w-[280px] px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Requirement
                  </th>

                  <th className="w-[330px] px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Risk
                  </th>

                  <th className="w-[100px] px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Priority
                  </th>

                  <th className="w-[130px] px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Execution
                  </th>

                  <th className="w-[100px] px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Findings
                  </th>

                  <th className="w-[110px] px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading || loadingScope ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-16 text-center text-sm text-slate-400"
                    >
                      Loading checklist data...
                    </td>
                  </tr>
                ) : null}

                {!loading &&
                !loadingScope &&
                !filteredRows.length ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-16 text-center"
                    >
                      <div className="mx-auto flex h-10 w-10 items-center justify-center border border-slate-200 bg-slate-50 text-slate-400">
                        <ClipboardCheck
                          size={18}
                        />
                      </div>

                      <div className="mt-3 text-sm font-semibold text-slate-800">
                        No checklist controls available
                      </div>

                      <div className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">
                        The checklist displays only the current audit scope and persisted execution records returned by the backend.
                      </div>

                      {selectedPlan ? (
                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/audit/planning?plan_id=${selectedPlan.id}`,
                            )
                          }
                          className="mt-4 inline-flex h-9 items-center gap-2 border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Review Audit Planning
                          <ArrowRight
                            size={14}
                          />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ) : null}

                {!loading &&
                !loadingScope
                  ? filteredRows.map(
                      (
                        row,
                        index,
                      ) => {
                        const executionStatus =
                          String(
                            row.execution
                              ?.status ||
                              "READY",
                          ).toUpperCase();

                        const expanded =
                          expandedControls.has(
                            row.control_id,
                          );

                        return (
                          <tr
                            key={
                              row.control_id
                            }
                            className="border-b border-slate-100 align-top"
                          >
                            <td className="px-4 py-4 text-xs font-medium text-slate-400">
                              {index + 1}
                            </td>

                            <td
                              className="cursor-pointer px-4 py-4 hover:bg-slate-50"
                              onClick={() =>
                                setSelectedControlId(
                                  row.control_id,
                                )
                              }
                            >
                              <div className="font-mono text-xs font-semibold text-slate-950">
                                {
                                  row.control_code
                                }
                              </div>

                              <div className="mt-1 text-sm font-semibold leading-5 text-slate-900">
                                {row.control_title ||
                                  "Control title unavailable"}
                              </div>

                              <div className="mt-1 text-xs leading-5 text-slate-500">
                                {row.control_description ||
                                  "No control description available."}
                              </div>

                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {row.standard_code !==
                                "-" ? (
                                  <span className="border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[9px] font-medium text-slate-500">
                                    {
                                      row.standard_code
                                    }
                                  </span>
                                ) : null}

                                {row.clause_code !==
                                "-" ? (
                                  <span className="border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[9px] font-medium text-slate-500">
                                    {
                                      row.clause_code
                                    }
                                  </span>
                                ) : null}
                              </div>
                            </td>

                            <td className="px-4 py-4">
                              <div className="font-mono text-[11px] font-semibold text-slate-800">
                                {
                                  row.requirement_code
                                }
                              </div>

                              <div className="mt-1 text-sm font-semibold leading-5 text-slate-900">
                                {row.requirement_title ||
                                  "Requirement title unavailable"}
                              </div>

                              <div className="mt-1 text-xs leading-5 text-slate-500">
                                {row.requirement_description ||
                                  "No requirement description available."}
                              </div>
                            </td>

                            <td className="px-4 py-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <span
                                    className={`inline-flex border px-2 py-1 text-[10px] font-semibold uppercase ${riskClass(row.risk_level)}`}
                                  >
                                    {formatStatus(
                                      row.risk_level,
                                    )}
                                  </span>

                                  <div className="mt-1 text-[10px] text-slate-400">
                                    {
                                      row.risk_count
                                    }{" "}
                                    mapped risk
                                    {row.risk_count ===
                                    1
                                      ? ""
                                      : "s"}
                                  </div>
                                </div>

                                {row.risks.length >
                                0 ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleExpanded(
                                        row.control_id,
                                      )
                                    }
                                    className="inline-flex h-7 items-center gap-1 border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
                                  >
                                    {expanded ? (
                                      <ChevronDown
                                        size={13}
                                      />
                                    ) : (
                                      <ChevronRight
                                        size={13}
                                      />
                                    )}

                                    {expanded
                                      ? "Hide"
                                      : "Details"}
                                  </button>
                                ) : null}
                              </div>

                              {row.risks.length ===
                              0 ? (
                                <div className="mt-3 border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-[10px] text-slate-500">
                                  No mapped risks
                                </div>
                              ) : null}

                              {expanded ? (
                                <div className="mt-3 space-y-2">
                                  {row.risks.map(
                                    (
                                      risk,
                                    ) => (
                                      <div
                                        key={
                                          risk.id
                                        }
                                        className="border border-slate-200 bg-slate-50 p-3"
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <div className="text-xs font-semibold text-slate-900">
                                              {risk.title ||
                                                `Risk ${risk.id}`}
                                            </div>

                                            <div className="mt-1 text-[11px] leading-5 text-slate-500">
                                              {risk.description ||
                                                "No risk description available."}
                                            </div>
                                          </div>

                                          <div className="flex shrink-0 items-center gap-1.5">
                                            <span
                                              className={`border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${riskClass(risk.risk_level)}`}
                                            >
                                              {formatStatus(
                                                risk.risk_level ||
                                                  "UNASSESSED",
                                              )}
                                            </span>

                                            <span className="border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">
                                              Score{" "}
                                              {risk.score ??
                                                "-"}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    ),
                                  )}
                                </div>
                              ) : null}
                            </td>

                            <td className="px-4 py-4">
                              <div className="text-sm font-semibold text-slate-900">
                                {row.priority.toFixed(
                                  0,
                                )}
                              </div>

                              <div className="mt-1 text-[10px] text-slate-400">
                                AI priority
                              </div>
                            </td>

                            <td className="px-4 py-4">
                              <span
                                className={`inline-flex border px-2.5 py-1 text-[10px] font-semibold uppercase ${
                                  statusClass[
                                    executionStatus
                                  ] ||
                                  statusClass.READY
                                }`}
                              >
                                {formatStatus(
                                  executionStatus,
                                )}
                              </span>
                            </td>

                            <td className="px-4 py-4">
                              <button
                                type="button"
                                onClick={() =>
                                  openFindings(
                                    row.control_id,
                                  )
                                }
                                className="text-left hover:underline"
                              >
                                <div className="text-sm font-semibold text-slate-900">
                                  {
                                    row.findingCount
                                  }
                                </div>

                                <div className="mt-1 text-[10px] text-slate-400">
                                  {
                                    row.openFindingCount
                                  }{" "}
                                  open
                                </div>
                              </button>
                            </td>

                            <td className="px-4 py-4 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  openExecution(
                                    row.control_id,
                                  )
                                }
                                className="inline-flex h-8 items-center gap-1.5 border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Test
                                <ArrowRight
                                  size={13}
                                />
                              </button>
                            </td>
                          </tr>
                        );
                      },
                    )
                  : null}
              </tbody>
            </table>
          </div>
        </section>

        {selectedRow ? (
          <section className="border border-slate-200 bg-white">
            <SectionHeader
              eyebrow="Selected Control"
              title={
                selectedRow.control_code
              }
              description={
                selectedRow.control_title ||
                "Selected audit control"
              }
              action={
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      openExecution(
                        selectedRow.control_id,
                      )
                    }
                    className="inline-flex h-9 items-center gap-2 bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    <FileSearch
                      size={14}
                    />
                    Open Execution
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      openFindings(
                        selectedRow.control_id,
                      )
                    }
                    className="inline-flex h-9 items-center gap-2 border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Findings
                  </button>
                </div>
              }
            />

            <div className="grid gap-px bg-slate-200 lg:grid-cols-3">
              <div className="bg-white p-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Control
                </div>

                <div className="mt-2 font-mono text-xs font-semibold text-slate-950">
                  {
                    selectedRow.control_code
                  }
                </div>

                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {
                    selectedRow.control_title
                  }
                </div>

                <div className="mt-2 text-xs leading-5 text-slate-500">
                  {
                    selectedRow.control_description ||
                    "No control description available."
                  }
                </div>
              </div>

              <div className="bg-white p-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Requirement
                </div>

                <div className="mt-2 font-mono text-xs font-semibold text-slate-800">
                  {
                    selectedRow.requirement_code
                  }
                </div>

                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {
                    selectedRow.requirement_title ||
                    "Requirement title unavailable"
                  }
                </div>

                <div className="mt-2 text-xs leading-5 text-slate-500">
                  {
                    selectedRow.requirement_description ||
                    "No requirement description available."
                  }
                </div>
              </div>

              <div className="bg-white p-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Risk Summary
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={`border px-2 py-1 text-[10px] font-semibold uppercase ${riskClass(selectedRow.risk_level)}`}
                  >
                    {formatStatus(
                      selectedRow.risk_level,
                    )}
                  </span>

                  <span className="text-xs font-semibold text-slate-700">
                    {
                      selectedRow.risk_count
                    }{" "}
                    risk
                    {selectedRow.risk_count ===
                    1
                      ? ""
                      : "s"}
                  </span>
                </div>

                <div className="mt-2 text-xs text-slate-500">
                  Max score:{" "}
                  {selectedRow.risk_score ??
                    "-"}
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  AI priority:{" "}
                  {selectedRow.priority.toFixed(
                    0,
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Mapped Risks
                  </div>

                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    Risk Register Context
                  </div>
                </div>

                <div className="text-xs text-slate-500">
                  {
                    selectedRow.risk_count
                  }{" "}
                  mapped
                </div>
              </div>

              {selectedRow.risks.length ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {selectedRow.risks.map(
                    (risk) => (
                      <div
                        key={risk.id}
                        className="border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">
                              {risk.title ||
                                `Risk ${risk.id}`}
                            </div>

                            <div className="mt-2 text-xs leading-5 text-slate-500">
                              {risk.description ||
                                "No risk description available."}
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <span
                              className={`border px-2 py-1 text-[10px] font-semibold uppercase ${riskClass(risk.risk_level)}`}
                            >
                              {formatStatus(
                                risk.risk_level ||
                                  "UNASSESSED",
                              )}
                            </span>

                            <span className="text-[10px] font-semibold text-slate-500">
                              Score{" "}
                              {risk.score ??
                                "-"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <div className="mt-4 border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-xs text-slate-500">
                  No mapped risks
                </div>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

export default function AuditChecklistsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-full bg-slate-50 p-8 text-sm text-slate-400">
          Loading audit checklist...
        </div>
      }
    >
      <AuditChecklistsContent />
    </Suspense>
  );
}
