"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";

import {
    CheckCircleIcon,
    ClockIcon,
    ExclamationTriangleIcon,
    MagnifyingGlassIcon,
    FunnelIcon,
    ArrowDownTrayIcon,
    EyeIcon,
    DocumentDuplicateIcon,
    DocumentTextIcon,
} from "@heroicons/react/24/outline";


interface Props {
    workspace: any;
}


type StatusFilter =
    | "ALL"
    | "APPROVED"
    | "PENDING"
    | "REJECTED"
    | "UPLOADED";


type AssessmentFilter =
    | "ALL"
    | "CONTROL"
    | "MATURITY";



const statusColor = (status: string) => {

    const s = status.toLowerCase();


    if (s.includes("approved"))
        return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30";


    if (
        s.includes("waiting") ||
        s.includes("pending")
    )
        return "bg-amber-500/10 text-amber-400 border border-amber-500/30";


    if (s.includes("rejected"))
        return "bg-red-500/10 text-red-400 border border-red-500/30";


    return "bg-slate-800 text-slate-300 border border-slate-700";
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

            <div className="flex items-center justify-between">


                <div>

                    <p className="text-xs uppercase tracking-wider text-slate-500">
                        {title}
                    </p>


                    <h3 className="mt-2 text-3xl font-bold">

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



export default function WorkspaceEvidence({
    workspace,
}: Props) {


    const evidences =
        workspace?.evidences ?? [];


    const coverage =
        workspace?.coverage ?? {};



    const [search,setSearch] =
        useState("");



    const [statusFilter,setStatusFilter] =
        useState<StatusFilter>("ALL");



    const [assessmentFilter,setAssessmentFilter] =
        useState<AssessmentFilter>("ALL");



    const [advancedOpen,setAdvancedOpen] =
        useState(false);



    const handleExport = () => {


        const data =
            JSON.stringify(
                evidences,
                null,
                2
            );


        const blob =
            new Blob(
                [
                    data
                ],
                {
                    type:"application/json"
                }
            );


        const url =
            URL.createObjectURL(blob);



        const link =
            document.createElement("a");


        link.href = url;


        link.download =
            "evidence-export.json";


        link.click();


        URL.revokeObjectURL(url);

    };



    const filtered =
        useMemo(() => {


            return evidences.filter(
                (item:any)=>{


                    const title =
                        item.title?.toLowerCase() ?? "";


                    const desc =
                        item.description?.toLowerCase() ?? "";


                    const keyword =
                        search.toLowerCase();


                    const matchesSearch =
                        title.includes(keyword) ||
                        desc.includes(keyword);



                    const status =
                        item.status?.toUpperCase() ?? "";


                    const assessment =
                        item.assessment_type?.toUpperCase() ?? "";



                    const matchesStatus =
                        statusFilter === "ALL"
                        ? true
                        : status.includes(statusFilter);



                    const matchesAssessment =
                        assessmentFilter === "ALL"
                        ? true
                        : assessment === assessmentFilter;



                    return (
                        matchesSearch &&
                        matchesStatus &&
                        matchesAssessment
                    );


                }
            );


        },[
            evidences,
            search,
            statusFilter,
            assessmentFilter,
        ]);
		    return (

        <div className="space-y-6">


            {/* KPI */}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">


                <KPI
                    title="Total Evidence"
                    value={coverage.total_evidence ?? 0}
                    color="bg-slate-800 text-slate-300"
                    icon={
                        <DocumentTextIcon className="h-7 w-7" />
                    }
                />



                <KPI
                    title="Approved"
                    value={coverage.approved_evidence ?? 0}
                    color="bg-emerald-500/10 border border-emerald-500/20"
                    icon={
                        <CheckCircleIcon className="h-7 w-7 text-emerald-400" />
                    }
                />



                <KPI
                    title="Pending"
                    value={coverage.pending_evidence ?? 0}
                    color="bg-orange-500/10"
                    icon={
                        <ClockIcon className="h-7 w-7 text-amber-400" />
                    }
                />



                <KPI
                    title="Rejected"
                    value={coverage.rejected_evidence ?? 0}
                    color="bg-red-500/10"
                    icon={
                        <ExclamationTriangleIcon className="h-7 w-7 text-red-400" />
                    }
                />


            </div>





            {/* Toolbar */}

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



                    <div className="relative w-full lg:max-w-md">


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

                            onChange={(e)=>
                                setSearch(e.target.value)
                            }

                            placeholder="Search evidence..."

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
                            placeholder:text-slate-500
                            outline-none
                            focus:border-cyan-500
                            "
                        />


                    </div>





                    <div className="flex flex-wrap gap-3">


                        <select
                            value={statusFilter}
                            onChange={(e)=>
                                setStatusFilter(
                                    e.target.value as StatusFilter
                                )
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

                            <option value="ALL">
                                All Status
                            </option>

                            <option value="APPROVED">
                                Approved
                            </option>

                            <option value="PENDING">
                                Pending
                            </option>

                            <option value="REJECTED">
                                Rejected
                            </option>

                            <option value="UPLOADED">
                                Uploaded
                            </option>


                        </select>





                        <select
                            value={assessmentFilter}

                            onChange={(e)=>
                                setAssessmentFilter(
                                    e.target.value as AssessmentFilter
                                )
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

                            <option value="ALL">
                                All Types
                            </option>


                            <option value="CONTROL">
                                Control
                            </option>


                            <option value="MATURITY">
                                Maturity
                            </option>


                        </select>





                        <button

                            onClick={() =>
                                setAdvancedOpen(
                                    !advancedOpen
                                )
                            }

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
                            bg-slate-800
                            px-4
                            py-2
                            text-white
                            hover:bg-slate-700
                            "
                        >

                            <ArrowDownTrayIcon
                                className="h-5 w-5"
                            />


                            Export


                        </button>



                    </div>


                </div>




                {
                    advancedOpen && (

                        <div
                            className="
                            mt-5
                            rounded-xl
                            border
                            border-cyan-500/20
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

                                Advanced Evidence Intelligence

                            </h3>



                            <div
                                className="
                                mt-4
                                grid
                                gap-4
                                md:grid-cols-3
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
                                        Coverage
                                    </p>


                                    <p
                                        className="
                                        mt-2
                                        text-2xl
                                        font-bold
                                        text-cyan-400
                                        "
                                    >

                                        {
                                            coverage.coverage_percent ?? 0
                                        }%

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
                                        Evidence Count
                                    </p>


                                    <p
                                        className="
                                        mt-2
                                        text-2xl
                                        font-bold
                                        text-white
                                        "
                                    >

                                        {
                                            coverage.total_evidence ?? 0
                                        }

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
                                        Approval Rate
                                    </p>


                                    <p
                                        className="
                                        mt-2
                                        text-2xl
                                        font-bold
                                        text-emerald-400
                                        "
                                    >

                                        {
                                            coverage.total_evidence
                                            ?
                                            Math.round(
                                                (
                                                    coverage.approved_evidence /
                                                    coverage.total_evidence
                                                ) * 100
                                            )
                                            :
                                            0
                                        }%

                                    </p>


                                </div>



                            </div>


                        </div>

                    )
                }



            </div>
			            {/* Evidence Table */}

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
                                font-semibold
                                uppercase
                                tracking-wider
                                text-slate-400
                                "
                            >

                                <th className="px-6 py-4">
                                    Evidence
                                </th>

                                <th className="px-6 py-4">
                                    Type
                                </th>

                                <th className="px-6 py-4">
                                    Version
                                </th>

                                <th className="px-6 py-4">
                                    Owner
                                </th>

                                <th className="px-6 py-4">
                                    Uploaded
                                </th>

                                <th className="px-6 py-4">
                                    Expiration
                                </th>

                                <th className="px-6 py-4">
                                    Status
                                </th>

                                <th className="px-6 py-4 text-center">
                                    Files
                                </th>

                                <th className="px-6 py-4 text-right">
                                    Actions
                                </th>

                            </tr>

                        </thead>




                        <tbody
                            className="
                            divide-y
                            divide-slate-800
                            bg-slate-950
                            "
                        >


                            {
                                filtered.length === 0 ? (

                                    <tr>

                                        <td
                                            colSpan={9}
                                            className="
                                            py-16
                                            text-center
                                            text-slate-500
                                            "
                                        >

                                            No evidence found.

                                        </td>

                                    </tr>


                                ) : (


                                    filtered.map(
                                        (item:any)=>(


                                            <tr

                                                key={item.id}

                                                className="
                                                transition
                                                hover:bg-slate-800/70
                                                "
                                            >



                                                <td className="px-6 py-5">


                                                    <div className="font-semibold text-white">

                                                        {item.title}

                                                    </div>



                                                    <div
                                                        className="
                                                        mt-1
                                                        max-w-md
                                                        text-sm
                                                        text-slate-400
                                                        "
                                                    >

                                                        {item.description}

                                                    </div>


                                                </td>




                                                <td className="px-6 py-5">


                                                    <span
                                                        className="
                                                        rounded-full
                                                        border
                                                        border-cyan-500/30
                                                        bg-cyan-500/10
                                                        px-3
                                                        py-1
                                                        text-xs
                                                        font-semibold
                                                        uppercase
                                                        text-cyan-400
                                                        "
                                                    >

                                                        {item.assessment_type}


                                                    </span>


                                                </td>




                                                <td className="px-6 py-5">

                                                    v{item.version ?? 1}

                                                </td>




                                                <td className="px-6 py-5 text-sm text-slate-300">

                                                    {
                                                        item.owner_name ??
                                                        item.owner ??
                                                        "-"
                                                    }

                                                </td>




                                                <td className="px-6 py-5 text-sm">

                                                    {
                                                        item.uploaded_at ??
                                                        item.created_at ??
                                                        "-"
                                                    }

                                                </td>




                                                <td className="px-6 py-5 text-sm">

                                                    {
                                                        item.expiration_date ??
                                                        "-"
                                                    }

                                                </td>




                                                <td className="px-6 py-5">


                                                    <span
                                                        className={clsx(
                                                            "rounded-full px-3 py-1 text-xs font-semibold",
                                                            statusColor(
                                                                item.status
                                                            )
                                                        )}
                                                    >

                                                        {item.status}

                                                    </span>


                                                </td>





                                                <td className="px-6 py-5 text-center">


                                                    <span
                                                        className="
                                                        rounded-lg
                                                        border
                                                        border-slate-700
                                                        bg-slate-800
                                                        px-3
                                                        py-1
                                                        text-sm
                                                        font-semibold
                                                        "
                                                    >

                                                        {
                                                            item.files?.length ?? 0
                                                        }


                                                    </span>


                                                </td>





                                                <td className="px-6 py-5">


                                                    <div
                                                        className="
                                                        flex
                                                        justify-end
                                                        gap-2
                                                        "
                                                    >


                                                        <button
                                                            className="
                                                            rounded-lg
                                                            border
                                                            border-slate-700
                                                            bg-slate-900
                                                            p-2
                                                            text-slate-300
                                                            hover:bg-slate-800
                                                            "
                                                        >

                                                            <EyeIcon
                                                                className="h-5 w-5"
                                                            />

                                                        </button>




                                                        <button

                                                            className="
                                                            rounded-lg
                                                            border
                                                            border-slate-700
                                                            p-2
                                                            hover:bg-slate-800
                                                            "
                                                        >

                                                            <DocumentDuplicateIcon
                                                                className="h-5 w-5"
                                                            />

                                                        </button>





                                                        <button

                                                            className="
                                                            rounded-lg
                                                            border
                                                            border-slate-700
                                                            p-2
                                                            hover:bg-slate-800
                                                            "

                                                        >

                                                            <ArrowDownTrayIcon
                                                                className="h-5 w-5"
                                                            />

                                                        </button>


                                                    </div>


                                                </td>


                                            </tr>


                                        )

                                    )

                                )

                            }



                        </tbody>


                    </table>


                </div>


            </div>





            {/* Summary */}


            <div
                className="
                grid
                gap-6
                lg:grid-cols-3
                "
            >


                <div
                    className="
                    rounded-xl
                    border
                    border-slate-800
                    bg-slate-900
                    p-6
                    shadow-lg
                    "
                >

                    <h3
                        className="
                        mb-4
                        text-lg
                        font-semibold
                        text-white
                        "
                    >

                        Evidence Distribution

                    </h3>


                    <div className="space-y-4">


                        <div className="flex justify-between">

                            <span>
                                Total
                            </span>

                            <strong>
                                {coverage.total_evidence ?? 0}
                            </strong>

                        </div>


                        <div className="flex justify-between">

                            <span>
                                Approved
                            </span>

                            <strong className="text-emerald-400">

                                {coverage.approved_evidence ?? 0}

                            </strong>

                        </div>


                        <div className="flex justify-between">

                            <span>
                                Pending
                            </span>

                            <strong className="text-amber-400">

                                {coverage.pending_evidence ?? 0}

                            </strong>

                        </div>


                        <div className="flex justify-between">

                            <span>
                                Rejected
                            </span>

                            <strong className="text-red-400">

                                {coverage.rejected_evidence ?? 0}

                            </strong>

                        </div>


                    </div>


                </div>





                <div
                    className="
                    rounded-xl
                    border
                    border-slate-800
                    bg-slate-900
                    p-6
                    shadow-lg
                    lg:col-span-2
                    "
                >

                    <h3 className="mb-4 text-lg font-semibold text-white">

                        Coverage Progress

                    </h3>



                    <div
                        className="
                        h-4
                        overflow-hidden
                        rounded-full
                        bg-slate-800
                        "
                    >

                        <div

                            className="
                            h-full
                            rounded-full
                            bg-emerald-500
                            transition-all
                            "

                            style={{
                                width:
                                `${coverage.coverage_percent ?? 0}%`,
                            }}

                        />


                    </div>




                    <div
                        className="
                        mt-3
                        flex
                        justify-between
                        text-sm
                        "
                    >

                        <span className="text-slate-500">

                            Overall Evidence Coverage

                        </span>


                        <strong>

                            {coverage.coverage_percent ?? 0}%

                        </strong>


                    </div>


                </div>



            </div>


        </div>

    );


}