"use client";

import { useEffect, useState } from "react";
import RiskHistoryModal from "./RiskHistoryModal";

type SummaryItem = {
  risk_id: number;
  risk_title: string;
  trends: ("up" | "down" | "same")[];
};

export default function RiskHistoryPage() {
  const [rows, setRows] = useState<SummaryItem[]>([]);
  const [activeRiskId, setActiveRiskId] = useState<number | null>(null);

  useEffect(() => {
    fetch("http://localhost:8000/risks/history/summary", {
      credentials: "include",
    })
      .then((r) => r.json())
      .then(setRows);
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Risk History</h1>

      <table className="w-full text-sm border border-slate-700">
        <thead className="bg-slate-800">
          <tr>
            <th className="p-2 text-left">Risk</th>
            <th className="p-2 text-left">Trend</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.risk_id}
              className="border-t border-slate-700"
            >
              <td className="p-2">{r.risk_title}</td>
              <td className="p-2 flex gap-1">
                {r.trends.map((t, i) => (
                  <span
                    key={i}
                    onClick={() => setActiveRiskId(r.risk_id)}
                    className="cursor-pointer"
                    title="View history"
                  >
                    {t === "up" && "▲"}
                    {t === "down" && "▼"}
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {activeRiskId && (
        <RiskHistoryModal
          riskId={activeRiskId}
          onClose={() => setActiveRiskId(null)}
        />
      )}
    </div>
  );
}
