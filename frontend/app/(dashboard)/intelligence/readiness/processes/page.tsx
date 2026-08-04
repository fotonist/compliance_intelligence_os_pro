"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type ReadinessRow = {
  process_id: number;
  process_code?: string;
  process_name: string;
  readiness_score: number;
  coverage_percentage: number;
  critical_risk_count?: number;
  critical_risks?: number;
  escalation_probability: number;
  trend_delta?: number;
  trend_30d?: number;
};

const STANDARD_OPTIONS = [
  { value: "", label: "All Standards" },
  { value: "5", label: "ISO 27001" },
  { value: "7", label: "ISO 9001" },
  { value: "13", label: "ISO 20000-1" },
  { value: "22", label: "ISO 14001" },
];

export default function ExecutiveReadinessProcessesPage() {
  const [rows, setRows] = useState<ReadinessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [standardId, setStandardId] = useState<string>("");

  useEffect(() => {
    load();
  }, [standardId]);

  async function load() {
    setLoading(true);
    try {
      const url = standardId
        ? `/analytics/process_readiness?standard_id=${standardId}`
        : "/analytics/process_readiness";

      const res = await apiFetch(url, { method: "GET" });

      if (res.ok) {
        const data = await res.json();
        setRows(Array.isArray(data) ? data : []);
      } else {
        setRows([]);
      }
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold">
            Executive Readiness – Processes
          </div>
          <div className="text-sm text-slate-400">
            Process-level compliance & escalation intelligence
          </div>
        </div>

        <div className="min-w-[220px]">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">
            Standard Scope
          </label>
          <select
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-slate-500"
            value={standardId}
            onChange={(e) => setStandardId(e.target.value)}
          >
            {STANDARD_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-950 border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 text-left text-slate-400">Process</th>
              <th className="px-4 py-3 text-left text-slate-400">Readiness %</th>
              <th className="px-4 py-3 text-left text-slate-400">Coverage %</th>
              <th className="px-4 py-3 text-left text-slate-400">Critical Risks</th>
              <th className="px-4 py-3 text-left text-slate-400">Escalation</th>
              <th className="px-4 py-3 text-left text-slate-400">Trend (30d)</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-slate-400">
                  Loading readiness intelligence...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-slate-400">
                  No readiness data available.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const criticalRiskCount =
                  r.critical_risk_count ?? r.critical_risks ?? 0;
                const trendValue = r.trend_delta ?? r.trend_30d ?? 0;

                return (
                  <tr
                    key={r.process_id}
                    className="border-t border-slate-800 hover:bg-slate-800/40 transition"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-100">
                        {r.process_code || `PRC-${String(r.process_id).padStart(3, "0")}`}
                      </div>
                      <div className="text-xs text-slate-400">
                        {r.process_name}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <ScoreBadge value={r.readiness_score} />
                    </td>

                    <td className="px-4 py-3">
                      {Math.round(r.coverage_percentage)}%
                    </td>

                    <td className="px-4 py-3">
                      <RiskBadge value={criticalRiskCount} />
                    </td>

                    <td className="px-4 py-3">
                      <EscalationBadge value={r.escalation_probability} />
                    </td>

                    <td className="px-4 py-3">
                      <TrendBadge value={trendValue} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= BADGES ================= */

function ScoreBadge({ value }: { value: number }) {
  const safeValue = Math.round(value);

  const color =
    safeValue >= 80
      ? "text-emerald-400"
      : safeValue >= 60
      ? "text-yellow-400"
      : "text-red-400";

  return <span className={`font-semibold ${color}`}>{safeValue}%</span>;
}

function RiskBadge({ value }: { value: number }) {
  if (value === 0) {
    return <span className="text-emerald-400">0</span>;
  }

  if (value <= 2) {
    return <span className="text-yellow-400">{value}</span>;
  }

  return <span className="text-red-400">{value}</span>;
}

function EscalationBadge({ value }: { value: number }) {
  const pct = value <= 1 ? Math.round(value * 100) : Math.round(value);

  const color =
    pct >= 60
      ? "text-red-400"
      : pct >= 30
      ? "text-yellow-400"
      : "text-emerald-400";

  return <span className={`font-semibold ${color}`}>{pct}%</span>;
}

function TrendBadge({ value }: { value: number }) {
  const safeValue = Math.round(value);

  if (safeValue === 0) {
    return <span className="text-slate-400">0%</span>;
  }

  if (safeValue > 0) {
    return <span className="text-emerald-400">+{safeValue}%</span>;
  }

  return <span className="text-red-400">{safeValue}%</span>;
}