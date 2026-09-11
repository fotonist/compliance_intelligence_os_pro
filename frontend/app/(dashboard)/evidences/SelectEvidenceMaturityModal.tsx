"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/api";

type EvidenceItem = {
  evidence_id: number;
  evidence_title: string;
  status: string;
  files_count: number;
};

type Props = {
  open: boolean;
  token: string;
  evaluationId: number;
  onClose: () => void;
  onLinked: () => void;
};

export default function SelectEvidenceMaturityModal({
  open,
  token,
  evaluationId,
  onClose,
  onLinked,
}: Props) {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkingId, setLinkingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch("/company/evidences/?page=1&page_size=100");
        if (!response.ok) {
          throw new Error((await response.text()) || "Failed to load evidence library");
        }
        const data = await response.json();
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch (err) {
        setItems([]);
        setError(err instanceof Error ? err.message : "Failed to load evidence library");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [open, token]);

  async function linkEvidence(evidenceId: number) {
    setLinkingId(evidenceId);
    setError(null);
    try {
      const response = await apiFetch(`/evidences/${evidenceId}/pam-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evaluation_id: evaluationId,
          relevance: "SUPPORTING",
        }),
      });
      if (!response.ok) {
        throw new Error((await response.text()) || "Failed to link evidence");
      }
      onLinked();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link evidence");
    } finally {
      setLinkingId(null);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-100">Link Existing Evidence</h3>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Evidence is managed centrally. This action only creates the PAM assessment relationship.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">X</button>
        </div>

        {error && <div className="mt-4 rounded-xl border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-300">{error}</div>}

        <div className="mt-4 max-h-[440px] space-y-2 overflow-auto">
          {loading && <div className="py-8 text-center text-sm text-slate-400">Loading evidence library...</div>}
          {!loading && items.length === 0 && <div className="py-8 text-center text-sm text-slate-500">No evidence available.</div>}
          {!loading && items.map((evidence) => (
            <div key={evidence.evidence_id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-200">{evidence.evidence_title}</div>
                <div className="mt-1 text-xs text-slate-500">{evidence.status} · {evidence.files_count} file(s)</div>
              </div>
              <button
                type="button"
                disabled={linkingId !== null}
                onClick={() => linkEvidence(evidence.evidence_id)}
                className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {linkingId === evidence.evidence_id ? "Linking..." : "Link"}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300">Close</button>
        </div>
      </div>
    </div>
  );
}
