"use client";

import React from "react";

export interface WorkspaceOverviewProps {
  workspace: any;
}

function KPICard({
  title,
  value,
  color,
}: {
  title: string;
  value: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-lg shadow-black/20  transition hover: slate-700 shadow-md">
      <div className="text-xs uppercase tracking-wider text-slate-500">
        {title}
      </div>

      <div className={`mt-4 text-4xl font-bold ${color}`}>
        {value}
      </div>
    </div>
  );
}

export default function WorkspaceOverview({
  workspace,
}: WorkspaceOverviewProps) {
  if (!workspace) return null;

  const coverage =
    workspace.coverage?.coverage_percentage ?? 0;

  const evidenceCount =
    workspace.evidences?.length ?? 0;

  const riskCount =
    workspace.risks?.length ?? 0;

  const taskCount =
    workspace.tasks?.length ?? 0;

  const health =
    workspace.analytics?.compliance_health ??
    Math.max(0, 100 - riskCount * 5);

  return (
    <div className="space-y-8">

      {/* Header */}

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-lg">

        <div className="text-sm text-slate-500">

          {workspace.standard?.code}

          {"  /  "}

          {workspace.clause?.code}

          {"  /  "}

          {workspace.requirement?.code}

          {"  /  "}

          {workspace.control?.code}

        </div>

        <h2 className="mt-3 text-3xl font-bold text-white">
          {workspace.control?.title}
        </h2>

        <p className="mt-4 max-w-4xl leading-7 text-slate-400">
          {workspace.control?.description}
        </p>

      </div>

      {/* KPI */}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">

        <KPICard
          title="Coverage"
          value={`${coverage}%`}
          color="text-cyan-400"
        />

        <KPICard
          title="Evidence"
          value={evidenceCount}
          color="text-emerald-400"
        />

        <KPICard
          title="Risks"
          value={riskCount}
          color="text-red-400"
        />

        <KPICard
          title="Tasks"
          value={taskCount}
          color="text-orange-400"
        />

        <KPICard
          title="Health"
          value={`${health}%`}
          color="text-cyan-400"
        />

      </div>

      {/* Summary */}

      <div className="grid gap-6 xl:grid-cols-2">

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-lg">

          <h3 className="mb-6 text-xl font-semibold">
            Control Summary
          </h3>

          <div className="grid grid-cols-2 gap-6">

            <div>
              <div className="text-xs uppercase text-slate-500">
                Standard
              </div>

              <div className="mt-2 font-semibold">
                {workspace.standard?.title}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase text-slate-500">
                Clause
              </div>

              <div className="mt-2 font-semibold">
                {workspace.clause?.title}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase text-slate-500">
                Requirement
              </div>

              <div className="mt-2 font-semibold">
                {workspace.requirement?.title}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase text-slate-500">
                Control
              </div>

              <div className="mt-2 font-semibold">
                {workspace.control?.code}
              </div>
            </div>

          </div>

        </div>
		        {/* Coverage */}

        <div className="rounded-xl border border-slate-800 bg-slate-950 p-8 shadow-lg">

          <div className="flex items-center justify-between">

            <h3 className="text-xl font-semibold">
              Coverage Progress
            </h3>

            <span className="text-3xl font-bold text-indigo-600">
              {coverage}%
            </span>

          </div>

          <div className="mt-8 h-4 overflow-hidden rounded-full bg-slate-800">

            <div
              className="h-full rounded-full bg-cyan-500 transition-all duration-700"
              style={{
                width: `${coverage}%`,
              }}
            />

          </div>

          <div className="mt-5 text-sm text-slate-500">
            Overall implementation coverage calculated from approved
            evidences and completed compliance activities.
          </div>

        </div>

      </div>

      {/* Risk / Evidence */}

      <div className="grid gap-6 xl:grid-cols-2">

        <div className="border border-slate-800 bg-slate-900 p-8 shadow-lg">

          <h3 className="mb-6 text-xl font-semibold">
            Risk Summary
          </h3>

          <div className="space-y-4">

            <div className="flex justify-between rounded-lg bg-red-500/10 border border-red-500/20 p-4">
              <span>Critical</span>
              <strong>
                {workspace.risk_summary?.critical ?? 0}
              </strong>
            </div>

            <div className="flex justify-between rounded-lg bg-orange-500/10 border border-orange-500/20 p-4">
              <span>High</span>
              <strong>
                {workspace.risk_summary?.high ?? 0}
              </strong>
            </div>

            <div className="flex justify-between rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
              <span>Medium</span>
              <strong>
                {workspace.risk_summary?.medium ?? 0}
              </strong>
            </div>

            <div className="flex justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4">
              <span>Low</span>
              <strong>
                {workspace.risk_summary?.low ?? 0}
              </strong>
            </div>

          </div>

        </div>

        <div className="rounded-xlborder border-slate-800 bg-slate-900 p-8 shadow-lg">

          <h3 className="mb-6 text-xl font-semibold">
            Evidence Summary
          </h3>

          <div className="grid grid-cols-2 gap-4">

            <div className="rounded-lg border border-slate-800 bg-slate-950 p-5">

              <div className="text-sm text-slate-500">
                Approved
              </div>

              <div className="mt-3 text-3xl font-bold text-emerald-600">
                {workspace.coverage?.approved ?? 0}
              </div>

            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950 p-5">

              <div className="text-sm text-slate-500">
                Waiting
              </div>

              <div className="mt-3 text-3xl font-bold text-amber-600">
                {workspace.coverage?.waiting ?? 0}
              </div>

            </div>

            <div className="rounded-lg border p-5">

              <div className="text-sm text-slate-500">
                Rejected
              </div>

              <div className="mt-3 text-3xl font-bold text-red-600">
                {workspace.coverage?.rejected ?? 0}
              </div>

            </div>

            <div className="rounded-lg border p-5">

              <div className="text-sm text-slate-500">
                Expired
              </div>

              <div className="mt-3 text-3xl font-bold text-slate-700">
                {workspace.coverage?.expired ?? 0}
              </div>

            </div>

          </div>

        </div>

      </div>

      {/* Task Summary */}

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-lg">

        <h3 className="mb-6 text-xl font-semibold">
          Task Summary
        </h3>

        <div className="grid gap-4 md:grid-cols-4">

          <div className="rounded-lg border p-5">
            <div className="text-sm text-slate-500">
              Open
            </div>

            <div className="mt-3 text-3xl font-bold text-red-600">
              {workspace.task_summary?.open ?? 0}
            </div>
          </div>

          <div className="rounded-lg border p-5">
            <div className="text-sm text-slate-500">
              In Progress
            </div>

            <div className="mt-3 text-3xl font-bold text-indigo-600">
              {workspace.task_summary?.in_progress ?? 0}
            </div>
          </div>

          <div className="rounded-lg border p-5">
            <div className="text-sm text-slate-500">
              Completed
            </div>

            <div className="mt-3 text-3xl font-bold text-emerald-600">
              {workspace.task_summary?.completed ?? 0}
            </div>
          </div>

          <div className="rounded-lg border p-5">
            <div className="text-sm text-slate-500">
              Overdue
            </div>

            <div className="mt-3 text-3xl font-bold text-orange-600">
              {workspace.task_summary?.overdue ?? 0}
            </div>
          </div>

        </div>

      </div>
	        {/* Timeline + AI */}

      <div className="grid gap-6 xl:grid-cols-2">

        {/* Recent Timeline */}

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-lg">

          <h3 className="mb-6 text-xl font-semibold">
            Recent Activity
          </h3>

          {(workspace.timeline ?? []).length === 0 ? (

            <div className="rounded-lg border border-dashed p-8 text-center text-slate-500">
              No recent activities found.
            </div>

          ) : (

            <div className="space-y-6">

              {(workspace.timeline ?? [])
                .slice(0, 5)
                .map((item: any, index: number) => (

                  <div
                    key={item.id ?? index}
                    className="flex gap-4"
                  >

                    <div className="flex flex-col items-center">

                      <div className="h-3 w-3 rounded-full bg-indigo-600" />

                      {index !==
                        Math.min(
                          (workspace.timeline?.length ?? 1),
                          5
                        ) - 1 && (
                        <div className="mt-1 h-full w-px bg-slate-700" />
                      )}

                    </div>

                    <div className="flex-1 rounded-lg bg-slate-950 p-4">

                      <div className="flex items-center justify-between">

                        <div className="font-semibold text-white">
                          {item.title}
                        </div>

                        <div className="text-xs text-slate-500">
                          {item.date}
                        </div>

                      </div>

                      <div className="mt-2 text-sm text-slate-400">
                        {item.description}
                      </div>

                    </div>

                  </div>

                ))}

            </div>

          )}

        </div>

        {/* AI Insight */}

        <div className="rounded-xl border bg-gradient-to-br from-cyan-600 via-slate-900 to-slate-950 p-8 text-white shadow-sm">

          <div className="mb-6 flex items-center gap-3">

            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
              ✨
            </div>

            <div>

              <h3 className="text-xl font-semibold">
                AI Compliance Insight
              </h3>

              <p className="text-sm text-cyan-100">
                Intelligent assessment generated from workspace data
              </p>

            </div>

          </div>

          <div className="rounded-xl bg-white/10 p-6 backdrop-blur-sm">

            <p className="whitespace-pre-wrap leading-8 text-cyan-50">

              {workspace.ai_summary?.summary ??
                workspace.ai_summary ??
                "No AI insight has been generated for this control yet."}

            </p>

          </div>

          <div className="mt-6 rounded-xl border border-white/20 bg-white/5 p-5">

            <div className="text-sm font-semibold uppercase tracking-wider text-cyan-200">
              Recommendation
            </div>

            <p className="mt-3 text-sm leading-7 text-indigo-50">

              Review outstanding risks, validate missing evidences,
              complete overdue tasks and perform a reassessment after
              all required evidence has been approved.

            </p>

          </div>

        </div>

      </div>

    </div>
  );
}