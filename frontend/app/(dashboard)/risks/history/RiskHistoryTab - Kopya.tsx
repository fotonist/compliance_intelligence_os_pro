"use client";

import { useEffect, useState } from "react";

type HistoryItem = {
  date: string;
  score: number | null;
};

type ApiResponse = {
  version: string;
  items: HistoryItem[];
};

type Props = {
  riskId: number;
};

export default function RiskHistoryTab({ riskId }: Props) {
  const [rows, setRows] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!riskId) return;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `https://compliance-intelligence-os-pro-2.onrender.com/risks/${riskId}/history`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Failed to load history");
        }

        const data: ApiResponse = await res.json();
        setRows(Array.isArray(data.items) ? data.items : []);
      } catch (e: any) {
        setError(e.message || "Unknown error");
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [riskId]);

  if (loading) {
    return <div className="text-slate-400 text-sm">Loading history…</div>;
  }

  if (error) {
    return <div className="text-red-500 text-sm">{error}</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="text-slate-400 text-sm">
        No historical changes recorded.
      </div>
    );
  }

  return (
    <ul className="space-y-1 text-sm">
      {rows.map((r, i) => (
        <li
          key={`${r.date}-${i}`}
          className="border border-slate-700 rounded px-3 py-2 bg-slate-800"
        >
          <div className="flex justify-between">
            <span className="text-slate-300">
              {new Date(r.date).toLocaleString()}
            </span>
            <span className="font-semibold text-slate-100">
              Score: {r.score ?? "-"}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
