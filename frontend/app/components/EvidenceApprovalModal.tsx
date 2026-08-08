"use client";

import { useState } from "react";

type Props = {
  evidenceId: number;
  onClose: () => void;
  onUpdated?: () => Promise<void> | void;
};

const API_BASE = "https://compliance-intelligence-os-pro-2.onrender.com";

function getToken() {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token")
  );
}

export default function EvidenceApprovalModal({
  evidenceId,
  onClose,
  onUpdated,
}: Props) {
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function update(status: "approved" | "rejected") {
    const token = getToken();
    if (!token) return;

    setSubmitting(true);
    try {
      const res = await fetch(
        `${API_BASE}/evidences/${evidenceId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status, comment }),
        }
      );
      if (!res.ok) throw new Error("status update failed");
      if (onUpdated) await onUpdated();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-slate-900 p-6 rounded-lg w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold mb-3">Evidence Review</h3>

        <textarea
          className="w-full bg-slate-800 border border-slate-600 rounded p-2 mb-4"
          placeholder="Reviewer comment (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1 bg-slate-600 rounded"
          >
            Cancel
          </button>
          <button
            disabled={submitting}
            onClick={() => update("rejected")}
            className="px-3 py-1 bg-red-600 rounded disabled:opacity-50"
          >
            Reject
          </button>
          <button
            disabled={submitting}
            onClick={() => update("approved")}
            className="px-3 py-1 bg-green-600 rounded disabled:opacity-50"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
