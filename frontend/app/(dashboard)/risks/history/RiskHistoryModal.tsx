"use client";

import { useEffect, useState } from "react";

type Item = {
  old_score: number;
  new_score: number;
  treatment: string | null;
  created_at: string;
};

export default function RiskHistoryModal({
  riskId,
  onClose,
}: {
  riskId: number;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Item[]>([]);

  useEffect(() => {
    fetch(`http://localhost:8000/risks/${riskId}/history`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then(setRows);
  }, [riskId]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center">
      <div className="bg-slate-900 p-4 rounded w-[500px]">
        <div className="flex justify-between mb-2">
          <h2 className="font-semibold">Risk History</h2>
          <button onClick={onClose}>✕</button>
        </div>

        <ul className="space-y-1 text-sm">
          {rows.map((r, i) => (
            <li key={i}>
              {r.old_score} → {r.new_score}{" "}
              <span className="text-slate-400">
                ({new Date(r.created_at).toLocaleString()})
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
