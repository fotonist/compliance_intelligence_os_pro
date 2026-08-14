"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/api";

type ControlHealthRow = {
  control_id: number;
  control_code: string | null;
  control_title: string | null;
  health_index: number;
  status: "Healthy" | "Partial" | "Weak" | "No Evidence" | string;
  gap_count: number;
  worst_severity: number;
  risk_count: number;
  evidence_count: number;
};

type HealthResponse = {
  summary: {
    total_controls: number;
    healthy_controls: number;
    partial_controls: number;
    weak_controls: number;
    no_evidence_controls: number;
    average_health: number;
  };
  controls: ControlHealthRow[];
};

function statusClass(status: string) {
  switch (status) {
    case "Healthy":
      return "text-emerald-400";
    case "Partial":
      return "text-amber-400";
    case "Weak":
      return "text-red-400";
    default:
      return "text-slate-400";
  }
}

function healthClass(value: number) {
  if (value >= 80) return "text-emerald-400";
  if (value >= 55) return "text-amber-400";
  return "text-red-400";
}

export default function ControlHealthPage() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await apiFetch("/api/intelligence/control-health");
        const json: HealthResponse = await res.json();

        if (!mounted) return;
        setData(json);
      } catch (err) {
        console.error("Control Health load error:", err);
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load Control Health.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredControls = useMemo(() => {
    if (!data?.controls) return [];
    if (filter === "All") return data.controls;
    return data.controls.filter((control) => control.status === filter);
  }, [data, filter]);

  if (loading) {
    return <div className="p-6 text-slate-400">Loading control health...</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-xl font-semibold text-white">Control Health</div>
        <div className="mt-4 rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-300">
          {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="p-6 text-red-400">Failed to load Control Health.</div>;
  }

  const summary = data.summary;

  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="text-xl font-semibold text-white">Control Health</div>
        <div className="text-sm text-slate-400 mt-1">
          Control-level health, coverage and weakness analysis.
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <Card label="Total Controls" value={summary.total_controls} />
        <Card label="Healthy" value={summary.healthy_controls} />
        <Card label="Partial" value={summary.partial_controls} />
        <Card label="Weak" value={summary.weak_controls} />
        <Card label="No Evidence" value={summary.no_evidence_controls} />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-sm text-slate-400">Average Control Health</div>
            <div className={`text-4xl font-semibold mt-1 ${healthClass(summary.average_health)}`}>
              {summary.average_health.toFixed(1)}
            </div>
          </div>
          <div className="text-xs text-slate-500">
            Based on evidence, gaps, risk linkage and severity.
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["All", "Healthy", "Partial", "Weak", "No Evidence"].map((item) => (
          <button
            key={item}
            onClick={() => setFilter(item)}
            className={`px-3 py-2 rounded-lg text-sm border ${
              filter === item
                ? "bg-slate-700 border-slate-600 text-white"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 text-sm font-medium text-white">
          Control Status
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-950 text-slate-400">
              <tr>
                <th className="text-left px-5 py-3">Control</th>
                <th className="text-left px-5 py-3">Health</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-right px-5 py-3">Evidence</th>
                <th className="text-right px-5 py-3">Risks</th>
                <th className="text-right px-5 py-3">Gaps</th>
                <th className="text-right px-5 py-3">Worst Severity</th>
              </tr>
            </thead>
            <tbody>
              {filteredControls.map((control) => (
                <tr key={control.control_id} className="border-t border-slate-800 hover:bg-slate-800/40">
                  <td className="px-5 py-4">
                    <div className="font-medium text-white">{control.control_code || "—"}</div>
                    <div className="text-xs text-slate-500 mt-1">{control.control_title || "Untitled control"}</div>
                  </td>
                  <td className={`px-5 py-4 font-semibold ${healthClass(control.health_index)}`}>
                    {control.health_index.toFixed(1)}
                  </td>
                  <td className={`px-5 py-4 font-medium ${statusClass(control.status)}`}>
                    {control.status}
                  </td>
                  <td className="px-5 py-4 text-right text-slate-300">{control.evidence_count}</td>
                  <td className="px-5 py-4 text-right text-slate-300">{control.risk_count}</td>
                  <td className="px-5 py-4 text-right text-slate-300">{control.gap_count}</td>
                  <td className="px-5 py-4 text-right text-slate-300">{control.worst_severity.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredControls.length === 0 && (
          <div className="p-6 text-center text-slate-500">No controls match this filter.</div>
        )}
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-2xl font-semibold text-white mt-1">{value}</div>
    </div>
  );
}
