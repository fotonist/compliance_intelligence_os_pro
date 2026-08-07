"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/app/lib/api";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token")
  );
}

type Control = {
  id: number;
  name: string;
};

type Role = {
  id: number;
  name: string;
};

const PRIORITIES = [
  { label: "Low", value: 25 },
  { label: "Medium", value: 50 },
  { label: "High", value: 75 },
  { label: "Critical", value: 100 },
];

function CreateCompanyTaskContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [processId, setProcessId] = useState(1);

  const [controlId, setControlId] = useState<number>(1);
  const [priorityScore, setPriorityScore] = useState<number>(50);
  const [ownerRole, setOwnerRole] = useState<string>("");

  const [dueDate, setDueDate] = useState("");

  const [controls, setControls] = useState<Control[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  // ---------------------------------------------------------
  // READ PROCESS ID FROM URL
  // ---------------------------------------------------------

  useEffect(() => {
    const pid = searchParams.get("process_id");

    if (pid) {
      setProcessId(Number(pid));
    }
  }, [searchParams]);

  // ---------------------------------------------------------
  // FETCH CONTROLS
  // ---------------------------------------------------------

  useEffect(() => {
    async function loadControls() {
      try {
        const res = await apiFetch("/controls");

        const data = await res.json();

        setControls(data.controls || data);

        if ((data.controls || data).length > 0) {
          setControlId((data.controls || data)[0].id);
        }
      } catch (err) {
        console.error("Failed to load controls", err);
      }
    }

    loadControls();
  }, []);

  // ---------------------------------------------------------
  // FETCH ROLES
  // ---------------------------------------------------------

  useEffect(() => {
    async function loadRoles() {
      try {
        const res = await apiFetch("/users/lookup/roles");

        const data = await res.json();

        setRoles(data);
      } catch (err) {
        console.error("Failed to load roles", err);
      }
    }

    loadRoles();
  }, []);

  // ---------------------------------------------------------
  // SUBMIT
  // ---------------------------------------------------------

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    const token = getToken();

    if (!token) {
      alert("No auth token found");
      return;
    }

    const payload = {
      title,
      description,
      process_id: Number(processId),
      control_id: Number(controlId),
      priority_score: Number(priorityScore),
      owner_role: ownerRole,
      due_date: new Date(dueDate).toISOString(),
    };

    const res = await fetch(
      `${API_URL}/company/tasks`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const text = await res.text();

    if (!res.ok) {
      alert(text);
      return;
    }

    router.push("/company/tasks");
  }

  return (
    <div className="p-6 max-w-xl text-white">

      <h1 className="text-xl font-semibold mb-6">
        Create Compliance Task
      </h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-5"
      >

        {/* TITLE */}

        <div className="space-y-1">
          <label className="text-sm text-slate-400">
            Title
          </label>

          <input
            className="w-full bg-slate-800 border border-slate-700 p-2 rounded"
            placeholder="Enter task title"
            value={title}
            onChange={(e) =>
              setTitle(e.target.value)
            }
            required
          />
        </div>

        {/* DESCRIPTION */}

        <div className="space-y-1">
          <label className="text-sm text-slate-400">
            Description
          </label>

          <textarea
            className="w-full bg-slate-800 border border-slate-700 p-2 rounded"
            placeholder="Describe the task"
            value={description}
            onChange={(e) =>
              setDescription(
                e.target.value
              )
            }
          />
        </div>

        {/* PROCESS */}

        <div className="space-y-1">
          <label className="text-sm text-slate-400">
            Process ID
          </label>

          <input
            type="number"
            className="w-full bg-slate-800 border border-slate-700 p-2 rounded opacity-60"
            value={processId}
            readOnly
          />
        </div>

        {/* CONTROL */}

        <div className="space-y-1">
          <label className="text-sm text-slate-400">
            Control
          </label>

          <select
            className="w-full bg-slate-800 border border-slate-700 p-2 rounded"
            value={controlId}
            onChange={(e) =>
              setControlId(Number(e.target.value))
            }
          >
            {controls.map((c: any) => (
              <option
                key={c.id}
                value={c.id}
              >
                {c.code} - {c.title}
              </option>
            ))}
          </select>
        </div>

        {/* PRIORITY */}

        <div className="space-y-1">
          <label className="text-sm text-slate-400">
            Priority
          </label>

          <select
            className="w-full bg-slate-800 border border-slate-700 p-2 rounded"
            value={priorityScore}
            onChange={(e) =>
              setPriorityScore(
                Number(e.target.value)
              )
            }
          >
            {PRIORITIES.map((p) => (
              <option
                key={p.value}
                value={p.value}
              >
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* OWNER ROLE */}

        <div className="space-y-1">
          <label className="text-sm text-slate-400">
            Owner Role
          </label>

          <select
            className="w-full bg-slate-800 border border-slate-700 p-2 rounded"
            value={ownerRole}
            onChange={(e) =>
              setOwnerRole(e.target.value)
            }
          >
            <option value="">
              Select role
            </option>

            {roles.map((r: any) => (
              <option
                key={r.id}
                value={r.name}
              >
                {r.name}
              </option>
            ))}
          </select>
        </div>

        {/* DUE DATE */}

        <div className="space-y-1">
          <label className="text-sm text-slate-400">
            Due Date
          </label>

          <input
            type="date"
            className="w-full bg-slate-800 border border-slate-700 p-2 rounded"
            value={dueDate}
            onChange={(e) =>
              setDueDate(
                e.target.value
              )
            }
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 p-2 rounded font-medium"
        >
          Create Task
        </button>

      </form>
    </div>
  );
}
export default function CreateCompanyTaskPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-slate-400">
          Loading...
        </div>
      }
    >
      <CreateCompanyTaskContent />
    </Suspense>
  );
}
