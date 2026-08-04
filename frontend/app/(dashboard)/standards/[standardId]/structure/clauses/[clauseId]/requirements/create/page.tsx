"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_BASE = "http://localhost:8000";

/* ================= AUTH ================= */

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token")
  );
}

/* ================= PAGE ================= */

export default function RequirementCreatePage() {
  const { standardId, clauseId } = useParams<{
    standardId: string;
    clauseId: string;
  }>();
  const router = useRouter();

  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!code.trim()) {
      setError("Requirement code is required.");
      return;
    }

    const token = getToken();
    if (!token) {
      setError("Authentication required.");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await fetch(`${API_BASE}/requirements`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        code: code.trim(),
        title: title.trim(),
        clause_id: Number(clauseId),
      }),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Requirement could not be created.");
      return;
    }

    router.push(`/standards/${standardId}/structure`);
  }

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-100">
          Create Requirement
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Add a new requirement under the selected clause.
        </p>
      </div>

      {/* Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-6">
        {/* Requirement Code */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Requirement Code
          </label>
          <input
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-slate-100
                       placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            placeholder="A.5.1"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <p className="text-xs text-slate-500 mt-1">
            Follow the official standard numbering scheme.
          </p>
        </div>

        {/* Requirement Title */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Requirement Title
          </label>
          <input
            className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-slate-100
                       placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            placeholder="Access control policy"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="border border-red-800 bg-red-950/40 text-red-300 text-sm rounded p-3">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            onClick={() =>
              router.push(`/standards/${standardId}/structure`)
            }
            className="px-4 py-2 text-sm rounded-md border border-slate-700 text-slate-300
                       hover:bg-slate-800"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-5 py-2 text-sm rounded-md bg-emerald-600 hover:bg-emerald-500
                       text-white disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create Requirement"}
          </button>
        </div>
      </div>
    </div>
  );
}
