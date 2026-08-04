"use client";

import {
    SparklesIcon,
    LightBulbIcon,
    CpuChipIcon,
} from "@heroicons/react/24/outline";


interface Props {
    workspace: any;
}


export default function WorkspaceAISummary({
    workspace,
}: Props) {


    const summary: string[] =
        workspace?.ai_summary ?? [];


    const executiveSummary =
        workspace?.ai_executive_summary ?? null;


    const findings =
        workspace?.ai_findings ?? [];


    const engine =
        workspace?.ai_engine ?? null;



    return (

        <div className="space-y-6">


            {/* AI EXECUTIVE SUMMARY */}

            <div
                className="
                overflow-hidden
                rounded-xl
                border
                border-slate-800
                bg-slate-900
                shadow-lg
                shadow-black/20
                "
            >

                <div
                    className="
                    border-b
                    bg-gradient-to-r
                    from-cyan-600
                    via-slate-900
                    to-slate-950
                    px-6
                    py-5
                    text-white
                    "
                >

                    <div
                        className="
                        flex
                        items-center
                        gap-3
                        "
                    >

                        <div
                            className="
                            rounded-lg
                            bg-white/20
                            p-3
                            "
                        >

                            <CpuChipIcon className="h-7 w-7"/>

                        </div>


                        <div>

                            <h2 className="text-xl font-semibold">

                                AI Executive Summary

                            </h2>


                            <p className="mt-1 text-sm text-blue-100">

                                AI-generated insights for this compliance object.

                            </p>

                        </div>

                    </div>

                </div>



                {
                    !executiveSummary ? (

                        <div className="py-20 text-center">

                            <SparklesIcon
                                className="
                                mx-auto
                                h-16
                                w-16
                                text-slate-600
                                "
                            />


                            <h3
                                className="
                                mt-5
                                text-lg
                                font-semibold
                                text-white
                                "
                            >

                                No AI Insights Available

                            </h3>


                            <p
                                className="
                                mt-2
                                text-sm
                                text-slate-400
                                "
                            >

                                AI analysis has not been generated yet.

                            </p>


                        </div>


                    ) : (

                        <div className="p-6">

                            <div
                                className="
                                rounded-xl
                                border
                                border-cyan-500/20
                                bg-slate-950
                                p-6
                                "
                            >

                                <p
                                    className="
                                    leading-8
                                    text-slate-300
                                    "
                                >

                                    {executiveSummary}

                                </p>


                            </div>

                        </div>

                    )
                }


            </div>
			            {/* KPI CARDS */}

            <div
                className="
                grid
                gap-6
                lg:grid-cols-3
                "
            >



                {/* AI OBSERVATIONS */}

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

                    <div
                        className="
                        flex
                        items-center
                        gap-3
                        "
                    >

                        <div
                            className="
                            rounded-lg
                            border
                            border-emerald-500/20
                            bg-emerald-500/10
                            p-3
                            "
                        >

                            <SparklesIcon
                                className="
                                h-6
                                w-6
                                text-emerald-300
                                "
                            />

                        </div>


                        <div>

                            <h3
                                className="
                                font-semibold
                                text-white
                                "
                            >

                                AI Observations

                            </h3>


                            <p
                                className="
                                text-sm
                                text-slate-400
                                "
                            >

                                Generated Insights

                            </p>


                        </div>


                    </div>



                    <div
                        className="
                        mt-6
                        text-5xl
                        font-bold
                        text-emerald-300
                        "
                    >

                        {summary.length}

                    </div>



                    <div
                        className="
                        mt-5
                        space-y-3
                        "
                    >

                        {
                            summary.map(
                                (
                                    item,
                                    index
                                ) => (

                                    <div
                                        key={index}
                                        className="
                                        rounded-lg
                                        border
                                        border-emerald-500/20
                                        bg-slate-950
                                        p-3
                                        "
                                    >

                                        <p
                                            className="
                                            text-sm
                                            text-slate-300
                                            "
                                        >

                                            {item}

                                        </p>


                                    </div>

                                )
                            )
                        }


                    </div>


                </div>





                {/* AI FINDINGS */}

                <div
                    className="
                    rounded-xl
                    border
                    border-amber-500/20
                    bg-slate-900
                    p-6
                    shadow-lg
                    "
                >

                    <div
                        className="
                        flex
                        items-center
                        gap-3
                        "
                    >

                        <div
                            className="
                            rounded-lg
                            border
                            border-amber-500/30
                            bg-amber-500/10
                            p-3
                            "
                        >

                            <LightBulbIcon
                                className="
                                h-6
                                w-6
                                text-amber-400
                                "
                            />

                        </div>


                        <div>

                            <h3
                                className="
                                font-semibold
                                text-white
                                "
                            >

                                AI Findings

                            </h3>


                            <p
                                className="
                                text-sm
                                text-slate-400
                                "
                            >

                                AI-generated risk and compliance findings

                            </p>


                        </div>


                    </div>



                    <div
                        className="
                        mt-6
                        text-5xl
                        font-bold
                        text-amber-400
                        "
                    >

                        {findings.length}

                    </div>



                    <div
                        className="
                        mt-5
                        space-y-3
                        "
                    >

                        {
                            findings.map(
                                (
                                    finding,
                                    index
                                ) => (

                                    <div
                                        key={index}
                                        className="
                                        rounded-lg
                                        border
                                        border-amber-500/20
                                        bg-slate-950
                                        p-4
                                        "
                                    >

                                        <div
                                            className="
                                            flex
                                            justify-between
                                            "
                                        >

                                            <span
                                                className="
                                                text-xs
                                                font-semibold
                                                text-amber-400
                                                "
                                            >

                                                {finding.category}

                                            </span>


                                            <span
                                                className="
                                                text-xs
                                                font-semibold
                                                text-red-400
                                                "
                                            >

                                                {finding.severity}

                                            </span>


                                        </div>



                                        <p
                                            className="
                                            mt-2
                                            text-sm
                                            text-slate-300
                                            "
                                        >

                                            {finding.message}

                                        </p>


                                    </div>

                                )

                            )
                        }


                    </div>


                </div>
				                {/* AI ENGINE */}

                <div
                    className="
                    rounded-xl
                    border
                    border-cyan-500/20
                    bg-slate-900
                    p-6
                    shadow-lg
                    "
                >

                    <div
                        className="
                        flex
                        items-center
                        gap-3
                        "
                    >

                        <div
                            className="
                            rounded-lg
                            bg-cyan-500/10
                            p-3
                            "
                        >

                            <CpuChipIcon
                                className="
                                h-6
                                w-6
                                text-cyan-400
                                "
                            />

                        </div>


                        <div>

                            <h3
                                className="
                                font-semibold
                                text-white
                                "
                            >

                                AI Engine

                            </h3>


                            <p
                                className="
                                text-sm
                                text-slate-500
                                "
                            >

                                Intelligence Processing

                            </p>


                        </div>


                    </div>




                    <div
                        className="
                        mt-6
                        space-y-4
                        "
                    >


                        <div
                            className="
                            rounded-lg
                            border
                            border-slate-700
                            bg-slate-950
                            px-4
                            py-3
                            "
                        >

                            <div
                                className="
                                text-sm
                                text-slate-400
                                "
                            >

                                Source

                            </div>


                            <div
                                className="
                                mt-1
                                font-medium
                                text-slate-200
                                "
                            >

                                {
                                    engine?.source ??
                                    "AI Engine Offline"
                                }

                            </div>


                        </div>



                        <div
                            className="
                            rounded-lg
                            border
                            border-slate-700
                            bg-slate-950
                            px-4
                            py-3
                            "
                        >

                            <div
                                className="
                                text-sm
                                text-slate-400
                                "
                            >

                                Status

                            </div>


                            <div
                                className="
                                mt-1
                                font-medium
                                text-cyan-400
                                "
                            >

                                {
                                    engine?.status ??
                                    "UNKNOWN"
                                }

                            </div>


                        </div>


                    </div>


                </div>


            </div>


        </div>

    );

}