"use client";

/* =========================================================
   IMPORTS
========================================================= */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/app/lib/api";

/* =========================================================
   TYPES
========================================================= */

type Task = {
  id: number;
  title?: string;
  description?: string;
  status?: string;
  process_id?: number;
  control_id?: number;
  owner_role?: string;
  due_date?: string;
};

type Evidence = {
  id: number;
  title: string;
  status: string;
  approval_status?: string;
};

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
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("OPEN");
  const [ownerRole, setOwnerRole] = useState("");
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [newEvidenceTitle, setNewEvidenceTitle] = useState("");
  const [loading, setLoading] = useState(true);

  const isClosed = String(task?.status || "").toUpperCase() === "CLOSED";

  /* =========================================================
     LOAD TASK
  ========================================================= */

  async function loadTask() {
    if (!taskId) {
      setLoading(false);
      return;
    }

    try {
      const res = await apiFetch(`/company/tasks/${taskId}`);

      if (!res.ok) {
        console.error("TASK LOAD FAILED", res.status);
        return;
      }

      const json = await res.json();

      setTask(json);
      setNotes(json?.description || "");
      setStatus(json?.status || "OPEN");
      setOwnerRole(json?.owner_role || "");

      await loadEvidence();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     LOAD EVIDENCE
  ========================================================= */

  async function loadEvidence() {
    if (!taskId) return;

    try {
      const res = await apiFetch(`/company/tasks/${taskId}/evidence`);

      if (!res.ok) {
        console.error("EVIDENCE LOAD FAILED", res.status);
        setEvidences([]);
        return;
      }

      const json = await res.json();

      if (Array.isArray(json)) {
        setEvidences(json);
      } else if (Array.isArray(json?.evidences)) {
        setEvidences(json.evidences);
      } else {
        setEvidences([]);
      }
    } catch (err) {
      console.error(err);
      setEvidences([]);
    }
  }

  /* =========================================================
     UPDATE TASK
  ========================================================= */

  async function updateTask() {
    if (isClosed || !taskId) return;

    try {
      const res = await apiFetch(`/company/tasks/${taskId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          description: notes,
          owner_role: ownerRole,
        }),
      });

      if (!res.ok) {
        console.error("TASK UPDATE FAILED", res.status);
        return;
      }

      router.push("/company/tasks");
    } catch (err) {
      console.error(err);
    }
  }

  /* =========================================================
     CLOSE TASK
  ========================================================= */

  async function closeTask() {
    if (isClosed || !taskId) return;

    try {
      const res = await apiFetch(`/company/tasks/${taskId}/close`, {
        method: "POST",
      });

      if (!res.ok) {
        console.error("TASK CLOSE FAILED", res.status);
        return;
      }

      router.push("/company/tasks");
    } catch (err) {
      console.error(err);
    }
  }

  /* =========================================================
     CREATE EVIDENCE
  ========================================================= */

  async function createEvidence() {
    if (isClosed || !taskId) return;

    const title = newEvidenceTitle.trim();
    if (!title) return;

    try {
      const res = await apiFetch(`/company/tasks/my/evidence`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          task_id: Number(taskId),
          title: title,
        }),
      });

      if (!res.ok) {
        console.error("EVIDENCE CREATE FAILED", res.status);
        return;
      }

      setNewEvidenceTitle("");
      await loadEvidence();
    } catch (err) {
      console.error(err);
    }
  }

  /* =========================================================
     UPLOAD FILE
  ========================================================= */

  async function uploadEvidenceFile(e: React.ChangeEvent<HTMLInputElement>) {
  if (isClosed || !taskId) return;

  const file = e.target.files?.[0];
  if (!file) return;

  const token =
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("token");

  const formData = new FormData();

  // Backend file: UploadFile = File(...) bekliyor
  formData.append("file", file, file.name);

  const res = await fetch(
    `https://compliance-intelligence-os-pro-2.onrender.com/company/tasks/${taskId}/evidence/upload`,
    {
      method: "POST",
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : undefined,
      body: formData,
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }

  e.target.value = "";
  await loadEvidence();
}

  /* =========================================================
     INIT
  ========================================================= */

  useEffect(() => {
    if (!taskId) {
      setLoading(false);
      return;
    }

    loadTask();
  }, [taskId]);

  if (loading) {
    return <div className="p-6 text-slate-400">Loading task...</div>;
  }

  if (!task) {
    return <div className="p-6 text-red-400">Task not found</div>;
  }

  return (
    <div className="p-6 space-y-6">

      <div className="flex justify-between items-center">
        <div>
          <div className="text-xs text-slate-400">Task #{task.id}</div>

          <div className="flex items-center gap-3">
            <div className="text-xl text-white font-semibold">
              {task.title || "Compliance remediation task"}
            </div>

            {String(task.status || "").toUpperCase() === "CLOSED" && (
              <span className="text-xs px-2 py-1 bg-green-900 text-green-300 rounded">
                CLOSED
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => router.push("/company/tasks")}
          className="text-cyan-400 text-sm"
        >
          Back
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-4 rounded">
        <div className="text-xs text-slate-400 mb-2">Owner Role</div>

        <select
          value={ownerRole}
          disabled={isClosed}
          onChange={(e) => setOwnerRole(e.target.value)}
          className="bg-slate-800 border border-slate-700 px-3 py-2 rounded text-sm"
        >
          <option value="">Select role</option>
          <option value="process_owner">Process Owner</option>
          <option value="control_owner">Control Owner</option>
          <option value="risk_owner">Risk Owner</option>
        </select>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-4 rounded">
        <div className="text-xs text-slate-400 mb-2">Status</div>

        <select
          value={status}
          disabled={isClosed}
          onChange={(e) => setStatus(e.target.value)}
          className="bg-slate-800 border border-slate-700 px-3 py-2 rounded text-sm"
        >
          <option value="OPEN">OPEN</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="UNDER_REVIEW">UNDER_REVIEW</option>
          <option value="BLOCKED">BLOCKED</option>
          <option value="DONE">DONE</option>
        </select>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-4 rounded">
        <div className="text-xs text-slate-400 mb-2">Remediation Notes</div>

        <textarea
          rows={6}
          disabled={isClosed}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 p-3 rounded text-sm"
        />
      </div>

      {/* =========================================================
         EVIDENCE PANEL
      ========================================================= */}

      <div className="bg-slate-900 border border-slate-800 p-4 rounded space-y-4">

        <div className="text-sm text-slate-300 font-semibold">
          Evidence
        </div>

        <div className="flex gap-2">

          <input
            value={newEvidenceTitle}
            disabled={isClosed}
            onChange={(e) => setNewEvidenceTitle(e.target.value)}
            placeholder="Evidence title"
            className="bg-slate-800 border border-slate-700 px-3 py-2 rounded text-sm w-64"
          />

          <button
            disabled={isClosed}
            onClick={createEvidence}
            className="bg-indigo-600 px-3 py-2 rounded text-xs"
          >
            Create
          </button>

          <label className="bg-slate-700 px-3 py-2 rounded text-xs cursor-pointer">
            Upload File
            <input
              type="file"
              onChange={uploadEvidenceFile}
              className="hidden"
            />
          </label>

        </div>

        {evidences.map((ev) => (
          <div
            key={ev.id}
            className="border border-slate-800 p-3 rounded text-sm"
          >
            <div className="text-white">{ev.title}</div>
            <div className="text-xs text-slate-400">
              {ev.status} {ev.approval_status || ""}
            </div>
          </div>
        ))}

      </div>

      <div className="flex gap-3">

        <button
          type="button"
          disabled={isClosed}
          onClick={updateTask}
          className="bg-cyan-600 px-4 py-2 rounded text-sm disabled:opacity-40"
        >
          Save Task
        </button>

        <button
          type="button"
          disabled={isClosed}
          onClick={closeTask}
          className="bg-green-600 px-4 py-2 rounded text-sm disabled:opacity-40"
        >
          Close Task
        </button>

      </div>

    </div>
  );
}
