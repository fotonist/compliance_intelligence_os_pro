"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/app/lib/api";
import {
  CheckCircle2,
  Clock3,
  AlertTriangle,
  ListTodo,
  RefreshCw,
  Plus,
  ChevronRight,
} from "lucide-react";

type TaskStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "UNDER_REVIEW"
  | "BLOCKED"
  | "DONE"
  | string;

type ComplianceTask = {
  id: number;
  tenant_id?: number | null;
  process_id?: number | null;
  control_id?: number | null;
  priority_score?: number | null;
  owner_role?: string | null;
  due_date?: string | null;
  title?: string | null;
  description?: string | null;
  status?: TaskStatus | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ComplianceTaskListResponse = {
  total: number;
  tasks: ComplianceTask[];
};

function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeStatus(status?: string | null): TaskStatus {
  if (!status) return "OPEN";
  return String(status).toUpperCase();
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString("tr-TR");
}

function isOverdue(task: ComplianceTask): boolean {
  const status = normalizeStatus(task.status);
  if (status === "DONE") return false;
  if (!task.due_date) return false;

  const due = new Date(task.due_date);
  if (Number.isNaN(due.getTime())) return false;

  const now = new Date();
  due.setHours(23, 59, 59, 999);
  return due.getTime() < now.getTime();
}

function getPriorityLabel(score: number): string {
  if (score >= 25) return "Critical";
  if (score >= 15) return "High";
  if (score >= 8) return "Medium";
  return "Low";
}

function statusBadgeClass(status: TaskStatus): string {
  switch (normalizeStatus(status)) {
    case "DONE":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "IN_PROGRESS":
      return "bg-cyan-500/15 text-cyan-300 border-cyan-500/30";
    case "UNDER_REVIEW":
      return "bg-violet-500/15 text-violet-300 border-violet-500/30";
    case "BLOCKED":
      return "bg-red-500/15 text-red-300 border-red-500/30";
    case "OPEN":
    default:
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
  }
}

function priorityBadgeClass(score: number): string {
  if (score >= 25) return "bg-red-500/15 text-red-300 border-red-500/30";
  if (score >= 15) return "bg-orange-500/15 text-orange-300 border-orange-500/30";
  if (score >= 8) return "bg-yellow-500/15 text-yellow-300 border-yellow-500/30";
  return "bg-slate-500/15 text-slate-300 border-slate-500/30";
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-slate-400">
          {label}
        </div>
        <div className="text-slate-400">{icon}</div>
      </div>
      <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
    </div>
  );
}

export default function CompanyTasksPage() {
  const router = useRouter();

  const [data, setData] = useState<ComplianceTaskListResponse>({
    total: 0,
    tasks: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [processIdFilter, setProcessIdFilter] = useState<string>("ALL");
  const [error, setError] = useState<string | null>(null);

  async function loadTasks(showRefresh = false) {
    try {
      setError(null);

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const processQuery =
        processIdFilter !== "ALL"
          ? `?process_id=${encodeURIComponent(processIdFilter)}`
          : "";

      const res = await apiFetch(`/company/tasks/my${processQuery}`);

      if (!res.ok) {
        console.error("TASK LIST FAILED", res.status);
        throw new Error(`Task load failed ${res.status}`);
      }

      const json = (await res.json()) as ComplianceTaskListResponse;

      setData({
        total: safeNumber(json?.total),
        tasks: Array.isArray(json?.tasks) ? json.tasks : [],
      });
    } catch (err) {
      console.error(err);
      setError("Tasks yüklenemedi.");
      setData({ total: 0, tasks: [] });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processIdFilter]);

  const processOptions = useMemo(() => {
    const ids = Array.from(
      new Set(
        data.tasks
          .map((t) => t.process_id)
          .filter((v): v is number => typeof v === "number")
      )
    ).sort((a, b) => a - b);

    return ids;
  }, [data.tasks]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();

    return data.tasks.filter((task) => {
      const taskStatus = normalizeStatus(task.status);

      if (statusFilter !== "ALL" && taskStatus !== statusFilter) {
        return false;
      }

      if (!q) return true;

      const haystack = [
        task.title ?? "",
        task.description ?? "",
        task.owner_role ?? "",
        task.control_id != null ? String(task.control_id) : "",
        task.process_id != null ? String(task.process_id) : "",
        task.id != null ? String(task.id) : "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [data.tasks, search, statusFilter]);

  const metrics = useMemo(() => {
    const open = filteredTasks.filter(
      (t) => normalizeStatus(t.status) === "OPEN"
    ).length;

    const inProgress = filteredTasks.filter(
      (t) => normalizeStatus(t.status) === "IN_PROGRESS"
    ).length;

    const blocked = filteredTasks.filter(
      (t) => normalizeStatus(t.status) === "BLOCKED"
    ).length;

    const done = filteredTasks.filter(
      (t) => normalizeStatus(t.status) === "DONE"
    ).length;

    const overdue = filteredTasks.filter((t) => isOverdue(t)).length;

    return { open, inProgress, blocked, done, overdue };
  }, [filteredTasks]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Tasks</h1>
          <p className="mt-1 text-sm text-slate-400">
            GAP, control ve remediation tasklarını buradan takip et.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => loadTasks(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            onClick={() => router.push("/company/tasks/create")}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
          >
            <Plus className="h-4 w-4" />
            New Task
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Open"
          value={metrics.open}
          icon={<ListTodo className="h-5 w-5" />}
        />
        <MetricCard
          label="In Progress"
          value={metrics.inProgress}
          icon={<Clock3 className="h-5 w-5" />}
        />
        <MetricCard
          label="Blocked"
          value={metrics.blocked}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <MetricCard
          label="Done"
          value={metrics.done}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <MetricCard
          label="Overdue"
          value={metrics.overdue}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="mb-2 block text-xs uppercase tracking-wide text-slate-400">
              Search
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Task title, description, owner role, id..."
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-wide text-slate-400">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
            >
              <option value="ALL">All</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="BLOCKED">Blocked</option>
              <option value="DONE">Done</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-wide text-slate-400">
              Process
            </label>
            <select
              value={processIdFilter}
              onChange={(e) => setProcessIdFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
            >
              <option value="ALL">All</option>
              {processOptions.map((id) => (
                <option key={id} value={String(id)}>
                  Process #{id}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="text-sm font-medium text-white">
            Task List
          </div>
          <div className="text-xs text-slate-400">
            Showing {filteredTasks.length} / {data.total}
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-slate-400">Loading tasks...</div>
        ) : error ? (
          <div className="p-6 text-sm text-red-400">{error}</div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            Task bulunamadı.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filteredTasks.map((task) => {
              const score = safeNumber(task.priority_score);
              const status = normalizeStatus(task.status);
              const overdue = isOverdue(task);

              return (
                <button
                  key={task.id}
                  onClick={() => router.push(`/company/tasks/${task.id}`)}
                  className="w-full px-4 py-4 text-left hover:bg-slate-800/60"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-sm font-semibold text-white">
                          {task.title || `Task #${task.id}`}
                        </div>

                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusBadgeClass(
                            status
                          )}`}
                        >
                          {status}
                        </span>

                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${priorityBadgeClass(
                            score
                          )}`}
                        >
                          {getPriorityLabel(score)} · {score.toFixed(2)}
                        </span>

                        {overdue && (
                          <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/15 px-2.5 py-1 text-[11px] font-medium text-red-300">
                            OVERDUE
                          </span>
                        )}
                      </div>

                      <div className="mt-2 line-clamp-2 text-sm text-slate-400">
                        {task.description || "No description"}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
                        <span>Task ID: {task.id}</span>
                        <span>Process: {task.process_id ?? "—"}</span>
                        <span>Control: {task.control_id ?? "—"}</span>
                        <span>Owner Role: {task.owner_role ?? "—"}</span>
                        <span>Due: {formatDate(task.due_date)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-cyan-400">
                      <span className="text-xs font-medium">{status}</span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}