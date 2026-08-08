"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://compliance-intelligence-os-pro-2.onrender.com";

/* ================= AUTH ================= */

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token")
  );
}

/* ================= PAGE ================= */

export default function EvidenceCreatePage() {
  const {
    standardId,
    clauseId,
    requirementId,
    controlId,
  } = useParams<{
    standardId: string;
    clauseId: string;
    requirementId: string;
    controlId: string;
  }>();

  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!title.trim()) {
      setError("Evidence title is required");
      return;
    }

    const token = getToken();
    if (!token) {
      setError("Not authenticated");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await fetch(`${API_BASE}/evidences`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim(),
        control_id: Number(controlId),
      }),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Evidence create failed");
      return;
    }

    router.push(
      `/standards/${standardId}/structure/clauses/${clauseId}/requirements/${requirementId}/controls/${controlId}/evidences`
    );
  }

  return (
    <div className="p-6 max-w-2xl space-y-4">
      <h1 className="text-lg font-semibold text-white">
        Create Evidence
      </h1>

      <div className="border border-slate-800 rounded-xl bg-slate-900 p-5 space-y-4">
        <div>
          <label className="text-sm text-slate-200">Title</label>
          <input
            className="w-full mt-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm text-slate-200">Description</label>
          <textarea
            className="w-full mt-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {error && (
          <div className="border border-red-800 bg-red-950/40 text-red-200 p-3 rounded">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 border border-slate-700 rounded text-slate-200"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 rounded bg-emerald-700 text-white disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create Evidence"}
          </button>
        </div>
      </div>
    </div>
  );
}
