"use client";

import { useEffect, useState } from "react";

type Evidence = {
  id: number;
  title: string;
};

type Props = {
  sessionId: string;
  practiceId: number;
  onClose: () => void;
  onLinked?: () => Promise<void> | void;
};

const API_BASE = "http://localhost:8000";

function getToken() {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token")
  );
}

export default function LinkEvidenceMaturityModal({
  sessionId,
  practiceId,
  onClose,
  onLinked,
}: Props) {
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    fetch(`${API_BASE}/evidences/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setEvidences)
      .finally(() => setLoading(false));
  }, []);

  async function handleLink() {
    if (!selectedId) return;

    const token = getToken();
    if (!token) return;

    const res = await fetch(
      `${API_BASE}/maturity/workspace/${sessionId}/practices/${practiceId}/evidences`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          evidence_id: selectedId,
        }),
      }
    );

    if (res.ok || res.status === 409) {
      if (onLinked) await onLinked();
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={(e) =>
        e.target === e.currentTarget && onClose()
      }
    >
      <div
        className="bg-slate-900 p-6 rounded-lg w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-semibold mb-4">
          Link Existing Evidence
        </h2>

        {loading ? (
          <div className="text-sm text-gray-500">
            Loading…
          </div>
        ) : (
          <ul className="space-y-1 max-h-64 overflow-auto text-sm">
            {evidences.map((ev) => (
              <li
                key={ev.id}
                onClick={() => setSelectedId(ev.id)}
                className={`p-2 rounded cursor-pointer ${
                  selectedId === ev.id
                    ? "bg-indigo-600"
                    : "bg-slate-800 hover:bg-slate-700"
                }`}
              >
                {ev.title}
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-3 py-1 bg-slate-600 rounded"
          >
            Cancel
          </button>
          <button
            disabled={!selectedId}
            onClick={handleLink}
            className="px-3 py-1 bg-indigo-600 rounded disabled:opacity-50"
          >
            Link
          </button>
        </div>
      </div>
    </div>
  );
}
