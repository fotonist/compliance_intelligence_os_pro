"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type RemediationTask = {
  id: number;
  title: string;
  status: string;
  priority?: string;
  owner_role?: string;
  created_at?: string;
};

export default function RemediationCenterPage() {
  const [tasks, setTasks] = useState<RemediationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function loadTasks() {
    setLoading(true);

    try {
      const res = await apiFetch("/company/tasks/my");

      if (!res.ok) {
        setTasks([]);
        return;
      }

      const json = await res.json();

      const list =
        Array.isArray(json)
          ? json
          : Array.isArray(json?.tasks)
          ? json.tasks
          : [];

      setTasks(list);

    } catch (err) {
      console.error(err);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: number, status: string) {
    try {

      setBusyId(id);

      const res = await apiFetch(`/company/tasks/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          status
        }),
      });

      if (!res.ok) {
        console.error("STATUS UPDATE FAILED");
        return;
      }

      await loadTasks();

    } catch (err) {
      console.error(err);
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    loadTasks();
  }, []);

  if (loading) {
    return (
      <div className="p-6 text-slate-400">
        Loading remediation center...
      </div>
    );
  }

  const openCount =
    tasks.filter((t) => t.status === "OPEN").length;

  const closedCount =
    tasks.filter((t) => t.status === "CLOSED").length;

  return (
    <div className="p-6 space-y-6">

      {/* HEADER */}

      <div>

        <div className="text-xs text-slate-400">
          Governance → Remediation
        </div>

        <div className="text-xl text-white font-semibold">
          Remediation Center
        </div>

      </div>

      {/* KPI */}

      <div className="grid grid-cols-3 gap-4">

        <div className="bg-slate-900 border border-slate-800 p-4 rounded">
          <div className="text-xs text-slate-400">
            Open Tasks
          </div>
          <div className="text-2xl text-white font-semibold">
            {openCount}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded">
          <div className="text-xs text-slate-400">
            Closed Tasks
          </div>
          <div className="text-2xl text-white font-semibold">
            {closedCount}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded">
          <div className="text-xs text-slate-400">
            Total Tasks
          </div>
          <div className="text-2xl text-white font-semibold">
            {tasks.length}
          </div>
        </div>

      </div>

      {tasks.length === 0 && (
        <div className="text-sm text-slate-500">
          No remediation tasks found
        </div>
      )}

      {/* LIST */}

      <div className="space-y-2">

        {tasks.map((t) => {

          const created =
            t.created_at
              ? new Date(t.created_at).toLocaleDateString()
              : "-";

          let statusColor = "bg-slate-700";

          if (t.status === "OPEN")
            statusColor = "bg-blue-600";

          if (t.status === "IN_PROGRESS")
            statusColor = "bg-yellow-600";

          if (t.status === "CLOSED")
            statusColor = "bg-green-600";

          return (
            <div
              key={t.id}
              className="border border-slate-800 bg-slate-900 p-4 rounded flex justify-between items-center"
            >

              <div className="space-y-1">

                <div className="text-sm text-white">
                  {t.title}
                </div>

                <div className="text-xs text-slate-400">
                  Task ID: {t.id}
                </div>

                <div className="text-xs text-slate-500">
                  Created: {created}
                </div>

              </div>

              <div className="flex items-center gap-2">

                <div className={`text-xs px-3 py-1 rounded text-white ${statusColor}`}>
                  {t.status}
                </div>

                {/* ACTIONS */}

                {t.status === "OPEN" && (
                  <button
                    disabled={busyId === t.id}
                    onClick={() =>
                      updateStatus(
                        t.id,
                        "IN_PROGRESS"
                      )
                    }
                    className="text-xs bg-yellow-600 px-3 py-1 rounded disabled:opacity-40"
                  >
                    START
                  </button>
                )}

                {t.status === "IN_PROGRESS" && (
                  <button
                    disabled={busyId === t.id}
                    onClick={() =>
                      updateStatus(
                        t.id,
                        "CLOSED"
                      )
                    }
                    className="text-xs bg-green-600 px-3 py-1 rounded disabled:opacity-40"
                  >
                    COMPLETE
                  </button>
                )}

                {t.status === "CLOSED" && (
                  <button
                    disabled={busyId === t.id}
                    onClick={() =>
                      updateStatus(
                        t.id,
                        "OPEN"
                      )
                    }
                    className="text-xs bg-blue-600 px-3 py-1 rounded disabled:opacity-40"
                  >
                    REOPEN
                  </button>
                )}

                <div className="text-xs bg-slate-700 px-3 py-1 rounded">
                  {t.priority ?? "NORMAL"}
                </div>

              </div>

            </div>
          );
        })}

      </div>

    </div>
  );
}