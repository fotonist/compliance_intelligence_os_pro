"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = "http://localhost:8000";

export default function RequirementCreatePage() {
  const router = useRouter();

  const [clauseId, setClauseId] = useState("");
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);

    const token =
      localStorage.getItem("access_token") ||
      sessionStorage.getItem("access_token");

    await fetch(`${API_BASE}/requirements`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        clause_id: Number(clauseId),
        code,
        title,
      }),
    });

    setLoading(false);
    router.back();
  }

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-lg font-semibold mb-4">Create Requirement</h1>

      <input
        className="w-full mb-2 p-2 bg-slate-800 border border-slate-700 rounded"
        placeholder="Clause ID"
        value={clauseId}
        onChange={(e) => setClauseId(e.target.value)}
      />

      <input
        className="w-full mb-2 p-2 bg-slate-800 border border-slate-700 rounded"
        placeholder="Requirement Code (e.g. 4.1)"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />

      <input
        className="w-full mb-4 p-2 bg-slate-800 border border-slate-700 rounded"
        placeholder="Requirement Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <button
        disabled={loading}
        onClick={submit}
        className="px-4 py-2 bg-emerald-700 rounded text-white"
      >
        Create
      </button>
    </div>
  );
}
