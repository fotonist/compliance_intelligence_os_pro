"use client";

import {
    useMemo,
    useState,
} from "react";

import clsx from "clsx";

import {
    ArrowDownTrayIcon,
    FunnelIcon,
    MagnifyingGlassIcon,
    ExclamationTriangleIcon,
    ShieldExclamationIcon,
    CheckCircleIcon,
    ClockIcon,
} from "@heroicons/react/24/outline";

interface Props {
    workspace: any;
}

type StatusFilter =
    | "ALL"
    | "OPEN"
    | "MITIGATED"
    | "ACCEPTED"
    | "CLOSED";

const riskColor = (level: string) => {
    const value = level?.toLowerCase() ?? "";

    if (value.includes("critical"))
        return `
        border-red-500/30
        bg-red-500/10
        text-red-400
        `;

    if (value.includes("high"))
        return `
        border-orange-500/30
        bg-orange-500/10
        text-orange-400
        `;

    if (value.includes("medium"))
        return `
        border-yellow-500/30
        bg-yellow-500/10
        text-yellow-400
        `;

    return `
    border-slate-700
    bg-slate-800
    text-slate-300
    `;
};

function KPI({
    title,
    value,
    icon,
}: {
    title: string;
    value: number | string;
    icon: React.ReactNode;
}) {
    return (
        <div
            className="
            rounded-xl
            border
            border-slate-800
            bg-slate-900
            p-5
            shadow-lg
            "
        >
            <div
                className="
                flex
                items-center
                justify-between
                "
            >
                <div>
                    <p
                        className="
                        text-xs
                        uppercase
                        tracking-wider
                        text-slate-500
                        "
                    >
                        {title}
                    </p>

                    <div
                        className="
                        mt-2
                        text-3xl
                        font-bold
                        text-white
                        "
                    >
                        {value}
                    </div>
                </div>

                <div
                    className="
                    rounded-xl
                    bg-slate-800
                    p-3
                    text-cyan-400
                    "
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
    const [status, setStatus] = useState<StatusFilter>("ALL");
    const [advancedOpen, setAdvancedOpen] = useState(false);

    const handleExport = () => {
        const data = JSON.stringify(risks, null, 2);

        const blob = new Blob([data], {
            type: "application/json",
        });

        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = "risk-export.json";
        link.click();

        URL.revokeObjectURL(url);
    };

    const filtered = useMemo(() => {
        return risks.filter((item: any) => {
            const title = item.title?.toLowerCase() ?? "";
            const description = item.description?.toLowerCase() ?? "";
            const keyword = search.toLowerCase();

            const matchesSearch =
                title.includes(keyword) ||
                description.includes(keyword);

            const itemStatus = item.status?.toUpperCase() ?? "";

            const matchesStatus =
                status === "ALL"
                    ? true
                    : itemStatus === status;

            return matchesSearch && matchesStatus;
        });
    }, [risks, search, status]);

    return (
        <div className="space-y-6">
            {/* KPI CARDS */}
            <div
                className="
                grid
                gap-4
                md:grid-cols-2
                xl:grid-cols-4
                "
            >
                <KPI
                    title="Total Risks"
                    value={summary.total ?? 0}
                    icon={
                        <ShieldExclamationIcon className="h-7 w-7" />
                    }
                />

                <KPI
                    title="Critical"
                    value={summary.critical ?? 0}
                    icon={
                        <ExclamationTriangleIcon className="h-7 w-7" />
                    }
                />

                <KPI
                    title="High"
                    value={summary.high ?? 0}
                    icon={
                        <ExclamationTriangleIcon className="h-7 w-7" />
                    }
                />

                <KPI
                    title="Closed"
                    value={summary.closed ?? 0}
                    icon={
                        <CheckCircleIcon className="h-7 w-7" />
                    }
                />
            </div>

            {/* TOOLBAR */}
            <div
                className="
                rounded-xl
                border
                border-slate-800
                bg-slate-900
                p-5
                shadow-lg
                "
            >
                <div
                    className="
                    flex
                    flex-col
                    gap-4
                    lg:flex-row
                    lg:items-center
                    lg:justify-between
                    "
                >
                    <div
                        className="
                        relative
                        w-full
                        lg:max-w-md
                        "
                    >
                        <MagnifyingGlassIcon
                            className="
                            absolute
                            left-3
                            top-3
                            h-5
                            w-5
                            text-slate-400
                            "
                        />

                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search risks..."
                            className="
                            w-full
                            rounded-lg
                            border
                            border-slate-700
                            bg-slate-950
                            py-2
                            pl-10
                            pr-4
                            text-slate-200
                            outline-none
                            focus:border-cyan-500
                            "
                        />
                    </div>

                    <div
                        className="
                        flex
                        flex-wrap
                        gap-3
                        "
                    >
                        <select
                            value={status}
                            onChange={(e) =>
                                setStatus(e.target.value as StatusFilter)
                            }
                            className="
                            rounded-lg
                            border
                            border-slate-700
                            bg-slate-950
                            px-3
                            py-2
                            text-slate-200
                            "
                        >
                            <option value="ALL">All Status</option>
                            <option value="OPEN">Open</option>
                            <option value="MITIGATED">Mitigated</option>
                            <option value="ACCEPTED">Accepted</option>
                            <option value="CLOSED">Closed</option>
                        </select>

                        <button
                            onClick={() => setAdvancedOpen(!advancedOpen)}
                            className="
                            flex
                            items-center
                            gap-2
                            rounded-lg
                            border
                            border-slate-700
                            bg-slate-900
                            px-4
                            py-2
                            text-slate-300
                            hover:bg-slate-800
                            hover:text-white
                            "
                        >
                            <FunnelIcon className="h-5 w-5" />
                            Advanced
                        </button>

                        <button
                            onClick={handleExport}
                            className="
                            flex
                            items-center
                            gap-2
                            rounded-lg
                            border
                            border-slate-700
                            bg-slate-900
                            px-4
                            py-2
                            text-slate-300
                            hover:bg-slate-800
                            "
                        >
                            <ArrowDownTrayIcon className="h-5 w-5" />
                            Export
                        </button>
                    </div>
                </div>

                {advancedOpen && (
                    <div
                        className="
                        mt-5
                        rounded-xl
                        border
                        border-red-500/20
                        bg-slate-950
                        p-5
                        "
                    >
                        <h3
                            className="
                            text-lg
                            font-semibold
                            text-white
                            "
                        >
                            Advanced Risk Intelligence
                        </h3>

                        <div
                            className="
                            mt-4
                            grid
                            gap-4
                            md:grid-cols-4
                            "
                        >
                            <div
                                className="
                                rounded-lg
                                border
                                border-slate-800
                                p-4
                                "
                            >
                                <p className="text-sm text-slate-500">
                                    Critical Exposure
                                </p>
                                <p
                                    className="
                                    mt-2
                                    text-2xl
                                    font-bold
                                    text-red-400
                                    "
                                >
                                    {summary.critical ?? 0}
                                </p>
                            </div>

                            <div
                                className="
                                rounded-lg
                                border
                                border-slate-800
                                p-4
                                "
                            >
                                <p className="text-sm text-slate-500">
                                    Total Risk Score
                                </p>
                                <p
                                    className="
                                    mt-2
                                    text-2xl
                                    font-bold
                                    text-white
                                    "
                                >
                                    {summary.total_score ?? 0}
                                </p>
                            </div>

                            <div
                                className="
                                rounded-lg
                                border
                                border-slate-800
                                p-4
                                "
                            >
                                <p className="text-sm text-slate-500">
                                    High Risks
                                </p>
                                <p
                                    className="
                                    mt-2
                                    text-2xl
                                    font-bold
                                    text-orange-400
                                    "
                                >
                                    {summary.high ?? 0}
                                </p>
                            </div>

                            <div
                                className="
                                rounded-lg
                                border
                                border-slate-800
                                p-4
                                "
                            >
                                <p className="text-sm text-slate-500">
                                    Total Records
                                </p>
                                <p
                                    className="
                                    mt-2
                                    text-2xl
                                    font-bold
                                    text-cyan-400
                                    "
                                >
                                    {summary.total ?? 0}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* RISK TABLE */}
            <div
                className="
                overflow-hidden
                rounded-xl
                border
                border-slate-800
                bg-slate-900
                shadow-lg
                "
            >
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-800">
                        <thead className="bg-slate-800/70">
                            <tr
                                className="
                                text-left
                                text-xs
                                uppercase
                                tracking-wider
                                text-slate-400
                                "
                            >
                                <th className="px-6 py-4">Risk</th>
                                <th className="px-6 py-4">Category</th>
                                <th className="px-6 py-4">Score</th>
                                <th className="px-6 py-4">Level</th>
                                <th className="px-6 py-4">Status</th>
                            </tr>
                        </thead>

                        <tbody
                            className="
                            divide-y
                            divide-slate-800
                            bg-slate-950
                            "
                        >
                            {filtered.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="
                                        py-16
                                        text-center
                                        text-slate-500
                                        "
                                    >
                                        No risk found.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((risk: any) => (
                                    <tr
                                        key={risk.id}
                                        className="hover:bg-slate-800/60"
                                    >
                                        <td className="px-6 py-5">
                                            <div className="font-semibold text-white">
                                                {risk.title}
                                            </div>
                                            <div
                                                className="
                                                mt-1
                                                text-sm
                                                text-slate-400
                                                "
                                            >
                                                {risk.description}
                                            </div>
                                        </td>

                                        <td className="px-6 py-5 text-slate-300">
                                            {risk.category ?? "-"}
                                        </td>

                                        <td className="px-6 py-5 font-semibold">
                                            {risk.score ?? 0}
                                        </td>

                                        <td className="px-6 py-5">
                                            <span
                                                className={clsx(
                                                    "rounded-full border px-3 py-1 text-xs font-semibold",
                                                    riskColor(risk.risk_level)
                                                )}
                                            >
                                                {risk.risk_level}
                                            </span>
                                        </td>

                                        <td className="px-6 py-5">
                                            {risk.status}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
