"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import {
    CheckCircleIcon,
    ClockIcon,
    ExclamationCircleIcon,
    MagnifyingGlassIcon,
    FunnelIcon,
    ArrowDownTrayIcon,
    EyeIcon,
    ClipboardDocumentCheckIcon,
    ClipboardDocumentListIcon,
} from "@heroicons/react/24/outline";

interface Props {
    workspace: any;
}

type StatusFilter =
    | "ALL"
    | "OPEN"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "OVERDUE";

type PriorityFilter =
    | "ALL"
    | "LOW"
    | "MEDIUM"
    | "HIGH"
    | "CRITICAL";

const statusColor = (status: string) => {

    const value = (status ?? "").toUpperCase();

    switch (value) {

        case "OPEN":
    return "bg-red-500/10 text-red-400 border border-red-500/30";

        case "IN_PROGRESS":
    return "bg-amber-500/10 text-amber-400 border border-amber-500/30";

        case "COMPLETED":
    return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30";

        case "OVERDUE":
    return "bg-red-500/10 text-red-400 border border-red-500/30";

       default:
    return "bg-slate-800 text-slate-300 border border-slate-700";

    }

};

const priorityColor = (score: number) => {

    if (score >= 90)
        return "bg-red-500/10 text-red-400 border border-red-500/30";

    if (score >= 70)
        return "bg-orange-500/10 text-orange-400 border border-orange-500/30";

    if (score >= 40)
        return "bg-amber-500/10 text-amber-400 border border-amber-500/30";

    return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30";

};

function KPI({
    title,
    value,
    icon,
    color,
}: {
    title: string;
    value: number | string;
    icon: React.ReactNode;
    color: string;
}) {

    return (

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-lg shadow-black/20">

            <div className="flex items-center justify-between">

                <div>

                    <p className="text-xs uppercase tracking-wider text-slate-500">

                        {title}

                    </p>

                    <h3 className="mt-2 text-3xl font-bold text-white">

                        {value}

                    </h3>

                </div>

                <div
                    className={clsx(
                        "rounded-xl p-3",
                        color
                    )}
                >
                    {icon}
                </div>

            </div>

        </div>

    );

}

export default function WorkspaceTasks({
    workspace,
}: Props) {

    const tasks = workspace?.tasks ?? [];

    const summary = workspace?.task_summary ?? {};

    const [search, setSearch] = useState("");

    const [statusFilter, setStatusFilter] =
        useState<StatusFilter>("ALL");

    const [priorityFilter, setPriorityFilter] =
        useState<PriorityFilter>("ALL");

    const filtered = useMemo(() => {

        return tasks.filter((task: any) => {

            const keyword =
                search.toLowerCase();

            const matchesSearch =

                (task.title ?? "")
                    .toLowerCase()
                    .includes(keyword)

                ||

                (task.description ?? "")
                    .toLowerCase()
                    .includes(keyword);

            const status =
                (task.status ?? "").toUpperCase();

            const matchesStatus =

                statusFilter === "ALL"

                    ? true

                    : status === statusFilter;

            let priority = "LOW";

            if (task.priority_score >= 90)
                priority = "CRITICAL";
            else if (task.priority_score >= 70)
                priority = "HIGH";
            else if (task.priority_score >= 40)
                priority = "MEDIUM";

            const matchesPriority =

                priorityFilter === "ALL"

                    ? true

                    : priority === priorityFilter;

            return (

                matchesSearch &&
                matchesStatus &&
                matchesPriority

            );

        });

    }, [
        tasks,
        search,
        statusFilter,
        priorityFilter,
    ]);

    return (

        <div className="space-y-6">

            {/* KPI */}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

                <KPI
                    title="Total Tasks"
                    value={summary.total ?? 0}
                    color="bg-slate-800 text-slate-300"
                    icon={
                        <ClipboardDocumentListIcon className="h-7 w-7" />
                    }
                />

                <KPI
                    title="Open"
                    value={summary.open ?? 0}
                    color="bg-red-500/10 border border-red-500/20"
                    icon={
                        <ExclamationCircleIcon className="h-7 w-7 text-red-400" />
                    }
                />

                <KPI
                    title="Completed"
					value={summary.completed ?? 0}
                    color="bg-emerald-500/10 border border-emerald-500/20"
                    icon={
                        <CheckCircleIcon className="h-7 w-7 text-emerald-400" />
                    }
                />

                <KPI
                    title="Overdue"
                    value={summary.overdue ?? 0}
                    color="bg-amber-500/10 border border-amber-500/20"
                    icon={
                        <ClockIcon className="h-7 w-7 text-amber-400" />
                    }
                />

            </div>

            {/* Toolbar */}

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-lg">

                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

                    <div className="relative w-full xl:max-w-md">

                        <MagnifyingGlassIcon
                            className="absolute left-3 top-3 h-5 w-5 text-slate-400"
                        />

                        <input
                            value={search}
                            onChange={(e) =>
                                setSearch(e.target.value)
                            }
                            placeholder="Search tasks..."
                            className="w-full rounded-lg border border-slate-700 bg-slate-900 text-slate-200 placeholder:text-slate-500 py-2 pl-10 pr-4 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                        />

                    </div>

                    <div className="flex flex-wrap gap-3">

                        <select
                            value={statusFilter}
                            onChange={(e) =>
                                setStatusFilter(
                                    e.target.value as StatusFilter
                                )
                            }
                            className="rounded-lg border border-slate-700 bg-slate-950 text-slate-200 px-3 py-2 outline-none focus:border-cyan-500"
                        >

                            <option value="ALL">All Status</option>
                            <option value="OPEN">Open</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="OVERDUE">Overdue</option>

                        </select>

                        <select
                            value={priorityFilter}
                            onChange={(e) =>
                                setPriorityFilter(
                                    e.target.value as PriorityFilter
                                )
                            }
                            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200 outline-none focus:border-cyan-500 "
                        >

                            <option value="ALL">All Priority</option>
                            <option value="CRITICAL">Critical</option>
                            <option value="HIGH">High</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="LOW">Low</option>

                        </select>

                        <button className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-slate-300 transition hover:bg-slate-800 hover:text-white">

                            <FunnelIcon className="h-5 w-5"/>

                            Advanced

                        </button>

                        <button className="flex items-center gap-2 rounded-lg border border-slate-700  bg-slate-900 px-4 py-2 text-slate-300  hover:bg-slate-800 hover:text-white transition">

                            <ArrowDownTrayIcon className="h-5 w-5"/>

                            Export

                        </button>

                    </div>

                </div>

            </div>

            {/* Tasks Table */}

            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-lg">

                <div className="overflow-x-auto">

                    <table className="min-w-full divide-y divide-slate-800">

                        <thead className="bg-slate-800/70">

                            <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-400">

                                <th className="px-6 py-4">
                                    Task
                                </th>

                                <th className="px-6 py-4">
                                    Priority
                                </th>

                                <th className="px-6 py-4">
                                    Status
                                </th>

                                <th className="px-6 py-4">
                                    Owner Role
                                </th>

                                <th className="px-6 py-4">
                                    Source
                                </th>

                                <th className="px-6 py-4">
                                    Due Date
                                </th>

                                <th className="px-6 py-4 text-right">
                                    Actions
                                </th>

                            </tr>

                        </thead>

                        <tbody className="divide-y divide-slate-800 bg-slate-950">
						                            {filtered.length === 0 ? (

                                <tr>

                                    <td
                                        colSpan={7}
                                        className="py-16 text-center text-slate-500"
                                    >

                                        No tasks found.

                                    </td>

                                </tr>

                            ) : (

                                filtered.map((task: any) => (

                                    <tr
                                        key={task.id}
                                        className="transition hover:bg-slate-900"
                                    >

                                        <td className="px-6 py-5">

                                            <div className="font-semibold text-white">

                                                {task.title}

                                            </div>

                                            <div className="mt-1 max-w-lg text-sm text-slate-400 line-clamp-2">

                                                {task.description || "-"}

                                            </div>

                                        </td>

                                        <td className="px-6 py-5">

                                            <div className="flex items-center gap-3">

                                                <span
                                                    className={clsx(
                                                        "rounded-full px-3 py-1 text-xs font-semibold",
                                                        priorityColor(
                                                            task.priority_score
                                                        )
                                                    )}
                                                >

                                                    {task.priority_score}

                                                </span>

                                                <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-800">

                                                    <div
                                                        className={clsx(
                                                            "h-full rounded-full",
                                                            task.priority_score >= 90
                                                                ? "bg-red-500"
                                                                : task.priority_score >= 70
                                                                  ? "bg-orange-500"
                                                                  : task.priority_score >= 40
                                                                    ? "bg-amber-500"
                                                                    : "bg-emerald-500"
                                                        )}
                                                        style={{
                                                            width: `${Math.min(
                                                                task.priority_score,
                                                                100
                                                            )}%`,
                                                        }}
                                                    />

                                                </div>

                                            </div>

                                        </td>

                                        <td className="px-6 py-5">

                                            <span
                                                className={clsx(
                                                    "rounded-full px-3 py-1 text-xs font-semibold",
                                                    statusColor(task.status)
                                                )}
                                            >

                                                {task.status}

                                            </span>

                                        </td>

                                        <td className="px-6 py-5">

                                            <span className="rounded-lg bg-slate-800 border border-slate-700  px-3 py-1 text-slate-200 text-lg">

                                                {task.owner_role || "-"}

                                            </span>

                                        </td>

                                        <td className="px-6 py-5">

                                            <div className="space-y-1">

                                                <div className="font-medium text-slate-300">

                                                    {task.source_type}

                                                </div>

                                                <div className="text-xs text-slate-500">

                                                    #{task.source_id}

                                                </div>

                                            </div>

                                        </td>

                                        <td className="px-6 py-5">

                                            <div className="text-sm text-slate-300">

                                                {task.due_date || "-"}

                                            </div>

                                            <div className="mt-1 text-xs text-slate-500">

                                                Created:

                                                {" "}

                                                {task.created_at}

                                            </div>

                                        </td>

                                        <td className="px-6 py-5">

                                            <div className="flex justify-end gap-2">

                                                <button
                                                    className="rounded-lg border border-slate-700 bg-slate-900 text-slate-300 transition p-2 hover:bg-slate-900"
                                                    title="View"
                                                >

                                                    <EyeIcon className="h-5 w-5"/>

                                                </button>

                                                <button
                                                    className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white"
                                                    title="Complete"
                                                >

                                                    <ClipboardDocumentCheckIcon className="h-5 w-5 text-emerald-400"/>

                                                </button>

                                            </div>

                                        </td>

                                    </tr>

                                ))

                            )}

                        </tbody>

                    </table>

                </div>

            </div>

            {/* Summary */}

            <div className="grid gap-6 lg:grid-cols-3">

                <div className="rounded-xl border border-slate-800  bg-slate-900 p-6 shadow-lg">

                    <h3 className="mb-5 text-lg font-semibold text-white">

                        Task Summary

                    </h3>

                    <div className="space-y-4">

                        <div className="flex items-center justify-between">

                            <span>Total Tasks</span>

                            <strong>

                                {summary.total ?? 0}

                            </strong>

                        </div>

                        <div className="flex items-center justify-between">

                            <span>Open</span>

                            <strong className="text-red-400">

                                {summary.open ?? 0}

                            </strong>

                        </div>

                        <div className="flex items-center justify-between">

                            <span>Completed</span>

                            <strong className="text-emerald-400">

                                {summary.completed ?? 0}

                            </strong>

                        </div>

                        <div className="flex items-center justify-between">

                            <span>Overdue</span>

                            <strong className="text-amber-400">

                                {summary.overdue ?? 0}

                            </strong>

                        </div>

                    </div>

                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-lg lg:col-span-2">

                    <h3 className="mb-5 text-lg font-semibold">

                        Task Status Overview

                    </h3>

                    <div className="space-y-6">
					                        <div className="grid gap-6 md:grid-cols-2">

                            <div>

                                <div className="mb-2 flex items-center justify-between text-sm">

                                    <span className="text-slate-400">
                                        Completion Rate
                                    </span>

                                    <strong>

                                        {summary.total
                                            ? Math.round(
                                                  ((summary.completed ?? 0) /
                                                      summary.total) *
                                                      100
                                              )
                                            : 0}
                                        %

                                    </strong>

                                </div>

                                <div className="h-3 overflow-hidden rounded-full bg-slate-800">

                                    <div
                                        className="h-full rounded-full bg-emerald-500 transition-all"
                                        style={{
                                            width: `${
                                                summary.total
                                                    ? Math.round(
                                                          ((summary.completed ??
                                                              0) /
                                                              summary.total) *
                                                              100
                                                      )
                                                    : 0
                                            }%`,
                                        }}
                                    />

                                </div>

                            </div>

                            <div>

                                <div className="mb-2 flex items-center justify-between text-sm">

                                    <span className="text-slate-600">
                                        Open Tasks
                                    </span>

                                    <strong>

                                        {summary.open ?? 0}

                                    </strong>

                                </div>

                                <div className="h-3 overflow-hidden rounded-full bg-slate-800">

                                    <div
                                        className="h-full rounded-full bg-red-500 transition-all"
                                        style={{
                                            width: `${
                                                summary.total
                                                    ? Math.round(
                                                          ((summary.open ?? 0) /
                                                              summary.total) *
                                                              100
                                                      )
                                                    : 0
                                            }%`,
                                        }}
                                    />

                                </div>

                            </div>

                        </div>

                        <div className="mt-8 grid gap-4 md:grid-cols-4">

                            <div className="rounded-xl bg-slate-950 border border-slate-800 p-5">

                                <div className="text-xs uppercase tracking-wider text-slate-500">

                                    Total

                                </div>

                                <div className="mt-2 text-3xl font-bold">

                                    {summary.total ?? 0}

                                </div>

                            </div>

                            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-5">

                                <div className="text-xs uppercase tracking-wider text-red-400">

                                    Open

                                </div>

                                <div className="mt-2 text-3xl font-bold text-red-400">

                                    {summary.open ?? 0}

                                </div>

                            </div>

                            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-5">

                                <div className="text-xs uppercase tracking-wider text-emerald-400">

                                    Completed

                                </div>

                                <div className="mt-2 text-3xl font-bold text-emerald-400">

                                    {summary.completed ?? 0}

                                </div>

                            </div>

                            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-5">

                                <div className="text-xs uppercase tracking-wider text-amber-400">

                                    Overdue

                                </div>

                                <div className="mt-2 text-3xl font-bold text-amber-400">

                                    {summary.overdue ?? 0}

                                </div>

                            </div>

                        </div>

                    </div>

                </div>

            </div>

        </div>

    );

}