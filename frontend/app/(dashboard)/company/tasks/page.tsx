"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/app/lib/api";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock3,
  Filter,
  ListChecks,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";

/* =========================================================
   TYPES
========================================================= */

type TaskStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "UNDER_REVIEW"
  | "READY_TO_CLOSE"
  | "BLOCKED"
  | "DONE"
  | "CANCELLED"
  | string;

type TaskType =
  | "REMEDIATION"
  | "CORRECTIVE_ACTION"
  | "EVIDENCE_COLLECTION"
  | "RISK_TREATMENT"
  | "COMPLIANCE_ACTION"
  | "REVIEW"
  | string;

type ComplianceTask = {
  id: number;
  tenant_id?: number | null;
  process_id?: number | null;
  control_id?: number | null;
  task_type?: TaskType | null;
  priority_score?: number | null;
  owner_role?: string | null;
  assignee_user_id?: number | null;
  created_by_user_id?: number | null;
  due_date?: string | null;
  title?: string | null;
  description?: string | null;
  status?: TaskStatus | null;
  source_type?: string | null;
  source_id?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ComplianceTaskListResponse = {
  total: number;
  tasks: ComplianceTask[];
};

/* =========================================================
   HELPERS
========================================================= */

function normalizeStatus(status?: string | null): TaskStatus {
  return String(status || "OPEN").trim().toUpperCase();
}

function normalizeType(type?: string | null): string {
  return String(type || "COMPLIANCE_ACTION").trim().toUpperCase();
}

function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatDate(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isOverdue(task: ComplianceTask): boolean {
  const status = normalizeStatus(task.status);

  if (status === "DONE" || status === "CANCELLED") {
    return false;
  }

  if (!task.due_date) {
    return false;
  }

  const due = new Date(task.due_date);

  if (Number.isNaN(due.getTime())) {
    return false;
  }

  due.setHours(23, 59, 59, 999);

  return due.getTime() < Date.now();
}

function priorityLabel(score?: number | null): string {
  const value = safeNumber(score);

  if (value >= 25) return "Critical";
  if (value >= 15) return "High";
  if (value >= 8) return "Medium";

  return "Low";
}

function priorityClass(score?: number | null): string {
  const value = safeNumber(score);

  if (value >= 25) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (value >= 15) {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  if (value >= 8) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function statusLabel(status?: string | null): string {
  switch (normalizeStatus(status)) {
    case "IN_PROGRESS":
      return "In Progress";
    case "UNDER_REVIEW":
      return "Under Review";
    case "READY_TO_CLOSE":
      return "Ready to Close";
    case "BLOCKED":
      return "Blocked";
    case "DONE":
      return "Done";
    case "CANCELLED":
      return "Cancelled";
    case "OPEN":
    default:
      return "Open";
  }
}

function statusClass(status?: string | null): string {
  switch (normalizeStatus(status)) {
    case "DONE":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "READY_TO_CLOSE":
      return "border-cyan-200 bg-cyan-50 text-cyan-700";

    case "UNDER_REVIEW":
      return "border-violet-200 bg-violet-50 text-violet-700";

    case "IN_PROGRESS":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "BLOCKED":
      return "border-red-200 bg-red-50 text-red-700";

    case "CANCELLED":
      return "border-slate-200 bg-slate-100 text-slate-500";

    case "OPEN":
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

function typeLabel(type?: string | null): string {
  switch (normalizeType(type)) {
    case "EVIDENCE_COLLECTION":
      return "Evidence Collection";
    case "CORRECTIVE_ACTION":
      return "Corrective Action";
    case "RISK_TREATMENT":
      return "Risk Treatment";
    case "COMPLIANCE_ACTION":
      return "Compliance Action";
    case "REMEDIATION":
      return "Remediation";
    case "REVIEW":
      return "Review";
    default:
      return normalizeType(type)
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}

/* =========================================================
   METRIC CARD
========================================================= */

function MetricCard({
  label,
  value,
  description,
  icon,
  active,
}: {
  label: string;
  value: number;
  description: string;
  icon: React.ReactNode;
  active?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-white px-4 py-4 shadow-sm ${
        active
          ? "border-cyan-200 ring-1 ring-cyan-100"
          : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            {label}
          </div>

          <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {value}
          </div>

          <div className="mt-1 text-xs text-slate-400">
            {description}
          </div>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          {icon}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function TasksPage() {
  const router = useRouter();

  const [tasks, setTasks] = useState<ComplianceTask[]>([]);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [processFilter, setProcessFilter] = useState("ALL");

  /* =========================================================
     LOAD TASKS
  ========================================================= */

  async function loadTasks(showRefresh = false) {
    try {
      setError("");

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const res = await apiFetch("/company/tasks");

      const json = (await res.json()) as ComplianceTaskListResponse;

      setTasks(Array.isArray(json?.tasks) ? json.tasks : []);
      setTotal(safeNumber(json?.total));
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load tasks."
      );

      setTasks([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, []);

  /* =========================================================
     FILTER OPTIONS
  ========================================================= */

  const processOptions = useMemo(() => {
    return Array.from(
      new Set(
        tasks
          .map((task) => task.process_id)
          .filter(
            (value): value is number =>
              typeof value === "number"
          )
      )
    ).sort((a, b) => a - b);
  }, [tasks]);

  const typeOptions = useMemo(() => {
    return Array.from(
      new Set(tasks.map((task) => normalizeType(task.task_type)))
    ).sort();
  }, [tasks]);

  /* =========================================================
     FILTERED TASKS
  ========================================================= */

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tasks.filter((task) => {
      const status = normalizeStatus(task.status);
      const type = normalizeType(task.task_type);

      if (
        statusFilter !== "ALL" &&
        status !== statusFilter
      ) {
        return false;
      }

      if (
        typeFilter !== "ALL" &&
        type !== typeFilter
      ) {
        return false;
      }

      if (
        processFilter !== "ALL" &&
        String(task.process_id ?? "") !== processFilter
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        task.id,
        task.title,
        task.description,
        task.owner_role,
        task.process_id,
        task.control_id,
        task.assignee_user_id,
        task.source_type,
        task.source_id,
        task.task_type,
      ]
        .map((value) => String(value ?? ""))
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [
    tasks,
    search,
    statusFilter,
    typeFilter,
    processFilter,
  ]);

  /* =========================================================
     METRICS
  ========================================================= */

  const metrics = useMemo(() => {
    return {
      open: tasks.filter(
        (task) => normalizeStatus(task.status) === "OPEN"
      ).length,

      inProgress: tasks.filter(
        (task) =>
          normalizeStatus(task.status) === "IN_PROGRESS"
      ).length,

      review: tasks.filter(
        (task) =>
          normalizeStatus(task.status) === "UNDER_REVIEW"
      ).length,

      blocked: tasks.filter(
        (task) =>
          normalizeStatus(task.status) === "BLOCKED"
      ).length,

      readyToClose: tasks.filter(
        (task) =>
          normalizeStatus(task.status) === "READY_TO_CLOSE"
      ).length,

      done: tasks.filter(
        (task) => normalizeStatus(task.status) === "DONE"
      ).length,

      overdue: tasks.filter((task) => isOverdue(task)).length,
    };
  }, [tasks]);

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="min-h-full bg-slate-50">

      {/* =====================================================
          PAGE HEADER
      ===================================================== */}

      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1700px] px-6 py-5 lg:px-8">

          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700">
                <ListChecks className="h-4 w-4" />
                Compliance Operations
              </div>

              <div className="mt-2 flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                  Task Management
                </h1>

                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
                  {total} total
                </span>
              </div>

              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Manage compliance actions, remediation activities,
                evidence collection and review workflows.
              </p>
            </div>

            <div className="flex items-center gap-2">

              <button
                type="button"
                onClick={() => loadTasks(true)}
                disabled={refreshing}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    refreshing ? "animate-spin" : ""
                  }`}
                />
                Refresh
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push("/company/tasks/create")
                }
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                New Task
              </button>

            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1700px] space-y-6 px-6 py-6 lg:px-8">

        {/* ===================================================
            ERROR
        =================================================== */}

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">
                Task data could not be loaded
              </div>
              <div className="mt-0.5 text-red-600">
                {error}
              </div>
            </div>
          </div>
        )}

        {/* ===================================================
            OPERATIONAL METRICS
        =================================================== */}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Operational Overview
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Current task workload and workflow health.
              </p>
            </div>

            <div className="hidden items-center gap-1.5 text-xs text-slate-400 md:flex">
              <CircleDashed className="h-3.5 w-3.5" />
              Live task scope
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">

            <MetricCard
              label="Open"
              value={metrics.open}
              description="Awaiting action"
              icon={<CircleDashed className="h-4.5 w-4.5" />}
              active={statusFilter === "OPEN"}
            />

            <MetricCard
              label="In Progress"
              value={metrics.inProgress}
              description="Active execution"
              icon={<Clock3 className="h-4.5 w-4.5" />}
              active={statusFilter === "IN_PROGRESS"}
            />

            <MetricCard
              label="Review"
              value={metrics.review}
              description="Under review"
              icon={<SlidersHorizontal className="h-4.5 w-4.5" />}
              active={statusFilter === "UNDER_REVIEW"}
            />

            <MetricCard
              label="Blocked"
              value={metrics.blocked}
              description="Needs attention"
              icon={<AlertTriangle className="h-4.5 w-4.5" />}
              active={statusFilter === "BLOCKED"}
            />

            <MetricCard
              label="Ready"
              value={metrics.readyToClose}
              description="Ready to close"
              icon={<CheckCircle2 className="h-4.5 w-4.5" />}
              active={statusFilter === "READY_TO_CLOSE"}
            />

            <MetricCard
              label="Done"
              value={metrics.done}
              description="Completed"
              icon={<CheckCircle2 className="h-4.5 w-4.5" />}
              active={statusFilter === "DONE"}
            />

            <MetricCard
              label="Overdue"
              value={metrics.overdue}
              description="Past due date"
              icon={<AlertTriangle className="h-4.5 w-4.5" />}
              active={false}
            />

          </div>
        </section>

        {/* ===================================================
            FILTER BAR
        =================================================== */}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">

            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <Filter className="h-4 w-4" />
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Task Explorer
                </div>
                <div className="text-xs text-slate-500">
                  Filter the current authorized task scope.
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-400">
              Showing{" "}
              <span className="font-semibold text-slate-600">
                {filteredTasks.length}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-600">
                {tasks.length}
              </span>
            </div>

          </div>

          <div className="grid grid-cols-1 gap-3 bg-slate-50/60 p-4 lg:grid-cols-2 xl:grid-cols-4">

            {/* SEARCH */}

            <div className="xl:col-span-2">
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                Search
              </label>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search task, description, ID, process, control, owner..."
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
              </div>
            </div>

            {/* STATUS */}

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                Status
              </label>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              >
                <option value="ALL">All statuses</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="READY_TO_CLOSE">Ready to Close</option>
                <option value="BLOCKED">Blocked</option>
                <option value="DONE">Done</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            {/* TYPE */}

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                Task Type
              </label>

              <select
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(event.target.value)
                }
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              >
                <option value="ALL">All task types</option>

                {typeOptions.map((type) => (
                  <option key={type} value={type}>
                    {typeLabel(type)}
                  </option>
                ))}
              </select>
            </div>

            {/* PROCESS */}

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                Process
              </label>

              <select
                value={processFilter}
                onChange={(event) =>
                  setProcessFilter(event.target.value)
                }
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              >
                <option value="ALL">All processes</option>

                {processOptions.map((processId) => (
                  <option
                    key={processId}
                    value={String(processId)}
                  >
                    Process #{processId}
                  </option>
                ))}
              </select>
            </div>

            {/* RESET */}

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("ALL");
                  setTypeFilter("ALL");
                  setProcessFilter("ALL");
                }}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Clear Filters
              </button>
            </div>

          </div>
        </section>

        {/* ===================================================
            TASK TABLE
        =================================================== */}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Task Register
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Compliance actions within your authorized scope.
              </p>
            </div>

            <div className="hidden items-center gap-2 text-xs text-slate-400 sm:flex">
              <UserRound className="h-3.5 w-3.5" />
              Assignee-aware workflow
            </div>
          </div>

          {loading ? (
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="animate-pulse px-5 py-5"
                >
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-5 space-y-2">
                      <div className="h-4 w-2/3 rounded bg-slate-200" />
                      <div className="h-3 w-1/2 rounded bg-slate-100" />
                    </div>

                    <div className="col-span-2 h-6 rounded bg-slate-100" />
                    <div className="col-span-2 h-6 rounded bg-slate-100" />
                    <div className="col-span-1 h-6 rounded bg-slate-100" />
                    <div className="col-span-2 h-6 rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="px-6 py-16 text-center">

              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400">
                <ListChecks className="h-5 w-5" />
              </div>

              <div className="mt-4 text-sm font-semibold text-slate-900">
                No tasks found
              </div>

              <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                There are no tasks matching the current filters
                within your authorized scope.
              </p>

              {(search ||
                statusFilter !== "ALL" ||
                typeFilter !== "ALL" ||
                processFilter !== "ALL") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("ALL");
                    setTypeFilter("ALL");
                    setProcessFilter("ALL");
                  }}
                  className="mt-4 text-sm font-medium text-cyan-700 hover:text-cyan-800"
                >
                  Clear filters
                </button>
              )}

            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full min-w-[1050px]">

                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70">

                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Task
                    </th>

                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Type
                    </th>

                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Process / Control
                    </th>

                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Owner / Assignee
                    </th>

                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Priority
                    </th>

                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Due
                    </th>

                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Status
                    </th>

                    <th className="w-10 px-3 py-3" />

                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">

                  {filteredTasks.map((task) => {
                    const overdue = isOverdue(task);

                    return (
                      <tr
                        key={task.id}
                        onClick={() =>
                          router.push(
                            `/company/tasks/${task.id}`
                          )
                        }
                        className="group cursor-pointer transition hover:bg-slate-50"
                      >

                        {/* TASK */}

                        <td className="px-5 py-4">

                          <div className="flex items-start gap-3">

                            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm">
                              <ListChecks className="h-4 w-4" />
                            </div>

                            <div className="min-w-0">

                              <div className="flex items-center gap-2">

                                <div className="max-w-[360px] truncate text-sm font-semibold text-slate-900 group-hover:text-cyan-700">
                                  {task.title ||
                                    "Untitled Compliance Task"}
                                </div>

                                <span className="shrink-0 text-[10px] font-medium text-slate-400">
                                  #{task.id}
                                </span>

                              </div>

                              <div className="mt-1 max-w-[390px] truncate text-xs text-slate-500">
                                {task.description ||
                                  "No task description provided."}
                              </div>

                            </div>
                          </div>

                        </td>

                        {/* TYPE */}

                        <td className="px-4 py-4">

                          <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600">
                            {typeLabel(task.task_type)}
                          </span>

                        </td>

                        {/* PROCESS / CONTROL */}

                        <td className="px-4 py-4">

                          <div className="space-y-1">

                            <div className="text-xs font-medium text-slate-700">
                              {task.process_id != null
                                ? `Process #${task.process_id}`
                                : "Process —"}
                            </div>

                            <div className="text-xs text-slate-400">
                              {task.control_id != null
                                ? `Control #${task.control_id}`
                                : "Control —"}
                            </div>

                          </div>

                        </td>

                        {/* OWNER / ASSIGNEE */}

                        <td className="px-4 py-4">

                          <div className="space-y-1">

                            <div className="text-xs font-medium text-slate-700">
                              {task.owner_role || "No owner role"}
                            </div>

                            <div className="flex items-center gap-1 text-xs text-slate-400">
                              <UserRound className="h-3 w-3" />

                              {task.assignee_user_id != null
                                ? `User #${task.assignee_user_id}`
                                : "Unassigned"}
                            </div>

                          </div>

                        </td>

                        {/* PRIORITY */}

                        <td className="px-4 py-4">

                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-semibold ${priorityClass(
                              task.priority_score
                            )}`}
                          >
                            {priorityLabel(
                              task.priority_score
                            )}
                          </span>

                        </td>

                        {/* DUE */}

                        <td className="px-4 py-4">

                          <div
                            className={`text-xs font-medium ${
                              overdue
                                ? "text-red-600"
                                : "text-slate-600"
                            }`}
                          >
                            {formatDate(task.due_date)}
                          </div>

                          {overdue && (
                            <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-red-500">
                              <AlertTriangle className="h-3 w-3" />
                              Overdue
                            </div>
                          )}

                        </td>

                        {/* STATUS */}

                        <td className="px-4 py-4">

                          <span
                            className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-semibold ${statusClass(
                              task.status
                            )}`}
                          >
                            {statusLabel(task.status)}
                          </span>

                        </td>

                        {/* OPEN */}

                        <td className="px-3 py-4 text-right">

                          <div className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition group-hover:bg-cyan-50 group-hover:text-cyan-600">
                            <ChevronRight className="h-4 w-4" />
                          </div>

                        </td>

                      </tr>
                    );
                  })}

                </tbody>

              </table>

            </div>
          )}

          {/* =================================================
              TABLE FOOTER
          ================================================= */}

          {!loading && filteredTasks.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/50 px-5 py-3 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">

              <div>
                Showing{" "}
                <span className="font-medium text-slate-600">
                  {filteredTasks.length}
                </span>{" "}
                task
                {filteredTasks.length === 1 ? "" : "s"}
              </div>

              <div className="flex items-center gap-4">
                <span>
                  Authorized scope
                </span>

                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  Workflow controlled
                </span>
              </div>

            </div>
          )}

        </section>

        {/* ===================================================
            OPERATIONAL NOTE
        =================================================== */}

        {!loading && tasks.length > 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">

            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-700">
                Task workspace
              </div>

              <div className="mt-0.5 text-xs leading-5 text-slate-500">
                Open a task to manage its workflow, evidence
                requirements, evidence files and completion gates.
              </div>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
