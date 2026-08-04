"use client";

import clsx from "clsx";

import {
    ChartBarIcon,
    ShieldCheckIcon,
    ExclamationTriangleIcon,
    CircleStackIcon,
    ArrowTrendingUpIcon,
    PresentationChartLineIcon,
} from "@heroicons/react/24/outline";


interface Props {
    workspace: any;
}


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
            shadow-black/20
            "
        >

            <div className="flex items-center justify-between">

                <div>

                    <p className="
                    text-xs
                    uppercase
                    tracking-wider
                    text-slate-400
                    ">
                        {title}
                    </p>


                    <h3 className="
                    mt-2
                    text-3xl
                    font-bold
                    text-white
                    ">
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



function MetricCard({
    title,
    value,
    description,
    icon,
}: {
    title: string;
    value: number | string;
    description: string;
    icon: React.ReactNode;
}) {

    return (

        <div
            className="
            rounded-xl
            border
            border-slate-800
            bg-slate-950
            p-5
            "
        >

            <div className="flex items-center gap-4">

                <div
                    className="
                    rounded-xl
                    border
                    border-slate-700
                    bg-slate-900
                    p-3
                    "
                >
                    {icon}
                </div>


                <div>

                    <p className="text-sm text-slate-400">
                        {title}
                    </p>


                    <p className="
                    mt-1
                    text-2xl
                    font-bold
                    text-white
                    ">
                        {value}
                    </p>

                </div>

            </div>


            <p className="
            mt-4
            text-sm
            text-slate-500
            ">
                {description}
            </p>

        </div>

    );

}



export default function WorkspaceAnalytics({
    workspace,
}: Props) {


    const analytics =
        workspace?.analytics ?? {};


    const risks =
        workspace?.risks ?? [];


    const evidences =
        workspace?.evidences ?? [];


    const tasks =
        workspace?.tasks ?? [];



    const riskCount =
        risks.length;



    const evidenceCount =
        evidences.length;



    const taskCount =
        tasks.length;



    const criticalRiskCount =
        risks.filter(
            (risk:any) =>
                risk.risk_level === "CRITICAL"
        ).length;



    const approvedEvidence =
        evidences.filter(
            (evidence:any) =>
                evidence.status === "approved" ||
                evidence.coverage_status === "ACHIEVED"
        ).length;



    const completedTasks =
        tasks.filter(
            (task:any) =>
                task.status === "COMPLETED"
        ).length;



    const complianceHealth =
        analytics.health_score ??
        analytics.compliance_health ??
        0;



    const riskExposure =
        analytics.risk_exposure ??
        criticalRiskCount;



    const evidenceCoverage =
        analytics.coverage ??
        (
            evidenceCount
                ? Math.round(
                    (approvedEvidence / evidenceCount) * 100
                )
                : 0
        );



    const taskPressure =
        analytics.task_pressure ??
        (
            taskCount
                ? Math.round(
                    ((taskCount - completedTasks) /
                    taskCount) * 100
                )
                : 0
        );



    return (

        <div className="space-y-6">


            <div className="
            grid
            gap-4
            md:grid-cols-2
            xl:grid-cols-4
            ">


                <KPI
                    title="Compliance Health"
                    value={`${complianceHealth}%`}
                    color="
                    bg-cyan-500/10
                    border
                    border-cyan-500/20
                    "
                    icon={
                        <ShieldCheckIcon
                            className="
                            h-7
                            w-7
                            text-cyan-400
                            "
                        />
                    }
                />


                <KPI
                    title="Risk Exposure"
                    value={riskExposure}
                    color="
                    bg-red-500/10
                    border
                    border-red-500/20
                    "
                    icon={
                        <ExclamationTriangleIcon
                            className="
                            h-7
                            w-7
                            text-red-400
                            "
                        />
                    }
                />


                <KPI
                    title="Evidence Coverage"
                    value={`${evidenceCoverage}%`}
                    color="
                    bg-emerald-500/10
                    border
                    border-emerald-500/20
                    "
                    icon={
                        <CircleStackIcon
                            className="
                            h-7
                            w-7
                            text-emerald-400
                            "
                        />
                    }
                />


                <KPI
                    title="Task Pressure"
                    value={`${taskPressure}%`}
                    color="
                    bg-amber-500/10
                    border
                    border-amber-500/20
                    "
                    icon={
                        <ChartBarIcon
                            className="
                            h-7
                            w-7
                            text-amber-400
                            "
                        />
                    }
                />

            </div>
			        {/* Intelligence Overview */}

        <div
            className="
            grid
            gap-6
            lg:grid-cols-3
            "
        >


            <MetricCard

                title="Risk Intelligence"

                value={riskCount}

                description={
                    `${criticalRiskCount} critical risks identified`
                }

                icon={
                    <ExclamationTriangleIcon
                        className="
                        h-6
                        w-6
                        text-red-400
                        "
                    />
                }

            />



            <MetricCard

                title="Evidence Intelligence"

                value={evidenceCount}

                description={
                    `${approvedEvidence} approved evidences`
                }

                icon={
                    <CircleStackIcon
                        className="
                        h-6
                        w-6
                        text-emerald-400
                        "
                    />
                }

            />



            <MetricCard

                title="Task Intelligence"

                value={taskCount}

                description={
                    `${completedTasks} completed tasks`
                }

                icon={
                    <ArrowTrendingUpIcon
                        className="
                        h-6
                        w-6
                        text-cyan-400
                        "
                    />
                }

            />


        </div>




        {/* Analytics Summary */}

        <div
            className="
            rounded-xl
            border
            border-slate-800
            bg-slate-900
            p-8
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

                <PresentationChartLineIcon
                    className="
                    h-7
                    w-7
                    text-cyan-400
                    "
                />


                <h3
                    className="
                    text-lg
                    font-semibold
                    text-white
                    "
                >
                    Compliance Analytics Overview
                </h3>


            </div>



            <div
                className="
                mt-6
                grid
                gap-5
                md:grid-cols-3
                "
            >


                <div
                    className="
                    rounded-xl
                    border
                    border-slate-800
                    bg-slate-950
                    p-5
                    "
                >

                    <p
                        className="
                        text-sm
                        text-slate-400
                        "
                    >
                        Coverage Status
                    </p>


                    <p
                        className="
                        mt-2
                        text-2xl
                        font-bold
                        text-white
                        "
                    >
                        {analytics.coverage ?? 0}%
                    </p>


                    <div
                        className="
                        mt-4
                        h-2
                        overflow-hidden
                        rounded-full
                        bg-slate-800
                        "
                    >

                        <div
                            className="
                            h-full
                            rounded-full
                            bg-cyan-500
                            "
                            style={{
                                width:
                                    `${analytics.coverage ?? evidenceCoverage}%`
                            }}
                        />

                    </div>

                </div>





                <div
                    className="
                    rounded-xl
                    border
                    border-slate-800
                    bg-slate-950
                    p-5
                    "
                >

                    <p
                        className="
                        text-sm
                        text-slate-400
                        "
                    >
                        Risk Distribution
                    </p>


                    <p
                        className="
                        mt-2
                        text-2xl
                        font-bold
                        text-white
                        "
                    >
                        {criticalRiskCount}
                    </p>


                    <p
                        className="
                        mt-2
                        text-sm
                        text-slate-500
                        "
                    >
                        Critical exposure items
                    </p>


                </div>





                <div
                    className="
                    rounded-xl
                    border
                    border-slate-800
                    bg-slate-950
                    p-5
                    "
                >

                    <p
                        className="
                        text-sm
                        text-slate-400
                        "
                    >
                        Execution Status
                    </p>


                    <p
                        className="
                        mt-2
                        text-2xl
                        font-bold
                        text-white
                        "
                    >
                        {completedTasks}/{taskCount}
                    </p>


                    <p
                        className="
                        mt-2
                        text-sm
                        text-slate-500
                        "
                    >
                        Completed compliance tasks
                    </p>


                </div>


            </div>


        </div>
		        {/* Exposure Intelligence */}

        <div
            className="
            rounded-xl
            border
            border-slate-800
            bg-slate-900
            p-8
            shadow-lg
            "
        >

            <div className="flex items-center gap-3">

                <ChartBarIcon
                    className="
                    h-7
                    w-7
                    text-cyan-400
                    "
                />


                <h3
                    className="
                    text-lg
                    font-semibold
                    text-white
                    "
                >
                    Exposure Intelligence
                </h3>

            </div>



            <div
                className="
                mt-6
                grid
                gap-4
                md:grid-cols-2
                xl:grid-cols-4
                "
            >


                <div
                    className="
                    rounded-xl
                    border
                    border-red-500/20
                    bg-red-500/10
                    p-5
                    "
                >

                    <p
                        className="
                        text-sm
                        text-red-300
                        "
                    >
                        Critical Risks
                    </p>


                    <p
                        className="
                        mt-2
                        text-3xl
                        font-bold
                        text-white
                        "
                    >
                        {criticalRiskCount}
                    </p>

                </div>





                <div
                    className="
                    rounded-xl
                    border
                    border-emerald-500/20
                    bg-emerald-500/10
                    p-5
                    "
                >

                    <p
                        className="
                        text-sm
                        text-emerald-300
                        "
                    >
                        Approved Evidence
                    </p>


                    <p
                        className="
                        mt-2
                        text-3xl
                        font-bold
                        text-white
                        "
                    >
                        {approvedEvidence}
                    </p>

                </div>





                <div
                    className="
                    rounded-xl
                    border
                    border-cyan-500/20
                    bg-cyan-500/10
                    p-5
                    "
                >

                    <p
                        className="
                        text-sm
                        text-cyan-300
                        "
                    >
                        Health Score
                    </p>


                    <p
                        className="
                        mt-2
                        text-3xl
                        font-bold
                        text-white
                        "
                    >
                        {complianceHealth}%
                    </p>

                </div>





                <div
                    className="
                    rounded-xl
                    border
                    border-amber-500/20
                    bg-amber-500/10
                    p-5
                    "
                >

                    <p
                        className="
                        text-sm
                        text-amber-300
                        "
                    >
                        Open Execution Load
                    </p>


                    <p
                        className="
                        mt-2
                        text-3xl
                        font-bold
                        text-white
                        "
                    >
                        {taskCount - completedTasks}
                    </p>

                </div>


            </div>


        </div>





        {/* Analytics Insight */}

        <div
            className="
            rounded-xl
            border
            border-slate-800
            bg-gradient-to-br
            from-cyan-600
            via-slate-900
            to-slate-950
            p-8
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

                <PresentationChartLineIcon
                    className="
                    h-7
                    w-7
                    text-cyan-100
                    "
                />


                <h3
                    className="
                    text-xl
                    font-semibold
                    text-white
                    "
                >
                    Intelligence Summary
                </h3>

            </div>



            <div
                className="
                mt-6
                grid
                gap-4
                md:grid-cols-3
                "
            >


                <div
                    className="
                    rounded-xl
                    border
                    border-white/10
                    bg-black/20
                    p-5
                    "
                >

                    <p className="text-sm text-cyan-100">
                        Risk Posture
                    </p>


                    <p
                        className="
                        mt-2
                        text-sm
                        text-slate-200
                        "
                    >
                        {criticalRiskCount > 0
                            ? "Critical exposure requires attention."
                            : "No critical exposure detected."
                        }
                    </p>

                </div>



                <div
                    className="
                    rounded-xl
                    border
                    border-white/10
                    bg-black/20
                    p-5
                    "
                >

                    <p className="text-sm text-cyan-100">
                        Evidence Readiness
                    </p>


                    <p
                        className="
                        mt-2
                        text-sm
                        text-slate-200
                        "
                    >
                        {evidenceCoverage}% evidence coverage achieved.
                    </p>

                </div>




                <div
                    className="
                    rounded-xl
                    border
                    border-white/10
                    bg-black/20
                    p-5
                    "
                >

                    <p className="text-sm text-cyan-100">
                        Operational Pressure
                    </p>


                    <p
                        className="
                        mt-2
                        text-sm
                        text-slate-200
                        "
                    >
                        {taskPressure}% remaining execution pressure.
                    </p>

                </div>


            </div>


        </div>


    </div>

    );

}