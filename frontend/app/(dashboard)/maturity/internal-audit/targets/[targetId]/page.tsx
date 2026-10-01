"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  useParams,
  useSearchParams,
} from "next/navigation";
import ProcessAttributeEvaluationEditor from "../../../workspace/[sessionId]/process/[assessmentProcessId]/ProcessAttributeEvaluationEditor";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000";

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

type TargetFindingSummaryItem = {
  id: number;
  status: string;
};

type AuditRevision = {
  id: number;
  audit_maturity_target_id: number;
  revision_no: number;
  tenant_id: number;
  pam_assessment_id: number;
  assessment_process_id: number;
  process_attribute_id: number;
  standard_indicator_id?: number | null;
  auditor_id?: number | null;
  pa_evaluation_id: number;
  rating: string;
  rating_justification?: string | null;
  observation?: string | null;
  conclusion?: string | null;
  result?: string | null;
  started_at?: string | null;
  completed_at: string;
  created_at: string;
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

type EligibleAuditor = {
  id: number;
  email: string;
  full_name?: string | null;
};

type CurrentUser = {
  id?: number | string | null;
  username?: string | null;
  email?: string | null;
  role?: string | null;
  roles?: Array<
    string | {
      name?: string | null;
    }
  >;
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

function label(value?: string | null) {
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

function normalizedRoles(
  user: CurrentUser | null
): string[] {
  if (!user) {
    return [];
  }

  const values: string[] = [];

  if (Array.isArray(user.roles)) {
    for (const role of user.roles) {
      if (typeof role === "string") {
        values.push(role);
      } else if (
        role &&
        typeof role.name === "string"
      ) {
        values.push(role.name);
      }
    }
  }

  if (typeof user.role === "string") {
    values.push(user.role);
  }

  return values
    .map((value) =>
      value
        .trim()
        .toLowerCase()
        .replaceAll("-", "_")
        .replaceAll(" ", "_")
    )
    .map((value) => {
      if (
        value === "internal_audit" ||
        value === "auditor"
      ) {
        return "internal_auditor";
      }

      return value;
    });
}

export default function MaturityAuditTargetWorkspace() {
  const params = useParams();
  const searchParams = useSearchParams();

  const targetId = Number(params.targetId);
  const assessmentId = Number(
    searchParams.get("assessment_id")
  );

  const [target, setTarget] =
    useState<AuditTarget | null>(null);

  const [currentUser, setCurrentUser] =
    useState<CurrentUser | null>(null);

  const [authResolved, setAuthResolved] =
    useState(false);

  const [eligibleAuditors, setEligibleAuditors] =
    useState<EligibleAuditor[]>([]);

  const [selectedAuditorId, setSelectedAuditorId] =
    useState("");

  const [auditorsLoading, setAuditorsLoading] =
    useState(false);

  const [assigningAuditor, setAssigningAuditor] =
    useState(false);

  const [attributeEvaluation, setAttributeEvaluation] =
    useState<ProcessAttributeEvaluation | null>(null);
  const [auditHistory, setAuditHistory] =
    useState<AuditRevision[]>([]);
  const [targetFindings, setTargetFindings] =
    useState<TargetFindingSummaryItem[]>([]);
  const [findingsLoading, setFindingsLoading] =
    useState(false);
  const [findingsError, setFindingsError] =
    useState("");

  const [historyLoading, setHistoryLoading] =
    useState(false);
  const [historyError, setHistoryError] =
    useState("");


  const [evaluationLoading, setEvaluationLoading] =
    useState(false);

  const [evaluationError, setEvaluationError] =
    useState("");

  const [result, setResult] = useState("");
  const [observation, setObservation] = useState("");
  const [conclusion, setConclusion] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadCurrentUser = async () => {
      const token = getToken();

      if (!token) {
        if (!cancelled) {
          setAuthResolved(true);
        }
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE}/auth/me`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

        if (
          response.ok &&
          !cancelled
        ) {
          setCurrentUser(
            (await response.json()) as CurrentUser
          );
        }
      } catch {
        // Backend remains the authorization authority.
      } finally {
        if (!cancelled) {
          setAuthResolved(true);
        }
      }
    };

    void loadCurrentUser();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadEligibleAuditors = useCallback(
    async () => {
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
          setEligibleAuditors([]);
          return;
        }

        const data =
          (await response.json()) as EligibleAuditor[];

        setEligibleAuditors(data);
      } catch {
        setEligibleAuditors([]);
      } finally {
        setAuditorsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!authResolved) {
      return;
    }

    void loadEligibleAuditors();
  }, [
    authResolved,
    loadEligibleAuditors,
  ]);

  const loadTarget = useCallback(async () => {
    const token = getToken();

    if (!token) {
      setError("Authentication token is not available.");
      setLoading(false);
      return;
    }

    if (
      !Number.isFinite(targetId) ||
      targetId <= 0 ||
      !Number.isFinite(assessmentId) ||
      assessmentId <= 0
    ) {
      setError("Invalid audit target context.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/pam/assessments/${assessmentId}/audit-targets`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          `Audit target request failed: ${response.status}`
        );
      }

      const data =
        (await response.json()) as AuditTarget[];

      const found = data.find(
        (item) => item.id === targetId
      );

      if (!found) {
        throw new Error(
          "Audit target was not found in this assessment."
        );
      }

      setTarget(found);
      setResult(found.result || "");
      setObservation(found.observation || "");
      setConclusion(found.conclusion || "");
    } catch (err) {
      setTarget(null);

      setError(
        err instanceof Error
          ? err.message
          : "Audit target could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [assessmentId, targetId]);

  useEffect(() => {
    void loadTarget();
  }, [loadTarget]);

  const loadTargetFindings = useCallback(
    async () => {
      if (
        !Number.isFinite(assessmentId) ||
        !Number.isFinite(targetId)
      ) {
        return;
      }

      const token = getToken();

      if (!token) {
        setTargetFindings([]);
        return;
      }

      setFindingsLoading(true);
      setFindingsError("");

      try {
        const response = await fetch(
          `${API_BASE}/pam/assessments/${assessmentId}/audit-findings?target_id=${targetId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            `Audit findings request failed: ${response.status}`
          );
        }

        const data =
          (await response.json()) as TargetFindingSummaryItem[];

        setTargetFindings(data);
      } catch (err) {
        setTargetFindings([]);

        setFindingsError(
          err instanceof Error
            ? err.message
            : "Audit findings could not be loaded."
        );
      } finally {
        setFindingsLoading(false);
      }
    },
    [assessmentId, targetId]
  );

  useEffect(() => {
    void loadTargetFindings();
  }, [loadTargetFindings]);

  const loadAuditHistory = useCallback(
    async () => {
      if (
        !Number.isFinite(assessmentId) ||
        !Number.isFinite(targetId)
      ) {
        return;
      }

      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("access_token")
          : null;

      if (!token) {
        setAuditHistory([]);
        return;
      }

      setHistoryLoading(true);
      setHistoryError("");

      try {
        const response = await fetch(
          `${API_BASE}/pam/assessments/${assessmentId}/audit-targets/${targetId}/revisions`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            `Audit history request failed: ${response.status}`
          );
        }

        const data =
          (await response.json()) as AuditRevision[];

        setAuditHistory(data);
      } catch (err) {
        setAuditHistory([]);

        setHistoryError(
          err instanceof Error
            ? err.message
            : "Audit history could not be loaded."
        );
      } finally {
        setHistoryLoading(false);
      }
    },
    [assessmentId, targetId]
  );

  useEffect(() => {
    void loadAuditHistory();
  }, [loadAuditHistory]);

  const loadAttributeEvaluation = useCallback(
    async () => {
      const token = getToken();

      if (!token) {
        setEvaluationError(
          "Authentication token is not available."
        );
        return;
      }

      setEvaluationLoading(true);
      setEvaluationError("");

      try {
        const response = await fetch(
          `${API_BASE}/pam/assessments/${assessmentId}/audit-targets/${targetId}/pa-evaluation`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            `Audit process attribute evaluation request failed: ${response.status}`
          );
        }

        const evaluation =
          (await response.json()) as ProcessAttributeEvaluation | null;

        setAttributeEvaluation(evaluation);
      } catch (err) {
        setAttributeEvaluation(null);

        setEvaluationError(
          err instanceof Error
            ? err.message
            : "Audit process attribute evaluation could not be loaded."
        );
      } finally {
        setEvaluationLoading(false);
      }
    },
    [assessmentId, targetId]
  );

  useEffect(() => {
    if (!target) {
      setAttributeEvaluation(null);
      return;
    }

    void loadAttributeEvaluation();
  }, [
    target?.id,
    target?.assessment_process_id,
    target?.process_attribute_id,
    loadAttributeEvaluation,
  ]);

  const assignAuditor = async () => {
    if (!target) {
      return;
    }

    const auditorId = Number(selectedAuditorId);

    if (
      !Number.isFinite(auditorId) ||
      auditorId <= 0
    ) {
      setError("Select an eligible Internal Auditor.");
      return;
    }

    const token = getToken();

    if (!token) {
      setError(
        "Authentication token is not available."
      );
      return;
    }

    setAssigningAuditor(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/pam/assessments/${assessmentId}/audit-targets/${target.id}/assign-auditor`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            auditor_id: auditorId,
          }),
        }
      );

      if (!response.ok) {
        let detail =
          "Auditor could not be assigned.";

        try {
          const body = await response.json();

          if (
            body &&
            typeof body.detail === "string"
          ) {
            detail = body.detail;
          }
        } catch {
          // Keep fallback message.
        }

        throw new Error(detail);
      }

      const updated =
        (await response.json()) as AuditTarget;

      setTarget((current) =>
        current
          ? {
              ...current,
              ...updated,
            }
          : updated
      );

      setSelectedAuditorId(
        String(updated.auditor_id ?? "")
      );

      setMessage(
        "Internal Auditor assigned successfully."
      );

      await loadEligibleAuditors();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Auditor could not be assigned."
      );
    } finally {
      setAssigningAuditor(false);
    }
  };

  const reopenAudit = async () => {
    if (!target) {
      return;
    }

    const token = getToken();

    if (!token) {
      setError(
        "Authentication token is not available."
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_BASE}/pam/assessments/${assessmentId}/audit-targets/${target.id}/reopen`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
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
            `Audit reopen failed: ${response.status}`
        );
      }

      const updated =
        (await response.json()) as AuditTarget;

      setTarget((current) =>
        current
          ? {
              ...current,
              ...updated,
            }
          : updated
      );

      setMessage(
        "Audit reopened. Official PA rating is now editable."
      );

      await loadAttributeEvaluation();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Audit could not be reopened."
      );
    } finally {
      setSaving(false);
    }
  };

  const updateExecution = async (
    nextStatus: string
  ) => {
    if (!target) {
      return;
    }

    const token = getToken();

    if (!token) {
      setError("Authentication token is not available.");
      return;
    }

    setSaving(true);
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
            status: nextStatus,
            result: result.trim() || null,
            observation:
              observation.trim() || null,
            conclusion:
              conclusion.trim() || null,
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

      setTarget((current) =>
        current
          ? {
              ...current,
              ...updated,
            }
          : updated
      );

      setResult(updated.result || "");
      setObservation(updated.observation || "");
      setConclusion(updated.conclusion || "");

      setMessage(
        `Audit execution updated to ${label(
          updated.status
        )}.`
      );

      await loadAuditHistory();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Audit execution could not be updated."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl py-16 text-center text-sm text-slate-500">
        Loading audit execution workspace...
      </div>
    );
  }

  if (error && !target) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Link
          href="/maturity/internal-audit"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
        >
          <ArrowLeft size={15} />
          Internal Audit
        </Link>

        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!target) {
    return null;
  }

  const status = target.status.toUpperCase();

  const roles = normalizedRoles(currentUser);

  const isInternalAuditor =
    roles.includes("internal_auditor");

  const canManageAuditorAssignment =
    authResolved &&
    (
      roles.includes("admin") ||
      roles.includes("superadmin") ||
      roles.includes("super_admin")
    );

  const currentUserId =
    currentUser?.id == null
      ? null
      : Number(currentUser.id);

  const assignedAuditorId =
    target.auditor_id == null
      ? null
      : Number(target.auditor_id);

  const isAssignedAuditor =
    currentUserId != null &&
    assignedAuditorId != null &&
    currentUserId === assignedAuditorId;

  const assignedAuditor =
    assignedAuditorId == null
      ? null
      : eligibleAuditors.find(
          (auditor) =>
            Number(auditor.id) === assignedAuditorId
        ) ?? null;

  const assignedAuditorDisplay =
    assignedAuditor
      ? (
          assignedAuditor.full_name?.trim() ||
          assignedAuditor.email
        )
      : assignedAuditorId == null
        ? "Unassigned"
        : `User #${assignedAuditorId}`;

  const hasOfficialAuditRating =
    Boolean(attributeEvaluation?.rating?.trim());

  const canStartAudit =
    authResolved &&
    isInternalAuditor &&
    isAssignedAuditor &&
    status === "READY";

  const canEditAudit =
    authResolved &&
    isInternalAuditor &&
    isAssignedAuditor &&
    status === "IN_PROGRESS";

  const canReopenAudit =
    authResolved &&
    isInternalAuditor &&
    isAssignedAuditor &&
    status === "COMPLETED";

  const terminal =
    status === "COMPLETED" ||
    status === "EXCEPTION";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href={`/maturity/internal-audit/plans/${target.audit_plan_id}`}
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft size={14} />
            Audit Plan
          </Link>

          <div className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Maturity Audit Execution
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-950">
              {target.process_attribute_code ||
                `Attribute #${target.process_attribute_id}`}
              {target.process_attribute_name
                ? ` - ${target.process_attribute_name}`
                : ""}
            </h1>

            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                target.status
              )}`}
            >
              {label(target.status)}
            </span>
          </div>

          <div className="mt-2 text-sm text-slate-600">
            {target.audit_plan_reference ||
              `Audit Plan #${target.audit_plan_id}`}
            {" / "}
            {target.audit_plan_name ||
              "Maturity Internal Audit"}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadTarget()}
          disabled={saving}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={15} />
          Refresh
        </button>
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

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Process
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-950">
            {target.process_code ||
              `Process #${target.assessment_process_id}`}
            {target.process_name
              ? ` - ${target.process_name}`
              : ""}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Process Attribute
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-950">
            {target.process_attribute_code ||
              `#${target.process_attribute_id}`}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {target.process_attribute_name || "-"}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Criterion
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-950">
            {target.indicator_code ||
              "Entire Process Attribute"}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {target.indicator_name || "-"}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Assessment Snapshot
          </div>

          <h2 className="mt-1 text-base font-semibold text-slate-950">
            Audit Process Attribute Rating
          </h2>

          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            Official Process Attribute rating recorded
            independently by the assigned Internal Auditor
            for this audit target.
          </p>
        </div>

        <div className="p-5">
          {target.status?.toUpperCase() === "COMPLETED" &&
          !attributeEvaluation &&
          !evaluationLoading &&
          !evaluationError ? (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="text-sm font-semibold text-amber-900">
                No official audit PA evaluation recorded
              </div>
              <p className="mt-1 text-xs leading-5 text-amber-800">
                This completed audit target predates the
                audit-scoped PA evaluation record. Its
                execution result is preserved, but it is
                not interpreted as a Process Attribute
                rating.
              </p>
            </div>
          ) : null}

          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Assigned Auditor
              </div>

              <div className="mt-1 text-sm font-semibold text-slate-900">
                {assignedAuditorDisplay}
              </div>

              {assignedAuditor?.email &&
              assignedAuditor.full_name ? (
                <div className="mt-1 text-xs text-slate-500">
                  {assignedAuditor.email}
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Audit Authority
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {!authResolved
                  ? "Checking..."
                  : isInternalAuditor
                    ? "Internal Auditor"
                    : "Read Only"}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Rating Access
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {canEditAudit
                  ? "Editable"
                  : status === "COMPLETED"
                    ? "Locked - Completed"
                    : assignedAuditorId == null
                      ? "Locked - No Auditor"
                      : "Read Only"}
              </div>
            </div>
          </div>

          {canManageAuditorAssignment ? (
            <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-950">
                    Auditor Assignment
                  </div>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Assign an eligible Internal Auditor to this audit target.
                    Assignment authority does not grant audit rating authority.
                  </p>

                  <div className="mt-3">
                    <label
                      htmlFor="audit-target-auditor"
                      className="mb-1.5 block text-xs font-semibold text-slate-700"
                    >
                      Internal Auditor
                    </label>

                    <select
                      id="audit-target-auditor"
                      value={selectedAuditorId}
                      onChange={(event) =>
                        setSelectedAuditorId(
                          event.target.value
                        )
                      }
                      disabled={
                        auditorsLoading ||
                        assigningAuditor ||
                        eligibleAuditors.length === 0 ||
                        status === "EXCEPTION"
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                    >
                      <option value="">
                        {auditorsLoading
                          ? "Loading eligible auditors..."
                          : eligibleAuditors.length === 0
                            ? "No eligible Internal Auditors available"
                            : "Select Internal Auditor"}
                      </option>

                      {eligibleAuditors.map(
                        (auditor) => (
                          <option
                            key={auditor.id}
                            value={String(auditor.id)}
                          >
                            {auditor.full_name?.trim()
                              ? `${auditor.full_name} (${auditor.email})`
                              : auditor.email}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void assignAuditor()}
                  disabled={
                    assigningAuditor ||
                    auditorsLoading ||
                    !selectedAuditorId ||
                    status === "EXCEPTION"
                  }
                  className="inline-flex shrink-0 items-center justify-center rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {assigningAuditor
                    ? "Assigning..."
                    : assignedAuditorId == null
                      ? "Assign Auditor"
                      : "Change Auditor"}
                </button>
              </div>

              {eligibleAuditors.length === 0 &&
              !auditorsLoading ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  No active, unlocked user with an active Internal Auditor
                  role is currently available for this tenant.
                </div>
              ) : null}

              {status === "EXCEPTION" ? (
                <div className="mt-3 text-xs text-slate-500">
                  Auditor assignment is locked for exception targets.
                </div>
              ) : null}
            </div>
          ) : null}

          {evaluationLoading ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              Loading official audit rating...
            </div>
          ) : evaluationError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {evaluationError}
            </div>
          ) : (
            <ProcessAttributeEvaluationEditor
              assessmentId={target.pam_assessment_id}
              assessmentProcessId={
                target.assessment_process_id
              }
              processAttributeId={
                target.process_attribute_id
              }
              evaluation={attributeEvaluation}
              variant="audit"
              saveEndpoint={`${API_BASE}/pam/assessments/${target.pam_assessment_id}/audit-targets/${target.id}/pa-evaluation`}
              onSaved={loadAttributeEvaluation}
              readOnly={!canEditAudit}
            />
          )}

          <div className="mt-4 flex justify-end border-t border-slate-200 pt-4">
            <Link
              href={`/maturity/workspace/${target.pam_assessment_id}/process/${target.assessment_process_id}`}
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Open Full Process Assessment
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <ClipboardCheck
              size={18}
              className="text-slate-500"
            />
            <h2 className="text-base font-semibold text-slate-950">
              Audit Execution
            </h2>
          </div>

          <p className="mt-1 text-sm text-slate-500">
            Record the auditor observation, conclusion,
            and execution result for this target.
          </p>
        </div>

        <div className="space-y-5 p-5">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Observation
            </label>

            <textarea
              value={observation}
              onChange={(event) =>
                setObservation(event.target.value)
              }
              disabled={!canEditAudit || saving}
              rows={6}
              className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Conclusion
            </label>

            <textarea
              value={conclusion}
              onChange={(event) =>
                setConclusion(event.target.value)
              }
              disabled={!canEditAudit || saving}
              rows={5}
              className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Result
            </label>

            <textarea
              value={result}
              onChange={(event) =>
                setResult(event.target.value)
              }
              disabled={!canEditAudit || saving}
              rows={3}
              className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 disabled:bg-slate-50"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
            <div className="text-xs text-slate-500">
              Started: {target.started_at || "-"}
              {" / "}
              Completed: {target.completed_at || "-"}
            </div>

            <div className="flex flex-wrap gap-2">
              {status === "READY" ? (
                <button
                  type="button"
                  onClick={() =>
                    void updateExecution(
                      "IN_PROGRESS"
                    )
                  }
                  disabled={saving || !canStartAudit}
                  title={
                    assignedAuditorId == null
                      ? "Assign an Internal Auditor before starting."
                      : !isInternalAuditor
                        ? "Internal Auditor role is required."
                        : !isAssignedAuditor
                          ? "Only the assigned auditor can start this target."
                          : undefined
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ClipboardCheck size={15} />
                  Start Audit
                </button>
              ) : null}

              {status === "COMPLETED" ? (
                <button
                  type="button"
                  onClick={() => void reopenAudit()}
                  disabled={
                    saving ||
                    !canReopenAudit
                  }
                  title={
                    assignedAuditorId == null
                      ? "Assign an Internal Auditor before reopening."
                      : !isInternalAuditor
                        ? "Internal Auditor role is required."
                        : !isAssignedAuditor
                          ? "Only the assigned auditor can reopen this target."
                          : undefined
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RefreshCw size={15} />
                  Reopen Audit
                </button>
              ) : null}

              {status === "IN_PROGRESS" ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      void updateExecution(
                        "IN_PROGRESS"
                      )
                    }
                    disabled={saving || !canEditAudit}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Save Progress
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void updateExecution(
                        "EXCEPTION"
                      )
                    }
                    disabled={saving || !canEditAudit}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    <ShieldAlert size={15} />
                    Mark Exception
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void updateExecution(
                        "COMPLETED"
                      )
                    }
                    disabled={
                      saving ||
                      !canEditAudit ||
                      !hasOfficialAuditRating
                    }
                    title={
                      !hasOfficialAuditRating
                        ? "Save an Official Audit Rating before completing this target."
                        : !canEditAudit
                          ? "Only the assigned Internal Auditor can complete an in-progress target."
                          : undefined
                    }
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <CheckCircle2 size={15} />
                    Complete Audit
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-slate-950">
            Audit History
          </h2>
          <p className="text-sm text-slate-500">
            Immutable completion decisions recorded for this audit target.
          </p>
        </div>

        <div className="mt-5">
          {historyLoading ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              Loading audit history...
            </div>
          ) : historyError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {historyError}
            </div>
          ) : auditHistory.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              No completed audit revisions have been recorded yet.
            </div>
          ) : (
            <div className="space-y-4">
              {auditHistory.map((revision) => (
                <div
                  key={revision.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-950">
                          Revision {revision.revision_no}
                        </span>

                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {revision.rating}
                        </span>
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        Official completion decision
                      </div>
                    </div>

                    <div className="text-xs text-slate-500">
                      {new Date(
                        revision.completed_at
                      ).toLocaleString()}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Auditor
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-800">
                        {revision.auditor_id
                          ? `User ${revision.auditor_id}`
                          : "Not recorded"}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        PA Evaluation
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-800">
                        #{revision.pa_evaluation_id}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Result
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-800">
                        {revision.result || "Not recorded"}
                      </div>
                    </div>
                  </div>

                  {revision.rating_justification ? (
                    <div className="mt-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Rating Justification
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                        {revision.rating_justification}
                      </p>
                    </div>
                  ) : null}

                  {revision.observation ? (
                    <div className="mt-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Observation
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                        {revision.observation}
                      </p>
                    </div>
                  ) : null}

                  {revision.conclusion ? (
                    <div className="mt-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Conclusion
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                        {revision.conclusion}
                      </p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              Findings and CAPA
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Findings are recorded separately from the official
              process attribute rating.
            </p>
          </div>

          <Link
            href={`/maturity/findings?assessment_id=${target.pam_assessment_id}&audit_target_id=${target.id}`}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Open Findings
          </Link>
        </div>

        <div className="mt-5">
          {findingsLoading ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              Loading findings...
            </div>
          ) : findingsError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {findingsError}
            </div>
          ) : (
            <>
              <div
                className={`rounded-xl border px-4 py-3 text-sm ${
                  targetFindings.length === 0
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-slate-50 text-slate-700"
                }`}
              >
                {targetFindings.length === 0
                  ? "No findings recorded for this audit target."
                  : `${targetFindings.length} finding${
                      targetFindings.length === 1 ? "" : "s"
                    } recorded for this audit target.`}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Total
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950">
                    {targetFindings.length}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Open
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950">
                    {
                      targetFindings.filter(
                        (finding) =>
                          finding.status?.toUpperCase() !== "CLOSED"
                      ).length
                    }
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Closed
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950">
                    {
                      targetFindings.filter(
                        (finding) =>
                          finding.status?.toUpperCase() === "CLOSED"
                      ).length
                    }
                  </div>
                </div>
              </div>

              {targetFindings.filter(
                (finding) =>
                  finding.status?.toUpperCase() !== "CLOSED"
              ).length > 0 ? (
                <p className="mt-3 text-sm text-amber-700">
                  {
                    targetFindings.filter(
                      (finding) =>
                        finding.status?.toUpperCase() !== "CLOSED"
                    ).length
                  }{" "}
                  finding
                  {targetFindings.filter(
                    (finding) =>
                      finding.status?.toUpperCase() !== "CLOSED"
                  ).length === 1
                    ? ""
                    : "s"}{" "}
                  still require follow-up.
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
