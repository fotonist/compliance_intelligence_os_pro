"use client";

import MaturityAuditFindingWorkspace from "./MaturityAuditFindingWorkspace";

import {
  ClipboardCheck,
  Plus,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import ProcessAttributeEvaluationEditor from "./ProcessAttributeEvaluationEditor";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

type AchievementIndicator = {
  id: number;
  code: string;
  name?: string | null;
  text?: string | null;
  description?: string | null;
};

type AuditPlan = {
  id: number;
  reference: string;
  name: string;
  audit_type: string;
  status: string;
  process_id?: number | null;
  standard_id?: number | null;
  standard_version_id?: number | null;
  lead_auditor_id?: number | null;
  planned_start?: string | null;
  planned_end?: string | null;
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

type AssessmentContext = {
  standard_id: number;
  standard_version_id: number;
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

function displayStatus(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );
}

function getIndicatorLabel(
  indicator: AchievementIndicator
) {
  return (
    indicator.name ||
    indicator.text ||
    indicator.description ||
    indicator.code
  );
}

type ProcessAttributeEvaluation = {
  id: number;
  process_attribute_id: number;
  rating?: string | null;
  justification?: string | null;
  status: string;
  evaluated_by?: number | null;
  evaluated_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export default function MaturityAuditWorkspace({
  assessmentId,
  assessmentProcessId,
  processAttributeId,
  attributeCode,
  indicators,
}: {
  assessmentId: number;
  assessmentProcessId: number;
  processAttributeId: number;
  attributeCode: string;
  indicators: AchievementIndicator[];
}) {
  const [
    attributeEvaluation,
    setAttributeEvaluation,
  ] = useState<ProcessAttributeEvaluation | null>(null);

  const [plans, setPlans] = useState<AuditPlan[]>([]);
  const [targets, setTargets] = useState<AuditTarget[]>([]);
  const [context, setContext] =
    useState<AssessmentContext | null>(null);

  const [planId, setPlanId] = useState("");
  const [executingTargetId, setExecutingTargetId] = useState<number | null>(null);
  const [executionObservation, setExecutionObservation] = useState("");
  const [executionConclusion, setExecutionConclusion] = useState("");
  const [executionResult, setExecutionResult] = useState("");
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [creatingPlan, setCreatingPlan] = useState(false);

  const [planReference, setPlanReference] = useState("");
  const [planName, setPlanName] = useState("");
  const [planObjective, setPlanObjective] = useState("");
  const [planScope, setPlanScope] = useState("");
  const [planStart, setPlanStart] = useState("");
  const [planEnd, setPlanEnd] = useState("");
  const [scopeType, setScopeType] =
    useState<"attribute" | "indicator">("attribute");
  const [indicatorId, setIndicatorId] =
    useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadAttributeEvaluation = useCallback(async () => {
    const token =
      window.localStorage.getItem("access_token") ||
      window.sessionStorage.getItem("access_token") ||
      window.localStorage.getItem("token") ||
      window.sessionStorage.getItem("token") ||
      "";

    if (!token) {
      setAttributeEvaluation(null);
      return;
    }

    const response = await fetch(
      `${API_BASE}/pam/assessments/${assessmentId}/processes/${assessmentProcessId}/process-attribute-evaluations`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      setAttributeEvaluation(null);
      return;
    }

    const data =
      (await response.json()) as ProcessAttributeEvaluation[];

    const evaluation =
      Array.isArray(data)
        ? data.find((item) =>
            Number(item.process_attribute_id) ===
            Number(processAttributeId)
          ) || null
        : null;

    setAttributeEvaluation(evaluation);
  }, [
    assessmentId,
    assessmentProcessId,
    processAttributeId,
  ]);

  const loadData = useCallback(async () => {
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

    const loadErrors: string[] = [];

    try {
      try {
        const contextResponse = await fetch(
          `${API_BASE}/pam/assessments/${assessmentId}/context`,
          {
            headers,
            cache: "no-store",
          }
        );

        if (!contextResponse.ok) {
          throw new Error(
            `Assessment context request failed: ${contextResponse.status}`
          );
        }

        const contextData =
          (await contextResponse.json()) as AssessmentContext;

        setContext(contextData);
      } catch (err) {
        setContext(null);

        loadErrors.push(
          err instanceof Error
            ? `Context: ${err.message}`
            : "Context: request failed."
        );
      }

      try {
        const plansResponse = await fetch(
          `${API_BASE}/audit/plans?framework_type=MATURITY_BASED`,
          {
            headers,
            cache: "no-store",
          }
        );

        if (!plansResponse.ok) {
          throw new Error(
            `Audit plan request failed: ${plansResponse.status}`
          );
        }

        const planData =
          (await plansResponse.json()) as AuditPlan[];

        setPlans(planData);
      } catch (err) {
        setPlans([]);

        loadErrors.push(
          err instanceof Error
            ? `Plans: ${err.message}`
            : "Plans: request failed."
        );
      }

      try {
        const targetsResponse = await fetch(
          `${API_BASE}/pam/assessments/${assessmentId}/audit-targets?assessment_process_id=${assessmentProcessId}`,
          {
            headers,
            cache: "no-store",
          }
        );

        if (!targetsResponse.ok) {
          throw new Error(
            `Audit target request failed: ${targetsResponse.status}`
          );
        }

        const targetData =
          (await targetsResponse.json()) as AuditTarget[];

        setTargets(targetData);
      } catch (err) {
        setTargets([]);

        loadErrors.push(
          err instanceof Error
            ? `Targets: ${err.message}`
            : "Targets: request failed."
        );
      }

      if (loadErrors.length > 0) {
        setError(loadErrors.join(" | "));
      }
    } finally {
      setLoading(false);
    }
  }, [
    assessmentId,
    assessmentProcessId,
  ]);
  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void loadAttributeEvaluation();
  }, [loadAttributeEvaluation]);

  const attributeTargets = useMemo(
    () =>
      targets.filter(
        (target) =>
          target.process_attribute_id ===
          processAttributeId
      ),
    [
      targets,
      processAttributeId,
    ]
  );

  const selectedPlan = useMemo(
    () =>
      plans.find(
        (plan) =>
          plan.id === Number(planId)
      ) || null,
    [
      plans,
      planId,
    ]
  );

  const createPlan = async () => {
    const token = getToken();

    if (!token) {
      setError(
        "Authentication token is not available."
      );
      return;
    }

    if (!context) {
      setError(
        "Assessment context is not available."
      );
      return;
    }

    if (!planReference.trim()) {
      setError(
        "Audit plan reference is required."
      );
      return;
    }

    if (!planName.trim()) {
      setError(
        "Audit plan name is required."
      );
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
              context.standard_id,
            standard_version_id:
              context.standard_version_id,
            process_id: null,
            lead_auditor_id: null,
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
      setShowPlanForm(false);

      await loadData();

      setPlanId(String(created.id));

      setMessage(
        "Audit plan created and selected successfully."
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

  const updateExecution = async (
    target: AuditTarget,
    status: string
  ) => {
    const token = getToken();

    if (!token) {
      setError(
        "Authentication token is not available."
      );
      return;
    }

    setExecutingTargetId(target.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/pam/assessments/${assessmentId}/audit-targets/${target.id}/execution`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status,
            result:
              executionResult.trim() || null,
            observation:
              executionObservation.trim() || null,
            conclusion:
              executionConclusion.trim() || null,
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
            `Audit execution update failed: ${response.status}`
        );
      }

      const updated =
        (await response.json()) as AuditTarget;

      setExecutionObservation(
        updated.observation || ""
      );
      setExecutionConclusion(
        updated.conclusion || ""
      );
      setExecutionResult(
        updated.result || ""
      );

      await loadData();

      setMessage(
        status === "IN_PROGRESS"
          ? "Audit execution started successfully."
          : status === "COMPLETED"
            ? "Audit execution completed successfully."
            : "Audit execution updated successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Audit execution could not be updated."
      );
    } finally {
      setExecutingTargetId(null);
    }
  };

  const createTarget = async () => {
    const token = getToken();

    if (!token) {
      setError(
        "Authentication token is not available."
      );
      return;
    }

    if (!planId) {
      setError("Select an audit plan.");
      return;
    }

    if (
      scopeType === "indicator" &&
      !indicatorId
    ) {
      setError(
        "Select an achievement criterion."
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/pam/assessments/${assessmentId}/audit-targets`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assessment_process_id:
              assessmentProcessId,
            audit_plan_id: Number(planId),
            process_attribute_id:
              processAttributeId,
            standard_indicator_id:
              scopeType === "indicator"
                ? Number(indicatorId)
                : null,
            auditor_id:
              selectedPlan?.lead_auditor_id ??
              null,
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
            `Audit target creation failed: ${response.status}`
        );
      }

      setMessage(
        "Audit target created successfully."
      );

      setIndicatorId("");
      setScopeType("attribute");

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Audit target could not be created."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Loading internal audit workspace...
      </div>
    );
  }

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-slate-500" />

              <h4 className="text-sm font-semibold text-slate-950">
                Internal Audit
              </h4>
            </div>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Define audit targets for {attributeCode}
              using the active assessment context.
            </p>
          </div>

          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
            {attributeTargets.length} Targets
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 p-5 2xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-slate-400" />

            <div className="text-sm font-semibold text-slate-900">
              Define Audit Target
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Audit Plan
            </label>

            <select
              value={planId}
              onChange={(event) =>
                setPlanId(event.target.value)
              }
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
            >
              <option value="">
                Select audit plan
              </option>

              {plans.map((plan) => (
                <option
                  key={plan.id}
                  value={plan.id}
                >
                  {plan.reference} - {plan.name}
                </option>
              ))}
            </select>

            {plans.length === 0 ? (
              <div className="mt-2 text-xs leading-5 text-slate-400">
                No audit plan matches this standard
                and version.
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => {
                setShowPlanForm(
                  (current) => !current
                );
                setError("");
                setMessage("");
              }}
              className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-slate-950"
            >
              <Plus className="h-3.5 w-3.5" />
              {showPlanForm
                ? "Close Plan Form"
                : "Create Audit Plan"}
            </button>

            {showPlanForm ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">
                  New Audit Plan
                </div>

                <div className="mt-1 text-xs leading-5 text-slate-500">
                  The standard and version are inherited
                  from the active maturity assessment.
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Reference
                    </label>

                    <input
                      value={planReference}
                      onChange={(event) =>
                        setPlanReference(
                          event.target.value
                        )
                      }
                      placeholder="IA-2026-001"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Name
                    </label>

                    <input
                      value={planName}
                      onChange={(event) =>
                        setPlanName(
                          event.target.value
                        )
                      }
                      placeholder="Internal Audit"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Objective
                  </label>

                  <textarea
                    value={planObjective}
                    onChange={(event) =>
                      setPlanObjective(
                        event.target.value
                      )
                    }
                    rows={2}
                    className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
                  />
                </div>

                <div className="mt-4">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Scope
                  </label>

                  <textarea
                    value={planScope}
                    onChange={(event) =>
                      setPlanScope(
                        event.target.value
                      )
                    }
                    rows={2}
                    className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
                  />
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Planned Start
                    </label>

                    <input
                      type="date"
                      value={planStart}
                      onChange={(event) =>
                        setPlanStart(
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Planned End
                    </label>

                    <input
                      type="date"
                      value={planEnd}
                      onChange={(event) =>
                        setPlanEnd(
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
                    />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Standard
                    </div>

                    <div className="mt-1 text-sm font-semibold text-slate-800">
                      {context?.standard_id ?? "-"}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Version
                    </div>

                    <div className="mt-1 text-sm font-semibold text-slate-800">
                      {context?.standard_version_id ?? "-"}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={creatingPlan}
                    onClick={() =>
                      setShowPlanForm(false)
                    }
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={
                      creatingPlan ||
                      !context ||
                      !planReference.trim() ||
                      !planName.trim()
                    }
                    onClick={() =>
                      void createPlan()
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {creatingPlan ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}

                    Create Plan
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Audit Scope
            </div>

            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setScopeType("attribute");
                  setIndicatorId("");
                }}
                className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
                  scopeType === "attribute"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                Entire Process Attribute
              </button>

              <button
                type="button"
                disabled={indicators.length === 0}
                onClick={() =>
                  setScopeType("indicator")
                }
                className={`rounded-xl border px-3 py-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  scopeType === "indicator"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                Achievement Criterion
              </button>
            </div>
          </div>

          {scopeType === "indicator" ? (
            <div className="mt-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Achievement Criterion
              </label>

              <select
                value={indicatorId}
                onChange={(event) =>
                  setIndicatorId(
                    event.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
              >
                <option value="">
                  Select criterion
                </option>

                {indicators.map(
                  (indicator) => (
                    <option
                      key={indicator.id}
                      value={indicator.id}
                    >
                      {indicator.code} -{" "}
                      {getIndicatorLabel(
                        indicator
                      )}
                    </option>
                  )
                )}
              </select>
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700">
              {message}
            </div>
          ) : null}

          <button
            type="button"
            disabled={
              saving ||
              !planId ||
              (scopeType === "indicator" &&
                !indicatorId)
            }
            onClick={() =>
              void createTarget()
            }
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <ClipboardCheck className="h-4 w-4" />
            )}

            Create Audit Target
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-4">
            <div className="text-sm font-semibold text-slate-900">
              Process Attribute Evaluation
            </div>

            <div className="mt-1 text-xs leading-5 text-slate-500">
              Canonical capability rating for {attributeCode}. This evaluation is shared with the Process Assessment Workspace.
            </div>
          </div>

          <ProcessAttributeEvaluationEditor
            assessmentId={assessmentId}
            assessmentProcessId={assessmentProcessId}
            processAttributeId={processAttributeId}
            evaluation={attributeEvaluation}
            onSaved={loadAttributeEvaluation}
          />
        </div>

        <div className="rounded-xl border border-slate-200 p-4">
          <div className="text-sm font-semibold text-slate-900">
            Audit Targets
          </div>

          <div className="mt-1 text-xs text-slate-500">
            Targets defined for {attributeCode}.
          </div>

          {attributeTargets.length ? (
            <div className="mt-4 space-y-3">
              {attributeTargets.map(
                (target) => (
                  <div
                    key={target.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-slate-500">
                          {target.audit_plan_reference ||
                            `Plan #${target.audit_plan_id}`}
                        </div>

                        <div className="mt-1 text-sm font-semibold text-slate-900">
                          {target.audit_plan_name ||
                            "Audit Plan"}
                        </div>
                      </div>

                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                        {displayStatus(
                          target.status
                        )}
                      </span>
                    </div>

                    <div className="mt-3 border-t border-slate-200 pt-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Scope
                      </div>

                      <div className="mt-1 text-sm text-slate-700">
                        {target.standard_indicator_id
                          ? `${
                              target.indicator_code ||
                              "Criterion"
                            } - ${
                              target.indicator_name ||
                              "Achievement Criterion"
                            }`
                          : `${
                              target.process_attribute_code ||
                              attributeCode
                            } - Entire Process Attribute`}
                      </div>
                    </div>

                    {target.status === "READY" ? (
                      <div className="mt-4 border-t border-slate-200 pt-4">
                        <button
                          type="button"
                          disabled={
                            executingTargetId === target.id
                          }
                          onClick={() => {
                            setExecutionObservation(
                              target.observation || ""
                            );
                            setExecutionConclusion(
                              target.conclusion || ""
                            );
                            setExecutionResult(
                              target.result || ""
                            );

                            void updateExecution(
                              target,
                              "IN_PROGRESS"
                            );
                          }}
                          className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {executingTargetId === target.id
                            ? "Starting..."
                            : "Start Audit"}
                        </button>
                      </div>
                    ) : null}

                    {target.status === "IN_PROGRESS" ? (
                      <div className="mt-4 border-t border-slate-200 pt-4">
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Audit Execution
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-4">
                          <div>
                            <label className="text-xs font-semibold text-slate-600">
                              Observation
                            </label>

                            <textarea
                              defaultValue={
                                target.observation || ""
                              }
                              onChange={(event) =>
                                setExecutionObservation(
                                  event.target.value
                                )
                              }
                              rows={3}
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-slate-600">
                              Conclusion
                            </label>

                            <textarea
                              defaultValue={
                                target.conclusion || ""
                              }
                              onChange={(event) =>
                                setExecutionConclusion(
                                  event.target.value
                                )
                              }
                              rows={3}
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-slate-600">
                              Result
                            </label>

                            <input
                              type="text"
                              defaultValue={
                                target.result || ""
                              }
                              onChange={(event) =>
                                setExecutionResult(
                                  event.target.value
                                )
                              }
                              placeholder="Enter audit result"
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
                            />
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={
                              executingTargetId === target.id
                            }
                            onClick={() =>
                              void updateExecution(
                                target,
                                "IN_PROGRESS"
                              )
                            }
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                          >
                            Save Progress
                          </button>

                          <button
                            type="button"
                            disabled={
                              executingTargetId === target.id
                            }
                            onClick={() =>
                              void updateExecution(
                                target,
                                "EXCEPTION"
                              )
                            }
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                          >
                            Mark Exception
                          </button>

                          <button
                            type="button"
                            disabled={
                              executingTargetId === target.id
                            }
                            onClick={() =>
                              void updateExecution(
                                target,
                                "COMPLETED"
                              )
                            }
                            className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                          >
                            Complete Audit
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <MaturityAuditFindingWorkspace
                      assessmentId={assessmentId}
                      auditTargetId={target.id}
                      auditPlanId={target.audit_plan_id}
                      attributeCode={attributeCode}
                      indicatorCode={
                        target.indicator_code || null
                      }
                    />


                    {target.status === "COMPLETED" ||
                    target.status === "EXCEPTION" ? (
                      <div className="mt-4 border-t border-slate-200 pt-4">
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Execution Summary
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-3">
                          <div>
                            <div className="text-xs font-medium text-slate-400">
                              Result
                            </div>

                            <div className="mt-1 text-sm text-slate-700">
                              {target.result || "-"}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs font-medium text-slate-400">
                              Observation
                            </div>

                            <div className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                              {target.observation || "-"}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs font-medium text-slate-400">
                              Conclusion
                            </div>

                            <div className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                              {target.conclusion || "-"}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <div className="text-xs font-medium text-slate-400">
                                Started
                              </div>

                              <div className="mt-1 text-sm text-slate-700">
                                {target.started_at
                                  ? new Date(
                                      target.started_at
                                    ).toLocaleString()
                                  : "-"}
                              </div>
                            </div>

                            <div>
                              <div className="text-xs font-medium text-slate-400">
                                Completed
                              </div>

                              <div className="mt-1 text-sm text-slate-700">
                                {target.completed_at
                                  ? new Date(
                                      target.completed_at
                                    ).toLocaleString()
                                  : "-"}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
              No audit target has been defined for
              this process attribute.
            </div>
          )}
        </div>
      </div>

      {context ? (
        <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-400">
          Standard {context.standard_id} / Version{" "}
          {context.standard_version_id}
        </div>
      ) : null}
    </div>
  );
}

