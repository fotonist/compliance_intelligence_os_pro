"use client";

import { useEffect, useState } from "react";

type Props = {
  riskId: number;
  onClose: () => void;
};

export default function ViewRiskModal({ riskId, onClose }: Props) {
  const [tab, setTab] = useState<"overview" | "evidence" | "history">("overview");
  const [evidences, setEvidences] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (tab === "evidence") {
      fetch(`https://compliance-intelligence-os-pro-2.onrender.com/evidences?risk_id=${riskId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      })
        .then((r) => r.json())
        .then(setEvidences);
    }

    if (tab === "history") {
      fetch(`https://compliance-intelligence-os-pro-2.onrender.com/risks/${riskId}/history`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      })
        .then((r) => r.json())
        .then(setHistory);
    }
  }, [tab, riskId]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-900 w-[700px] rounded-lg border border-slate-700 p-5">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-semibold">Risk Detail</h2>
          <button onClick={onClose}>✕</button>
        </div>

        <div className="flex gap-4 border-b mb-4">
          {["overview", "evidence", "history"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t as any)}
              className={tab === t ? "border-b-2 border-blue-500" : ""}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        {tab === "overview" && <div>Overview content</div>}

        {tab === "evidence" && (
          <ul className="space-y-1 text-sm">
            {evidences.map((e) => (
              <li key={e.id} className="border px-2 py-1 rounded">
                Evidence #{e.id}
              </li>
            ))}
          </ul>
        )}

        {tab === "history" && (
          <ul className="space-y-1 text-sm">
            {history.map((h) => (
              <li key={h.id} className="border px-2 py-1 rounded">
                Score: {h.score_new ?? h.score_old}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
