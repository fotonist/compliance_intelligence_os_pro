"use client";

import Link from "next/link";
import {
  ClipboardCheck,
  RefreshCw,
  ShieldCheck,
  Target,
  Activity,
  Plus,
  ArrowRight,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

type AssessmentContext = {
  tenant_id: number;
  framework_adoption_id: number;
  standard_id: number;
  standard_version_id: number;
  standard_code: string;
  standard_type: string;
  version_code: string;
  pam_framework_model_id: number;
  pam_framework_model_code: string;
  capability_framework_model_id: number;
  capability_framework_model_code: string;
};

type Assessment = {
  id: number;
  tenant_id: number;
  framework_adoption_id: number;
  framework_model_id: number;
  name: string;
  scope?: string | null;
  status: string;
  audit_plan_id?: number | null;
  context: AssessmentContext;
};

type AssessmentProcess = {
  id: number;
  assessment_id: number;
  tenant_process_id?: number | null;
  pam_process_id: number;
  pam_process_code?: string | null;
  pam_process_name?: string | null;
  in_scope: boolean;
  target_capability_level?: number | null;
  status: string;
};

type AuditPlan = {
  id: number;
  reference: string;
  name: string;
  audit_type: string;
  status: string;
  objective?: string | null;
  scope?: string | null;
  process_id?: number | null;
  standard_id?: number | null;
  standard_version_id?: number | null;
  lead_auditor_id?: number | null;
  planned_start?: string | null;
  planned_end?: string | null;
};

type EligibleAuditor = {
  id: number;
  email: string;
  full_name?: string | null;
};

type AuditTarget = {
  id: number;
  tenant_id: number;
  audit_plan_id: number;
  pam_assessment_id: number;
  assessment_process_id: number;
  process_attribute_id: number;
  standard_indicator_id?: number | null;
  status: string;
  result?: string | null;
  observation?: string | null;
  conclusion?: string | null;
  auditor_id?: number | null;
  started_at?: string | null;
  completed_at?: string | null;
  audit_plan_reference?: string | null;
  audit_plan_name?: string | null;
  process_attribute_code?: string | null;
  process_attribute_name?: string | null;
  indicator_code?: string | null;
  indicator_name?: string | null;
};

function getToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return (
    window.localStorage.getItem("access_token") ||
    window.sessionStorage.getItem("access_token") ||
    window.localStorage.getItem("token") ||
    window.sessionStorage.getItem("token") ||
    ""
  );
}

function statusLabel(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusClass(value?: string | null) {
  const status = (value || "").toUpperCase();

  if (status === "COMPLETED" || status === "CLOSED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "IN_PROGRESS") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (status === "EXCEPTION") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

export default function MaturityInternalAuditPage() {
  const [assessments, setAssessments] =
    useState<Assessment[]>([]);
  const [assessmentId, setAssessmentId] =
    useState("");
  const [processes, setProcesses] =
    useState<AssessmentProcess[]>([]);
  const [processId, setProcessId] =
    useState("");
  const [plans, setPlans] =
    useState<AuditPlan[]>([]);
  const [targets, setTargets] =
    useState<AuditTarget[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [detailLoading, setDetailLoading] =
    useState(false);
  const [error, setError] =
    useState("");
  const [message, setMessage] =
    useState("");
  const [selectedPlanId, setSelectedPlanId] =
    useState("");
  const [showPlanForm, setShowPlanForm] =
    useState(false);
  const [creatingPlan, setCreatingPlan] =
    useState(false);
  const [planReference, setPlanReference] =
    useState("");
  const [planName, setPlanName] =
    useState("");
  const [planObjective, setPlanObjective] =
    useState("");
  const [planScope, setPlanScope] =
    useState("");
  const [planStart, setPlanStart] =
    useState("");
  const [planEnd, setPlanEnd] =
    useState("");
  const [planLeadAuditorId, setPlanLeadAuditorId] =
    useState("");
  const [eligibleAuditors, setEligibleAuditors] =
    useState<EligibleAuditor[]>([]);
  const [auditorsLoading, setAuditorsLoading] =
    useState(false);

  const selectedAssessment = useMemo(
    () =>
      assessments.find(
        (item) => item.id === Number(assessmentId)
      ) || null,
    [assessments, assessmentId]
  );

  const compatiblePlans = useMemo(() => {
    if (!selectedAssessment) {
      return [];
    }

    const context = selectedAssessment.context;

    return plans.filter(
      (plan) =>
        plan.standard_id === context.standard_id &&
        plan.standard_version_id ===
          context.standard_version_id
    );
  }, [plans, selectedAssessment]);

  const compatiblePlanIds = useMemo(
    () => new Set(compatiblePlans.map((plan) => plan.id)),
    [compatiblePlans]
  );

  const selectedPlan = useMemo(
    () =>
      compatiblePlans.find(
        (plan) => plan.id === Number(selectedPlanId)
      ) || null,
    [compatiblePlans, selectedPlanId]
  );

  const visibleTargets = useMemo(() => {
    return targets.filter((target) => {
      if (!compatiblePlanIds.has(target.audit_plan_id)) {
        return false;
      }

      if (
        processId &&
        target.assessment_process_id !== Number(processId)
      ) {
        return false;
      }

      return true;
    });
  }, [
    targets,
    compatiblePlanIds,
    processId,
  ]);

  const processMap = useMemo(
    () =>
      new Map(
        processes.map((process) => [
          process.id,
          process,
        ])
      ),
    [processes]
  );

  const completedCount = visibleTargets.filter(
    (target) =>
      target.status.toUpperCase() === "COMPLETED"
  ).length;

  const inProgressCount = visibleTargets.filter(
    (target) =>
      target.status.toUpperCase() === "IN_PROGRESS"
  ).length;

  const exceptionCount = visibleTargets.filter(
    (target) =>
      target.status.toUpperCase() === "EXCEPTION"
  ).length;

  const loadRoot = useCallback(async () => {
    const token = getToken();

    if (!token) {
      setError("Authentication token is not available.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const headers = {
      Authorization: `Bearer ${token}`,
    };

    const errors: string[] = [];

    try {
      try {
        const response = await fetch(
          `${API_BASE}/pam/assessments`,
          {
            headers,
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            `Assessment request failed: ${response.status}`
          );
        }

        const data =
          (await response.json()) as Assessment[];

        setAssessments(data);

        setAssessmentId((current) => {
          if (
            current &&
            data.some(
              (item) => item.id === Number(current)
            )
          ) {
            return current;
          }

          return data.length
            ? String(data[0].id)
            : "";
        });
      } catch (err) {
        setAssessments([]);

        errors.push(
          err instanceof Error
            ? `Assessments: ${err.message}`
            : "Assessments: request failed."
        );
      }

      try {
        const response = await fetch(
          `${API_BASE}/audit/plans?framework_type=MATURITY_BASED`,
          {
            headers,
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            `Audit plan request failed: ${response.status}`
          );
        }

        setPlans(
          (await response.json()) as AuditPlan[]
        );
      } catch (err) {
        setPlans([]);

        errors.push(
          err instanceof Error
            ? `Plans: ${err.message}`
            : "Plans: request failed."
        );
      }

      if (errors.length) {
        setError(errors.join(" | "));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAssessment = useCallback(
    async (selectedId: number) => {
      const token = getToken();

      if (!token) {
        setError("Authentication token is not available.");
        return;
      }

      setDetailLoading(true);
      setError("");

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const errors: string[] = [];

      try {
        try {
          const response = await fetch(
            `${API_BASE}/pam/assessments/${selectedId}/processes`,
            {
              headers,
              cache: "no-store",
            }
          );

          if (!response.ok) {
            throw new Error(
              `Process request failed: ${response.status}`
            );
          }

          setProcesses(
            (await response.json()) as AssessmentProcess[]
          );
        } catch (err) {
          setProcesses([]);

          errors.push(
            err instanceof Error
              ? `Processes: ${err.message}`
              : "Processes: request failed."
          );
        }

        try {
          const response = await fetch(
            `${API_BASE}/pam/assessments/${selectedId}/audit-targets`,
            {
              headers,
              cache: "no-store",
            }
          );

          if (!response.ok) {
            throw new Error(
              `Audit target request failed: ${response.status}`
            );
          }

          setTargets(
            (await response.json()) as AuditTarget[]
          );
        } catch (err) {
          setTargets([]);

          errors.push(
            err instanceof Error
              ? `Targets: ${err.message}`
              : "Targets: request failed."
          );
        }

        if (errors.length) {
          setError(errors.join(" | "));
        }
      } finally {
        setDetailLoading(false);
      }
    },
    []
  );

  const loadEligibleAuditors = async () => {
    const token = getToken();

    if (!token) {
      setEligibleAuditors([]);
      return;
    }

    setAuditorsLoading(true);

    try {
      const response = await fetch(
        `${API_BASE}/pam/eligible-auditors`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          `Eligible auditors request failed: ${response.status}`
        );
      }

      const data =
        (await response.json()) as EligibleAuditor[];

      setEligibleAuditors(data);
    } catch (err) {
      setEligibleAuditors([]);

      setError(
        err instanceof Error
          ? err.message
          : "Eligible auditors could not be loaded."
      );
    } finally {
      setAuditorsLoading(false);
    }
  };

  const createPlan = async () => {
    const token = getToken();

    if (!token) {
      setError("Authentication token is not available.");
      return;
    }

    if (!selectedAssessment) {
      setError("Select a maturity assessment first.");
      return;
    }

    if (!planReference.trim()) {
      setError("Audit plan reference is required.");
      return;
    }

    if (!planName.trim()) {
      setError("Audit plan name is required.");
      return;
    }

    if (!planLeadAuditorId) {
      setError("Lead auditor is required.");
      return;
    }

    if (
      planStart &&
      planEnd &&
      planEnd < planStart
    ) {
      setError(
        "Planned end date cannot be before planned start date."
      );
      return;
    }

    setCreatingPlan(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/audit/plans`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reference: planReference.trim(),
            name: planName.trim(),
            audit_type: "internal",
            objective:
              planObjective.trim() || null,
            scope:
              planScope.trim() || null,
            standard_id:
              selectedAssessment.context.standard_id,
            standard_version_id:
              selectedAssessment.context.standard_version_id,
            process_id: null,
            lead_auditor_id:
              Number(planLeadAuditorId),
            planned_start:
              planStart || null,
            planned_end:
              planEnd || null,
          }),
        }
      );

      if (!response.ok) {
        let detail = "";

        try {
          const body = await response.json();

          detail =
            typeof body?.detail === "string"
              ? body.detail
              : "";
        } catch {
          detail = await response.text();
        }

        throw new Error(
          detail ||
            `Audit plan creation failed: ${response.status}`
        );
      }

      const created =
        (await response.json()) as AuditPlan;

      setPlanReference("");
      setPlanName("");
      setPlanObjective("");
      setPlanScope("");
      setPlanStart("");
      setPlanEnd("");
      setPlanLeadAuditorId("");
      setShowPlanForm(false);

      await loadRoot();

      setSelectedPlanId(String(created.id));

      setMessage(
        "Maturity audit plan created successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Audit plan could not be created."
      );
    } finally {
      setCreatingPlan(false);
    }
  };

  useEffect(() => {
    void loadRoot();
  }, [loadRoot]);

  useEffect(() => {
    if (!assessmentId) {
      setProcesses([]);
      setTargets([]);
      setProcessId("");
      return;
    }

    setProcessId("");
    setSelectedPlanId("");
    setShowPlanForm(false);
    setMessage("");
    void loadAssessment(Number(assessmentId));
  }, [assessmentId, loadAssessment]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Maturity Workspace
          </div>

          <h1 className="mt-2 text-2xl font-semibold text-slate-950">
            Internal Audit
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Manage maturity audit scope through the active assessment,
            standard version, assessment process, process attribute,
            and achievement criterion lineage.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadRoot()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => {
              setShowPlanForm(true);
              setSelectedPlanId("");
              setPlanLeadAuditorId("");
              setError("");
              setMessage("");
              void loadEligibleAuditors();
            }}
            disabled={!selectedAssessment}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={15} />
            New Audit Plan
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-3">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Assessment
          </label>

          <select
            value={assessmentId}
            onChange={(event) =>
              setAssessmentId(event.target.value)
            }
            disabled={loading}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400"
          >
            {!assessments.length ? (
              <option value="">
                No maturity assessment available
              </option>
            ) : null}

            {assessments.map((assessment) => (
              <option
                key={assessment.id}
                value={assessment.id}
              >
                {assessment.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Framework
          </label>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900">
            {selectedAssessment
              ? `${selectedAssessment.context.standard_code} / ${selectedAssessment.context.version_code}`
              : "No assessment selected"}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Process
          </label>

          <select
            value={processId}
            onChange={(event) =>
              setProcessId(event.target.value)
            }
            disabled={!assessmentId || detailLoading}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 disabled:bg-slate-50"
          >
            <option value="">All assessment processes</option>

            {processes.map((process) => (
              <option
                key={process.id}
                value={process.id}
              >
                {process.pam_process_code
                  ? `${process.pam_process_code} - `
                  : ""}
                {process.pam_process_name ||
                  `Process #${process.id}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={<ClipboardCheck size={17} />}
          label="Compatible Plans"
          value={compatiblePlans.length}
        />

        <Metric
          icon={<Target size={17} />}
          label="Audit Targets"
          value={visibleTargets.length}
        />

        <Metric
          icon={<Activity size={17} />}
          label="In Progress"
          value={inProgressCount}
        />

        <Metric
          icon={<ShieldCheck size={17} />}
          label="Completed"
          value={completedCount}
          detail={
            exceptionCount
              ? `${exceptionCount} exception`
              : undefined
          }
        />
      </div>

      {showPlanForm ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Maturity Audit Planning
              </div>

              <h2 className="mt-1 text-base font-semibold text-slate-950">
                New Audit Plan
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Standard and version are inherited from the selected maturity assessment.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowPlanForm(false)}
              className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
              aria-label="Close plan form"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Reference
                </label>

                <input
                  value={planReference}
                  onChange={(event) =>
                    setPlanReference(event.target.value)
                  }
                  placeholder="IA-ENG01-2026-003"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Plan Name
                </label>

                <input
                  value={planName}
                  onChange={(event) =>
                    setPlanName(event.target.value)
                  }
                  placeholder="ENG 01 Internal Audit"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Objective
                </label>

                <textarea
                  value={planObjective}
                  onChange={(event) =>
                    setPlanObjective(event.target.value)
                  }
                  rows={4}
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Scope
                </label>

                <textarea
                  value={planScope}
                  onChange={(event) =>
                    setPlanScope(event.target.value)
                  }
                  rows={4}
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Lead Auditor
              </label>

              <select
                value={planLeadAuditorId}
                onChange={(event) =>
                  setPlanLeadAuditorId(event.target.value)
                }
                disabled={auditorsLoading}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 disabled:opacity-50"
              >
                <option value="">
                  {auditorsLoading
                    ? "Loading eligible auditors..."
                    : "Select lead auditor"}
                </option>

                {eligibleAuditors.map((auditor) => (
                  <option
                    key={auditor.id}
                    value={auditor.id}
                  >
                    {auditor.full_name?.trim()
                      ? `${auditor.full_name} - ${auditor.email}`
                      : auditor.email}
                  </option>
                ))}
              </select>

              <p className="mt-2 text-xs text-slate-500">
                Only active Internal Auditor users are eligible.
              </p>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Planned Start
                </label>

                <input
                  type="date"
                  value={planStart}
                  onChange={(event) =>
                    setPlanStart(event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Planned End
                </label>

                <input
                  type="date"
                  value={planEnd}
                  onChange={(event) =>
                    setPlanEnd(event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPlanForm(false)}
                disabled={creatingPlan}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void createPlan()}
                disabled={
                  creatingPlan ||
                  !selectedAssessment ||
                  !planLeadAuditorId
                }
                className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <Plus size={15} />

                {creatingPlan
                  ? "Creating..."
                  : "Create Audit Plan"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">
            Audit Plans
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Only plans matching the selected assessment standard
            and standard version are shown.
          </p>
        </div>

        <div className="p-5">
          {!selectedAssessment ? (
            <Empty text="Select a maturity assessment." />
          ) : !compatiblePlans.length ? (
            <Empty text="No compatible maturity audit plan was found for this standard version." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-3 font-semibold">
                      Reference
                    </th>
                    <th className="px-3 py-3 font-semibold">
                      Audit Plan
                    </th>
                    <th className="px-3 py-3 font-semibold">
                      Type
                    </th>
                    <th className="px-3 py-3 font-semibold">
                      Status
                    </th>
                    <th className="px-3 py-3 font-semibold">
                      Targets
                    </th>
                    <th className="px-3 py-3 text-right font-semibold">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {compatiblePlans.map((plan) => {
                    const planTargets =
                      visibleTargets.filter(
                        (target) =>
                          target.audit_plan_id === plan.id
                      );

                    return (
                      <tr
                        key={plan.id}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="px-3 py-4 font-medium text-slate-900">
                          {plan.reference}
                        </td>

                        <td className="px-3 py-4 text-slate-700">
                          {plan.name}
                        </td>

                        <td className="px-3 py-4 text-slate-600">
                          {statusLabel(plan.audit_type)}
                        </td>

                        <td className="px-3 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                              plan.status
                            )}`}
                          >
                            {statusLabel(plan.status)}
                          </span>
                        </td>

                        <td className="px-3 py-4 text-slate-700">
                          {planTargets.length}
                        </td>

                        <td className="px-3 py-4 text-right">
                          <Link
                            href={`/maturity/internal-audit/plans/${plan.id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Open
                            <ArrowRight size={14} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedPlan ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Selected Audit Plan
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-950">
                  {selectedPlan.name}
                </h2>

                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                    selectedPlan.status
                  )}`}
                >
                  {statusLabel(selectedPlan.status)}
                </span>
              </div>

              <div className="mt-1 text-sm font-medium text-slate-500">
                {selectedPlan.reference}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedPlanId("")}
              className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <X size={14} />
              Close
            </button>
          </div>

          <div className="grid gap-5 p-5 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Objective
              </div>

              <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {selectedPlan.objective ||
                  "No objective defined."}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Scope
              </div>

              <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {selectedPlan.scope ||
                  "No scope defined."}
              </div>
            </div>
          </div>

          <div className="grid gap-px border-t border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
            <PlanFact
              label="Framework"
              value={
                selectedAssessment
                  ? `${selectedAssessment.context.standard_code} / ${selectedAssessment.context.version_code}`
                  : "-"
              }
            />

            <PlanFact
              label="Assessment"
              value={selectedAssessment?.name || "-"}
            />

            <PlanFact
              label="Planned Period"
              value={
                selectedPlan.planned_start ||
                selectedPlan.planned_end
                  ? `${selectedPlan.planned_start || "-"} - ${selectedPlan.planned_end || "-"}`
                  : "Not scheduled"
              }
            />

            <PlanFact
              label="Audit Targets"
              value={String(
                visibleTargets.filter(
                  (target) =>
                    target.audit_plan_id ===
                    selectedPlan.id
                ).length
              )}
            />
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">
            Audit Targets
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Canonical maturity targets for the selected assessment.
          </p>
        </div>

        <div className="p-5">
          {detailLoading ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Loading audit targets...
            </div>
          ) : !visibleTargets.length ? (
            <Empty text="No maturity audit target matches the selected context." />
          ) : (
            <div className="space-y-3">
              {visibleTargets.map((target) => {
                const process = processMap.get(
                  target.assessment_process_id
                );

                return (
                  <div
                    key={target.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {target.audit_plan_reference ||
                            `Audit Plan #${target.audit_plan_id}`}
                        </div>

                        <div className="mt-1 text-base font-semibold text-slate-950">
                          {target.audit_plan_name ||
                            "Maturity Internal Audit"}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
                          <span>
                            Process:{" "}
                            <strong className="font-medium text-slate-900">
                              {process
                                ? `${
                                    process.pam_process_code
                                      ? `${process.pam_process_code} - `
                                      : ""
                                  }${
                                    process.pam_process_name ||
                                    `Process #${process.id}`
                                  }`
                                : `Assessment Process #${target.assessment_process_id}`}
                            </strong>
                          </span>

                          <span>
                            Attribute:{" "}
                            <strong className="font-medium text-slate-900">
                              {target.process_attribute_code ||
                                `#${target.process_attribute_id}`}
                            </strong>
                          </span>

                          <span>
                            Criterion:{" "}
                            <strong className="font-medium text-slate-900">
                              {target.indicator_code ||
                                "Entire Process Attribute"}
                            </strong>
                          </span>
                        </div>
                      </div>

                      <span
                        className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                          target.status
                        )}`}
                      >
                        {statusLabel(target.status)}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
                      <Link
                        href={`/maturity/workspace/${target.pam_assessment_id}/process/${target.assessment_process_id}`}
                        className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Open Process Assessment
                      </Link>

                      <Link
                        href={`/maturity/internal-audit/targets/${target.id}?assessment_id=${target.pam_assessment_id}`}
                        className="inline-flex items-center rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
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
                      </Link>

                      <Link
                        href={`/maturity/findings?assessment_id=${target.pam_assessment_id}&audit_target_id=${target.id}`}
                        className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        View Findings
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

function PlanFact({
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

      <div className="mt-2 text-sm font-medium text-slate-900">
        {value}
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  detail?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-slate-500">{icon}</span>

        {detail ? (
          <span className="text-xs text-slate-500">
            {detail}
          </span>
        ) : null}
      </div>

      <div className="mt-4 text-2xl font-semibold text-slate-950">
        {value}
      </div>

      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}
