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

  risk_level_old?: string | null;
  risk_level_new?: string | null;

  treatment_old?: string | null;
  treatment_new?: string | null;

  action_old?: string | null;
  action_new?: string | null;

  change_reason?: string | null;
};

type ApiResponse =
  | HistoryItem[]
  | {
      items?: HistoryItem[];
      rich?: HistoryItem[];
    };

type Props = {
  riskId: number;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
      } else if (Array.isArray(data.rich)) {
        setRows(data.rich);
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
            className="rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm shadow-sm"
          >
            <div className="flex justify-between mb-1">
              <span className="text-slate-500 text-xs font-medium">
                {date ? new Date(date).toLocaleString() : "-"}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs mt-3">
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
                label="Risk Level"
                oldVal={r.risk_level_old}
                newVal={r.risk_level_new}
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

            {r.change_reason && (
              <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-slate-700">
                <span className="font-semibold text-slate-900">
                  Change Reason:
                </span>{" "}
                {r.change_reason}
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
