"use client";

import { useEffect, useState } from "react";
import RiskHistoryModal from "./RiskHistoryModal";


type Trend = "up" | "down" | "same";

type SummaryItem = {
  risk_id: number;
  risk_title: string;
  trends?: Trend[]; // 🔴 opsiyonel
};

const API_BASE = "http://localhost:8000";

export default function RiskHistoryPage() {
  const [rows, setRows] = useState<SummaryItem[]>([]);
  const [activeRiskId, setActiveRiskId] = useState<number | null>(null);

  useEffect(() => {
    loadSummary();
  }, []);

  async function loadSummary() {
    try {
      const res = await fetch(`${API_BASE}/risks/history`, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();

      // 🛡️ API response shape guard
      if (Array.isArray(data)) {
        setRows(data);
      } else if (Array.isArray(data.items)) {
        setRows(data.items);
      } else {
        setRows([]);
      }
    } catch (err) {
      console.error("Failed to load risk history summary", err);
      setRows([]);
    }
  }

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
          {rows.length === 0 && (
            <tr>
              <td colSpan={2} className="p-4 text-center text-slate-500">
                No history found
              </td>
            </tr>
          )}

          {rows.map((r) => (
            <tr
              key={r.risk_id}
              className="border-t border-slate-700 hover:bg-slate-800"
            >
              <td className="p-2">{r.risk_title}</td>

              <td className="p-2">
                <div className="flex gap-2">
                  {(r.trends ?? []).map((t, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveRiskId(r.risk_id)}
                      className="text-lg hover:scale-110 transition"
                      title="View detailed history"
                    >
                      {t === "up" && <span className="text-red-500">▲</span>}
                      {t === "down" && <span className="text-green-500">▼</span>}
                      {t === "same" && <span className="text-slate-400">■</span>}
                    </button>
                  ))}

                  {(r.trends ?? []).length === 0 && (
                    <span className="text-slate-500 text-xs">
                      No trend data
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {activeRiskId !== null && (
        <RiskHistoryModal
          riskId={activeRiskId}
          onClose={() => setActiveRiskId(null)}
        />
      )}
    </div>
  );
}
