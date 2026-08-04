"use client";

import { ClockIcon } from "@heroicons/react/24/outline";

interface Props {
    workspace: any;
}

const iconColor = (type: string) => {
    const value = (type ?? "").toUpperCase();

    switch (value) {
        case "EVIDENCE":
    return "bg-blue-500/10 text-blue-400 border border-blue-500/30";

        case "RISK":
    return "bg-red-500/10 text-red-400 border border-red-500/30";

        case "TASK":
    return "bg-amber-500/10 text-amber-400 border border-amber-500/30";

        case "CONTROL":
    return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30";

       default:
    return "bg-slate-800 text-slate-300 border border-slate-700";
    }
};

export default function WorkspaceTimeline({
    workspace,
}: Props) {

    const timeline =
        workspace?.timeline ?? [];

    return (

        <div className="space-y-6">

            <div className="rounded-xl border border-slate-800 bg-slate-900 shadow-black/20 shadow-lg">

                <div className="border-b border-slate-800 px-6 py-5">

                    <h2 className="text-xl font-semibold text-white">

                        Activity Timeline

                    </h2>

                    <p className="mt-1 text-sm text-slate-400">

                        Recent compliance activities related to this control.

                    </p>

                </div>

                {timeline.length === 0 ? (

                    <div className="py-20 text-center">

                        <ClockIcon className="mx-auto h-16 w-16 text-slate-600"/>

                        <h3 className="mt-4 text-lg font-semibold text-white">

                            No Timeline Found

                        </h3>

                        <p className="mt-2 text-sm text-slate-500">

                            There are no recorded activities yet.

                        </p>

                    </div>

                ) : (

                    <div className="relative px-8 py-8">

                        <div className="absolute bottom-0 left-10 top-0 w-px bg-slate-700"/>

                        <div className="space-y-8">

                            {timeline.map((item: any, index: number) => (

                                <div
                                    key={`${item.type}-${item.date}-${item.title}-${index}`}
                                    className="relative flex gap-6"
                                >

                                    <div
                                        className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full ${iconColor(
                                            item.type
                                        )}`}
                                    >

                                        <ClockIcon className="h-5 w-5"/>

                                    </div>

                                    <div className="flex-1 rounded-xl border border-slate-800 bg-slate-950 p-5">

                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

                                            <div>

                                                <div className="text-lg font-semibold text-slate-white">

                                                    {item.title}

                                                </div>

                                                <div className="mt-2 text-sm text-slate-400">

                                                    {item.action}

                                                </div>

                                            </div>

                                            <div className="flex flex-col items-end gap-2">

                                                <span
                                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${iconColor(
                                                        item.type
                                                    )}`}
                                                >

                                                    {item.type}

                                                </span>

                                                <span className="text-sm text-slate-400">

                                                    {item.date}

                                                </span>

                                            </div>

                                        </div>

                                    </div>

                                </div>

                            ))}

                        </div>

                    </div>

                )}

            </div>

        </div>

    );

}