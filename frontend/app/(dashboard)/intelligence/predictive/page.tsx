"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BrainCircuit,
  CheckCircle2,
  CircleAlert,
  Database,
  Gauge,
  Info,
  RefreshCw,
  ShieldAlert,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { apiFetch } from "@/app/lib/api";

type Risk = {
  risk_id: number;
  title?: string | null;
  current_score?: number | null;
  risk_level?: string | null;
  status?: string | null;
  escalation_probability_30d?: number | null;
  expected_score_delta?: number | null;
  model_version?: string | null;
  forecast_mode?: string | null;
  forecast_status?: string | null;
  forecast_created_at?: string | null;
  inherent_exposure?: number | null;
  residual_exposure?: number | null;
  unified_score?: number | null;
  evidence_quality?: number | null;
  linked_evidence_count?: number | null;
  approved_evidence_count?: number | null;
  control_code?: string | null;
  control_title?: string | null;
  process_names?: string[];
};

type Summary = {
  total_risks?: number;
  open_risks?: number;
  forecasted_risks?: number;
  high_probability_risks?: number;
  executive_alerts?: number;
  avg_escalation_probability?: number;
  avg_expected_score_delta?: number;
  forecast_coverage?: number;
  forecast_coverage_percent?: number;
  baseline_forecast_risks?: number;
  ml_forecast_risks?: number;
  insufficient_history_risks?: number;
  latest_forecast_at?: string | null;
  total_unified_exposure?: number;
  total_residual_exposure?: number;
};

type Overview = {
  summary?: Summary;
  top_risks?: Risk[];
  executive_alerts?: Risk[];
};

type Explain = {
  risk_id?: number;
  risk_title?: string;
  forecast_mode?: string;
  forecast_status?: string;
  model_version?: string | null;
  escalation_probability_30d?: number;
  expected_score_delta?: number;
  explanation?: string | null;
  feature_importance?: Record<string, number> | null;
  features?: Record<string, number | string | null> | null;
  training_status?: string | null;
};

function pct(value?: number | null) {
  const n = Number(value ?? 0);
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}

function num(value?: number | null, decimals = 2) {
  return Number(value ?? 0).toFixed(decimals);
}

function delta(value?: number | null) {
  const n = Number(value ?? 0);
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;
}

function date(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function severity(level?: string | null) {
  const x = String(level || "").toLowerCase();
  if (x === "critical") return "Critical";
  if (x === "high") return "High";
  if (x === "medium") return "Medium";
  if (x === "low") return "Low";
  return "Unclassified";
}

function severityClass(level?: string | null) {
  const x = String(level || "").toLowerCase();
  if (x === "critical") return "border-red-200 bg-red-50 text-red-700";
  if (x === "high") return "border-orange-200 bg-orange-50 text-orange-700";
  if (x === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  if (x === "low") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-50 text-slate-500";
}

export default function PredictiveInsightsPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
  const [explain, setExplain] = useState<Explain | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);

  async function load() {
    try {
      setError(null);
      const res = await apiFetch("/company/intelligence/overview", { method: "GET" });
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load predictive intelligence.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadExplain(risk: Risk) {
    setSelectedRisk(risk);
    setExplain(null);
    setExplainLoading(true);
    try {
      const res = await apiFetch(`/company/risk-forecast/explain/${risk.risk_id}`, { method: "GET" });
      if (!res.ok) throw new Error(await res.text());
      setExplain(await res.json());
    } catch (err) {
      setExplain({ explanation: err instanceof Error ? err.message : "Explanation unavailable." });
    } finally {
      setExplainLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const summary = data?.summary ?? {};
  const risks = data?.top_risks ?? [];
  const alerts = data?.executive_alerts ?? [];

  const sortedRisks = useMemo(() => [...risks].sort((a, b) =>
    Number(b.escalation_probability_30d ?? 0) - Number(a.escalation_probability_30d ?? 0)
  ), [risks]);

  const bands = useMemo(() => {
    const result = { critical: 0, high: 0, medium: 0, low: 0 };
    risks.forEach((r) => {
      const p = pct(r.escalation_probability_30d);
      if (p >= 75) result.critical++;
      else if (p >= 50) result.high++;
      else if (p >= 25) result.medium++;
      else result.low++;
    });
    return result;
  }, [risks]);

  if (loading) return <Loading />;

  if (error) return (
    <div className="min-h-full bg-[#F6F8FB] p-6 lg:p-8">
      <div className="mx-auto max-w-[1700px] rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 text-red-700"><CircleAlert size={20}/><strong>Predictive Insights unavailable</strong></div>
        <p className="mt-2 text-sm text-slate-500">{error}</p>
        <button onClick={() => { setLoading(true); void load(); }} className="mt-4 rounded-lg bg-[#102A43] px-4 py-2 text-sm font-medium text-white">Retry</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-full bg-[#F6F8FB] text-slate-900">
      <div className="mx-auto max-w-[1700px] p-6 lg:p-8">
        <header className="mb-7 border-b border-slate-200 pb-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50">
                <BrainCircuit className="h-6 w-6 text-cyan-700" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-semibold tracking-tight text-[#102A43]">Predictive Insights</h1>
                  <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-700">Predictive Intelligence</span>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Coverage {num(summary.forecast_coverage_percent, 0)}%</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">Forward-looking risk escalation, expected movement and model explainability.</p>
                <p className="mt-2 text-[10px] uppercase tracking-wider text-slate-400">Latest intelligence run {date(summary.latest_forecast_at)}</p>
              </div>
            </div>
            <button disabled={refreshing} onClick={() => { setRefreshing(true); void load(); }} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"}/> Refresh Intelligence
            </button>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-4 xl:grid-cols-6">
          <Metric label="Risk Universe" value={summary.total_risks ?? 0} caption="Total identified risks" icon={<Target size={17}/>}/>
          <Metric label="Forecasted Risks" value={summary.forecasted_risks ?? 0} caption="Risks with forecast" icon={<BrainCircuit size={17}/>}/>
          <Metric label="30D High Probability" value={summary.high_probability_risks ?? 0} caption="Elevated escalation probability" icon={<ShieldAlert size={17}/>} danger={(summary.high_probability_risks ?? 0) > 0}/>
          <Metric label="Executive Alerts" value={summary.executive_alerts ?? 0} caption="Forecast-driven attention" icon={<CircleAlert size={17}/>} danger={(summary.executive_alerts ?? 0) > 0}/>
          <Metric label="Avg 30D Escalation" value={`${pct(summary.avg_escalation_probability)}%`} caption="Average probability" icon={<TrendingUp size={17}/>} danger={pct(summary.avg_escalation_probability) >= 50}/>
          <Metric label="Avg Expected Δ" value={delta(summary.avg_expected_score_delta)} caption="Expected score movement" icon={<Gauge size={17}/>} danger={Number(summary.avg_expected_score_delta ?? 0) > 0}/>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_1fr]">
          <Panel title="30-Day Escalation Outlook" subtitle="Verified forecast probabilities from the intelligence layer" icon={<TrendingUp size={18}/> }>
            <div className="grid gap-3 sm:grid-cols-4">
              <Band label="Critical" value={bands.critical} tone="critical" />
              <Band label="High" value={bands.high} tone="high" />
              <Band label="Medium" value={bands.medium} tone="medium" />
              <Band label="Low" value={bands.low} tone="low" />
            </div>
            <div className="mt-5 space-y-3">
              {sortedRisks.slice(0, 6).map((risk) => {
                const probability = pct(risk.escalation_probability_30d);
                return (
                  <button key={risk.risk_id} onClick={() => void loadExplain(risk)} className="w-full text-left rounded-xl border border-slate-200 bg-white p-3 transition hover:border-slate-300 hover:shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-[#102A43]">{risk.title || `Risk #${risk.risk_id}`}</div>
                        <div className="mt-1 text-[10px] text-slate-400">{risk.forecast_mode || "Forecast"} · {risk.forecast_status || "available"}</div>
                      </div>
                      <div className="shrink-0 text-right"><div className="text-lg font-semibold text-[#102A43]">{probability}%</div><div className="text-[9px] uppercase tracking-wide text-slate-400">30D</div></div>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-cyan-600" style={{width: `${Math.min(100, probability)}%`}} /></div>
                  </button>
                );
              })}
              {!sortedRisks.length && <Empty message="No forecasted risk records are currently available."/>}
            </div>
          </Panel>

          <Panel title="Model Posture" subtitle="Actual forecast coverage and training state" icon={<BrainCircuit size={18}/> }>
            <div className="grid grid-cols-2 gap-3">
              <Small label="Coverage" value={`${num(summary.forecast_coverage_percent, 0)}%`}/>
              <Small label="Forecasted" value={summary.forecast_coverage ?? 0}/>
              <Small label="ML Forecasts" value={summary.ml_forecast_risks ?? 0}/>
              <Small label="Baseline" value={summary.baseline_forecast_risks ?? 0}/>
            </div>
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex gap-2 text-xs font-semibold text-amber-800"><Info size={15}/> Training readiness</div>
              <p className="mt-1 text-xs leading-5 text-amber-700">{(summary.insufficient_history_risks ?? 0) > 0 ? `${summary.insufficient_history_risks} risk records do not have sufficient history for ML forecasting and use the backend-supported fallback posture.` : "Current forecast set has sufficient historical coverage for the configured forecasting posture."}</p>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4 text-[10px] text-slate-400"><span>Latest run</span><span>{date(summary.latest_forecast_at)}</span></div>
          </Panel>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-2"><Target size={18} className="text-cyan-700"/><div><h2 className="text-sm font-semibold text-[#102A43]">Priority Risk Forecast</h2><p className="text-[11px] text-slate-400">Risks ordered by verified 30-day escalation probability.</p></div></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left">
              <thead><tr className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400"><th className="px-5 py-3">Risk</th><th className="px-3 py-3">Severity</th><th className="px-3 py-3">Current</th><th className="px-3 py-3">30D Probability</th><th className="px-3 py-3">Expected Δ</th><th className="px-3 py-3">Unified</th><th className="px-3 py-3">Model</th><th className="px-5 py-3">Status</th></tr></thead>
              <tbody>
                {sortedRisks.map((risk) => <tr key={risk.risk_id} onClick={() => void loadExplain(risk)} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-5 py-3"><div className="max-w-[300px] truncate text-xs font-semibold text-[#102A43]">{risk.title || `Risk #${risk.risk_id}`}</div><div className="mt-1 text-[10px] text-slate-400">ID {risk.risk_id}</div></td>
                  <td className="px-3 py-3"><span className={`rounded-full border px-2 py-1 text-[9px] font-semibold ${severityClass(risk.risk_level)}`}>{severity(risk.risk_level)}</span></td>
                  <td className="px-3 py-3 text-xs font-semibold">{num(risk.current_score)}</td>
                  <td className="px-3 py-3"><span className="text-xs font-semibold text-cyan-700">{pct(risk.escalation_probability_30d)}%</span></td>
                  <td className={`px-3 py-3 text-xs font-semibold ${Number(risk.expected_score_delta ?? 0) > 0 ? "text-red-600" : "text-emerald-700"}`}>{delta(risk.expected_score_delta)}</td>
                  <td className="px-3 py-3 text-xs">{num(risk.unified_score)}</td>
                  <td className="px-3 py-3 text-[10px] text-slate-500">{risk.forecast_mode || "—"}<br/>{risk.model_version || "—"}</td>
                  <td className="px-5 py-3 text-[10px] text-slate-500">{risk.forecast_status || "—"}</td>
                </tr>)}
              </tbody>
            </table>
            {!sortedRisks.length && <div className="p-8"><Empty message="No forecast records are available for this tenant."/></div>}
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.35fr]">
          <Panel title="Executive Alerts" subtitle="Forecast-driven risks requiring attention" icon={<CircleAlert size={18}/> }>
            <div className="space-y-3">
              {alerts.map((risk) => <button key={risk.risk_id} onClick={() => void loadExplain(risk)} className="w-full rounded-xl border border-red-100 bg-red-50/50 p-4 text-left hover:bg-red-50"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-semibold text-[#102A43]">{risk.title || `Risk #${risk.risk_id}`}</div><div className="mt-1 text-[10px] text-red-700">30D escalation {pct(risk.escalation_probability_30d)}% · expected {delta(risk.expected_score_delta)}</div></div><ArrowUpRight size={15} className="text-red-600"/></div></button>)}
              {!alerts.length && <Empty message="No executive forecast alerts are currently available."/>}
            </div>
          </Panel>

          <Panel title="Forecast Explainability" subtitle="Select a risk to inspect the backend explanation" icon={<Info size={18}/> }>
            {!selectedRisk && <Empty message="Select a forecast row to inspect model mode, explanation and features."/>}
            {selectedRisk && explainLoading && <div className="animate-pulse space-y-3"><div className="h-5 rounded bg-slate-100"/><div className="h-20 rounded bg-slate-100"/><div className="h-20 rounded bg-slate-100"/></div>}
            {selectedRisk && explain && !explainLoading && <div className="space-y-4">
              <div><div className="text-xs font-semibold text-[#102A43]">{explain.risk_title || selectedRisk.title || `Risk #${selectedRisk.risk_id}`}</div><div className="mt-1 text-[10px] text-slate-400">{explain.forecast_mode || selectedRisk.forecast_mode || "—"} · {explain.model_version || selectedRisk.model_version || "—"} · {explain.training_status || "—"}</div></div>
              <div className="grid grid-cols-2 gap-3"><Small label="30D Probability" value={`${pct(explain.escalation_probability_30d)}%`}/><Small label="Expected Δ" value={delta(explain.expected_score_delta)}/></div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Explanation</div><p className="mt-2 text-xs leading-5 text-slate-600">{explain.explanation || "No explanation was returned by the backend for this forecast."}</p></div>
              {explain.feature_importance && <div><div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Feature importance</div><div className="space-y-2">{Object.entries(explain.feature_importance).slice(0, 8).map(([key, value]) => <div key={key} className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2"><span className="text-[11px] text-slate-600">{key}</span><span className="text-[11px] font-semibold text-[#102A43]">{num(value, 3)}</span></div>)}</div></div>}
              {explain.features && <div><div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Forecast features</div><div className="grid grid-cols-2 gap-2">{Object.entries(explain.features).slice(0, 10).map(([key, value]) => <div key={key} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"><div className="text-[9px] uppercase tracking-wide text-slate-400">{key}</div><div className="mt-1 text-[11px] font-semibold text-slate-700">{String(value ?? "—")}</div></div>)}</div></div>}
            </div>}
          </Panel>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <Integrity title="No fabricated forecasts" text="The screen renders only forecast records returned by the tenant-scoped intelligence API." icon={<ShieldAlert size={17}/>}/>
          <Integrity title="Baseline is explicit" text="Baseline and ML forecast counts come from the backend summary rather than being inferred in the UI." icon={<Database size={17}/>}/>
          <Integrity title="Explainability is traceable" text="Risk explanations are fetched for the selected risk from the canonical forecast explanation endpoint." icon={<CheckCircle2 size={17}/>}/>
        </section>
      </div>
    </div>
  );
}

function Metric({label,value,caption,icon,danger}:{label:string;value:string|number;caption:string;icon:React.ReactNode;danger?:boolean}){return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between"><div><div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</div><div className={`mt-2 text-2xl font-semibold ${danger ? "text-red-600" : "text-[#102A43]"}`}>{value}</div></div><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-cyan-700">{icon}</div></div><div className="mt-3 text-[10px] text-slate-400">{caption}</div></div>}
function Panel({title,subtitle,icon,children}:{title:string;subtitle:string;icon:React.ReactNode;children:React.ReactNode}){return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-start gap-2.5"><div className="mt-0.5 text-cyan-700">{icon}</div><div><h2 className="text-sm font-semibold text-[#102A43]">{title}</h2><p className="mt-0.5 text-[11px] text-slate-400">{subtitle}</p></div></div>{children}</section>}
function Small({label,value}:{label:string;value:string|number}){return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-[9px] uppercase tracking-wider text-slate-400">{label}</div><div className="mt-1 text-lg font-semibold text-[#102A43]">{value}</div></div>}
function Band({label,value,tone}:{label:string;value:number;tone:string}){const c=tone==="critical"?"border-red-200 bg-red-50 text-red-700":tone==="high"?"border-orange-200 bg-orange-50 text-orange-700":tone==="medium"?"border-amber-200 bg-amber-50 text-amber-700":"border-emerald-200 bg-emerald-50 text-emerald-700";return <div className={`rounded-xl border p-3 ${c}`}><div className="text-[9px] font-semibold uppercase tracking-wider opacity-75">{label}</div><div className="mt-1 text-xl font-semibold">{value}</div></div>}
function Integrity({title,text,icon}:{title:string;text:string;icon:React.ReactNode}){return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-xs font-semibold text-[#102A43]">{icon}{title}</div><p className="mt-2 text-[10px] leading-5 text-slate-500">{text}</p></div>}
function Empty({message}:{message:string}){return <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-400">{message}</div>}
function Loading(){return <div className="min-h-full bg-[#F6F8FB] p-6 lg:p-8"><div className="mx-auto max-w-[1700px] space-y-6 animate-pulse"><div className="h-20 rounded-2xl bg-white"/><div className="grid grid-cols-2 gap-4 xl:grid-cols-6">{Array.from({length:6}).map((_,i)=><div key={i} className="h-28 rounded-2xl bg-white"/>)}</div><div className="grid gap-6 xl:grid-cols-2"><div className="h-[430px] rounded-2xl bg-white"/><div className="h-[430px] rounded-2xl bg-white"/></div></div></div>}
