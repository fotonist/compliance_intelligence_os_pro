"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Link2,
  PlayCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  Suspense,
} from "react";
import { useSearchParams } from "next/navigation";

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
};

type Assessment = {
  id: number;
  name: string;
  status: string;
  context: AssessmentContext;
};

type Finding = {
  id: number;
  audit_maturity_target_id: number;
  title: string;
  description: string;
  severity: string;
  status: string;
  assigned_owner_id?: number | null;
  process_manager_id?: number | null;
  due_date?: string | null;
};

type FollowUpAction = {
  id: number;
  tenant_id: number;
  finding_id: number;
  action_code: string;
  title: string;
  description?: string | null;
  assigned_owner_id?: number | null;
  created_by?: number | null;
  verifier_id?: number | null;
  priority: string;
  due_date?: string | null;
  status: string;
  started_at?: string | null;
  submitted_for_verification_at?: string | null;
  verified_at?: string | null;
  completed_at?: string | null;
  completion_note?: string | null;
  verification_comment?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type UserItem = {
  id: number;
  email?: string | null;
  full_name?: string | null;
};

type EvidenceItem = {
  id: number;
  title?: string | null;
  name?: string | null;
  file_name?: string | null;
  filename?: string | null;
  status?: string | null;
  assessment_type?: string | null;
  standard_id?: number | null;
  standard_version_id?: number | null;
};

type EvidenceLink = {
  id: number;
  tenant_id: number;
  follow_up_action_id: number;
  evidence_id: number;
  linked_by: number;
  note?: string | null;
  created_at?: string | null;
};

type WorkflowEvent = {
  id: number;
  action: string;
  from_status?: string | null;
  to_status?: string | null;
  comment?: string | null;
  actor_id?: number | null;
  actor_role?: string | null;
  created_at?: string | null;
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
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusClass(value?: string | null) {
  const status = (value || "").toUpperCase();

  if (status === "COMPLETED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (
    status === "VERIFICATION_FAILED" ||
    status === "BLOCKED"
  ) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (status === "READY_FOR_VERIFICATION") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (status === "IN_PROGRESS") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "CANCELLED") {
    return "border-slate-300 bg-slate-100 text-slate-500";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function priorityClass(value?: string | null) {
  const priority = (value || "").toUpperCase();

  if (priority === "CRITICAL") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (priority === "HIGH") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  if (priority === "MEDIUM") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function userLabel(
  users: UserItem[],
  userId?: number | null
) {
  if (!userId) {
    return "Unassigned";
  }

  const user = users.find(
    (item) => item.id === userId
  );

  if (!user) {
    return `User #${userId}`;
  }

  return (
    user.full_name ||
    user.email ||
    `User #${user.id}`
  );
}

function evidenceLabel(item: EvidenceItem) {
  return (
    item.title ||
    item.name ||
    item.file_name ||
    item.filename ||
    `Evidence #${item.id}`
  );
}

function extractArray<T>(
  value: unknown,
  keys: string[] = []
): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const record =
      value as Record<string, unknown>;

    for (const key of keys) {
      if (Array.isArray(record[key])) {
        return record[key] as T[];
      }
    }
  }

  return [];
}

function FollowUpActionsContent() {
  const searchParams = useSearchParams();

  const requestedAssessmentId =
    searchParams.get("assessment_id");

  const requestedFindingId =
    searchParams.get("finding_id");

  const [assessments, setAssessments] =
    useState<Assessment[]>([]);

  const [assessmentId, setAssessmentId] =
    useState("");

  const [findings, setFindings] =
    useState<Finding[]>([]);

  const [actions, setActions] =
    useState<FollowUpAction[]>([]);

  const [users, setUsers] =
    useState<UserItem[]>([]);

  const [evidenceCandidates, setEvidenceCandidates] =
    useState<EvidenceItem[]>([]);

  const [selectedActionId, setSelectedActionId] =
    useState("");

  const [linkedEvidence, setLinkedEvidence] =
    useState<EvidenceLink[]>([]);

  const [workflow, setWorkflow] =
    useState<WorkflowEvent[]>([]);

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("");

  const [priorityFilter, setPriorityFilter] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [detailLoading, setDetailLoading] =
    useState(false);

  const [actionBusy, setActionBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  const [notice, setNotice] =
    useState("");

  const [showCreate, setShowCreate] =
    useState(false);

  const [createFindingId, setCreateFindingId] =
    useState("");

  const [createTitle, setCreateTitle] =
    useState("");

  const [createDescription, setCreateDescription] =
    useState("");

  const [createPriority, setCreatePriority] =
    useState("MEDIUM");

  const [createOwnerId, setCreateOwnerId] =
    useState("");

  const [createDueDate, setCreateDueDate] =
    useState("");

  const [selectedEvidenceId, setSelectedEvidenceId] =
    useState("");

  const [evidenceNote, setEvidenceNote] =
    useState("");

  const [completionNote, setCompletionNote] =
    useState("");

  const [verificationComment, setVerificationComment] =
    useState("");

  const selectedAssessment = useMemo(
    () =>
      assessments.find(
        (item) =>
          item.id === Number(assessmentId)
      ) || null,
    [assessments, assessmentId]
  );

  const selectedAction = useMemo(
    () =>
      actions.find(
        (item) =>
          item.id === Number(selectedActionId)
      ) || null,
    [actions, selectedActionId]
  );

  const findingMap = useMemo(
    () =>
      new Map(
        findings.map((finding) => [
          finding.id,
          finding,
        ])
      ),
    [findings]
  );

  const visibleActions = useMemo(() => {
    const needle =
      search.trim().toLowerCase();

    return actions.filter((action) => {
      if (
        statusFilter &&
        action.status !== statusFilter
      ) {
        return false;
      }

      if (
        priorityFilter &&
        action.priority !== priorityFilter
      ) {
        return false;
      }

      if (!needle) {
        return true;
      }

      const finding =
        findingMap.get(action.finding_id);

      const haystack = [
        action.action_code,
        action.title,
        action.description,
        action.priority,
        action.status,
        finding?.title,
        finding?.severity,
        userLabel(
          users,
          action.assigned_owner_id
        ),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [
    actions,
    search,
    statusFilter,
    priorityFilter,
    findingMap,
    users,
  ]);

  const openCount = actions.filter(
    (item) => item.status === "OPEN"
  ).length;

  const progressCount = actions.filter(
    (item) =>
      item.status === "IN_PROGRESS" ||
      item.status === "BLOCKED" ||
      item.status === "VERIFICATION_FAILED"
  ).length;

  const verificationCount = actions.filter(
    (item) =>
      item.status === "READY_FOR_VERIFICATION"
  ).length;

  const completedCount = actions.filter(
    (item) => item.status === "COMPLETED"
  ).length;

  const request = useCallback(
    async (
      path: string,
      init?: RequestInit
    ) => {
      const token = getToken();

      if (!token) {
        throw new Error(
          "Authentication token is not available."
        );
      }

      const response = await fetch(
        `${API_BASE}${path}`,
        {
          ...init,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(init?.body
              ? {
                  "Content-Type":
                    "application/json",
                }
              : {}),
            ...(init?.headers || {}),
          },
          cache: "no-store",
        }
      );

      if (!response.ok) {
        let detail = "";

        try {
          const payload =
            (await response.json()) as {
              detail?: unknown;
            };

          if (
            typeof payload.detail === "string"
          ) {
            detail = payload.detail;
          }
        } catch {
          detail = "";
        }

        throw new Error(
          detail ||
            `Request failed: ${response.status}`
        );
      }

      if (response.status === 204) {
        return null;
      }

      return response.json();
    },
    []
  );

  const loadAssessments = useCallback(
    async () => {
      setLoading(true);
      setError("");

      try {
        const data =
          (await request(
            "/pam/assessments"
          )) as Assessment[];

        setAssessments(data);

        setAssessmentId((current) => {
          if (
            requestedAssessmentId &&
            data.some(
              (item) =>
                item.id ===
                Number(requestedAssessmentId)
            )
          ) {
            return requestedAssessmentId;
          }

          if (
            current &&
            data.some(
              (item) =>
                item.id === Number(current)
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
        setError(
          err instanceof Error
            ? err.message
            : "Assessments could not be loaded."
        );
      } finally {
        setLoading(false);
      }
    },
    [
      request,
      requestedAssessmentId,
    ]
  );

  const loadContext = useCallback(
    async (
      selectedAssessmentId: number
    ) => {
      setDetailLoading(true);
      setError("");

      try {
        const [
          findingPayload,
          actionPayload,
          userPayload,
        ] = await Promise.all([
          request(
            `/pam/assessments/${selectedAssessmentId}/audit-findings`
          ),
          request(
            `/pam/assessments/${selectedAssessmentId}/follow-up-actions`
          ),
          request("/users"),
        ]);

        const nextFindings =
          extractArray<Finding>(
            findingPayload,
            [
              "items",
              "findings",
              "results",
              "data",
            ]
          );

        const nextActions =
          extractArray<FollowUpAction>(
            actionPayload,
            [
              "items",
              "actions",
              "results",
              "data",
            ]
          );

        const nextUsers =
          extractArray<UserItem>(
            userPayload,
            [
              "items",
              "users",
              "results",
              "data",
            ]
          );

        setFindings(nextFindings);
        setActions(nextActions);
        setUsers(nextUsers);

        setCreateFindingId((current) => {
          if (
            requestedFindingId &&
            nextFindings.some(
              (item) =>
                item.id ===
                Number(requestedFindingId)
            )
          ) {
            return requestedFindingId;
          }

          if (
            current &&
            nextFindings.some(
              (item) =>
                item.id === Number(current)
            )
          ) {
            return current;
          }

          return nextFindings.length
            ? String(nextFindings[0].id)
            : "";
        });

        setSelectedActionId((current) => {
          if (
            current &&
            nextActions.some(
              (item) =>
                item.id === Number(current)
            )
          ) {
            return current;
          }

          const requestedAction =
            requestedFindingId
              ? nextActions.find(
                  (item) =>
                    item.finding_id ===
                    Number(requestedFindingId)
                )
              : null;

          if (requestedAction) {
            return String(
              requestedAction.id
            );
          }

          return nextActions.length
            ? String(nextActions[0].id)
            : "";
        });
      } catch (err) {
        setFindings([]);
        setActions([]);
        setUsers([]);
        setError(
          err instanceof Error
            ? err.message
            : "Follow-up context could not be loaded."
        );
      } finally {
        setDetailLoading(false);
      }
    },
    [
      request,
      requestedFindingId,
    ]
  );

  const loadActionDetail = useCallback(
    async (
      selectedAssessmentId: number,
      actionId: number
    ) => {
      try {
        const [
          evidencePayload,
          workflowPayload,
        ] = await Promise.all([
          request(
            `/pam/assessments/${selectedAssessmentId}/follow-up-actions/${actionId}/evidences`
          ),
          request(
            `/pam/assessments/${selectedAssessmentId}/follow-up-actions/${actionId}/workflow`
          ),
        ]);

        setLinkedEvidence(
          extractArray<EvidenceLink>(
            evidencePayload,
            [
              "items",
              "evidences",
              "results",
              "data",
            ]
          )
        );

        setWorkflow(
          extractArray<WorkflowEvent>(
            workflowPayload,
            [
              "items",
              "events",
              "results",
              "data",
            ]
          )
        );
      } catch (err) {
        setLinkedEvidence([]);
        setWorkflow([]);
        setError(
          err instanceof Error
            ? err.message
            : "Action detail could not be loaded."
        );
      }
    },
    [request]
  );

  const loadEvidenceCandidates =
    useCallback(
      async () => {
        if (!selectedAssessment) {
          setEvidenceCandidates([]);
          return;
        }

        try {
          const query =
            new URLSearchParams({
              assessment_type: "maturity",
              standard_id: String(
                selectedAssessment.context
                  .standard_id
              ),
              standard_version_id: String(
                selectedAssessment.context
                  .standard_version_id
              ),
            });

          const payload =
            await request(
              `/evidences?${query.toString()}`
            );

          const rows =
            extractArray<EvidenceItem>(
              payload,
              [
                "items",
                "evidences",
                "results",
                "data",
              ]
            ).filter(
              (item) =>
                (item.status || "")
                  .toLowerCase() ===
                "uploaded"
            );

          setEvidenceCandidates(rows);

          setSelectedEvidenceId(
            (current) => {
              if (
                current &&
                rows.some(
                  (item) =>
                    item.id ===
                    Number(current)
                )
              ) {
                return current;
              }

              return rows.length
                ? String(rows[0].id)
                : "";
            }
          );
        } catch {
          setEvidenceCandidates([]);
          setSelectedEvidenceId("");
        }
      },
      [
        request,
        selectedAssessment,
      ]
    );

  useEffect(() => {
    void loadAssessments();
  }, [loadAssessments]);

  useEffect(() => {
    if (!assessmentId) {
      setFindings([]);
      setActions([]);
      setSelectedActionId("");
      return;
    }

    void loadContext(
      Number(assessmentId)
    );
  }, [
    assessmentId,
    loadContext,
  ]);

  useEffect(() => {
    if (
      !assessmentId ||
      !selectedActionId
    ) {
      setLinkedEvidence([]);
      setWorkflow([]);
      return;
    }

    void loadActionDetail(
      Number(assessmentId),
      Number(selectedActionId)
    );
  }, [
    assessmentId,
    selectedActionId,
    loadActionDetail,
  ]);

  useEffect(() => {
    void loadEvidenceCandidates();
  }, [loadEvidenceCandidates]);

  async function refreshAll(
    actionId?: number
  ) {
    if (!assessmentId) {
      return;
    }

    await loadContext(
      Number(assessmentId)
    );

    if (actionId) {
      setSelectedActionId(
        String(actionId)
      );

      await loadActionDetail(
        Number(assessmentId),
        actionId
      );
    }
  }

  async function runAction(
    operation: () => Promise<unknown>,
    successMessage: string,
    actionId?: number
  ) {
    setActionBusy(true);
    setError("");
    setNotice("");

    try {
      await operation();

      setNotice(successMessage);

      await refreshAll(
        actionId ||
          (selectedActionId
            ? Number(selectedActionId)
            : undefined)
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Operation failed."
      );
    } finally {
      setActionBusy(false);
    }
  }

  async function createAction() {
    if (
      !assessmentId ||
      !createFindingId ||
      !createTitle.trim()
    ) {
      setError(
        "Finding and action title are required."
      );
      return;
    }

    setActionBusy(true);
    setError("");
    setNotice("");

    try {
      const payload =
        (await request(
          `/pam/assessments/${assessmentId}/follow-up-actions`,
          {
            method: "POST",
            body: JSON.stringify({
              finding_id:
                Number(createFindingId),
              title:
                createTitle.trim(),
              description:
                createDescription.trim() ||
                null,
              assigned_owner_id:
                createOwnerId
                  ? Number(createOwnerId)
                  : null,
              priority:
                createPriority,
              due_date:
                createDueDate || null,
            }),
          }
        )) as FollowUpAction;

      setCreateTitle("");
      setCreateDescription("");
      setCreateDueDate("");
      setShowCreate(false);
      setNotice(
        "Follow-up action created."
      );

      await refreshAll(payload.id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Action could not be created."
      );
    } finally {
      setActionBusy(false);
    }
  }

  async function assignOwner(
    ownerId: number
  ) {
    if (
      !assessmentId ||
      !selectedAction
    ) {
      return;
    }

    await runAction(
      () =>
        request(
          `/pam/assessments/${assessmentId}/follow-up-actions/${selectedAction.id}/assign-owner`,
          {
            method: "POST",
            body: JSON.stringify({
              assigned_owner_id:
                ownerId,
              comment:
                "Owner assignment updated.",
            }),
          }
        ),
      "Owner assignment updated.",
      selectedAction.id
    );
  }

  async function transition(
    endpoint: string,
    message: string,
    body: Record<string, unknown> = {}
  ) {
    if (
      !assessmentId ||
      !selectedAction
    ) {
      return;
    }

    await runAction(
      () =>
        request(
          `/pam/assessments/${assessmentId}/follow-up-actions/${selectedAction.id}/${endpoint}`,
          {
            method: "POST",
            body: JSON.stringify(body),
          }
        ),
      message,
      selectedAction.id
    );
  }

  async function linkEvidence() {
    if (
      !assessmentId ||
      !selectedAction ||
      !selectedEvidenceId
    ) {
      return;
    }

    await runAction(
      () =>
        request(
          `/pam/assessments/${assessmentId}/follow-up-actions/${selectedAction.id}/evidences`,
          {
            method: "POST",
            body: JSON.stringify({
              evidence_id:
                Number(selectedEvidenceId),
              note:
                evidenceNote.trim() ||
                null,
            }),
          }
        ),
      "Evidence linked.",
      selectedAction.id
    );

    setEvidenceNote("");
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Maturity Workspace
          </div>

          <h1 className="mt-2 text-2xl font-semibold text-slate-950">
            Follow-up Actions
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Track corrective implementation from maturity
            findings through ownership, evidence,
            independent verification, and completion.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setShowCreate(
                (value) => !value
              )
            }
            disabled={
              !assessmentId ||
              !findings.length
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40"
          >
            <Target size={15} />
            New Action
          </button>

          <button
            type="button"
            onClick={() => {
              void loadAssessments();

              if (assessmentId) {
                void loadContext(
                  Number(assessmentId)
                );
              }
            }}
            disabled={
              loading ||
              detailLoading ||
              actionBusy
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={
                loading ||
                detailLoading ||
                actionBusy
                  ? "animate-spin"
                  : ""
              }
            />
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Assessment
          </label>

          <select
            value={assessmentId}
            onChange={(event) => {
              setAssessmentId(
                event.target.value
              );
              setSelectedActionId("");
            }}
            disabled={loading}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400"
          >
            {!assessments.length ? (
              <option value="">
                No maturity assessment available
              </option>
            ) : null}

            {assessments.map(
              (assessment) => (
                <option
                  key={assessment.id}
                  value={assessment.id}
                >
                  {assessment.name}
                </option>
              )
            )}
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
      </div>

      {showCreate ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-950">
              New Follow-up Action
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Create an executable action from an
              existing maturity finding.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Finding">
              <select
                value={createFindingId}
                onChange={(event) =>
                  setCreateFindingId(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {findings.map(
                  (finding) => (
                    <option
                      key={finding.id}
                      value={finding.id}
                    >
                      #{finding.id} - {finding.title}
                    </option>
                  )
                )}
              </select>
            </Field>

            <Field label="Priority">
              <select
                value={createPriority}
                onChange={(event) =>
                  setCreatePriority(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="LOW">
                  Low
                </option>
                <option value="MEDIUM">
                  Medium
                </option>
                <option value="HIGH">
                  High
                </option>
                <option value="CRITICAL">
                  Critical
                </option>
              </select>
            </Field>

            <Field label="Title">
              <input
                value={createTitle}
                onChange={(event) =>
                  setCreateTitle(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Assigned Owner">
              <select
                value={createOwnerId}
                onChange={(event) =>
                  setCreateOwnerId(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">
                  Unassigned
                </option>

                {users.map((user) => (
                  <option
                    key={user.id}
                    value={user.id}
                  >
                    {user.full_name ||
                      user.email ||
                      `User #${user.id}`}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Due Date">
              <input
                type="date"
                value={createDueDate}
                onChange={(event) =>
                  setCreateDueDate(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Description">
              <textarea
                value={createDescription}
                onChange={(event) =>
                  setCreateDescription(
                    event.target.value
                  )
                }
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() =>
                setShowCreate(false)
              }
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => {
                void createAction();
              }}
              disabled={actionBusy}
              className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Create Action
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={<Target size={17} />}
          label="Open"
          value={openCount}
        />

        <Metric
          icon={<PlayCircle size={17} />}
          label="In Progress"
          value={progressCount}
        />

        <Metric
          icon={<ShieldCheck size={17} />}
          label="Verification"
          value={verificationCount}
        />

        <Metric
          icon={<CheckCircle2 size={17} />}
          label="Completed"
          value={completedCount}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              Follow-up Registry
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Corrective implementation actions for
              the selected maturity assessment.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search actions"
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400 sm:w-56"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">
                All statuses
              </option>
              <option value="OPEN">
                Open
              </option>
              <option value="IN_PROGRESS">
                In Progress
              </option>
              <option value="BLOCKED">
                Blocked
              </option>
              <option value="READY_FOR_VERIFICATION">
                Ready for Verification
              </option>
              <option value="VERIFICATION_FAILED">
                Verification Failed
              </option>
              <option value="COMPLETED">
                Completed
              </option>
              <option value="CANCELLED">
                Cancelled
              </option>
            </select>

            <select
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(
                  event.target.value
                )
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">
                All priorities
              </option>
              <option value="LOW">
                Low
              </option>
              <option value="MEDIUM">
                Medium
              </option>
              <option value="HIGH">
                High
              </option>
              <option value="CRITICAL">
                Critical
              </option>
            </select>
          </div>
        </div>

        <div className="p-5">
          {detailLoading ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Loading follow-up actions...
            </div>
          ) : !visibleActions.length ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
              No follow-up actions match the selected context.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-3 font-semibold">
                      Action
                    </th>
                    <th className="px-3 py-3 font-semibold">
                      Finding
                    </th>
                    <th className="px-3 py-3 font-semibold">
                      Owner
                    </th>
                    <th className="px-3 py-3 font-semibold">
                      Priority
                    </th>
                    <th className="px-3 py-3 font-semibold">
                      Status
                    </th>
                    <th className="px-3 py-3 font-semibold">
                      Due Date
                    </th>
                    <th className="px-3 py-3 font-semibold">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {visibleActions.map(
                    (action) => {
                      const finding =
                        findingMap.get(
                          action.finding_id
                        );

                      return (
                        <tr
                          key={action.id}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td className="px-3 py-4">
                            <div className="font-semibold text-slate-950">
                              {action.title}
                            </div>

                            <div className="mt-1 text-xs text-slate-500">
                              {action.action_code}
                            </div>
                          </td>

                          <td className="px-3 py-4">
                            <div className="font-medium text-slate-800">
                              {finding?.title ||
                                `Finding #${action.finding_id}`}
                            </div>

                            <div className="mt-1 text-xs text-slate-500">
                              Finding #{action.finding_id}
                            </div>
                          </td>

                          <td className="px-3 py-4 text-slate-600">
                            {userLabel(
                              users,
                              action.assigned_owner_id
                            )}
                          </td>

                          <td className="px-3 py-4">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityClass(
                                action.priority
                              )}`}
                            >
                              {displayStatus(
                                action.priority
                              )}
                            </span>
                          </td>

                          <td className="px-3 py-4">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                                action.status
                              )}`}
                            >
                              {displayStatus(
                                action.status
                              )}
                            </span>
                          </td>

                          <td className="px-3 py-4 text-slate-600">
                            {action.due_date ||
                              "-"}
                          </td>

                          <td className="px-3 py-4">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedActionId(
                                  String(
                                    action.id
                                  )
                                )
                              }
                              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              Open Workflow
                            </button>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedAction ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Action Workflow
              </div>

              <h2 className="mt-2 text-lg font-semibold text-slate-950">
                {selectedAction.title}
              </h2>

              <div className="mt-1 text-sm text-slate-500">
                {selectedAction.action_code}
                {" / "}
                Finding #{selectedAction.finding_id}
              </div>
            </div>

            <span
              className={`inline-flex self-start rounded-full border px-3 py-1.5 text-xs font-semibold ${statusClass(
                selectedAction.status
              )}`}
            >
              {displayStatus(
                selectedAction.status
              )}
            </span>
          </div>

          <div className="grid gap-6 py-5 xl:grid-cols-2">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-950">
                Ownership and Execution
              </h3>

              <Field label="Assigned Owner">
                <select
                  value={
                    selectedAction.assigned_owner_id ||
                    ""
                  }
                  onChange={(event) => {
                    if (
                      event.target.value
                    ) {
                      void assignOwner(
                        Number(
                          event.target.value
                        )
                      );
                    }
                  }}
                  disabled={
                    actionBusy ||
                    selectedAction.status ===
                      "COMPLETED" ||
                    selectedAction.status ===
                      "CANCELLED"
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                >
                  <option value="">
                    Unassigned
                  </option>

                  {users.map((user) => (
                    <option
                      key={user.id}
                      value={user.id}
                    >
                      {user.full_name ||
                        user.email ||
                        `User #${user.id}`}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="flex flex-wrap gap-2">
                {selectedAction.status ===
                "OPEN" ? (
                  <ActionButton
                    disabled={actionBusy}
                    onClick={() => {
                      void transition(
                        "start",
                        "Action started.",
                        {
                          comment:
                            "Implementation started.",
                        }
                      );
                    }}
                  >
                    Start
                  </ActionButton>
                ) : null}

                {selectedAction.status ===
                "IN_PROGRESS" ? (
                  <ActionButton
                    disabled={actionBusy}
                    onClick={() => {
                      void transition(
                        "block",
                        "Action blocked.",
                        {
                          comment:
                            "Implementation blocked.",
                        }
                      );
                    }}
                  >
                    Block
                  </ActionButton>
                ) : null}

                {selectedAction.status ===
                  "BLOCKED" ||
                selectedAction.status ===
                  "VERIFICATION_FAILED" ? (
                  <ActionButton
                    disabled={actionBusy}
                    onClick={() => {
                      void transition(
                        "resume",
                        "Action resumed.",
                        {
                          comment:
                            "Implementation resumed.",
                        }
                      );
                    }}
                  >
                    Resume
                  </ActionButton>
                ) : null}
              </div>

              {selectedAction.status ===
              "IN_PROGRESS" ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Completion Note
                  </label>

                  <textarea
                    value={completionNote}
                    onChange={(event) =>
                      setCompletionNote(
                        event.target.value
                      )
                    }
                    rows={3}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  />

                  <button
                    type="button"
                    disabled={
                      actionBusy ||
                      !completionNote.trim()
                    }
                    onClick={() => {
                      void transition(
                        "submit-for-verification",
                        "Action submitted for verification.",
                        {
                          completion_note:
                            completionNote.trim(),
                          comment:
                            "Implementation submitted for verification.",
                        }
                      );

                      setCompletionNote("");
                    }}
                    className="mt-3 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    Submit for Verification
                  </button>
                </div>
              ) : null}

              {selectedAction.status ===
              "READY_FOR_VERIFICATION" ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-blue-700">
                    Verification Comment
                  </label>

                  <textarea
                    value={verificationComment}
                    onChange={(event) =>
                      setVerificationComment(
                        event.target.value
                      )
                    }
                    rows={3}
                    className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm"
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={
                        actionBusy ||
                        !verificationComment.trim()
                      }
                      onClick={() => {
                        void transition(
                          "verify",
                          "Verification failed. Rework is required.",
                          {
                            effective: false,
                            comment:
                              verificationComment.trim(),
                          }
                        );

                        setVerificationComment("");
                      }}
                      className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-40"
                    >
                      Verification Failed
                    </button>

                    <button
                      type="button"
                      disabled={
                        actionBusy ||
                        !verificationComment.trim()
                      }
                      onClick={() => {
                        void transition(
                          "verify",
                          "Action verified and completed.",
                          {
                            effective: true,
                            comment:
                              verificationComment.trim(),
                          }
                        );

                        setVerificationComment("");
                      }}
                      className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      Verify and Complete
                    </button>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-950">
                Implementation Evidence
              </h3>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <Field label="Uploaded Evidence">
                  <select
                    value={selectedEvidenceId}
                    onChange={(event) =>
                      setSelectedEvidenceId(
                        event.target.value
                      )
                    }
                    disabled={
                      !evidenceCandidates.length
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    {!evidenceCandidates.length ? (
                      <option value="">
                        No uploaded maturity evidence available
                      </option>
                    ) : null}

                    {evidenceCandidates.map(
                      (item) => (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {evidenceLabel(
                            item
                          )}
                        </option>
                      )
                    )}
                  </select>
                </Field>

                <div className="mt-3">
                  <Field label="Link Note">
                    <input
                      value={evidenceNote}
                      onChange={(event) =>
                        setEvidenceNote(
                          event.target.value
                        )
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </Field>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    void linkEvidence();
                  }}
                  disabled={
                    actionBusy ||
                    !selectedEvidenceId
                  }
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
                >
                  <Link2 size={15} />
                  Link Evidence
                </button>
              </div>

              {!linkedEvidence.length ? (
                <div className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">
                  No implementation evidence linked.
                </div>
              ) : (
                <div className="space-y-2">
                  {linkedEvidence.map(
                    (link) => {
                      const evidence =
                        evidenceCandidates.find(
                          (item) =>
                            item.id ===
                            link.evidence_id
                        );

                      return (
                        <div
                          key={link.id}
                          className="rounded-xl border border-slate-200 px-4 py-3"
                        >
                          <div className="font-medium text-slate-900">
                            {evidence
                              ? evidenceLabel(
                                  evidence
                                )
                              : `Evidence #${link.evidence_id}`}
                          </div>

                          {link.note ? (
                            <div className="mt-1 text-xs text-slate-500">
                              {link.note}
                            </div>
                          ) : null}
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </section>
          </div>

          <section className="border-t border-slate-200 pt-5">
            <h3 className="text-sm font-semibold text-slate-950">
              Workflow History
            </h3>

            {!workflow.length ? (
              <div className="mt-3 rounded-xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">
                No workflow events available.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {workflow.map((event) => (
                  <div
                    key={event.id}
                    className="flex gap-3 rounded-xl border border-slate-200 px-4 py-3"
                  >
                    <div className="mt-0.5">
                      {event.to_status ===
                      "COMPLETED" ? (
                        <CheckCircle2
                          size={17}
                          className="text-emerald-600"
                        />
                      ) : event.to_status ===
                        "VERIFICATION_FAILED" ? (
                        <AlertCircle
                          size={17}
                          className="text-red-600"
                        />
                      ) : (
                        <Clock3
                          size={17}
                          className="text-slate-400"
                        />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">
                        {displayStatus(
                          event.action
                        )}
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        {event.from_status
                          ? displayStatus(
                              event.from_status
                            )
                          : "Start"}
                        {" -> "}
                        {event.to_status
                          ? displayStatus(
                              event.to_status
                            )
                          : "-"}
                      </div>

                      {event.comment ? (
                        <div className="mt-2 text-sm text-slate-600">
                          {event.comment}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default function FollowUpActionsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-slate-500">
          Loading follow-up actions...
        </div>
      }
    >
      <FollowUpActionsContent />
    </Suspense>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-slate-500">
        {icon}
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>

      {children}
    </div>
  );
}

function ActionButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
