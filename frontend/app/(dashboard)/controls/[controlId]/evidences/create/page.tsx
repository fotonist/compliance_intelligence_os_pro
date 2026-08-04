"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_BASE = "http://localhost:8000";

type EvidenceStatus =
  | "uploaded"
  | "waiting_approval"
  | "approved"
  | "rejected";

export default function CreateEvidencePage() {
  const router = useRouter();
  const params = useParams();
  const controlId = params.controlId as string;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [status, setStatus] = useState<EvidenceStatus>("uploaded");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const token =
        localStorage.getItem("access_token") ||
        localStorage.getItem("token");

      if (!token) {
        throw new Error("Authentication required.");
      }

      const res = await fetch(`${API_BASE}/company/evidences`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          source_url: sourceUrl || null,
          status,
          control_id: Number(controlId),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "Failed to create evidence.");
      }

      router.push(`/controls/${controlId}/evidences`);
    } catch (err: any) {
      setError(err.message || "Unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-8 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-white tracking-tight">
            Create Evidence
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            Attach documentation or references supporting this control.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Access Control Policy v2.1"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Description
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Brief explanation..."
              />
            </div>

            {/* Source URL */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Source URL
              </label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://..."
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Status
              </label>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as EvidenceStatus)
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="uploaded">Uploaded</option>
                <option value="waiting_approval">
                  Waiting Approval
                </option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-4 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() =>
                  router.push(`/controls/${controlId}/evidences`)
                }
                className="px-5 py-2.5 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 transition"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create Evidence"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}