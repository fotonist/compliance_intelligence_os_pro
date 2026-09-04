"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/app/lib/api";

/* =========================================================
   TYPES
========================================================= */

type Task = {
  id: number;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  process_id?: number | null;
  control_id?: number | null;
  task_type?: string | null;
  owner_role?: string | null;
  assignee_user_id?: number | null;
  created_by_user_id?: number | null;
  priority_score?: number | null;
  due_date?: string | null;
  source_type?: string | null;
  source_id?: number | null;
};

type EvidenceFile = {
  id: number;
  file_name?: string;
  filename?: string;
  version?: number;
  status?: string;
  uploaded_at?: string;
  mime_type?: string;
  file_size?: number;
};

type Evidence = {
  id: number;
  title: string;
  description?: string;
  status?: string;
  approval_status?: string | null;
  control_id?: number | null;
  requirement_id?: number | null;
  created_at?: string;
  files?: EvidenceFile[];
};

type EvidenceRequirement = {
  id: number;
  task_id: number;
  name: string;
  description?: string | null;
  evidence_type?: string | null;
  required: boolean;
  status?: string | null;
  created_at?: string;
  updated_at?: string;
};

type AssignableUser = {
  id: number;
  email?: string | null;
  full_name?: string | null;
  username?: string | null;
  is_active?: boolean;
  is_locked?: boolean;
  roles?: Array<{ id?: number; name?: string | null }>;
};

const STATUS_ORDER = [
  "OPEN",
  "IN_PROGRESS",
  "UNDER_REVIEW",
  "READY_TO_CLOSE",
  "DONE",
];

const TRANSITIONS: Record<string, string[]> = {
  OPEN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["BLOCKED", "UNDER_REVIEW", "CANCELLED"],
  BLOCKED: ["IN_PROGRESS", "CANCELLED"],
  UNDER_REVIEW: ["IN_PROGRESS", "READY_TO_CLOSE"],
  READY_TO_CLOSE: ["DONE"],
  DONE: [],
  CANCELLED: [],
};

/* =========================================================
   HELPERS
========================================================= */

function normalizeStatus(value?: string | null) {
  return String(value || "OPEN").trim().toUpperCase();
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}

function formatFileSize(value?: number) {
  if (!value) return "—";

  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function statusClass(status?: string | null) {
  switch (normalizeStatus(status)) {
    case "DONE":
      return "bg-emerald-950 text-emerald-300 border-emerald-800";
    case "CANCELLED":
      return "bg-slate-800 text-slate-400 border-slate-700";
    case "READY_TO_CLOSE":
      return "bg-cyan-950 text-cyan-300 border-cyan-800";
    case "UNDER_REVIEW":
      return "bg-violet-950 text-violet-300 border-violet-800";
    case "BLOCKED":
      return "bg-red-950 text-red-300 border-red-800";
    case "IN_PROGRESS":
      return "bg-blue-950 text-blue-300 border-blue-800";
    default:
      return "bg-slate-800 text-slate-300 border-slate-700";
  }
}

function fileStatusClass(status?: string | null) {
  switch (String(status || "").toLowerCase()) {
    case "approved":
      return "text-emerald-300";
    case "waiting_approval":
      return "text-amber-300";
    case "rejected":
      return "text-red-300";
    default:
      return "text-slate-300";
  }
}

/* =========================================================
   COMPONENT
========================================================= */

export default function TaskWorkspacePage() {
  const router = useRouter();
  const params = useParams();

  const rawTaskId = params?.taskId ?? params?.id;

  const taskId =
    typeof rawTaskId === "string"
      ? rawTaskId
      : Array.isArray(rawTaskId)
        ? rawTaskId[0]
        : "";

  const [task, setTask] = useState<Task | null>(null);
  const [description, setDescription] = useState("");

  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [requirements, setRequirements] = useState<EvidenceRequirement[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<number | "">("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");

  const [newEvidenceTitle, setNewEvidenceTitle] = useState("");
  const [newEvidenceDescription, setNewEvidenceDescription] = useState("");

  const [newRequirementName, setNewRequirementName] = useState("");
  const [newRequirementType, setNewRequirementType] = useState("");

  const [selectedEvidenceId, setSelectedEvidenceId] = useState<number | null>(
    null
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [creatingEvidence, setCreatingEvidence] = useState(false);
  const [uploadingEvidenceId, setUploadingEvidenceId] = useState<number | null>(
    null
  );
  const [creatingRequirement, setCreatingRequirement] = useState(false);
  const [error, setError] = useState("");

  /* =========================================================
     DERIVED STATE
  ========================================================= */

  const currentStatus = normalizeStatus(task?.status);

  const isTerminal =
    currentStatus === "DONE" || currentStatus === "CANCELLED";

  const availableTransitions = useMemo(
    () => TRANSITIONS[currentStatus] || [],
    [currentStatus]
  );

  const selectedEvidence = evidences.find(
    (evidence) => evidence.id === selectedEvidenceId
  );

  /* =========================================================
     LOAD
  ========================================================= */

  async function loadEvidence() {
    if (!taskId) return;

    const res = await apiFetch(`/company/tasks/${taskId}/evidence`);

    const json = await res.json();

    const rows = Array.isArray(json)
      ? json
      : Array.isArray(json?.evidences)
        ? json.evidences
        : [];

    setEvidences(rows);
  }

  async function loadRequirements() {
    if (!taskId) return;

    const res = await apiFetch(
      `/company/tasks/${taskId}/evidence-requirements`
    );

    const json = await res.json();

    setRequirements(Array.isArray(json) ? json : []);
  }

  async function loadUsers() {
    try {
      setLoadingUsers(true);
      setAssignmentError("");

      const res = await apiFetch("/users/?page=1&page_size=100&is_active=true");
      const json = await res.json();

      const rows = Array.isArray(json)
        ? json
        : Array.isArray(json?.items)
          ? json.items
          : Array.isArray(json?.users)
            ? json.users
            : Array.isArray(json?.data)
              ? json.data
              : [];

      const eligible = rows.filter(
        (user: AssignableUser) =>
          user?.is_active !== false && user?.is_locked !== true
      );

      setAssignableUsers(eligible);
    } catch (err) {
      console.error(err);
      setAssignableUsers([]);
      setAssignmentError(
        err instanceof Error
          ? err.message
          : "Unable to load assignable users."
      );
    } finally {
      setLoadingUsers(false);
    }
  }

  async function assignTask() {
    if (!taskId || isTerminal || selectedAssigneeId === "") return;

    try {
      setAssigning(true);
      setAssignmentError("");
      setError("");

      await apiFetch(`/company/tasks/${taskId}/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignee_user_id: Number(selectedAssigneeId),
        }),
      });

      await loadTask();
    } catch (err) {
      console.error(err);
      setAssignmentError(
        err instanceof Error
          ? err.message
          : "Unable to assign task."
      );
    } finally {
      setAssigning(false);
    }
  }

  async function loadTask() {
    if (!taskId) {
      setLoading(false);
      return;
    }

    try {
      setError("");

      const res = await apiFetch(`/company/tasks/${taskId}`);
      const json = await res.json();

      setTask(json);
      setDescription(json?.description || "");
      setSelectedAssigneeId(
        json?.assignee_user_id != null ? Number(json.assignee_user_id) : ""
      );

      await Promise.all([loadEvidence(), loadRequirements()]);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Unable to load task."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTask();
    loadUsers();
  }, [taskId]);

  /* =========================================================
     TASK UPDATE
  ========================================================= */

  async function saveTask() {
    if (!taskId || isTerminal) return;

    try {
      setSaving(true);
      setError("");

      const res = await apiFetch(`/company/tasks/${taskId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description,
        }),
      });

      const json = await res.json();

      setTask(json);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Unable to save task."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     STATUS TRANSITION
  ========================================================= */

  async function transitionTask(nextStatus: string) {
    if (!taskId || isTerminal) return;

    try {
      setTransitioning(true);
      setError("");

      await apiFetch(`/company/tasks/${taskId}/transition`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: nextStatus,
        }),
      });

      await loadTask();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to transition task."
      );
    } finally {
      setTransitioning(false);
    }
  }

  /* =========================================================
     CANCEL
  ========================================================= */

  async function cancelTask() {
    if (!taskId || isTerminal) return;

    const confirmed = window.confirm(
      "Cancel this task? This action changes the task workflow state."
    );

    if (!confirmed) return;

    try {
      setTransitioning(true);
      setError("");

      await apiFetch(`/company/tasks/${taskId}/cancel`, {
        method: "POST",
      });

      await loadTask();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Unable to cancel task."
      );
    } finally {
      setTransitioning(false);
    }
  }

  /* =========================================================
     CLOSE
  ========================================================= */

  async function closeTask() {
    if (!taskId || isTerminal) return;

    try {
      setTransitioning(true);
      setError("");

      await apiFetch(`/company/tasks/${taskId}/close`, {
        method: "POST",
      });

      await loadTask();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Task cannot be completed."
      );
    } finally {
      setTransitioning(false);
    }
  }

  /* =========================================================
     CREATE EVIDENCE
  ========================================================= */

  async function createEvidence() {
    if (!taskId || isTerminal) return;

    const title = newEvidenceTitle.trim();

    if (!title) {
      setError("Evidence title is required.");
      return;
    }

    if (!task?.control_id) {
      setError(
        "This task has no control relationship. Evidence cannot be created until a control is linked."
      );
      return;
    }

    try {
      setCreatingEvidence(true);
      setError("");

      const res = await apiFetch(`/company/tasks/${taskId}/evidence`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description: newEvidenceDescription.trim() || null,
        }),
      });

      const json = await res.json();

      setNewEvidenceTitle("");
      setNewEvidenceDescription("");

      await loadEvidence();

      if (json?.evidence_id) {
        setSelectedEvidenceId(Number(json.evidence_id));
      }
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create evidence."
      );
    } finally {
      setCreatingEvidence(false);
    }
  }

  /* =========================================================
     UPLOAD FILE TO EXISTING EVIDENCE
  ========================================================= */

  async function uploadEvidenceFile(
    evidenceId: number,
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    if (isTerminal) return;

    const file = event.target.files?.[0];

    if (!file) return;

    try {
      setUploadingEvidenceId(evidenceId);
      setError("");

      const formData = new FormData();

      formData.append("files", file, file.name);

      await apiFetch(`/evidences/${evidenceId}/files`, {
        method: "POST",
        body: formData,
      });

      event.target.value = "";

      await loadEvidence();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to upload evidence file."
      );
    } finally {
      setUploadingEvidenceId(null);
    }
  }

  /* =========================================================
     LOAD EVIDENCE DETAIL / FILES
  ========================================================= */

  function openEvidenceWorkspace(evidenceId?: number) {
    const query = evidenceId
      ? `?task_id=${encodeURIComponent(taskId)}&evidence_id=${encodeURIComponent(String(evidenceId))}`
      : `?task_id=${encodeURIComponent(taskId)}`;

    router.push(`/evidences${query}`);
  }

  async function openEvidence(evidenceId: number) {
    try {
      setSelectedEvidenceId(evidenceId);

      const res = await apiFetch(`/evidences/${evidenceId}/detail`);
      const json = await res.json();

      const detail = json?.evidence;
      const files = Array.isArray(json?.files) ? json.files : [];

      setEvidences((current) =>
        current.map((item) =>
          item.id === evidenceId
            ? {
                ...item,
                ...detail,
                files,
              }
            : item
        )
      );
    } catch (err) {
      console.error(err);
    }
  }

  /* =========================================================
     FILE REVIEW
  ========================================================= */

  async function submitFile(fileId: number) {
    try {
      setError("");

      await apiFetch(`/evidences/files/${fileId}/submit`, {
        method: "POST",
      });

      if (selectedEvidenceId) {
        await openEvidence(selectedEvidenceId);
      }
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Unable to submit file."
      );
    }
  }

  async function approveFile(fileId: number) {
    try {
      setError("");

      await apiFetch(`/evidences/files/${fileId}/approve`, {
        method: "POST",
      });

      if (selectedEvidenceId) {
        await openEvidence(selectedEvidenceId);
      }
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Unable to approve file."
      );
    }
  }

  async function rejectFile(fileId: number) {
    const reason = window.prompt("Rejection reason (optional):") || "";

    try {
      setError("");

      await apiFetch(`/evidences/files/${fileId}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason,
        }),
      });

      if (selectedEvidenceId) {
        await openEvidence(selectedEvidenceId);
      }
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Unable to reject file."
      );
    }
  }

  /* =========================================================
     EVIDENCE REQUIREMENTS
  ========================================================= */

  async function createRequirement() {
    if (!taskId || isTerminal) return;

    const name = newRequirementName.trim();

    if (!name) {
      setError("Evidence requirement name is required.");
      return;
    }

    try {
      setCreatingRequirement(true);
      setError("");

      await apiFetch(
        `/company/tasks/${taskId}/evidence-requirements`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            description: null,
            evidence_type: newRequirementType.trim() || null,
            required: true,
          }),
        }
      );

      setNewRequirementName("");
      setNewRequirementType("");

      await loadRequirements();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create evidence requirement."
      );
    } finally {
      setCreatingRequirement(false);
    }
  }

  /* =========================================================
     RENDER — ENTERPRISE COMPLIANCE WORKSPACE
  ========================================================= */

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-[1480px]">
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-24 rounded bg-slate-200" />
            <div className="h-8 w-2/3 rounded bg-slate-200" />
            <div className="h-24 rounded-xl bg-white ring-1 ring-slate-200" />
            <div className="h-64 rounded-xl bg-white ring-1 ring-slate-200" />
          </div>
        </div>
      </main>
    );
  }

  if (!task) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-[1480px]">
          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">
              Task not found
            </div>
            <button
              type="button"
              onClick={() => router.push("/company/tasks")}
              className="mt-4 text-sm font-medium text-sky-700 hover:text-sky-800"
            >
              Back to Tasks
            </button>
          </div>
        </div>
      </main>
    );
  }

  const requiredRequirements = requirements.filter((item) => item.required);
  const requiredComplete = requiredRequirements.filter(
    (item) => normalizeStatus(item.status) === "DONE" || normalizeStatus(item.status) === "APPROVED"
  ).length;

  const approvedFiles = evidences.reduce(
    (total, evidence) =>
      total +
      (evidence.files || []).filter(
        (file) => String(file.status || "").toLowerCase() === "approved"
      ).length,
    0
  );

  const reviewFiles = evidences.reduce(
    (total, evidence) =>
      total +
      (evidence.files || []).filter(
        (file) => String(file.status || "").toLowerCase() === "waiting_approval"
      ).length,
    0
  );

  const overdue =
    !!task?.due_date &&
    !isTerminal &&
    new Date(task.due_date).getTime() < Date.now();

  const priorityLabel =
    (task.priority_score ?? 0) >= 80
      ? "Critical"
      : (task.priority_score ?? 0) >= 60
        ? "High"
        : (task.priority_score ?? 0) >= 30
          ? "Medium"
          : "Low";

  const priorityClass =
    priorityLabel === "Critical"
      ? "border-red-200 bg-red-50 text-red-700"
      : priorityLabel === "High"
        ? "border-orange-200 bg-orange-50 text-orange-700"
        : priorityLabel === "Medium"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-slate-200 bg-slate-50 text-slate-600";

  const currentAssignee = assignableUsers.find(
    (user) => user.id === Number(task.assignee_user_id)
  );

  const currentAssigneeLabel =
    currentAssignee?.full_name ||
    currentAssignee?.username ||
    currentAssignee?.email ||
    (task.assignee_user_id ? `User #${task.assignee_user_id}` : "Unassigned");


  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1480px] px-6 py-6 lg:px-8">

        {/* Header / breadcrumb */}
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              <button
                type="button"
                onClick={() => router.push("/company/tasks")}
                className="hover:text-sky-700"
              >
                Compliance Operations
              </button>
              <span className="text-slate-300">/</span>
              <span>Task Workspace</span>
              <span className="text-slate-300">/</span>
              <span>#{task.id}</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="max-w-4xl text-2xl font-semibold tracking-tight text-slate-950 lg:text-[28px]">
                {task.title || "Compliance Task"}
              </h1>

              <span
                className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-semibold ${statusClass(
                  task.status
                )}`}
              >
                {currentStatus.replaceAll("_", " ")}
              </span>

              <span className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold ${priorityClass}`}>
                {priorityLabel} priority
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-500">
              <span>{task.task_type || "COMPLIANCE_ACTION"}</span>
              <span>Task #{task.id}</span>
              {overdue && (
                <span className="font-semibold text-red-600">Overdue</span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push("/company/tasks")}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Back to Task Register
          </button>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span className="mt-0.5 font-bold">!</span>
            <span>{error}</span>
          </div>
        )}

        {/* Executive task facts */}
        <section className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 md:grid-cols-4 lg:grid-cols-8 lg:divide-y-0">
            {[
              ["Process", task.process_id ? `#${task.process_id}` : "—"],
              ["Control", task.control_id ? `#${task.control_id}` : "—"],
              ["Owner", task.owner_role || "—"],
              ["Assignee", currentAssigneeLabel],
              ["Priority", String(task.priority_score ?? "—")],
              ["Due date", formatDate(task.due_date)],
              ["Source", task.source_type || "manual"],
              ["Created by", task.created_by_user_id ? `User #${task.created_by_user_id}` : "—"],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0 px-4 py-4">
                <div className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {label}
                </div>
                <div className="mt-1 truncate text-sm font-medium text-slate-800">
                  {value}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">

          <div className="min-w-0 space-y-5">

            {/* Workflow */}
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-950">
                    Workflow
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Controlled task lifecycle and permitted transitions.
                  </p>
                </div>
                <span className="text-xs font-medium text-slate-500">
                  Current: {currentStatus.replaceAll("_", " ")}
                </span>
              </div>

              <div className="overflow-x-auto px-5 py-6">
                <div className="flex min-w-[720px] items-center">
                  {STATUS_ORDER.map((statusValue, index) => {
                    const currentIndex = STATUS_ORDER.indexOf(currentStatus);
                    const active = currentStatus === statusValue;
                    const passed = currentIndex > index;

                    return (
                      <div key={statusValue} className="flex flex-1 items-center">
                        <div className="flex min-w-0 flex-col items-center text-center">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold ${
                              active
                                ? "border-sky-600 bg-sky-600 text-white"
                                : passed
                                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                  : "border-slate-300 bg-white text-slate-400"
                            }`}
                          >
                            {passed ? "✓" : index + 1}
                          </div>
                          <div
                            className={`mt-2 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.08em] ${
                              active ? "text-sky-700" : passed ? "text-emerald-700" : "text-slate-400"
                            }`}
                          >
                            {statusValue.replaceAll("_", " ")}
                          </div>
                        </div>

                        {index < STATUS_ORDER.length - 1 && (
                          <div
                            className={`mx-2 h-px flex-1 ${
                              passed ? "bg-emerald-400" : "bg-slate-200"
                            }`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  {availableTransitions
                    .filter((next) => next !== "CANCELLED")
                    .map((nextStatus) => (
                      <button
                        key={nextStatus}
                        type="button"
                        disabled={transitioning}
                        onClick={() => transitionTask(nextStatus)}
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Move to {nextStatus.replaceAll("_", " ")}
                      </button>
                    ))}

                  {availableTransitions.includes("CANCELLED") && (
                    <button
                      type="button"
                      disabled={transitioning}
                      onClick={cancelTask}
                      className="rounded-md border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Cancel Task
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Evidence readiness */}
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-950">
                    Evidence Readiness
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Evidence requirements, records and file approval state.
                  </p>
                </div>

                <div className="flex items-center gap-5 text-right">
                  <div>
                    <div className="text-lg font-semibold text-slate-950">
                      {requiredComplete}/{requiredRequirements.length}
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Requirements
                    </div>
                  </div>
                  <div className="h-8 w-px bg-slate-200" />
                  <div>
                    <div className="text-lg font-semibold text-slate-950">
                      {approvedFiles}
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Approved files
                    </div>
                  </div>
                  <div className="h-8 w-px bg-slate-200" />
                  <div>
                    <div className="text-lg font-semibold text-slate-950">
                      {reviewFiles}
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      In review
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5">
                <div className="mb-6">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Required evidence
                    </div>
                    <div className="text-xs font-medium text-slate-500">
                      {requirements.length} total
                    </div>
                  </div>

                  {requirements.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 py-6">
                      <div className="text-sm font-medium text-slate-700">
                        No evidence requirements defined
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Define the evidence expected before this task can be closed.
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-slate-200">
                      <div className="grid grid-cols-[minmax(0,1fr)_140px_110px] border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        <span>Requirement</span>
                        <span>Type</span>
                        <span>Status</span>
                      </div>

                      {requirements.map((requirement) => {
                        const reqStatus = normalizeStatus(requirement.status);
                        const satisfied =
                          reqStatus === "DONE" || reqStatus === "APPROVED";

                        return (
                          <div
                            key={requirement.id}
                            className="grid grid-cols-[minmax(0,1fr)_140px_110px] items-center border-b border-slate-100 px-4 py-3 last:border-b-0"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-slate-800">
                                {requirement.name}
                              </div>
                              <div className="mt-0.5 flex gap-2 text-[11px] text-slate-400">
                                {requirement.required && <span>Required</span>}
                                <span>#{requirement.id}</span>
                              </div>
                            </div>
                            <div className="truncate text-xs text-slate-500">
                              {requirement.evidence_type || "Any evidence"}
                            </div>
                            <div className="flex items-center justify-end gap-2">
                              <span
                                className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-semibold ${
                                  satisfied
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-slate-200 bg-slate-50 text-slate-600"
                                }`}
                              >
                                {satisfied ? "SATISFIED" : reqStatus.replaceAll("_", " ")}
                              </span>
                              <button
                                type="button"
                                onClick={() => openEvidenceWorkspace()}
                                className="whitespace-nowrap text-[11px] font-semibold text-sky-700 hover:text-sky-800"
                              >
                                {satisfied ? "Open evidence →" : "Collect evidence →"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {!isTerminal && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Add requirement
                    </div>

                    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_190px_auto]">
                      <input
                        value={newRequirementName}
                        onChange={(e) => setNewRequirementName(e.target.value)}
                        placeholder="Requirement name"
                        className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                      />
                      <input
                        value={newRequirementType}
                        onChange={(e) => setNewRequirementType(e.target.value)}
                        placeholder="Evidence type"
                        className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                      />
                      <button
                        type="button"
                        disabled={creatingRequirement}
                        onClick={createRequirement}
                        className="h-9 rounded-md bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        {creatingRequirement ? "Adding..." : "Add requirement"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Evidence workspace handoff */}
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Evidence Operations
                </div>
                <h2 className="mt-1 text-sm font-semibold text-slate-950">
                  Evidence collection is managed separately
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  This task workspace defines what evidence is required and shows readiness.
                  Evidence records, file upload, submission and review are handled in the Evidence workspace.
                </p>
              </div>

              <div className="grid gap-3 p-5 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Requirements
                  </div>
                  <div className="mt-1 text-xl font-semibold text-slate-950">
                    {requiredRequirements.length}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Required evidence items
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Evidence records
                  </div>
                  <div className="mt-1 text-xl font-semibold text-slate-950">
                    {evidences.length}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Linked to this task
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Approved files
                  </div>
                  <div className="mt-1 text-xl font-semibold text-emerald-700">
                    {approvedFiles}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Accepted evidence files
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-slate-700">
                      Responsibility boundary
                    </span>
                    <span className="text-xs leading-5 text-slate-500">
                      Assignees collect evidence. Evidence reviewers validate files.
                      Task completion depends on the backend closure gate.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEvidenceWorkspace()}
                    className="shrink-0 rounded-md bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Manage evidence →
                  </button>
                </div>
              </div>
            </section>

            {/* Description */}
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-sm font-semibold text-slate-950">
                  Task Description
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Operational context, expected outcome and acceptance criteria.
                </p>
              </div>

              <div className="p-5">
                <textarea
                  rows={7}
                  disabled={isTerminal}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50 disabled:text-slate-500"
                  placeholder="Describe the compliance action, expected outcome, scope and acceptance criteria."
                />

                {!isTerminal && (
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={saveTask}
                      className="rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save description"}
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Sticky operations rail */}
          <aside className="space-y-5 xl:sticky xl:top-5">

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Task Operations
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-950">
                  Current state
                </div>
                <div className="mt-2 inline-flex rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                  {currentStatus.replaceAll("_", " ")}
                </div>
              </div>

              <div className="space-y-2 p-4">
                {!isTerminal && availableTransitions.length > 0 ? (
                  availableTransitions
                    .filter((next) => next !== "CANCELLED")
                    .map((nextStatus) => (
                      <button
                        key={nextStatus}
                        type="button"
                        disabled={transitioning}
                        onClick={() => transitionTask(nextStatus)}
                        className="flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 disabled:opacity-50"
                      >
                        <span>Move to {nextStatus.replaceAll("_", " ")}</span>
                        <span>→</span>
                      </button>
                    ))
                ) : (
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                    No workflow transition is currently available.
                  </div>
                )}

                {currentStatus === "READY_TO_CLOSE" && (
                  <button
                    type="button"
                    disabled={transitioning}
                    onClick={closeTask}
                    className="mt-2 flex w-full items-center justify-center rounded-md bg-emerald-700 px-3 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    Complete Task
                  </button>
                )}

                {!isTerminal && availableTransitions.includes("CANCELLED") && (
                  <button
                    type="button"
                    disabled={transitioning}
                    onClick={cancelTask}
                    className="mt-2 flex w-full items-center justify-center rounded-md border border-red-200 bg-white px-3 py-2.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Cancel Task
                  </button>
                )}
              </div>
            </section>

            {/* Assignment */}
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Assignment
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-950">
                  Responsible user
                </div>
              </div>

              <div className="space-y-3 p-4">
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Current assignee
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-800">
                    {currentAssigneeLabel}
                  </div>
                  {currentAssignee?.email && (
                    <div className="mt-0.5 truncate text-xs text-slate-500">
                      {currentAssignee.email}
                    </div>
                  )}
                </div>

                {!isTerminal && (
                  <>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-slate-600">
                        Assign to
                      </span>
                      <select
                        value={selectedAssigneeId}
                        onChange={(e) =>
                          setSelectedAssigneeId(
                            e.target.value ? Number(e.target.value) : ""
                          )
                        }
                        disabled={loadingUsers || assigning}
                        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50 disabled:text-slate-400"
                      >
                        <option value="">
                          {loadingUsers ? "Loading users..." : "Select a user"}
                        </option>
                        {assignableUsers.map((user) => {
                          const label =
                            user.full_name ||
                            user.username ||
                            user.email ||
                            `User #${user.id}`;

                          const roleLabel =
                            user.roles?.map((role) => role.name).filter(Boolean).join(", ");

                          return (
                            <option key={user.id} value={user.id}>
                              {roleLabel ? `${label} — ${roleLabel}` : label}
                            </option>
                          );
                        })}
                      </select>
                    </label>

                    <button
                      type="button"
                      disabled={
                        assigning ||
                        loadingUsers ||
                        selectedAssigneeId === "" ||
                        Number(selectedAssigneeId) === Number(task.assignee_user_id)
                      }
                      onClick={assignTask}
                      className="flex w-full items-center justify-center rounded-md bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {assigning ? "Assigning..." : "Assign task"}
                    </button>

                    {assignmentError && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-5 text-amber-800">
                        {assignmentError}
                      </div>
                    )}

                    {!loadingUsers && assignableUsers.length === 0 && !assignmentError && (
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] leading-5 text-slate-500">
                        No eligible active users are available for assignment.
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Closure Readiness
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-950">
                  Completion gate
                </div>
              </div>

              <div className="space-y-3 p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Required evidence</span>
                  <span className="font-semibold text-slate-800">
                    {requiredComplete}/{requiredRequirements.length}
                  </span>
                </div>

                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-sky-600"
                    style={{
                      width:
                        requiredRequirements.length === 0
                          ? "100%"
                          : `${Math.min(
                              100,
                              (requiredComplete / requiredRequirements.length) * 100
                            )}%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Approved files</span>
                  <span className="font-semibold text-slate-800">{approvedFiles}</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Files awaiting review</span>
                  <span className="font-semibold text-slate-800">{reviewFiles}</span>
                </div>

                <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-[11px] leading-5 text-slate-500">
                  The final close action remains subject to the backend completion gate for required evidence and checklist items.
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Traceability
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-950">
                  Compliance context
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                <div className="flex items-center justify-between px-5 py-3">
                  <span className="text-xs text-slate-500">Process</span>
                  <span className="text-xs font-semibold text-slate-800">
                    #{task.process_id ?? "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between px-5 py-3">
                  <span className="text-xs text-slate-500">Control</span>
                  <span className="text-xs font-semibold text-slate-800">
                    #{task.control_id ?? "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between px-5 py-3">
                  <span className="text-xs text-slate-500">Source</span>
                  <span className="text-xs font-semibold text-slate-800">
                    {task.source_type || "manual"}
                    {task.source_id ? ` #${task.source_id}` : ""}
                  </span>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
