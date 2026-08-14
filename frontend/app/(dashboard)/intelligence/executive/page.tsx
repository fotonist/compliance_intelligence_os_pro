"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, BrainCircuit, CheckCircle2, FileCheck2, ShieldAlert, Target } from "lucide-react";
import { apiFetch } from "@/app/lib/api";

type Summary = {
  generated_at?: string;
  executive?: {
    readiness_score?: number;
    compliance_score?: number;
    evidence_score?: number;
    risk_health_score?: number;
    status?: string;
  };
  controls?: {
    total?: number;
    covered?: number;
    uncovered?: number;
    coverage_percent?: number;
  };
  risks?: {
    total?: number;
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
    average_score?: number;
    unified_exposure?: number;
    top_risks?: Array<{ id?: number; title?: string; score?: number; level?: string; unified_score?: number }>;
  };
  evidence?: {
    total?: number;
    approved?: number;
    pending?: number;
    rejected?: number;
    strength_percent?: number;
    weak_evidences?: Array<{ id?: number; title?: string; status?: string; approval_status?: string }>;
  };
  tasks?: {
    total?: number;
    open?: number;
    overdue?: number;
    critical?: number;
    high?: number;
    priority_tasks?: Array<{ id?: number; title?: string; priority_score?: number; owner_role?: string; status?: string; due_date?: string }>;
  };
};

function scoreTone(value: number) {
  if (value >= 85) return "text-emerald-300";
  if (value >= 70) return "text-cyan-300";
  if (value >= 50) return "text-amber-300";
  return "text-red-300";
}

export default function ExecutiveIntelligencePage() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/executive-summary");
        if (!res.ok) throw new Error(await res.text());
        setData(await res.json());
      } catch (e: any) {
        setError(e?.message || "Unable to load executive intelligence.");
      }
    })();
  }, []);

  if (!data) {
    return <div className="min-h-full bg-[#020817] p-8 text-slate-300">{error || "Loading Executive Intelligence..."}</div>;
  }

  const executive = data.executive || {};
  const controls = data.controls || {};
  const risks = data.risks || {};
  const evidence = data.evidence || {};
  const tasks = data.tasks || {};
  const readiness = Number(executive.readiness_score || 0);

  return (
    <div className="min-h-full bg-[#020817] text-slate-100">
      <div className="mx-auto max-w-[1500px] p-6 lg:p-8">
        <header className="mb-7 flex items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10">
              <BrainCircuit className="h-6 w-6 text-cyan-300" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Executive Intelligence</h1>
              <p className="mt-1 text-sm text-slate-400">Executive compliance posture, exposure, readiness and decision signals</p>
            </div>
          </div>
          <div className={`rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium ${scoreTone(readiness)}`}>
            {executive.status || "UNASSESSED"}
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-5">
          <HeroMetric label="Executive Readiness" value={`${readiness.toFixed(1)}%`} icon={<Target className="h-5 w-5" />} tone={scoreTone(readiness)} />
          <HeroMetric label="Compliance Health" value={`${Number(executive.compliance_score || 0).toFixed(1)}%`} icon={<CheckCircle2 className="h-5 w-5" />} tone={scoreTone(Number(executive.compliance_score || 0))} />
          <HeroMetric label="Evidence Strength" value={`${Number(executive.evidence_score || 0).toFixed(1)}%`} icon={<FileCheck2 className="h-5 w-5" />} tone={scoreTone(Number(executive.evidence_score || 0))} />
          <HeroMetric label="Risk Health" value={`${Number(executive.risk_health_score || 0).toFixed(1)}%`} icon={<ShieldAlert className="h-5 w-5" />} tone={scoreTone(Number(executive.risk_health_score || 0))} />
          <HeroMetric label="Unified Exposure" value={Number(risks.unified_exposure || 0).toFixed(1)} icon={<AlertTriangle className="h-5 w-5" />} tone="text-orange-300" />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-3">
          <ExecutivePanel title="Control Posture">
            <MetricRow label="Total Controls" value={controls.total ?? 0} />
            <MetricRow label="Covered" value={controls.covered ?? 0} />
            <MetricRow label="Uncovered" value={controls.uncovered ?? 0} danger={Number(controls.uncovered || 0) > 0} />
            <MetricRow label="Coverage" value={`${Number(controls.coverage_percent || 0).toFixed(1)}%`} />
          </ExecutivePanel>

          <ExecutivePanel title="Risk Posture">
            <MetricRow label="Total Risks" value={risks.total ?? 0} />
            <MetricRow label="Critical" value={risks.critical ?? 0} danger={Number(risks.critical || 0) > 0} />
            <MetricRow label="High" value={risks.high ?? 0} danger={Number(risks.high || 0) > 0} />
            <MetricRow label="Average Score" value={Number(risks.average_score || 0).toFixed(1)} />
          </ExecutivePanel>

          <ExecutivePanel title="Evidence & Execution">
            <MetricRow label="Evidence Strength" value={`${Number(evidence.strength_percent || 0).toFixed(1)}%`} />
            <MetricRow label="Pending Evidence" value={evidence.pending ?? 0} />
            <MetricRow label="Rejected Evidence" value={evidence.rejected ?? 0} danger={Number(evidence.rejected || 0) > 0} />
            <MetricRow label="Overdue Tasks" value={tasks.overdue ?? 0} danger={Number(tasks.overdue || 0) > 0} />
          </ExecutivePanel>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <ExecutivePanel title="Top Risk Exposure">
            {(risks.top_risks || []).length ? (
              <div className="space-y-3">
                {(risks.top_risks || []).map((risk) => (
                  <div key={risk.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                    <div>
                      <div className="font-medium text-slate-100">{risk.title || `Risk #${risk.id}`}</div>
                      <div className="mt-1 text-xs text-slate-500">{risk.level || "Unclassified"} · Score {risk.score ?? "—"}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-orange-300">{Number(risk.unified_score || 0).toFixed(1)}</div>
                      <div className="text-[10px] text-slate-500">Exposure</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <Empty text="No risk exposure signals available." />}
          </ExecutivePanel>

          <ExecutivePanel title="Executive Decision Signals">
            <div className="space-y-3">
              {Number(risks.critical || 0) > 0 && <Signal severity="CRITICAL" text={`${risks.critical} critical risk(s) require executive attention.`} />}
              {Number(controls.uncovered || 0) > 0 && <Signal severity="HIGH" text={`${controls.uncovered} control(s) currently lack coverage.`} />}
              {Number(evidence.rejected || 0) > 0 && <Signal severity="MEDIUM" text={`${evidence.rejected} evidence item(s) require remediation or replacement.`} />}
              {Number(tasks.overdue || 0) > 0 && <Signal severity="HIGH" text={`${tasks.overdue} overdue task(s) may affect compliance readiness.`} />}
              {Number(risks.critical || 0) === 0 && Number(controls.uncovered || 0) === 0 && Number(evidence.rejected || 0) === 0 && Number(tasks.overdue || 0) === 0 && <Signal severity="HEALTHY" text="No immediate executive escalation signals detected." />}
            </div>
          </ExecutivePanel>
        </section>
      </div>
    </div>
  );
}

function HeroMetric({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
      <div className={`flex items-center gap-2 text-xs ${tone}`}>{icon}{label}</div>
      <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
    </div>
  );
}

function ExecutivePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
      <h2 className="mb-4 font-semibold text-white">{title}</h2>
      {children}
    </div>
  );
}

function MetricRow({ label, value, danger }: { label: string; value: string | number; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-900 py-3 last:border-b-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`font-semibold ${danger ? "text-red-300" : "text-slate-100"}`}>{value}</span>
    </div>
  );
}

function Signal({ severity, text }: { severity: string; text: string }) {
  const tone = severity === "CRITICAL" ? "text-red-300 border-red-500/20 bg-red-500/5" : severity === "HIGH" ? "text-orange-300 border-orange-500/20 bg-orange-500/5" : severity === "MEDIUM" ? "text-amber-300 border-amber-500/20 bg-amber-500/5" : "text-emerald-300 border-emerald-500/20 bg-emerald-500/5";
  return <div className={`rounded-xl border p-4 text-sm ${tone}`}><span className="mr-2 text-[10px] font-semibold tracking-wider">{severity}</span>{text}</div>;
}

function Empty({ text }: { text: string }) {
  return <div className="py-10 text-center text-sm text-slate-500">{text}</div>;
}
