"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, BrainCircuit, TrendingUp, ShieldAlert } from "lucide-react";
import { apiFetch } from "@/app/lib/api";

type Risk = {
  risk_id: number;
  title?: string | null;
  current_score?: number | null;
  risk_level?: string | null;
  status?: string | null;
  escalation_probability_30d?: number | null;
  expected_score_delta?: number | null;
  control_code?: string | null;
  process_names?: string[];
};

type Overview = {
  summary?: {
    total_risks?: number;
    open_risks?: number;
    forecasted_risks?: number;
    high_probability_risks?: number;
    avg_escalation_probability?: number;
    avg_expected_score_delta?: number;
  };
  top_risks?: Risk[];
  executive_alerts?: Risk[];
};

function riskTone(level?: string | null) {
  const value = String(level || "").toUpperCase();
  if (value === "CRITICAL") return "text-red-300 bg-red-500/10 border-red-500/20";
  if (value === "HIGH") return "text-orange-300 bg-orange-500/10 border-orange-500/20";
  if (value === "MEDIUM") return "text-amber-300 bg-amber-500/10 border-amber-500/20";
  return "text-emerald-300 bg-emerald-500/10 border-emerald-500/20";
}

export default function RiskIntelligencePage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/company/intelligence/overview");
        if (!res.ok) throw new Error(await res.text());
        setData(await res.json());
      } catch (e: any) {
        setError(e?.message || "Unable to load risk intelligence.");
      }
    })();
  }, []);

  if (!data) {
    return (
      <div className="min-h-full bg-[#020817] p-8 text-slate-300">
        {error ? error : "Loading Risk Intelligence..."}
      </div>
    );
  }

  const summary = data.summary || {};
  const escalation = Math.round(Number(summary.avg_escalation_probability || 0) * 100);
  const delta = Number(summary.avg_expected_score_delta || 0);

  return (
    <div className="min-h-full bg-[#020817] text-slate-100">
      <div className="mx-auto max-w-[1500px] p-6 lg:p-8">
        <header className="mb-7 flex items-center gap-4 border-b border-slate-800 pb-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10">
            <BrainCircuit className="h-6 w-6 text-cyan-300" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Risk Intelligence</h1>
            <p className="mt-1 text-sm text-slate-400">
              Predictive risk exposure, escalation pressure and emerging risk signals
            </p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          <Metric label="Risk Universe" value={summary.total_risks ?? 0} />
          <Metric label="Open Risks" value={summary.open_risks ?? 0} />
          <Metric label="Forecasted Risks" value={summary.forecasted_risks ?? 0} />
          <Metric label="High Probability" value={summary.high_probability_risks ?? 0} danger />
          <Metric label="Avg Escalation" value={`${escalation}%`} />
          <Metric label="Avg Score Delta" value={`${delta >= 0 ? "+" : ""}${delta.toFixed(2)}`} />
        </section>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
          <div className="mb-4 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-orange-300" />
            <h2 className="font-semibold">Risk Escalation Watchlist</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-800">
                  <th className="px-3 py-3">Risk</th>
                  <th className="px-3 py-3">Score</th>
                  <th className="px-3 py-3">Level</th>
                  <th className="px-3 py-3">Escalation</th>
                  <th className="px-3 py-3">Expected Δ</th>
                  <th className="px-3 py-3">Control</th>
                  <th className="px-3 py-3">Process</th>
                </tr>
              </thead>
              <tbody>
                {(data.top_risks || []).map((risk) => (
                  <tr key={risk.risk_id} className="border-b border-slate-900 hover:bg-slate-900/60">
                    <td className="px-3 py-3 font-medium text-slate-100">{risk.title || `Risk #${risk.risk_id}`}</td>
                    <td className="px-3 py-3">{risk.current_score ?? "—"}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full border px-2 py-1 text-xs ${riskTone(risk.risk_level)}`}>{risk.risk_level || "—"}</span>
                    </td>
                    <td className="px-3 py-3 text-cyan-300">{Math.round(Number(risk.escalation_probability_30d || 0) * 100)}%</td>
                    <td className="px-3 py-3">{Number(risk.expected_score_delta || 0).toFixed(2)}</td>
                    <td className="px-3 py-3 text-slate-300">{risk.control_code || "—"}</td>
                    <td className="px-3 py-3 text-slate-400">{risk.process_names?.join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.top_risks?.length && <div className="py-10 text-center text-slate-500">No risk signals available.</div>}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <Panel title="Executive Risk Alerts" icon={<AlertTriangle className="h-5 w-5 text-red-300" />}>
            {(data.executive_alerts || []).length ? (
              <div className="space-y-3">
                {(data.executive_alerts || []).slice(0, 5).map((risk) => (
                  <div key={risk.risk_id} className="rounded-xl border border-red-500/10 bg-red-500/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{risk.title || `Risk #${risk.risk_id}`}</span>
                      <span className="text-xs text-red-300">{Math.round(Number(risk.escalation_probability_30d || 0) * 100)}% escalation</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-400">Score {risk.current_score ?? "—"} · {risk.risk_level || "Unclassified"}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No executive risk alerts.</p>
            )}
          </Panel>

          <Panel title="What Risk Intelligence Answers" icon={<TrendingUp className="h-5 w-5 text-cyan-300" />}>
            <ul className="space-y-3 text-sm text-slate-300">
              <li>• Which risks are most likely to escalate?</li>
              <li>• Where is risk pressure increasing?</li>
              <li>• Which controls are connected to emerging risk?</li>
              <li>• Which risks require attention before they become critical?</li>
            </ul>
          </Panel>
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value, danger }: { label: string; value: string | number; danger?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${danger ? "border-red-500/20 bg-red-500/5" : "border-slate-800 bg-slate-950/70"}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}
