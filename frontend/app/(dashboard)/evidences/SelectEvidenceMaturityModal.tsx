"use client";

import { useEffect, useState } from "react";

const API_BASE = "https://compliance-intelligence-os-pro-2.onrender.com";

type EvidenceItem = {
  id: number;
  title: string;
  status: string;
  files_count: number;
};

type Props = {
  open: boolean;
  token: string;
  evaluationId: number;
  sessionId: number;
  onClose: () => void;
  onLinked: () => void;
};

export default function SelectEvidenceMaturityModal({
  open,
  token,
  evaluationId,
  sessionId,
  onClose,
  onLinked,
}: Props) {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    async function load() {
      setLoading(true);
      try {
        const r = await fetch(
          `${API_BASE}/maturity/evidences?session_id=${sessionId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await r.json();
        setItems(Array.isArray(data) ? data : []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [open, token, sessionId]);

  async function linkEvidence(evidenceId: number) {
    await fetch(
      `${API_BASE}/maturity/evidences/${evaluationId}/link`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ evidence_id: evidenceId }),
      }
    );

    onLinked();
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-lg w-[520px] p-4">
        <div className="flex justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-200">
            Link Existing Evidence
          </h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>

        {loading && (
          <div className="text-xs text-slate-400">Loading…</div>
        )}

        {!loading && items.length === 0 && (
          <div className="text-xs text-slate-500 italic">
            No available evidence
          </div>
        )}

        <div className="space-y-2 max-h-[400px] overflow-auto">
          {items.map((e) => (
            <div
              key={e.id}
              className="flex justify-between items-center border border-slate-700 rounded px-3 py-2"
            >
              <div>
                <div className="text-xs text-slate-200">{e.title}</div>
                <div className="text-[10px] text-slate-400">
                  {e.status} · {e.files_count} file
                </div>
              </div>

              <button
                onClick={() => linkEvidence(e.id)}
                className="text-xs bg-emerald-600 px-2 py-1 rounded"
              >
                Link
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
