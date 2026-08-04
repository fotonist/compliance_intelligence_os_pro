"use client";

import { useEffect, useState } from "react";

type HistoryItem = {
  id?: number;
  date?: string;
  created_at?: string;
  changed_at?: string;

  likelihood_old?: number | null;
  likelihood_new?: number | null;

  impact_old?: number | null;
  impact_new?: number | null;

  score_old?: number | null;
  score_new?: number | null;

  treatment_old?: string | null;
  treatment_new?: string | null;

  action_old?: string | null;
  action_new?: string | null;

  reason?: string | null;
};

type ApiResponse =
  | HistoryItem[]
  | {
      items?: HistoryItem[];
    };

type Props = {
  riskId: number;
};

const API_BASE = "http://localhost:8000";

export default function RiskHistoryTab({ riskId }: Props) {
  const [rows, setRows] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!riskId) return;
    load();
  }, [riskId]);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const token =
        localStorage.getItem("token") ||
        localStorage.getItem("access_token");

      const res = await fetch(`${API_BASE}/risks/${riskId}/history`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data: ApiResponse = await res.json();

      if (Array.isArray(data)) {
        setRows(data);
      } else if (Array.isArray(data.items)) {
        setRows(data.items);
      } else {
        setRows([]);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load history");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

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
    <div className="space-y-2">
      {rows.map((r, i) => {
        const date =
          r.changed_at || r.created_at || r.date || undefined;

        return (
          <div
            key={r.id ?? i}
            className="border border-slate-700 rounded px-3 py-2 bg-slate-800 text-sm"
          >
            <div className="flex justify-between mb-1">
              <span className="text-slate-300">
                {date ? new Date(date).toLocaleString() : "-"}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              <Diff
                label="Likelihood"
                oldVal={r.likelihood_old}
                newVal={r.likelihood_new}
              />
              <Diff
                label="Impact"
                oldVal={r.impact_old}
                newVal={r.impact_new}
              />
              <Diff
                label="Score"
                oldVal={r.score_old}
                newVal={r.score_new}
              />
              <Diff
                label="Treatment"
                oldVal={r.treatment_old}
                newVal={r.treatment_new}
              />
              <Diff
                label="Action"
                oldVal={r.action_old}
                newVal={r.action_new}
              />
            </div>

            {r.reason && (
              <div className="mt-2 text-xs text-slate-400">
                Reason: {r.reason}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Diff({
  label,
  oldVal,
  newVal,
}: {
  label: string;
  oldVal: any;
  newVal: any;
}) {
  if (
    oldVal === undefined &&
    newVal === undefined
  ) {
    return null;
  }

  return (
    <div>
      <div className="text-slate-400">{label}</div>
      <div className="text-slate-100">
        <span className="text-slate-400">
          {oldVal ?? "-"}
        </span>{" "}
        →{" "}
        <span className="font-semibold">
          {newVal ?? "-"}
        </span>
      </div>
    </div>
  );
}
