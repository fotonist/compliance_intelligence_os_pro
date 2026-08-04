// frontend/app/components/ProcessRiskLinkModal.tsx
"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type Risk = {
  id: number;
  code?: string;
  title: string;
};

type Props = {
  processId: number;
  open: boolean;
  onClose: () => void;
  onLinked?: () => void; // parent refresh callback
};

export default function ProcessRiskLinkModal({
  processId,
  open,
  onClose,
  onLinked,
}: Props) {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    async function loadRisks() {
      try {
        setLoading(true);
        setError(null);

        const res = await apiFetch("/risks", { method: "GET" });

        if (!res.ok) {
          setRisks([]);
          return;
        }

        const json = await res.json();
        setRisks(Array.isArray(json) ? json : []);
      } catch (err) {
        console.error("Failed to load risks", err);
        setRisks([]);
      } finally {
        setLoading(false);
      }
    }

    loadRisks();
  }, [open]);

  async function linkRisk() {
    if (!selectedId) return;

    try {
      setLinking(true);
      setError(null);

      const res = await apiFetch(
        `/company/processes/${processId}/risks/${selectedId}`,
        { method: "POST" }
      );

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Link failed");
      }

      if (onLinked) onLinked();
      onClose();
    } catch (e: any) {
      setError(e?.message || "Link failed");
    } finally {
      setLinking(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold text-slate-100">
            Link Risk to Process
          </div>
          <button
            onClick={onClose}
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            Close
          </button>
        </div>

        <div>
          <div className="text-sm text-slate-400 mb-2">
            Select a risk to link
          </div>

          {loading ? (
            <div className="text-sm text-slate-400">Loading risks...</div>
          ) : risks.length === 0 ? (
            <div className="text-sm text-slate-500">
              No risks found for this tenant.
            </div>
          ) : (
            <select
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(Number(e.target.value))}
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">Select risk</option>
              {risks.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code ? `${r.code} — ${r.title}` : r.title}
                </option>
              ))}
            </select>
          )}
        </div>

        {error ? (
          <div className="text-sm text-red-400">{error}</div>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm border border-slate-700 text-slate-200"
          >
            Cancel
          </button>
          <button
            onClick={linkRisk}
            disabled={!selectedId || linking}
            className="px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
          >
            {linking ? "Linking..." : "Link"}
          </button>
        </div>
      </div>
    </div>
  );
}
