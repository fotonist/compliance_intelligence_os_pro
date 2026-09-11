"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

const API_BASE = "https://compliance-intelligence-os-pro-2.onrender.com";

type Evaluation = {
  id: number;
  rating: string | null;
  justification: string | null;
  status: string;
  evaluated_by: number | null;
  evaluated_at: string | null;
};

type Indicator = {
  id: number;
  code: string;
  text: string;
  guidance: string | null;
  sort_order: number;
};

type Attribute = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  capability_level: {
    id: number;
    level: number;
    code: string;
    name: string;
    description: string | null;
  };
  evaluation: Evaluation | null;
  generic_practices: Indicator[];
  generic_resources: Indicator[];
  generic_work_products: Indicator[];
};

type Process = {
  assessment_process_id: number;
  tenant_process_id: number | null;
  tenant_process: {
    id: number;
    code: string | null;
    name: string;
    type: string | null;
    owner: string | null;
    status: string | null;
  } | null;
  pam_process_id: number;
  code: string;
  name: string;
  purpose: string | null;
  description: string | null;
  process_group: { id: number; code: string; name: string };
  outcomes: { id: number; code: string; text: string; sort_order: number }[];
  base_practices: Indicator[];
  work_products: {
    id: number;
    code: string;
    name: string;
    description: string | null;
    characteristics: unknown;
    direction: string;
    sort_order: number;
  }[];
  target_capability_level: number | null;
  status: string;
  attributes: Attribute[];
};

type Workspace = {
  assessment: {
    id: number;
    name: string;
    scope: string | null;
    status: string;
    framework_adoption_id: number;
    framework_model_id: number;
    assessor_user_id: number | null;
    sponsor_user_id: number | null;
    created_at: string;
    updated_at: string;
  };
  summary: {
    processes_in_scope: number;
    assessed_processes: number;
    attributes_evaluated: number;
    attributes_total: number;
    average_capability: number | null;
    target_capability: number | null;
    capability_gap: number | null;
  };
  capability_levels: {
    id: number;
    level: number;
    code: string;
    name: string;
    description: string | null;
    attributes: { id: number; code: string; name: string; description: string | null; sort_order: number }[];
  }[];
  processes: Process[];
};

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
    </div>
  );
}

function IndicatorList({ title, items }: { title: string; items: Indicator[] }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="font-medium text-slate-200">{title}</h4>
        <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-400">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-slate-600">No indicators loaded.</div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="font-mono text-xs text-cyan-300">{item.code}</div>
              <div className="mt-1 text-sm text-slate-300">{item.text}</div>
              {item.guidance && <div className="mt-2 text-xs text-slate-500">{item.guidance}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MaturityPracticeWorkspacePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [selectedProcessId, setSelectedProcessId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const token = getToken();

  const loadWorkspace = useCallback(async () => {
    if (!token || !sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/maturity/workspace/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to load PAM assessment workspace");
      }
      const data: Workspace = await response.json();
      setWorkspace(data);
      setSelectedProcessId((current) => current ?? data.processes[0]?.assessment_process_id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load PAM assessment workspace");
    } finally {
      setLoading(false);
    }
  }, [sessionId, token]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const selectedProcess = useMemo(
    () => workspace?.processes.find((item) => item.assessment_process_id === selectedProcessId) ?? null,
    [workspace, selectedProcessId]
  );

  async function saveAttribute(attribute: Attribute, rating: string, justification: string) {
    if (!workspace || !selectedProcess || !token) return;
    setSavingId(attribute.id);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE}/maturity/workspace/${workspace.assessment.id}/processes/${selectedProcess.assessment_process_id}/attributes/${attribute.id}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ rating: rating.trim() || null, justification: justification.trim() || null, status: "DRAFT" }),
        }
      );
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to save evaluation");
      }
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save evaluation");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-[#020817] p-8 text-slate-300">Loading assessment workspace...</div>;
  }
  if (error && !workspace) {
    return <div className="min-h-screen bg-[#020817] p-8 text-red-300">{error}</div>;
  }
  if (!workspace) {
    return <div className="min-h-screen bg-[#020817] p-8 text-slate-400">Assessment workspace is empty.</div>;
  }

  return (
    <div className="min-h-screen bg-[#020817] px-5 py-8 text-white md:px-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.25em] text-slate-500">Governance & Intelligence Engine</div>
            <h1 className="text-3xl font-semibold tracking-tight">ISO/IEC 15504 Process Assessment</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">Process-profile assessment workspace for the canonical Process Assessment Model.</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm">
            <div className="text-slate-500">Assessment</div>
            <div className="mt-1 font-medium text-slate-200">#{workspace.assessment.id} · {workspace.assessment.status}</div>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Metric label="Processes in Scope" value={workspace.summary.processes_in_scope} />
          <Metric label="Assessed Processes" value={workspace.summary.assessed_processes} />
          <Metric label="Attributes Evaluated" value={`${workspace.summary.attributes_evaluated}/${workspace.summary.attributes_total}`} />
          <Metric label="Average Capability" value={workspace.summary.average_capability ?? "—"} />
          <Metric label="Capability Gap" value={workspace.summary.capability_gap ?? "—"} />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
            <div className="mb-4 px-2">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Process Profile</div>
              <div className="mt-1 text-sm text-slate-400">Select a process to assess.</div>
            </div>
            <div className="space-y-2">
              {workspace.processes.map((process) => (
                <button key={process.assessment_process_id} type="button" onClick={() => setSelectedProcessId(process.assessment_process_id)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedProcessId === process.assessment_process_id ? "border-indigo-500/60 bg-indigo-500/10" : "border-slate-800 bg-slate-900/50 hover:border-slate-700"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-sm text-cyan-300">{process.code}</span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500">{process.status}</span>
                  </div>
                  <div className="mt-2 font-medium text-slate-200">{process.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{process.process_group.code} · {process.process_group.name}</div>
                  <div className="mt-3 text-xs text-slate-500">Target: {process.target_capability_level ?? "Not set"}</div>
                </button>
              ))}
            </div>
          </aside>

          <main className="min-w-0">
            {selectedProcess ? (
              <div className="space-y-6">
                <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="font-mono text-sm text-cyan-300">{selectedProcess.code}</div>
                      <h2 className="mt-2 text-2xl font-semibold">{selectedProcess.name}</h2>
                      <div className="mt-2 text-sm text-slate-500">{selectedProcess.process_group.code} · {selectedProcess.process_group.name}</div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-right text-sm">
                      <div className="text-slate-500">Target Capability</div>
                      <div className="mt-1 text-lg font-semibold text-slate-200">{selectedProcess.target_capability_level ?? "Not set"}</div>
                    </div>
                  </div>

                  {selectedProcess.purpose && (
                    <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Purpose</div>
                      <div className="mt-2 text-sm leading-6 text-slate-300">{selectedProcess.purpose}</div>
                    </div>
                  )}

                  <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                      <div className="mb-3 flex items-center justify-between"><h3 className="font-medium">Process Outcomes</h3><span className="text-xs text-slate-500">{selectedProcess.outcomes.length}</span></div>
                      <div className="space-y-2">
                        {selectedProcess.outcomes.map((outcome) => <div key={outcome.id} className="rounded-xl border border-slate-800 p-3"><span className="font-mono text-xs text-cyan-300">{outcome.code}</span><div className="mt-1 text-sm text-slate-300">{outcome.text}</div></div>)}
                        {selectedProcess.outcomes.length === 0 && <div className="text-sm text-slate-600">No outcomes loaded.</div>}
                      </div>
                    </div>
                    <IndicatorList title="Base Practices" items={selectedProcess.base_practices} />
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                    <div className="mb-3 flex items-center justify-between"><h3 className="font-medium">Work Products</h3><span className="text-xs text-slate-500">{selectedProcess.work_products.length}</span></div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {selectedProcess.work_products.map((item) => <div key={item.id} className="rounded-xl border border-slate-800 p-3"><span className="font-mono text-xs text-cyan-300">{item.code}</span><div className="mt-1 text-sm text-slate-300">{item.name}</div><div className="mt-1 text-xs text-slate-500">Direction: {item.direction}</div></div>)}
                      {selectedProcess.work_products.length === 0 && <div className="text-sm text-slate-600">No work products loaded.</div>}
                    </div>
                  </div>
                </section>

                <section>
                  <div className="mb-4 flex items-end justify-between">
                    <div><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Capability Measurement</div><h3 className="mt-1 text-xl font-semibold">Process Attributes</h3></div>
                    {error && <div className="text-sm text-red-300">{error}</div>}
                  </div>
                  <div className="space-y-4">
                    {selectedProcess.attributes.map((attribute) => <AttributeCard key={attribute.id} attribute={attribute} saving={savingId === attribute.id} onSave={saveAttribute} />)}
                    {selectedProcess.attributes.length === 0 && <div className="rounded-2xl border border-slate-800 p-6 text-sm text-slate-500">No process attributes are configured for this framework model.</div>}
                  </div>
                </section>
              </div>
            ) : (
              <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-10 text-center text-slate-500">Select a process.</div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function AttributeCard({ attribute, saving, onSave }: { attribute: Attribute; saving: boolean; onSave: (attribute: Attribute, rating: string, justification: string) => Promise<void> }) {
  const [rating, setRating] = useState(attribute.evaluation?.rating ?? "");
  const [justification, setJustification] = useState(attribute.evaluation?.justification ?? "");

  useEffect(() => {
    setRating(attribute.evaluation?.rating ?? "");
    setJustification(attribute.evaluation?.justification ?? "");
  }, [attribute.evaluation?.id, attribute.evaluation?.rating, attribute.evaluation?.justification]);

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-cyan-300">{attribute.code}</span>
            <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-500">Level {attribute.capability_level.level}</span>
          </div>
          <h4 className="mt-2 text-lg font-medium text-slate-200">{attribute.name}</h4>
          {attribute.description && <p className="mt-2 text-sm leading-6 text-slate-400">{attribute.description}</p>}
        </div>
        <div className="w-full lg:w-48">
          <label className="text-xs uppercase tracking-[0.18em] text-slate-500">Rating</label>
          <input value={rating} onChange={(event) => setRating(event.target.value)} placeholder="Enter rating" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500" />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <IndicatorList title="Generic Practices" items={attribute.generic_practices} />
        <IndicatorList title="Generic Resources" items={attribute.generic_resources} />
        <IndicatorList title="Generic Work Products" items={attribute.generic_work_products} />
      </div>

      <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <label className="text-xs uppercase tracking-[0.18em] text-slate-500">Justification / Assessment Notes</label>
        <textarea value={justification} onChange={(event) => setJustification(event.target.value)} rows={4} placeholder="Record the assessment rationale, observations and supporting context." className="mt-2 w-full resize-y rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-slate-200 outline-none focus:border-indigo-500" />
        <div className="mt-3 flex justify-end">
          <button type="button" disabled={saving} onClick={() => onSave(attribute, rating, justification)} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50">{saving ? "Saving..." : "Save Evaluation"}</button>
        </div>
      </div>
    </div>
  );
}
