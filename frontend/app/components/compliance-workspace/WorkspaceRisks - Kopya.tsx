"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import {
    ExclamationTriangleIcon,
    ShieldExclamationIcon,
    ShieldCheckIcon,
    MagnifyingGlassIcon,
    FunnelIcon,
    ArrowDownTrayIcon,
    EyeIcon,
    FireIcon,
    CheckCircleIcon,
    ClockIcon,
} from "@heroicons/react/24/outline";

interface Props {
    workspace: any;
}

type RiskLevelFilter =
    | "ALL"
    | "CRITICAL"
    | "HIGH"
    | "MEDIUM"
    | "LOW";

type StatusFilter =
    | "ALL"
    | "OPEN"
    | "IN_PROGRESS"
    | "MITIGATED"
    | "CLOSED";

const levelColor = (level: string) => {

    const value = (level ?? "").toUpperCase();

    switch (value) {

        case "CRITICAL":
            return "bg-red-500/10 text-red-400 border border-red-500/30";

        case "HIGH":
           return "bg-orange-500/10 text-orange-400 border border-orange-500/30";

        case "MEDIUM":
            return "bg-amber-500/10 text-amber-400 border border-amber-500/30";

        case "LOW":
            return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30";

        default:
            return "bg-slate-800 text-slate-700 border border-slate-200";
    }

};

const statusColor = (status: string) => {

    const value = (status ?? "").toUpperCase();

    switch (value) {

        case "OPEN":
            return "bg-red-500/10 text-red-400 border border-red-500/30";

        case "IN_PROGRESS":
             return "bg-amber-500/10 text-amber-400 border border-amber-500/30";

        case "MITIGATED":
            return "bg-blue-500/10 text-blue-400 border border-blue-500/30";

        case "CLOSED":
             return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30";

        default:
             return "bg-slate-800 text-slate-300 border border-slate-700";

    }

};

const coverageColor = (status: string) => {

    const value = (status ?? "").toUpperCase();

    switch (value) {

        case "ACHIEVED":
            return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30";

        case "PARTIALLY_ACHIEVED":
             return "bg-amber-500/10 text-amber-400 border border-amber-500/30";

        case "NOT_ACHIEVED":
             return "bg-red-500/10 text-red-400 border border-red-500/30";

        default:
           return "bg-slate-800 text-slate-300 border border-slate-700";

    }

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

        <div className="rounded-xl border border-slate-800 bg-slate-900 text-slate-400 shadow-black/20 p-5 shadow-lg">

            <div className="flex items-center justify-between">

                <div>

                    <p className="text-xs uppercase tracking-widest text-slate-500">

                        {title}

                    </p>

                    <div className="mt-2 text-3xl font-bold text-white">

                        {value}

                    </div>

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

export default function WorkspaceRisks({
    workspace,
}: Props) {

    const risks = workspace?.risks ?? [];

    const summary = workspace?.risk_summary ?? {};

    const [search, setSearch] = useState("");

    const [riskLevel, setRiskLevel] =
        useState<RiskLevelFilter>("ALL");

    const [status, setStatus] =
        useState<StatusFilter>("ALL");

    const filtered = useMemo(() => {

        return risks.filter((risk: any) => {

            const keyword =
                search.toLowerCase();

            const matchesSearch =
                (risk.title ?? "")
                    .toLowerCase()
                    .includes(keyword) ||

                (risk.description ?? "")
                    .toLowerCase()
                    .includes(keyword);

            const matchesLevel =
                riskLevel === "ALL"
                    ? true
                    : (risk.risk_level ?? "")
                          .toUpperCase() === riskLevel;

            const matchesStatus =
                status === "ALL"
                    ? true
                    : (risk.status ?? "")
                          .toUpperCase() === status;

            return (
                matchesSearch &&
                matchesLevel &&
                matchesStatus
            );

        });

    }, [
        risks,
        search,
        riskLevel,
        status,
    ]);

    return (

        <div className="space-y-6">

            {/* KPI */}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">

                <KPI
                    title="Total Risks"
                    value={summary.total ?? 0}
                    color="bg-slate-800 text-slate-300"
                    icon={
                        <ShieldExclamationIcon className="h-7 w-7" />
                    }
                />

                <KPI
                    title="Critical"
                    value={summary.critical ?? 0}
                    color="bg-red-500/10 text-red-400 border border-red-500/20"
                    icon={
                        <FireIcon className="h-7 w-7 text-red-600" />
                    }
                />

                <KPI
                    title="High"
                    value={summary.high ?? 0}
                    color="bg-orange-500/10 text-orange-400 border border-orange-500/20"
                    icon={
                        <ExclamationTriangleIcon className="h-7 w-7 text-orange-600" />
                    }
                />

                <KPI
                    title="Medium"
                    value={summary.medium ?? 0}
                    color="bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    icon={
                        <ClockIcon className="h-7 w-7 text-amber-600" />
                    }
                />

                <KPI
                    title="Low"
                    value={summary.low ?? 0}
                   color="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    icon={
                        <ShieldCheckIcon className="h-7 w-7 text-emerald-600" />
                    }
                />

            </div>

            {/* Toolbar */}

            <div className="rounded-xl border border-slate-800 bg-slate-900 border-slate-700 text-slate-200 place-holder:text-slate-500 shadow-black/20 p-5 shadow-lg">

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
    placeholder="Search risks..."
    className="
        w-full
        rounded-lg
        border
        border-slate-700
        bg-slate-950
        px-4
        py-2
        pl-10
        text-sm
        text-slate-200
        placeholder:text-slate-500
        outline-none
        transition
        focus:border-cyan-500
        focus:ring-1
        focus:ring-cyan-500
    "
/>

                    </div>

                    <div className="flex flex-wrap gap-3">

                        <select
                            value={riskLevel}
                            onChange={(e) =>
                                setRiskLevel(
                                    e.target.value as RiskLevelFilter
                                )
                            }
                            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                        >
                            <option value="ALL">
                                All Levels
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
                            value={status}
                            onChange={(e) =>
                                setStatus(
                                    e.target.value as StatusFilter
                                )
                            }
                            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                        >
                            <option value="ALL">
                                All Status
                            </option>

                            <option value="OPEN">
                                Open
                            </option>

                            <option value="IN_PROGRESS">
                                In Progress
                            </option>

                            <option value="MITIGATED">
                                Mitigated
                            </option>

                            <option value="CLOSED">
                                Closed
                            </option>

                        </select>

                        <button className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 transition hover:bg-slate-800 hover:text-white">

                            <FunnelIcon className="h-5 w-5 text-slate-400"/>

                            Advanced

                        </button>

                        <button className="flex items-center gap-2 rounded-lg border-slate-700 bg-slate-900 px-4 py-2 text-slate-300 text-white hover:bg-slate-800">

                            <ArrowDownTrayIcon className="h-5 w-5" />

                            Export

                        </button>

                    </div>

                </div>

            </div>

            {/* Risk Table */}

            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 border-slate-800 shadow-lg">

                <div className="overflow-x-auto">

                    <table className="min-w-full divide-y divide-slate-800">

                       <thead className="bg-slate-800/70">

                            <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500">

                                <th className="px-6 py-4">
                                    Risk
                                </th>

                                <th className="px-6 py-4">
                                    Level
                                </th>

                                <th className="px-6 py-4">
                                    Score
                                </th>

                                <th className="px-6 py-4">
                                    Impact
                                </th>

                                <th className="px-6 py-4">
                                    Likelihood
                                </th>

                                <th className="px-6 py-4">
                                    Coverage
                                </th>

                                <th className="px-6 py-4">
                                    Status
                                </th>

                                <th className="px-6 py-4">
                                    Treatment
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
                                        colSpan={9}
                                        className="py-16 text-center text-slate-500"
                                    >

                                        No risks found.

                                    </td>

                                </tr>

                            ) : (

                                filtered.map((risk: any) => (

                                    <tr
                                        key={risk.id}
                                        className="transition hover:bg-slate-900"
                                    >

                                        <td className="px-6 py-5">

                                            <div className="font-semibold text-white">

                                                {risk.title}

                                            </div>

                                            <div className="mt-1 max-w-lg text-sm text-slate-400 line-clamp-2">

                                                {risk.description || "-"}

                                            </div>

                                        </td>

                                        <td className="px-6 py-5">

                                            <span
                                                className={clsx(
                                                    "rounded-full px-3 py-1 text-xs font-semibold",
                                                    levelColor(risk.risk_level)
                                                )}
                                            >

                                                {risk.risk_level}

                                            </span>

                                        </td>

                                        <td className="px-6 py-5">

                                            <div className="flex items-center gap-3">

                                                <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-800">

                                                    <div
                                                        className={clsx(
                                                            "h-full rounded-full",
                                                            risk.score >= 17
                                                                ? "bg-red-500"
                                                                : risk.score >= 10
                                                                  ? "bg-orange-500"
                                                                  : risk.score >= 5
                                                                    ? "bg-amber-500"
                                                                    : "bg-emerald-500"
                                                        )}
                                                        style={{
                                                            width: `${Math.min(
                                                                (risk.score / 25) * 100,
                                                                100
                                                            )}%`,
                                                        }}
                                                    />

                                                </div>

                                                <span className="font-semibold">

                                                    {risk.score}

                                                </span>

                                            </div>

                                        </td>

                                        <td className="px-6 py-5">

                                            <span className="rounded-lg bg-slate-800 border border-slate-700  px-3 py-1 text-sm font-semibold text-slate-200">

                                                {risk.impact}

                                            </span>

                                        </td>

                                        <td className="px-6 py-5">

                                            <span className="rounded-lg bg-slate-800 px-3 py-1 text-sm font-semibold">

                                                {risk.likelihood}

                                            </span>

                                        </td>

                                        <td className="px-6 py-5">

                                            <span
                                                className={clsx(
                                                    "rounded-full px-3 py-1 text-xs font-semibold",
                                                    coverageColor(
                                                        risk.coverage_status
                                                    )
                                                )}
                                            >

                                                {risk.coverage_status}

                                            </span>

                                        </td>

                                        <td className="px-6 py-5">

                                            <span
                                                className={clsx(
                                                    "rounded-full px-3 py-1 text-xs font-semibold",
                                                    statusColor(
                                                        risk.status
                                                    )
                                                )}
                                            >

                                                {risk.status}

                                            </span>

                                        </td>

                                        <td className="px-6 py-5">

                                            <div className="max-w-xs text-sm text-slate-400 line-clamp-2">

                                                {risk.treatment || "-"}

                                            </div>

                                        </td>

                                        <td className="px-6 py-5">

                                            <div className="flex justify-end gap-2">

                                                <button
                                                    className="rounded-lg border p-2 transition hover:bg-slate-800 border-slate-700 bg-slate-900"
                                                    title="View"
                                                >

                                                    <EyeIcon className="h-5 w-5" />

                                                </button>

                                                <button
                                                    className="rounded-lg border p-2 transition hover:bg-slate-800 border-slate-700 bg-slate-900"
                                                    title="Approve"
                                                >

                                                    <CheckCircleIcon className="h-5 w-5 text-emerald-600" />

                                                </button>

                                                <button
                                                    className="rounded-lg border p-2 transition hover:bg-slate-800 border-slate-700 bg-slate-900"
                                                    title="Review"
                                                >

                                                    <ClockIcon className="h-5 w-5 text-amber-600" />

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

            {/* Risk Summary */}

            <div className="grid gap-6 lg:grid-cols-3">

                <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-lg">

                    <h3 className="mb-5 text-lg font-semibold">

                        Risk Overview

                    </h3>

                    <div className="space-y-4">

                        <div className="flex items-center justify-between">

                            <span>Total Risks</span>

                            <strong>

                                {summary.total ?? 0}

                            </strong>

                        </div>

                        <div className="flex items-center justify-between">

                            <span>Critical</span>

                            <strong className="text-red-400">

                                {summary.critical ?? 0}

                            </strong>

                        </div>

                        <div className="flex items-center justify-between">

                            <span>High</span>

                            <strong className="text-orange-400">

                                {summary.high ?? 0}

                            </strong>

                        </div>

                        <div className="flex items-center justify-between">

                            <span>Medium</span>

                            <strong className="text-amber-400">

                                {summary.medium ?? 0}

                            </strong>

                        </div>

                        <div className="flex items-center justify-between">

                            <span>Low</span>

                            <strong className="text-emerald-400">

                                {summary.low ?? 0}

                            </strong>

                        </div>

                    </div>

                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-lg lg:col-span-2">

                    <h3 className="mb-5 text-lg font-semibold">

                        Risk Score Distribution

                    </h3>

                    <div className="space-y-6">
					                        <div className="grid gap-6 md:grid-cols-2">

                            <div>

                                <div className="mb-2 flex items-center justify-between text-sm">

                                    <span className="text-slate-400">
                                        Average Risk Score
                                    </span>

                                    <strong>
                                        {summary.average_score ?? 0}
                                    </strong>

                                </div>

                                <div className="h-3 overflow-hidden rounded-full bg-slate-800">

                                    <div
                                        className="h-full rounded-full bg-blue-600 transition-all"
                                        style={{
                                            width: `${Math.min(
                                                ((summary.average_score ?? 0) / 25) * 100,
                                                100
                                            )}%`,
                                        }}
                                    />

                                </div>

                            </div>

                            <div>

                                <div className="mb-2 flex items-center justify-between text-sm">

                                    <span className="text-slate-600">
                                        Total Risk Score
                                    </span>

                                    <strong>
                                        {summary.total_score ?? 0}
                                    </strong>

                                </div>

                                <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">

                                    <div className="text-4xl font-bold text-white">

                                        {summary.total_score ?? 0}

                                    </div>

                                    <p className="mt-2 text-sm text-slate-500">

                                        Sum of all calculated risk scores.

                                    </p>

                                </div>

                            </div>

                        </div>

                        <div className="mt-8 grid gap-4 md:grid-cols-4">

                            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-5">

                                <div className="text-xs uppercase tracking-wider text-red-400">

                                    Critical

                                </div>

                                <div className="mt-2 text-3xl font-bold text-red-400">

                                    {summary.critical ?? 0}

                                </div>

                            </div>

                            <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-5">

                                <div className="text-xs uppercase tracking-wider text-orange-400">

                                    High

                                </div>

                                <div className="mt-2 text-3xl font-bold text-orange-400">

                                    {summary.high ?? 0}

                                </div>

                            </div>

                            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-5">

                                <div className="text-xs uppercase tracking-wider text-amber-400">

                                    Medium

                                </div>

                                <div className="mt-2 text-3xl font-bold text-amber-400">

                                    {summary.medium ?? 0}

                                </div>

                            </div>

                            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-5">

                                <div className="text-xs uppercase tracking-wider text-emerald-400">

                                    Low

                                </div>

                                <div className="mt-2 text-3xl font-bold text-emerald-400">

                                    {summary.low ?? 0}

                                </div>

                            </div>

                        </div>

                    </div>

                </div>

            </div>

        </div>

    );

}