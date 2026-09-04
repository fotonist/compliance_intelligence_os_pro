"use client";

import { useMemo, useState } from "react";
import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  RectangleStackIcon,
} from "@heroicons/react/24/outline";

interface Props {
  workspace: any;
}

function normalize(value: any) {
  return String(value ?? "").trim().toLowerCase();
}

function statusConfig(status: any) {
  const value = normalize(status);

  if (
    value === "completed" ||
    value === "complete" ||
    value === "closed" ||
    value === "done"
  ) {
    return {
      label: "Completed",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700",
      icon: CheckCircleIcon,
    };
  }

  if (
    value === "in_progress" ||
    value === "in-progress" ||
    value === "progress"
  ) {
    return {
      label: "In Progress",
      className:
        "border-blue-200 bg-blue-50 text-blue-700",
      icon: ClockIcon,
    };
  }

  if (
    value === "overdue" ||
    value === "late"
  ) {
    return {
      label: "Overdue",
      className:
        "border-red-200 bg-red-50 text-red-700",
      icon: ExclamationTriangleIcon,
    };
  }

  return {
    label: status || "Open",
    className:
      "border-slate-200 bg-slate-50 text-slate-600",
    icon: RectangleStackIcon,
  };
}

function StatusBadge({ status }: { status: any }) {
  const config = statusConfig(status);
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] ${config.className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}

function Metric({
  label,
  value,
  description,
  tone = "default",
}: {
  label: string;
  value: number;
  description: string;
  tone?: "default" | "danger" | "success";
}) {
  const valueClass =
    tone === "danger"
      ? "text-red-700"
      : tone === "success"
        ? "text-emerald-700"
        : "text-slate-900";

  return (
    <div className="bg-white px-5 py-4">
      <div className="text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-400">
        {label}
      </div>

      <div
        className={`mt-1.5 text-xl font-semibold tracking-tight ${valueClass}`}
      >
        {value}
      </div>

      <div className="mt-0.5 text-[10px] text-slate-500">
        {description}
      </div>
    </div>
  );
}

export default function WorkspaceTasks({
  workspace,
}: Props) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");

  const tasks = Array.isArray(workspace?.tasks)
    ? workspace.tasks
    : [];

  const counts = useMemo(() => {
    const normalized = tasks.map((task: any) =>
      normalize(task.status)
    );

    return {
      total: tasks.length,

      open: normalized.filter(
        (status: string) =>
          status === "open" ||
          status === "new" ||
          status === "todo" ||
          status === ""
      ).length,

      progress: normalized.filter(
        (status: string) =>
          status === "in_progress" ||
          status === "in-progress" ||
          status === "progress"
      ).length,

      overdue: normalized.filter(
        (status: string) =>
          status === "overdue" ||
          status === "late"
      ).length,

      completed: normalized.filter(
        (status: string) =>
          status === "completed" ||
          status === "complete" ||
          status === "closed" ||
          status === "done"
      ).length,
    };
  }, [tasks]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return tasks.filter((task: any) => {
      const status = normalize(task.status);

      const searchable = [
        task.title,
        task.name,
        task.description,
        task.owner,
        task.assignee,
        task.priority,
        task.type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesQuery =
        !q || searchable.includes(q);

      const matchesStatus =
        statusFilter === "all" ||
        status === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [tasks, query, statusFilter]);

  return (
    <div className="space-y-5">

      <section className="border border-slate-200 bg-white">

        <div className="border-b border-slate-200 px-5 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Remediation Management
              </div>

              <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
                Remediation Register
              </h2>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Actions and remediation activities associated
                with the current compliance object.
              </p>
            </div>

            <div className="flex items-center gap-2 border border-slate-200 bg-slate-50 px-3 py-1.5">
              <RectangleStackIcon className="h-3.5 w-3.5 text-slate-500" />

              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                {filtered.length} of {counts.total} actions
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px border-b border-slate-200 bg-slate-200 xl:grid-cols-5">

          <Metric
            label="Total"
            value={counts.total}
            description="Registered actions"
          />

          <Metric
            label="Open"
            value={counts.open}
            description="Awaiting action"
          />

          <Metric
            label="In Progress"
            value={counts.progress}
            description="Currently active"
          />

          <Metric
            label="Overdue"
            value={counts.overdue}
            description="Past target date"
            tone={
              counts.overdue > 0
                ? "danger"
                : "default"
            }
          />

          <Metric
            label="Completed"
            value={counts.completed}
            description="Closed actions"
            tone={
              counts.completed > 0
                ? "success"
                : "default"
            }
          />

        </div>

        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-4 lg:flex-row">

          <div className="relative min-w-0 flex-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={query}
              onChange={(e) =>
                setQuery(e.target.value)
              }
              placeholder="Search remediation actions..."
              className="h-9 w-full border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-400"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value)
            }
            className="h-9 border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-slate-400"
          >
            <option value="all">
              All statuses
            </option>
            <option value="open">
              Open
            </option>
            <option value="in_progress">
              In Progress
            </option>
            <option value="overdue">
              Overdue
            </option>
            <option value="completed">
              Completed
            </option>
          </select>

        </div>

      </section>

      <section className="border border-slate-200 bg-white">

        <div className="hidden grid-cols-[minmax(0,1fr)_120px_150px_120px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 lg:grid">
          <div>Action</div>
          <div>Status</div>
          <div>Owner / Priority</div>
          <div className="text-right">
            Target
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-14 text-center">

            <RectangleStackIcon className="mx-auto h-8 w-8 text-slate-300" />

            <h3 className="mt-3 text-sm font-semibold text-slate-800">
              No remediation actions
            </h3>

            <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">
              No actions match the current search and
              status filters.
            </p>

          </div>
        ) : (
          <div className="divide-y divide-slate-100">

            {filtered.map(
              (task: any, index: number) => {

                const title =
                  task.title ??
                  task.name ??
                  "Untitled action";

                const owner =
                  task.owner ??
                  task.assignee ??
                  "Unassigned";

                const priority =
                  task.priority ??
                  "Normal";

                const target =
                  task.due_date ??
                  task.target_date ??
                  task.deadline ??
                  null;

                return (
                  <div
                    key={
                      task.id ??
                      task.task_id ??
                      index
                    }
                    className="grid gap-4 px-5 py-4 transition hover:bg-slate-50 lg:grid-cols-[minmax(0,1fr)_120px_150px_120px] lg:items-center"
                  >

                    <div className="min-w-0">

                      <div className="flex items-start gap-3">

                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center border border-slate-200 bg-slate-50">
                          <RectangleStackIcon className="h-4 w-4 text-slate-500" />
                        </div>

                        <div className="min-w-0">

                          <div className="truncate text-sm font-medium text-slate-800">
                            {title}
                          </div>

                          {task.description && (
                            <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                              {task.description}
                            </div>
                          )}

                          <div className="mt-2 text-[10px] text-slate-400">
                            Action #{task.id ?? index + 1}
                          </div>

                        </div>

                      </div>

                    </div>

                    <div>
                      <StatusBadge
                        status={task.status}
                      />
                    </div>

                    <div className="min-w-0">

                      <div className="truncate text-xs font-medium text-slate-600">
                        {owner}
                      </div>

                      <div className="mt-1 text-[10px] text-slate-400">
                        Priority: {priority}
                      </div>

                    </div>

                    <div className="text-left lg:text-right">

                      {target ? (
                        <span className="text-xs text-slate-600">
                          {String(target).slice(0, 10)}
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase tracking-[0.06em] text-slate-400">
                          No target
                        </span>
                      )}

                    </div>

                  </div>
                );
              }
            )}

          </div>
        )}

      </section>

    </div>
  );
}
