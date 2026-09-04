"use client";

import React from "react";
import {
  ShieldCheckIcon,
  CircleStackIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

export interface WorkspaceOverviewProps {
  workspace: any;
}

function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "accent";
}) {
  const valueClass = {
    default: "text-slate-900",
    success: "text-emerald-700",
    warning: "text-amber-700",
    danger: "text-red-700",
    accent: "text-cyan-700",
  }[tone];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </div>

      <div className={`mt-3 text-3xl font-semibold tracking-tight ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

function Section({
  eyebrow,
  title,
  icon: Icon,
  children,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
        {Icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
            <Icon className="h-4 w-4 text-slate-500" />
          </div>
        )}

        <div>
          {eyebrow && (
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              {eyebrow}
            </div>
          )}

          <h3 className="text-sm font-semibold text-slate-900">
            {title}
          </h3>
        </div>
      </div>

      <div className="p-6">
        {children}
      </div>
    </section>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
        {label}
      </div>

      <div className="mt-1.5 text-sm font-medium text-slate-800">
        {value || "—"}
      </div>
    </div>
  );
}

function StatusRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "danger" | "warning" | "amber" | "success";
}) {
  const styles = {
    danger:
      "border-red-100 bg-red-50 text-red-700",
    warning:
      "border-orange-100 bg-orange-50 text-orange-700",
    amber:
      "border-amber-100 bg-amber-50 text-amber-700",
    success:
      "border-emerald-100 bg-emerald-50 text-emerald-700",
  }[tone];

  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-4 py-3 ${styles}`}
    >
      <span className="text-sm font-medium">
        {label}
      </span>

      <span className="text-sm font-semibold">
        {value}
      </span>
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
    Array.isArray(workspace.evidences)
      ? workspace.evidences.length
      : 0;

  const evidenceStatuses =
    Array.isArray(workspace.evidences)
      ? workspace.evidences.map((e: any) => ({
          status: String(
            e?.status ??
            e?.approval_status ??
            ""
          ).toLowerCase().trim(),
          coverageStatus: String(
            e?.coverage_status ??
            ""
          ).toUpperCase().trim(),
          expiresAt:
            e?.expires_at ??
            e?.expiry_date ??
            e?.expiration_date ??
            null,
        }))
      : [];

  const approvedEvidenceCount =
    evidenceStatuses.filter(
      (e: any) =>
        e.status === "approved" ||
        e.coverageStatus === "ACHIEVED"
    ).length;

  const rejectedEvidenceCount =
    evidenceStatuses.filter(
      (e: any) =>
        e.status === "rejected"
    ).length;

  const expiredEvidenceCount =
    evidenceStatuses.filter(
      (e: any) =>
        e.status === "expired" ||
        (
          e.expiresAt &&
          !Number.isNaN(Date.parse(String(e.expiresAt))) &&
          Date.parse(String(e.expiresAt)) < Date.now()
        )
    ).length;

  const waitingEvidenceCount =
    Math.max(
      evidenceCount -
        approvedEvidenceCount -
        rejectedEvidenceCount -
        expiredEvidenceCount,
      0
    );

  const riskCount =
    workspace.risks?.length ?? 0;

  const taskCount =
    workspace.tasks?.length ?? 0;

  const health =
    workspace.analytics?.compliance_health ??
    Math.max(0, 100 - riskCount * 5);

  const timeline =
    Array.isArray(workspace.timeline)
      ? workspace.timeline.slice(0, 5)
      : [];

  const aiSummary =
    Array.isArray(workspace.ai_summary)
      ? workspace.ai_summary.join("\n")
      : workspace.ai_summary?.summary ??
        workspace.ai_summary ??
        "No AI insight has been generated for this control yet.";

  return (
    <div className="space-y-5">

      {/* Control identity */}

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="px-6 py-6">

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

            <div className="min-w-0">

              <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">

                <span>
                  {workspace.standard?.code ?? "Standard"}
                </span>

                {workspace.clause?.code && (
                  <>
                    <span className="text-slate-300">/</span>
                    <span>{workspace.clause.code}</span>
                  </>
                )}

                {workspace.requirement?.code && (
                  <>
                    <span className="text-slate-300">/</span>
                    <span>{workspace.requirement.code}</span>
                  </>
                )}

                {workspace.control?.code && (
                  <>
                    <span className="text-slate-300">/</span>
                    <span>{workspace.control.code}</span>
                  </>
                )}

              </div>

              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                {workspace.control?.title ?? "Compliance Control"}
              </h2>

              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">
                {workspace.control?.description ??
                  "Control definition and implementation context."}
              </p>

            </div>

            <div className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600">
              <ShieldCheckIcon className="h-3.5 w-3.5" />
              Control
            </div>

          </div>

        </div>
      </section>

      {/* KPI */}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">

        <MetricCard
          label="Coverage"
          value={`${coverage}%`}
          tone="accent"
        />

        <MetricCard
          label="Evidence"
          value={evidenceCount}
          tone="success"
        />

        <MetricCard
          label="Risks"
          value={riskCount}
          tone={riskCount > 0 ? "danger" : "default"}
        />

        <MetricCard
          label="Tasks"
          value={taskCount}
          tone={taskCount > 0 ? "warning" : "default"}
        />

        <MetricCard
          label="Health"
          value={`${health}%`}
          tone="accent"
        />

      </div>

      {/* Context + Coverage */}

      <div className="grid gap-5 xl:grid-cols-2">

        <Section
          eyebrow="Control Context"
          title="Requirement & Control"
          icon={ShieldCheckIcon}
        >
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">

            <InfoItem
              label="Standard"
              value={workspace.standard?.title}
            />

            <InfoItem
              label="Clause"
              value={workspace.clause?.title}
            />

            <InfoItem
              label="Requirement"
              value={workspace.requirement?.title}
            />

            <InfoItem
              label="Control"
              value={workspace.control?.code}
            />

          </div>
        </Section>

        <Section
          eyebrow="Implementation"
          title="Coverage Progress"
        >
          <div className="flex items-end justify-between">

            <div>
              <div className="text-3xl font-semibold tracking-tight text-slate-950">
                {coverage}%
              </div>

              <div className="mt-1 text-xs text-slate-500">
                Overall implementation coverage
              </div>
            </div>

            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              Current
            </div>

          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-cyan-600 transition-all duration-700"
              style={{
                width: `${Math.min(Math.max(coverage, 0), 100)}%`,
              }}
            />
          </div>

          <div className="mt-3 flex justify-between text-[11px] text-slate-400">
            <span>0%</span>
            <span>Implementation coverage</span>
            <span>100%</span>
          </div>
        </Section>

      </div>

      {/* Risk + Evidence */}

      <div className="grid gap-5 xl:grid-cols-2">

        <Section
          eyebrow="Risk Intelligence"
          title="Risk Summary"
          icon={ExclamationTriangleIcon}
        >
          <div className="space-y-2.5">

            <StatusRow
              label="Critical"
              value={workspace.risk_summary?.critical ?? 0}
              tone="danger"
            />

            <StatusRow
              label="High"
              value={workspace.risk_summary?.high ?? 0}
              tone="warning"
            />

            <StatusRow
              label="Medium"
              value={workspace.risk_summary?.medium ?? 0}
              tone="amber"
            />

            <StatusRow
              label="Low"
              value={workspace.risk_summary?.low ?? 0}
              tone="success"
            />

          </div>
        </Section>

        <Section
          eyebrow="Evidence Assurance"
          title="Evidence Summary"
          icon={CircleStackIcon}
        >
          <div className="grid grid-cols-2 gap-3">

            <MetricCard
              label="Approved"
              value={approvedEvidenceCount}
              tone="success"
            />

            <MetricCard
              label="Waiting"
              value={waitingEvidenceCount}
              tone="warning"
            />

            <MetricCard
              label="Rejected"
              value={rejectedEvidenceCount}
              tone="danger"
            />

            <MetricCard
              label="Expired"
              value={expiredEvidenceCount}
              tone="default"
            />

          </div>
        </Section>

      </div>

      {/* Tasks */}

      <Section
        eyebrow="Remediation"
        title="Task Summary"
        icon={ClipboardDocumentListIcon}
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">

          <MetricCard
            label="Open"
            value={workspace.task_summary?.open ?? 0}
            tone="danger"
          />

          <MetricCard
            label="In Progress"
            value={workspace.task_summary?.in_progress ?? 0}
            tone="accent"
          />

          <MetricCard
            label="Completed"
            value={workspace.task_summary?.completed ?? 0}
            tone="success"
          />

          <MetricCard
            label="Overdue"
            value={workspace.task_summary?.overdue ?? 0}
            tone="warning"
          />

        </div>
      </Section>

      {/* Timeline + AI */}

      <div className="grid gap-5 xl:grid-cols-2">

        <Section
          eyebrow="Activity"
          title="Recent Activity"
          icon={ClockIcon}
        >
          {timeline.length === 0 ? (

            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center">
              <p className="text-sm font-medium text-slate-600">
                No recent activities
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Workspace activity will appear here.
              </p>
            </div>

          ) : (

            <div className="space-y-4">

              {timeline.map(
                (item: any, index: number) => (
                  <div
                    key={item.id ?? index}
                    className="flex gap-3"
                  >

                    <div className="flex flex-col items-center">

                      <div className="mt-1.5 h-2.5 w-2.5 rounded-full bg-cyan-600" />

                      {index < timeline.length - 1 && (
                        <div className="mt-1 w-px flex-1 bg-slate-200" />
                      )}

                    </div>

                    <div className="min-w-0 flex-1 border-b border-slate-100 pb-4">

                      <div className="flex items-start justify-between gap-4">

                        <div className="text-sm font-semibold text-slate-800">
                          {item.title ?? "Activity"}
                        </div>

                        <div className="shrink-0 text-[10px] text-slate-400">
                          {item.date ?? ""}
                        </div>

                      </div>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {item.description ?? ""}
                      </p>

                    </div>

                  </div>
                )
              )}

            </div>

          )}
        </Section>

        <Section
          eyebrow="Intelligence"
          title="AI Compliance Insight"
          icon={SparklesIcon}
        >

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">

            <div className="flex items-center gap-3">

              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white">
                <SparklesIcon className="h-4 w-4 text-cyan-600" />
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-800">
                  Intelligent assessment
                </div>

                <div className="text-[11px] text-slate-400">
                  Generated from workspace data
                </div>
              </div>

            </div>

            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">
              {aiSummary}
            </p>

          </div>

          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4">

            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              Recommended Action
            </div>

            <p className="mt-2 text-xs leading-5 text-slate-500">
              Review outstanding risks, validate missing evidence,
              complete overdue tasks and reassess the control after
              required evidence has been approved.
            </p>

          </div>

        </Section>

      </div>

    </div>
  );
}
