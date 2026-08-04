"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token")
  );
}

export default function CreateTaskPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [processId, setProcessId] = useState<number | null>(null);
  const [controlId, setControlId] = useState<number | null>(null);

  const [priorityScore, setPriorityScore] = useState(50);
  const [ownerRole, setOwnerRole] = useState("process_owner");
  const [dueDate, setDueDate] = useState("");

  /* ===============================
     URL PARAM OKUMA
  =============================== */

  useEffect(() => {
    const pid = searchParams.get("process_id");
    const cid = searchParams.get("control_id");

    if (pid) {
      setProcessId(Number(pid));
    }

    if (cid) {
      setControlId(Number(cid));
    }
  }, [searchParams]);

  /* ===============================
     SUBMIT
  =============================== */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const token = getToken();

    if (!token) {
      alert("No auth token found");
      return;
    }

    if (!processId) {
      alert("Process ID missing");
      return;
    }

    try {
      const payload = {
        title,
        description,
        process_id: Number(processId),
        control_id: controlId ? Number(controlId) : null,
        priority_score: Number(priorityScore),
        owner_role: ownerRole,
        due_date: new Date(dueDate).toISOString(),
      };

      console.log("POST URL:", `${API_URL}/company/tasks`);
      console.log("PAYLOAD:", payload);

      const res = await fetch(`${API_URL}/company/tasks`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();

      console.log("RESPONSE STATUS:", res.status);
      console.log("RESPONSE BODY:", text);

      if (!res.ok) {
        alert(text);
        return;
      }

      router.push("/company/tasks");

    } catch (err) {
      console.error("NETWORK ERROR:", err);
      alert("Failed to connect to backend");
    }
  }

  return (
    <div className="p-6 max-w-xl text-white">
      <h1 className="text-xl font-semibold mb-6">
        Create Compliance Task
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">

        <input
          className="w-full bg-slate-800 border border-slate-700 p-2 rounded"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <textarea
          className="w-full bg-slate-800 border border-slate-700 p-2 rounded"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <input
          type="number"
          className="w-full bg-slate-800 border border-slate-700 p-2 rounded"
          placeholder="Process ID"
          value={processId ?? ""}
          onChange={(e) => setProcessId(Number(e.target.value))}
          required
        />

        <input
          type="number"
          className="w-full bg-slate-800 border border-slate-700 p-2 rounded"
          placeholder="Control ID"
          value={controlId ?? ""}
          onChange={(e) => setControlId(Number(e.target.value))}
        />

        <input
          type="number"
          className="w-full bg-slate-800 border border-slate-700 p-2 rounded"
          placeholder="Priority Score"
          value={priorityScore}
          onChange={(e) => setPriorityScore(Number(e.target.value))}
          required
        />

        <input
          type="text"
          className="w-full bg-slate-800 border border-slate-700 p-2 rounded"
          placeholder="Owner Role"
          value={ownerRole}
          onChange={(e) => setOwnerRole(e.target.value)}
          required
        />

        <input
          type="date"
          className="w-full bg-slate-800 border border-slate-700 p-2 rounded"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          required
        />

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 p-2 rounded"
        >
          Create Task
        </button>
      </form>
    </div>
  );
}