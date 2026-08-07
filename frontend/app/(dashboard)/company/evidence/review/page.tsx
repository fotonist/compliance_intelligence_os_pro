"use client";

import EvidenceDetailDrawer from "./components/EvidenceDetailDrawer";
import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/api";

type PendingEvidence = {
  id?: number;
  evidence_id?: number;
  file_id?: number;
  title?: string;
  status?: string;
  control_id?: number;
  created_at?: string;
  approval_status?: string;

  // güvenli type — sadece render için
  control?: {
    code?: string;
    title?: string;
  };
};

function getEvidenceId(ev: any): number | null {
  return ev?.id ?? ev?.evidence_id ?? ev?.file_id ?? null;
}

export default function EvidenceReviewPage() {
  const [items, setItems] = useState<PendingEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<number | null>(null);

  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  async function loadPending() {
    setLoading(true);

    try {
      const res = await apiFetch("/company/tasks/my/evidence");

      if (!res.ok) {
        setItems([]);
        return;
      }

      const json = await res.json();

      const list =
        Array.isArray(json)
          ? json
          : Array.isArray(json?.evidences)
          ? json.evidences
          : [];

      const pending = list.filter(
        (e: any) => e.approval_status === "PENDING_REVIEW"
      );

      setItems(pending);
    } catch (err) {
      console.error(err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function approve(ev: PendingEvidence) {
    const id = getEvidenceId(ev);

    if (!id) {
      console.error("Approve failed: id undefined", ev);
      return;
    }

    try {
      setBusyId(id);
      const res = await apiFetch(`/evidences/${id}/approve`, {
        method: "POST",
      });

      if (!res.ok) {
        console.error("APPROVE FAILED", res.status);
        return;
      }

      await loadPending();
    } catch (err) {
      console.error(err);
    } finally {
      setBusyId(null);
    }
  }

  async function rejectEvidence() {
    if (!rejectId) return;

    try {
      setBusyId(rejectId);

      const res = await apiFetch(`/evidences/${rejectId}/reject`, {
        method: "POST",
        body: JSON.stringify({
          reason: rejectReason,
        }),
      });

      if (!res.ok) {
        console.error("REJECT FAILED", res.status);
        return;
      }

      setRejectId(null);
      setRejectReason("");

      await loadPending();
    } catch (err) {
      console.error(err);
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    loadPending();
  }, []);

  if (loading) {
    return (
      <div className="p-6 text-slate-400">
        Loading evidence review...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="text-xs text-slate-400">
          Evidence Review
        </div>

        <div className="text-xl text-white font-semibold">
          Pending Evidence Files
        </div>
      </div>

      {items.length === 0 && (
        <div className="text-sm text-slate-500">
          No pending evidence
        </div>
      )}

      <div className="space-y-2">
        {items.map((ev, index) => {
          // DEBUG burada — render içinde değil
          console.log("EV:", ev);

          const created =
            ev.created_at
              ? new Date(ev.created_at).toLocaleDateString()
              : "-";

          const id = getEvidenceId(ev);

          return (
            <div
              key={id ?? index}
              onClick={() => id && setSelectedEvidence(id)}
              className="border border-slate-800 bg-slate-900 p-3 rounded flex justify-between items-center cursor-pointer hover:bg-slate-800"
            >
              <div className="space-y-1">
                <div className="text-sm text-white">
                  {ev.title ?? "Untitled Evidence"}
                </div>

                <div className="text-xs text-slate-400">
                  Evidence ID: {id ?? "-"}
                </div>

                <div className="text-xs text-slate-500">
                  Control:{" "}
                  {ev.control
                    ? `${ev.control.code} - ${ev.control.title}`
                    : "-"}
                </div>

                <div className="text-xs text-slate-500">
                  Uploaded: {created}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  disabled={busyId === id}
                  onClick={(e) => {
                    e.stopPropagation();
                    approve(ev);
                  }}
                  className="text-xs bg-green-600 px-3 py-1 rounded disabled:opacity-40"
                >
                  Approve
                </button>

                <button
                  disabled={busyId === id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setRejectId(id);
                  }}
                  className="text-xs bg-red-600 px-3 py-1 rounded disabled:opacity-40"
                >
                  Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <EvidenceDetailDrawer
        evidenceId={selectedEvidence}
        open={!!selectedEvidence}
        onClose={() => setSelectedEvidence(null)}
      />

      {rejectId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded w-[420px] space-y-4">
            <div className="text-white font-medium">
              Reject Reason
            </div>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full bg-slate-800 text-white p-2 rounded text-sm"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setRejectId(null);
                  setRejectReason("");
                }}
                className="px-3 py-1 text-xs bg-slate-700 rounded"
              >
                Cancel
              </button>

              <button
                onClick={rejectEvidence}
                className="px-3 py-1 text-xs bg-red-600 rounded"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}