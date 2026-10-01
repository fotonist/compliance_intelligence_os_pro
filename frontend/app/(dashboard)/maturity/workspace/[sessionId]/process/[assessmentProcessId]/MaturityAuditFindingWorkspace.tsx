"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  History,
  RefreshCw,
  ShieldCheck,
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

type UserRecord = {
  id: number;
  email?: string | null;
  full_name?: string | null;
  name?: string | null;
  is_active?: boolean;
};

type Finding = {
  id: number;
  tenant_id: number;
  audit_plan_id: number;
  audit_maturity_target_id: number;
  created_by: number;
  assigned_owner_id?: number | null;
  process_manager_id?: number | null;
  title: string;
  description: string;
  requirement?: string | null;
  objective_evidence?: string | null;
  severity: string;
  status: string;
  owner?: string | null;
  due_date?: string | null;
  root_cause?: string | null;
  correction?: string | null;
  corrective_action_plan?: string | null;
  recommendation?: string | null;
  manager_review_status?: string | null;
  manager_review_comment?: string | null;
  implementation_status?: string | null;
  implementation_evidence?: string | null;
  verification_status?: string | null;
  verification_comment?: string | null;
  closure_comment?: string | null;
  closed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type WorkflowEvent = {
  id: number;
  finding_id: number;
  actor_id?: number | null;
  actor_role?: string | null;
  action: string;
  from_status?: string | null;
  to_status?: string | null;
  comment?: string | null;
  created_at?: string | null;
};

type Props = {
  assessmentId: number;
  auditTargetId: number;
  auditPlanId: number;
  attributeCode: string;
  indicatorCode?: string | null;
};

type Draft = {
  root_cause: string;
  correction: string;
  corrective_action_plan: string;
  due_date: string;
  comment: string;
  implementation_evidence: string;
};

type AssignmentDraft = {
  assigned_owner_id: string;
  process_manager_id: string;
  comment: string;
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

function normalizeStatus(value?: string | null) {
  if (!value) {
    return "-";
  }

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function userLabel(user: UserRecord) {
  return (
    user.full_name ||
    user.name ||
    user.email ||
    `User ${user.id}`
  );
}

function extractUsers(payload: unknown): UserRecord[] {
  if (Array.isArray(payload)) {
    return payload as UserRecord[];
  }

  if (
    payload &&
    typeof payload === "object"
  ) {
    const record = payload as Record<string, unknown>;

    for (const key of [
      "items",
      "users",
      "results",
      "data",
    ]) {
      if (Array.isArray(record[key])) {
        return record[key] as UserRecord[];
      }
    }
  }

  return [];
}

function statusClass(status: string) {
  if (status === "CLOSED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (
    status === "VERIFICATION_FAILED" ||
    status === "REVISION_REQUIRED"
  ) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (
    status === "READY_FOR_VERIFICATION" ||
    status === "PLAN_APPROVED"
  ) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

export default function MaturityAuditFindingWorkspace({
  assessmentId,
  auditTargetId,
  auditPlanId,
  attributeCode,
  indicatorCode,
}: Props) {
  const [findings, setFindings] =
    useState<Finding[]>([]);
  const [users, setUsers] =
    useState<UserRecord[]>([]);

  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);
  const [error, setError] =
    useState("");
  const [message, setMessage] =
    useState("");

  const [showCreate, setShowCreate] =
    useState(false);
  const [expandedId, setExpandedId] =
    useState<number | null>(null);

  const [workflow, setWorkflow] =
    useState<Record<number, WorkflowEvent[]>>({});

  const [workflowLoadingId, setWorkflowLoadingId] =
    useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] =
    useState("");
  const [severity, setSeverity] =
    useState("MEDIUM");
  const [requirement, setRequirement] =
    useState("");
  const [objectiveEvidence, setObjectiveEvidence] =
    useState("");
  const [ownerId, setOwnerId] =
    useState("");
  const [managerId, setManagerId] =
    useState("");
  const [dueDate, setDueDate] =
    useState("");

  const [drafts, setDrafts] =
    useState<Record<number, Draft>>({});

  const [assignmentDrafts, setAssignmentDrafts] = useState<
    Record<number, AssignmentDraft>
  >({});


  const baseUrl =
    `${API_BASE}/pam/assessments/` +
    `${assessmentId}/audit-findings`;

  const loadData = useCallback(async () => {
    const token = getToken();

    if (!token) {
      setError(
        "Authentication token is not available."
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [findingResponse, userResponse] =
        await Promise.all([
          fetch(baseUrl, {
            headers,
            cache: "no-store",
          }),
          fetch(`${API_BASE}/users`, {
            headers,
            cache: "no-store",
          }),
        ]);

      if (!findingResponse.ok) {
        const body =
          await findingResponse.text();

        throw new Error(
          body ||
            `Finding request failed: ${findingResponse.status}`
        );
      }

      const findingData =
        (await findingResponse.json()) as Finding[];

      setFindings(
        findingData.filter(
          (item) =>
            item.audit_maturity_target_id ===
            auditTargetId
        )
      );

      if (userResponse.ok) {
        const userData =
          await userResponse.json();

        setUsers(
          extractUsers(userData).filter(
            (user) => user.is_active !== false
          )
        );
      } else {
        setUsers([]);
      }
    } catch (err) {
      setFindings([]);
      setError(
        err instanceof Error
          ? err.message
          : "Audit findings could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [
    assessmentId,
    auditTargetId,
    baseUrl,
  ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCount = useMemo(
    () =>
      findings.filter(
        (item) => item.status !== "CLOSED"
      ).length,
    [findings]
  );

  const getAssignmentDraft = (
  finding: Finding
): AssignmentDraft =>
  assignmentDrafts[finding.id] || {
    assigned_owner_id: finding.assigned_owner_id
      ? String(finding.assigned_owner_id)
      : "",
    process_manager_id: finding.process_manager_id
      ? String(finding.process_manager_id)
      : "",
    comment: "",
  };

const updateAssignmentDraft = (
  finding: Finding,
  field: keyof AssignmentDraft,
  value: string
) => {
  setAssignmentDrafts((current) => ({
    ...current,
    [finding.id]: {
      ...getAssignmentDraft(finding),
      ...current[finding.id],
      [field]: value,
    },
  }));
};

const getDraft = (finding: Finding): Draft =>
    drafts[finding.id] || {
      root_cause: finding.root_cause || "",
      correction: finding.correction || "",
      corrective_action_plan:
        finding.corrective_action_plan || "",
      due_date: finding.due_date || "",
      comment: "",
      implementation_evidence:
        finding.implementation_evidence || "",
    };

  const updateDraft = (
    finding: Finding,
    field: keyof Draft,
    value: string
  ) => {
    setDrafts((current) => ({
      ...current,
      [finding.id]: {
        ...getDraft(finding),
        ...current[finding.id],
        [field]: value,
      },
    }));
  };

  const createFinding = async () => {
    const token = getToken();

    if (!token) {
      setError(
        "Authentication token is not available."
      );
      return;
    }

    if (!title.trim() || !description.trim()) {
      setError(
        "Title and description are required."
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        baseUrl,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            target_id: auditTargetId,
            title: title.trim(),
            description: description.trim(),
            severity,
            requirement:
              requirement.trim() || null,
            objective_evidence:
              objectiveEvidence.trim() || null,
            assigned_owner_id:
              ownerId
                ? Number(ownerId)
                : null,
            process_manager_id:
              managerId
                ? Number(managerId)
                : null,
            due_date: dueDate || null,
          }),
        }
      );

      if (!response.ok) {
        const body = await response.text();

        throw new Error(
          body ||
            `Finding creation failed: ${response.status}`
        );
      }

      setTitle("");
      setDescription("");
      setSeverity("MEDIUM");
      setRequirement("");
      setObjectiveEvidence("");
      setOwnerId("");
      setManagerId("");
      setDueDate("");
      setShowCreate(false);
      setMessage("Finding created.");

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Finding could not be created."
      );
    } finally {
      setSaving(false);
    }
  };

  const postAction = async (
    finding: Finding,
    action: string,
    payload: Record<string, unknown>
  ) => {
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
        `${baseUrl}/${finding.id}/${action}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const body = await response.text();

        throw new Error(
          body ||
            `Finding action failed: ${response.status}`
        );
      }

      await response.json();

      setMessage(
        "Finding workflow updated."
      );

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Finding workflow could not be updated."
      );
    } finally {
      setSaving(false);
    }
  };

  const loadWorkflow = async (
    finding: Finding
  ) => {
    if (expandedId === finding.id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(finding.id);

    if (workflow[finding.id]) {
      return;
    }

    const token = getToken();

    if (!token) {
      return;
    }

    setWorkflowLoadingId(finding.id);

    try {
      const response = await fetch(
        `${baseUrl}/${finding.id}/workflow`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      if (!response.ok) {
        return;
      }

      const data =
        (await response.json()) as WorkflowEvent[];

      setWorkflow((current) => ({
        ...current,
        [finding.id]: data,
      }));
    } finally {
      setWorkflowLoadingId(null);
    }
  };

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-slate-500" />

            <h4 className="text-sm font-semibold text-slate-950">
              Findings & CAPA
            </h4>
          </div>

          <div className="mt-1 text-xs text-slate-500">
            {attributeCode}
            {indicatorCode
              ? ` / ${indicatorCode}`
              : ""}
            {" / "}
            Audit target #{auditTargetId}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
            {findings.length} findings
          </span>

          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
            {openCount} open
          </span>

          <button
            type="button"
            onClick={() =>
              setShowCreate((current) => !current)
            }
            className="rounded-xl bg-slate-950 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            {showCreate
              ? "Cancel"
              : "Create Finding"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="border-b border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      {showCreate ? (
        <div className="border-b border-slate-200 p-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <label className="lg:col-span-2">
              <span className="text-xs font-semibold text-slate-600">
                Finding Title
              </span>

              <input
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value)
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
              />
            </label>

            <label className="lg:col-span-2">
              <span className="text-xs font-semibold text-slate-600">
                Description
              </span>

              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                rows={3}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
              />
            </label>

            <label>
              <span className="text-xs font-semibold text-slate-600">
                Severity
              </span>

              <select
                value={severity}
                onChange={(event) =>
                  setSeverity(event.target.value)
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">
                  Medium
                </option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">
                  Critical
                </option>
              </select>
            </label>

            <label>
              <span className="text-xs font-semibold text-slate-600">
                Due Date
              </span>

              <input
                type="date"
                value={dueDate}
                onChange={(event) =>
                  setDueDate(event.target.value)
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </label>

            <label>
              <span className="text-xs font-semibold text-slate-600">
                Owner
              </span>

              <select
                value={ownerId}
                onChange={(event) =>
                  setOwnerId(event.target.value)
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              >
                <option value="">
                  Not assigned
                </option>

                {users.map((user) => (
                  <option
                    key={user.id}
                    value={user.id}
                  >
                    {userLabel(user)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-xs font-semibold text-slate-600">
                Process Manager
              </span>

              <select
                value={managerId}
                onChange={(event) =>
                  setManagerId(event.target.value)
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              >
                <option value="">
                  Not assigned
                </option>

                {users.map((user) => (
                  <option
                    key={user.id}
                    value={user.id}
                  >
                    {userLabel(user)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-xs font-semibold text-slate-600">
                Requirement
              </span>

              <input
                value={requirement}
                onChange={(event) =>
                  setRequirement(event.target.value)
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </label>

            <label>
              <span className="text-xs font-semibold text-slate-600">
                Objective Evidence
              </span>

              <input
                value={objectiveEvidence}
                onChange={(event) =>
                  setObjectiveEvidence(
                    event.target.value
                  )
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </label>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                void createFinding()
              }
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving
                ? "Creating..."
                : "Create Finding"}
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 p-5 text-sm text-slate-500">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading findings...
        </div>
      ) : findings.length === 0 ? (
        <div className="p-5 text-sm text-slate-500">
          No findings have been recorded for this audit target.
        </div>
      ) : (
        <div className="divide-y divide-slate-200">
          {findings.map((finding) => {
            const draft = getDraft(finding);
            const assignmentDraft = getAssignmentDraft(finding);

            return (
              <div
                key={finding.id}
                className="p-5"
              >
                <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-950">
                        {finding.title}
                      </span>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                          finding.status
                        )}`}
                      >
                        {normalizeStatus(
                          finding.status
                        )}
                      </span>

                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500">
                        {finding.severity}
                      </span>
                    </div>

                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {finding.description}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                      <span>
                        Finding #{finding.id}
                      </span>
                      <span>
                        Audit plan #{auditPlanId}
                      </span>
                      <span>
                        Owner{" "}
                        {finding.assigned_owner_id
                          ? `#${finding.assigned_owner_id}`
                          : "-"}
                      </span>
                      <span>
                        Manager{" "}
                        {finding.process_manager_id
                          ? `#${finding.process_manager_id}`
                          : "-"}
                      </span>
                      <span>
                        Due{" "}
                        {finding.due_date || "-"}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void loadWorkflow(finding)
                    }
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <History className="h-4 w-4" />
                    Workflow
                    {expandedId === finding.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {finding.status === "OPEN" ? (
                  <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <ClipboardList className="h-4 w-4" />
                      Finding Assignment
                    </div>

                    <p className="mt-1 text-xs text-slate-500">
                      Assign an owner before corrective action workflow begins.
                    </p>

                    <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-slate-600">
                          Finding Owner
                        </span>

                        <select
                          value={assignmentDraft.assigned_owner_id}
                          onChange={(event) =>
                            updateAssignmentDraft(
                              finding,
                              "assigned_owner_id",
                              event.target.value
                            )
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400"
                        >
                          <option value="">Select owner</option>
                          {users.map((user) => (
                            <option key={user.id} value={String(user.id)}>
                              {user.full_name || user.name || user.email || `User #${user.id}`}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-slate-600">
                          Process Manager
                        </span>

                        <select
                          value={assignmentDraft.process_manager_id}
                          onChange={(event) =>
                            updateAssignmentDraft(
                              finding,
                              "process_manager_id",
                              event.target.value
                            )
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400"
                        >
                          <option value="">Not assigned</option>
                          {users.map((user) => (
                            <option key={user.id} value={String(user.id)}>
                              {user.full_name || user.name || user.email || `User #${user.id}`}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block lg:col-span-2">
                        <span className="mb-1 block text-xs font-semibold text-slate-600">
                          Assignment Comment
                        </span>

                        <textarea
                          value={assignmentDraft.comment}
                          onChange={(event) =>
                            updateAssignmentDraft(
                              finding,
                              "comment",
                              event.target.value
                            )
                          }
                          rows={2}
                          placeholder="Optional assignment context"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400"
                        />
                      </label>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        disabled={
                          saving ||
                          !assignmentDraft.assigned_owner_id
                        }
                        onClick={() =>
                          void postAction(
                            finding,
                            "assign-owner",
                            {
                              assigned_owner_id: Number(
                                assignmentDraft.assigned_owner_id
                              ),
                              process_manager_id:
                                assignmentDraft.process_manager_id
                                  ? Number(
                                      assignmentDraft.process_manager_id
                                    )
                                  : null,
                              comment:
                                assignmentDraft.comment.trim() || null,
                            }
                          )
                        }
                        className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {saving
                          ? "Assigning..."
                          : "Assign Finding"}
                      </button>
                    </div>
                  </div>
                ) : null}

                {finding.status === "ASSIGNED" ||
                finding.status === "OWNER_RESPONSE" ||
                finding.status === "REVISION_REQUIRED" ||
                finding.status === "VERIFICATION_FAILED" ? (
                  <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <ClipboardList className="h-4 w-4" />
                      Owner Response
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                      <textarea
                        value={draft.root_cause}
                        onChange={(event) =>
                          updateDraft(
                            finding,
                            "root_cause",
                            event.target.value
                          )
                        }
                        rows={3}
                        placeholder="Root cause"
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      />

                      <textarea
                        value={draft.correction}
                        onChange={(event) =>
                          updateDraft(
                            finding,
                            "correction",
                            event.target.value
                          )
                        }
                        rows={3}
                        placeholder="Correction"
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      />

                      <textarea
                        value={
                          draft.corrective_action_plan
                        }
                        onChange={(event) =>
                          updateDraft(
                            finding,
                            "corrective_action_plan",
                            event.target.value
                          )
                        }
                        rows={3}
                        placeholder="Corrective action plan"
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm lg:col-span-2"
                      />

                      <input
                        type="date"
                        value={draft.due_date}
                        onChange={(event) =>
                          updateDraft(
                            finding,
                            "due_date",
                            event.target.value
                          )
                        }
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      />

                      <input
                        value={draft.comment}
                        onChange={(event) =>
                          updateDraft(
                            finding,
                            "comment",
                            event.target.value
                          )
                        }
                        placeholder="Workflow comment"
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          void postAction(
                            finding,
                            "owner-response",
                            {
                              root_cause:
                                draft.root_cause ||
                                null,
                              correction:
                                draft.correction ||
                                null,
                              corrective_action_plan:
                                draft.corrective_action_plan ||
                                null,
                              due_date:
                                draft.due_date ||
                                null,
                              comment:
                                draft.comment ||
                                null,
                            }
                          )
                        }
                        className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700"
                      >
                        Save Response
                      </button>

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          void postAction(
                            finding,
                            "owner-submit",
                            {
                              comment:
                                draft.comment ||
                                null,
                            }
                          )
                        }
                        className="rounded-xl bg-slate-950 px-3.5 py-2 text-xs font-semibold text-white"
                      >
                        Submit for Review
                      </button>
                    </div>
                  </div>
                ) : null}

                {finding.status ===
                "SUBMITTED_FOR_REVIEW" ? (
                  <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">
                      Manager Review
                    </div>

                    <input
                      value={draft.comment}
                      onChange={(event) =>
                        updateDraft(
                          finding,
                          "comment",
                          event.target.value
                        )
                      }
                      placeholder="Manager review comment"
                      className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          void postAction(
                            finding,
                            "manager-revision",
                            {
                              comment:
                                draft.comment,
                            }
                          )
                        }
                        className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700"
                      >
                        Request Revision
                      </button>

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          void postAction(
                            finding,
                            "manager-approve",
                            {
                              comment:
                                draft.comment ||
                                null,
                            }
                          )
                        }
                        className="rounded-xl bg-slate-950 px-3.5 py-2 text-xs font-semibold text-white"
                      >
                        Approve Plan
                      </button>
                    </div>
                  </div>
                ) : null}

                {finding.status ===
                "PLAN_APPROVED" ? (
                  <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">
                      Implementation
                    </div>

                    <textarea
                      value={
                        draft.implementation_evidence
                      }
                      onChange={(event) =>
                        updateDraft(
                          finding,
                          "implementation_evidence",
                          event.target.value
                        )
                      }
                      rows={3}
                      placeholder="Implementation evidence"
                      className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />

                    <input
                      value={draft.comment}
                      onChange={(event) =>
                        updateDraft(
                          finding,
                          "comment",
                          event.target.value
                        )
                      }
                      placeholder="Implementation comment"
                      className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        void postAction(
                          finding,
                          "implementation-complete",
                          {
                            implementation_evidence:
                              draft.implementation_evidence,
                            comment:
                              draft.comment ||
                              null,
                          }
                        )
                      }
                      className="mt-3 rounded-xl bg-slate-950 px-3.5 py-2 text-xs font-semibold text-white"
                    >
                      Complete Implementation
                    </button>
                  </div>
                ) : null}

                {finding.status ===
                "READY_FOR_VERIFICATION" ? (
                  <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <ShieldCheck className="h-4 w-4" />
                      Effectiveness Verification
                    </div>

                    <input
                      value={draft.comment}
                      onChange={(event) =>
                        updateDraft(
                          finding,
                          "comment",
                          event.target.value
                        )
                      }
                      placeholder="Verification comment"
                      className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          void postAction(
                            finding,
                            "verify",
                            {
                              effective: false,
                              comment:
                                draft.comment,
                            }
                          )
                        }
                        className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700"
                      >
                        Mark Ineffective
                      </button>

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          void postAction(
                            finding,
                            "verify",
                            {
                              effective: true,
                              comment:
                                draft.comment,
                            }
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3.5 py-2 text-xs font-semibold text-white"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Verify & Close
                      </button>
                    </div>
                  </div>
                ) : null}

                {expandedId === finding.id ? (
                  <div className="mt-5 border-t border-slate-200 pt-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Workflow History
                    </div>

                    {workflowLoadingId ===
                    finding.id ? (
                      <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Loading workflow...
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {(workflow[finding.id] || []).map(
                          (event) => (
                            <div
                              key={event.id}
                              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-slate-700">
                                  {normalizeStatus(
                                    event.action
                                  )}
                                </span>

                                <span className="text-xs text-slate-400">
                                  {event.created_at
                                    ? new Date(
                                        event.created_at
                                      ).toLocaleString()
                                    : ""}
                                </span>
                              </div>

                              <div className="mt-1 text-xs text-slate-500">
                                {normalizeStatus(
                                  event.from_status
                                )}
                                {" -> "}
                                {normalizeStatus(
                                  event.to_status
                                )}
                              </div>

                              {event.comment ? (
                                <div className="mt-2 text-xs leading-5 text-slate-600">
                                  {event.comment}
                                </div>
                              ) : null}
                            </div>
                          )
                        )}

                        {(workflow[finding.id] || [])
                          .length === 0 ? (
                          <div className="text-sm text-slate-500">
                            No workflow events are available.
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
