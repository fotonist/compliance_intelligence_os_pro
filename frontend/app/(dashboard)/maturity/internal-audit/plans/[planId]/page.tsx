"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  RefreshCw,
  ShieldCheck,
  Target,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

type AuditPlan = {
  id: number;
  tenant_id?: number;
  reference: string;
  name: string;
  audit_type: string;
  objective?: string | null;
  scope?: string | null;
  standard_id?: number | null;
  standard_version_id?: number | null;
  process_id?: number | null;
  lead_auditor_id?: number | null;
  planned_start?: string | null;
  planned_end?: string | null;
  status: string;
  created_by?: number | null;
  created_at?: string;
  updated_at?: string;
};

type Assessment = {
  id: number;
  name: string;
  status: string;
  context: {
    standard_id: number;
    standard_code: string;
    standard_version_id: number;
    version_code: string;
  };
};

type AssessmentProcess = {
  id: number;
  pam_process_id: number;
  pam_process_code?: string | null;
  pam_process_name?: string | null;
  target_capability_level?: number | null;
};

type AuditTarget = {
  id: number;
  tenant_id: number;
  audit_plan_id: number;
  audit_plan_reference?: string | null;
  audit_plan_name?: string | null;
  pam_assessment_id: number;
  assessment_process_id: number;
  pam_process_id?: number | null;
  process_code?: string | null;
  process_name?: string | null;
  process_attribute_id: number;
  process_attribute_code?: string | null;
  process_attribute_name?: string | null;
  standard_indicator_id?: number | null;
  indicator_code?: string | null;
  indicator_name?: string | null;
  indicator_type?: string | null;
  auditor_id?: number | null;
  status: string;
  result?: string | null;
  observation?: string | null;
  conclusion?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function getToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

function statusLabel(value?: string | null) {
  if (!value) {
    return "-";
  }

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusClass(value?: string | null) {
  switch ((value || "").toUpperCase()) {
    case "COMPLETED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "IN_PROGRESS":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "EXCEPTION":
      return "border-red-200 bg-red-50 text-red-700";
    case "READY":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function Fact({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white px-5 py-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-slate-900">
        {value}
      </div>
    </div>
  );
}

export default function MaturityAuditPlanWorkspace() {
  const params = useParams();
  const planId = Number(params.planId);

  const [plan, setPlan] =
    useState<AuditPlan | null>(null);
  const [assessments, setAssessments] =
    useState<Assessment[]>([]);
  const [targets, setTargets] =
    useState<AuditTarget[]>([]);
  const [processesByAssessment, setProcessesByAssessment] =
    useState<Record<number, AssessmentProcess[]>>({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    const token = getToken();

    if (!token) {
      setError("Authentication token is not available.");
      setLoading(false);
      return;
    }

    if (!Number.isFinite(planId) || planId <= 0) {
      setError("Invalid audit plan id.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const headers = {
      Authorization: `Bearer ${token}`,
    };

    try {
      const [planResponse, assessmentResponse] =
        await Promise.all([
          fetch(`${API_BASE}/audit/plans/${planId}`, {
            headers,
            cache: "no-store",
          }),
          fetch(`${API_BASE}/pam/assessments`, {
            headers,
            cache: "no-store",
          }),
        ]);

      if (!planResponse.ok) {
        throw new Error(
          `Audit plan request failed: ${planResponse.status}`
        );
      }

      if (!assessmentResponse.ok) {
        throw new Error(
          `Assessment request failed: ${assessmentResponse.status}`
        );
      }

      const loadedPlan =
        (await planResponse.json()) as AuditPlan;

      const loadedAssessments =
        (await assessmentResponse.json()) as Assessment[];

      setPlan(loadedPlan);
      setAssessments(loadedAssessments);

      const compatibleAssessments =
        loadedAssessments.filter(
          (assessment) =>
            assessment.context.standard_id ===
              loadedPlan.standard_id &&
            assessment.context.standard_version_id ===
              loadedPlan.standard_version_id
        );

      const targetResults: AuditTarget[] = [];
      const processMap: Record<
        number,
        AssessmentProcess[]
      > = {};

      for (const assessment of compatibleAssessments) {
        const [targetResponse, processResponse] =
          await Promise.all([
            fetch(
              `${API_BASE}/pam/assessments/${assessment.id}/audit-targets`,
              {
                headers,
                cache: "no-store",
              }
            ),
            fetch(
              `${API_BASE}/pam/assessments/${assessment.id}/processes`,
              {
                headers,
                cache: "no-store",
              }
            ),
          ]);

        if (!targetResponse.ok) {
          throw new Error(
            `Audit target request failed for assessment ${assessment.id}: ${targetResponse.status}`
          );
        }

        if (!processResponse.ok) {
          throw new Error(
            `Assessment process request failed for assessment ${assessment.id}: ${processResponse.status}`
          );
        }

        const assessmentTargets =
          (await targetResponse.json()) as AuditTarget[];

        const assessmentProcesses =
          (await processResponse.json()) as AssessmentProcess[];

        targetResults.push(
          ...assessmentTargets.filter(
            (target) =>
              target.audit_plan_id === loadedPlan.id
          )
        );

        processMap[assessment.id] =
          assessmentProcesses;
      }

      setTargets(targetResults);
      setProcessesByAssessment(processMap);
    } catch (err) {
      setPlan(null);
      setTargets([]);
      setProcessesByAssessment({});

      setError(
        err instanceof Error
          ? err.message
          : "Audit plan workspace could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const compatibleAssessments = useMemo(() => {
    if (!plan) {
      return [];
    }

    return assessments.filter(
      (assessment) =>
        assessment.context.standard_id ===
          plan.standard_id &&
        assessment.context.standard_version_id ===
          plan.standard_version_id
    );
  }, [assessments, plan]);

  const completedCount = targets.filter(
    (target) =>
      target.status.toUpperCase() === "COMPLETED"
  ).length;

  const inProgressCount = targets.filter(
    (target) =>
      target.status.toUpperCase() === "IN_PROGRESS"
  ).length;

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl py-16 text-center text-sm text-slate-500">
        Loading audit plan workspace...
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        <Link
          href="/maturity/internal-audit"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
        >
          <ArrowLeft size={15} />
          Internal Audit
        </Link>

        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || "Audit plan was not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href="/maturity/internal-audit"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft size={14} />
            Internal Audit
          </Link>

          <div className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Maturity Audit Plan
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-950">
              {plan.name}
            </h1>

            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                plan.status
              )}`}
            >
              {statusLabel(plan.status)}
            </span>
          </div>

          <div className="mt-1 text-sm font-medium text-slate-500">
            {plan.reference}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadData()}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Target size={17} />
            Audit Targets
          </div>
          <div className="mt-3 text-3xl font-semibold text-slate-950">
            {targets.length}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <ClipboardCheck size={17} />
            In Progress
          </div>
          <div className="mt-3 text-3xl font-semibold text-slate-950">
            {inProgressCount}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <ShieldCheck size={17} />
            Completed
          </div>
          <div className="mt-3 text-3xl font-semibold text-slate-950">
            {completedCount}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">
            Plan Definition
          </h2>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Objective
            </div>
            <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {plan.objective || "No objective defined."}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Scope
            </div>
            <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {plan.scope || "No scope defined."}
            </div>
          </div>
        </div>

        <div className="grid gap-px border-t border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
          <Fact
            label="Audit Type"
            value={statusLabel(plan.audit_type)}
          />

          <Fact
            label="Assessment Contexts"
            value={String(compatibleAssessments.length)}
          />

          <Fact
            label="Planned Start"
            value={plan.planned_start || "-"}
          />

          <Fact
            label="Planned End"
            value={plan.planned_end || "-"}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
          <CalendarDays
            size={18}
            className="text-slate-500"
          />
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              Audit Targets
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Execution scope assigned to this maturity audit plan.
            </p>
          </div>
        </div>

        <div className="p-5">
          {!targets.length ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-5 py-10 text-center text-sm text-slate-500">
              No audit target is currently assigned to this plan.
            </div>
          ) : (
            <div className="space-y-3">
              {targets.map((target) => {
                const process =
                  processesByAssessment[
                    target.pam_assessment_id
                  ]?.find(
                    (item) =>
                      item.id ===
                      target.assessment_process_id
                  );

                return (
                  <div
                    key={target.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-slate-950">
                            {target.process_attribute_code ||
                              `Attribute #${target.process_attribute_id}`}
                            {target.process_attribute_name
                              ? ` - ${target.process_attribute_name}`
                              : ""}
                          </div>

                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(
                              target.status
                            )}`}
                          >
                            {statusLabel(target.status)}
                          </span>
                        </div>

                        <div className="mt-2 text-sm text-slate-600">
                          Process:{" "}
                          <span className="font-medium text-slate-900">
                            {process
                              ? `${
                                  process.pam_process_code
                                    ? `${process.pam_process_code} - `
                                    : ""
                                }${
                                  process.pam_process_name ||
                                  `Process #${process.id}`
                                }`
                              : target.process_code
                              ? `${target.process_code}${
                                  target.process_name
                                    ? ` - ${target.process_name}`
                                    : ""
                                }`
                              : `Assessment Process #${target.assessment_process_id}`}
                          </span>
                        </div>

                        <div className="mt-1 text-sm text-slate-600">
                          Criterion:{" "}
                          <span className="font-medium text-slate-900">
                            {target.indicator_code ||
                              "Entire Process Attribute"}
                          </span>
                        </div>
                      </div>

                      <Link
                        href={`/maturity/internal-audit/targets/${target.id}?assessment_id=${target.pam_assessment_id}`}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                      >
                        {String(target.status || "")
                          .trim()
                          .toUpperCase() === "COMPLETED"
                          ? "View Audit"
                          : String(target.status || "")
                                .trim()
                                .toUpperCase() === "IN_PROGRESS"
                            ? "Continue Audit"
                            : "Execute Audit"}
                        <ArrowRight size={15} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
