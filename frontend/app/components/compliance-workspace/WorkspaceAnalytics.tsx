"use client";

import { useMemo } from "react";
import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  ChartBarIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

interface Props {
  workspace: any;
}

function number(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function percentage(value: any) {
  return `${number(value).toFixed(1)}%`;
}

function Metric({
  label,
  value,
  description,
  trend,
}: {
  label: string;
  value: string | number;
  description: string;
  trend?: "positive" | "negative" | null;
}) {
  return (
    <div className="bg-white px-5 py-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[9px] font-semibold uppercase tracking-[0.13em] text-slate-400">
          {label}
        </div>

        {trend === "positive" && (
          <ArrowTrendingUpIcon className="h-4 w-4 text-emerald-600" />
        )}

        {trend === "negative" && (
          <ArrowTrendingDownIcon className="h-4 w-4 text-red-600" />
        )}
      </div>

      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
        {value}
      </div>

      <div className="mt-1 text-[10px] text-slate-500">
        {description}
      </div>
    </div>
  );
}

function ProgressBar({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description?: string;
}) {
  const safeValue = Math.max(
    0,
    Math.min(100, number(value))
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-slate-700">
            {label}
          </div>

          {description && (
            <div className="mt-0.5 text-[10px] text-slate-400">
              {description}
            </div>
          )}
        </div>

        <div className="text-xs font-semibold text-slate-700">
          {percentage(safeValue)}
        </div>
      </div>

      <div className="mt-2 h-1.5 bg-slate-100">
        <div
          className="h-1.5 bg-slate-700 transition-all"
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}

export default function WorkspaceAnalytics({
  workspace,
}: Props) {
  const analytics = workspace?.analytics ?? {};

  const evidence = Array.isArray(workspace?.evidences)
    ? workspace.evidences
    : [];

  const risks = Array.isArray(workspace?.risks)
    ? workspace.risks
    : [];

  const tasks = Array.isArray(workspace?.tasks)
    ? workspace.tasks
    : [];

  const approvedEvidence = evidence.filter(
    (item: any) =>
      String(item.status ?? "").toLowerCase() ===
      "approved"
  ).length;

  const evidenceAssurance =
    evidence.length > 0
      ? (approvedEvidence / evidence.length) * 100
      : 0;

  const criticalRisks = risks.filter(
    (risk: any) =>
      String(
        risk.risk_level ?? risk.severity ?? ""
      ).toUpperCase() === "CRITICAL"
  ).length;

  const highRisks = risks.filter(
    (risk: any) =>
      String(
        risk.risk_level ?? risk.severity ?? ""
      ).toUpperCase() === "HIGH"
  ).length;

  const completedTasks = tasks.filter(
    (task: any) => {
      const status = String(
        task.status ?? ""
      ).toLowerCase();

      return [
        "completed",
        "complete",
        "closed",
        "done",
      ].includes(status);
    }
  ).length;

  const taskCompletion =
    tasks.length > 0
      ? (completedTasks / tasks.length) * 100
      : 0;

  const compliance =
    analytics.compliance_percentage ??
    analytics.compliance ??
    workspace?.compliance_percentage ??
    workspace?.compliance ??
    0;

  const coverage =
    analytics.coverage_percentage ??
    analytics.coverage ??
    0;

  const maturity =
    analytics.maturity_percentage ??
    analytics.maturity ??
    null;

  const posture = useMemo(() => {
    const score = number(compliance);

    if (score >= 80) {
      return {
        label: "Strong",
        description:
          "The current compliance posture is broadly healthy.",
        className:
          "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    }

    if (score >= 50) {
      return {
        label: "Moderate",
        description:
          "Material compliance gaps require continued management.",
        className:
          "border-amber-200 bg-amber-50 text-amber-700",
      };
    }

    return {
      label: "Attention Required",
      description:
        "The current posture contains significant assurance gaps.",
      className:
        "border-red-200 bg-red-50 text-red-700",
    };
  }, [compliance]);

  return (
    <div className="space-y-5">

      <section className="border border-slate-200 bg-white">

        <div className="border-b border-slate-200 px-5 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Compliance Intelligence
              </div>

              <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
                Compliance Analytics
              </h2>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Consolidated posture, assurance and remediation
                indicators for the current compliance object.
              </p>
            </div>

            <div
              className={`inline-flex items-center gap-2 self-start border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${posture.className}`}
            >
              <ShieldCheckIcon className="h-3.5 w-3.5" />
              {posture.label}
            </div>

          </div>
        </div>

        <div className="grid grid-cols-2 gap-px bg-slate-200 xl:grid-cols-4">

          <Metric
            label="Compliance"
            value={percentage(compliance)}
            description="Overall compliance posture"
            trend={
              number(compliance) >= 70
                ? "positive"
                : "negative"
            }
          />

          <Metric
            label="Evidence Assurance"
            value={percentage(evidenceAssurance)}
            description="Approved evidence ratio"
          />

          <Metric
            label="Risk Exposure"
            value={criticalRisks + highRisks}
            description={`${criticalRisks} critical · ${highRisks} high`}
            trend={
              criticalRisks + highRisks > 0
                ? "negative"
                : "positive"
            }
          />

          <Metric
            label="Remediation"
            value={percentage(taskCompletion)}
            description="Completed action ratio"
          />

        </div>

      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">

        <section className="border border-slate-200 bg-white">

          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-2">
              <ChartBarIcon className="h-4 w-4 text-slate-500" />

              <h3 className="text-sm font-semibold text-slate-800">
                Posture Indicators
              </h3>
            </div>

            <p className="mt-1 text-[10px] text-slate-400">
              Current performance against available assurance
              indicators.
            </p>
          </div>

          <div className="space-y-6 p-5">

            <ProgressBar
              label="Compliance"
              value={number(compliance)}
              description="Overall compliance score"
            />

            <ProgressBar
              label="Control Coverage"
              value={number(coverage)}
              description="Controls with effective coverage"
            />

            <ProgressBar
              label="Evidence Assurance"
              value={evidenceAssurance}
              description="Evidence records approved"
            />

            {maturity !== null && (
              <ProgressBar
                label="Maturity"
                value={number(maturity)}
                description="Current maturity posture"
              />
            )}

            <ProgressBar
              label="Remediation Completion"
              value={taskCompletion}
              description="Actions completed"
            />

          </div>

        </section>

        <section className="border border-slate-200 bg-white">

          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-800">
              Intelligence Summary
            </h3>

            <p className="mt-1 text-[10px] text-slate-400">
              Key signals requiring management attention.
            </p>
          </div>

          <div className="divide-y divide-slate-100">

            <div className="flex items-start justify-between gap-6 px-5 py-4">
              <div>
                <div className="text-xs font-medium text-slate-700">
                  Evidence assurance
                </div>

                <div className="mt-1 text-[10px] leading-5 text-slate-500">
                  {approvedEvidence} of {evidence.length} evidence
                  records are approved.
                </div>
              </div>

              <div className="shrink-0 text-sm font-semibold text-slate-800">
                {percentage(evidenceAssurance)}
              </div>
            </div>

            <div className="flex items-start justify-between gap-6 px-5 py-4">
              <div>
                <div className="text-xs font-medium text-slate-700">
                  Risk exposure
                </div>

                <div className="mt-1 text-[10px] leading-5 text-slate-500">
                  Critical and high-severity risks currently
                  associated with this object.
                </div>
              </div>

              <div className="shrink-0 text-sm font-semibold text-slate-800">
                {criticalRisks + highRisks}
              </div>
            </div>

            <div className="flex items-start justify-between gap-6 px-5 py-4">
              <div>
                <div className="text-xs font-medium text-slate-700">
                  Remediation progress
                </div>

                <div className="mt-1 text-[10px] leading-5 text-slate-500">
                  {completedTasks} of {tasks.length} actions are
                  completed.
                </div>
              </div>

              <div className="shrink-0 text-sm font-semibold text-slate-800">
                {percentage(taskCompletion)}
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="text-xs font-medium text-slate-700">
                Management assessment
              </div>

              <div className="mt-1 text-[10px] leading-5 text-slate-500">
                {posture.description}
              </div>
            </div>

          </div>

        </section>

      </div>

    </div>
  );
}
