"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { apiFetch } from "@/app/lib/api";

type Action = {
  control_code?: string | null;
  standard_code?: string | null;
  clause_code?: string | null;
  requirement_code?: string | null;
  control_id: number;
  max_risk_score?: number | null;
  highest_risk_level?: string | null;
  escalation_probability: number;
  expected_score_delta?: number | null;
  ai_priority_score: number;
  suggested_owner_role: string;
  suggested_due_date: string;
  suggested_evidence_types: string[];
};

type RiskPlan = { process_id: number; total_actions: number; critical_actions: number; actions: Action[] };

type AuditPlan = {
  id: number;
  reference: string;
  name: string;
  audit_type?: string | null;
  status?: string | null;
  objective?: string | null;
  scope?: string | null;
  planned_start?: string | null;
  planned_end?: string | null;
  process_id?: number | null;
};

type ExecutionRecord = {
  id: number;
  audit_plan_id: number;
  process_id?: number | null;
  control_id: number;
  status: string;
  result?: string | null;
  observation?: string | null;
  conclusion?: string | null;
};

export default function AuditExecutionPage() {
  return (
    <Suspense fallback={<Panel>Loading audit execution...</Panel>}>
      <AuditExecutionContent />
    </Suspense>
  );
}

function AuditExecutionContent() {
  const params = useSearchParams();
  const router = useRouter();
  const processIdParam = params.get("process_id");
  const controlIdParam = params.get("control_id");
  const planId = params.get("plan_id");
  const processId = processIdParam ? Number(processIdParam) : null;
  const controlId = controlIdParam ? Number(controlIdParam) : null;

  const [action, setAction] = useState<Action | null>(null);
  const [auditPlan, setAuditPlan] = useState<AuditPlan | null>(null);
  const [riskPlan, setRiskPlan] = useState<RiskPlan | null>(null);
  const [records, setRecords] = useState<ExecutionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [status, setStatus] = useState("READY");
  const [result, setResult] = useState("CONFORMITY");
  const [notes, setNotes] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [selectedControlId, setSelectedControlId] = useState<number | null>(controlId);

  useEffect(() => {
    setSelectedControlId(controlId);
  }, [controlId]);

  useEffect(() => {
    loadContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, processIdParam, controlIdParam]);

  async function loadContext() {
    setLoading(true);
    setError("");
    setSaveMessage("");
    setAction(null);
    setAuditPlan(null);
    setRiskPlan(null);
    try {
      if (planId) {
        const planRes = await apiFetch(`/audit/plans/${planId}`);
        if (!planRes.ok) throw new Error("Audit plan could not be loaded.");
        const plan = (await planRes.json()) as AuditPlan;
        setAuditPlan(plan);

        if (plan.process_id) {
          const riskRes = await apiFetch(`/company/coverage/processes/${plan.process_id}/audit-plan`);
          if (!riskRes.ok) throw new Error("Risk-based audit queue could not be loaded.");
          const riskData = (await riskRes.json()) as RiskPlan;
          setRiskPlan(riskData);
          const targetId = controlId ?? selectedControlId;
          if (targetId) setAction(riskData.actions?.find((x) => x.control_id === targetId) || null);
        }

        const recordRes = await apiFetch(`/audit/execution?plan_id=${plan.id}`);
        if (recordRes.ok) setRecords((await recordRes.json()) as ExecutionRecord[]);
        return;
      }

      if (processId) {
        const riskRes = await apiFetch(`/company/coverage/processes/${processId}/audit-plan`);
        if (!riskRes.ok) throw new Error("Risk-based audit queue could not be loaded.");
        const riskData = (await riskRes.json()) as RiskPlan;
        setRiskPlan(riskData);
        if (controlId) setAction(riskData.actions?.find((x) => x.control_id === controlId) || null);
        if (!action && !controlId) setError("Select a control from the execution queue to begin.");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load audit execution context.");
    } finally {
      setLoading(false);
    }
  }

  const currentRecord = useMemo(
    () => records.find((record) => record.control_id === selectedControlId),
    [records, selectedControlId],
  );

  useEffect(() => {
    if (!currentRecord) return;
    setStatus(currentRecord.status || "READY");
    setResult(currentRecord.result || "CONFORMITY");
    setNotes(currentRecord.observation || "");
    setConclusion(currentRecord.conclusion || "");
  }, [currentRecord]);

  function selectAction(next: Action) {
    setSelectedControlId(next.control_id);
    setAction(next);
    setSaveMessage("");
    const query = new URLSearchParams();
    if (auditPlan?.id) query.set("plan_id", String(auditPlan.id));
    if (riskPlan?.process_id || auditPlan?.process_id) query.set("process_id", String(riskPlan?.process_id || auditPlan?.process_id));
    query.set("control_id", String(next.control_id));
    router.replace(`/audit/execution?${query.toString()}`);
  }

  async function saveExecution() {
    if (!auditPlan?.id || !action) return null;
    setSaving(true);
    setSaveMessage("");
    setError("");
    try {
      const res = await apiFetch("/audit/execution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audit_plan_id: auditPlan.id,
          process_id: riskPlan?.process_id || auditPlan.process_id || null,
          control_id: action.control_id,
          status,
          result,
          observation: notes.trim() || null,
          conclusion: conclusion.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(await safeText(res));
      const saved = (await res.json()) as ExecutionRecord;
      setRecords((current) => [...current.filter((x) => x.control_id !== saved.control_id), saved]);
      setSaveMessage("Execution record saved successfully.");
      return saved;
    } catch (e: any) {
      setError(e?.message || "Failed to save execution record.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  function openFindings() {
    const query = new URLSearchParams();
    if (auditPlan?.id) query.set("plan_id", String(auditPlan.id));
    if (action?.control_id) query.set("control_id", String(action.control_id));
    if (currentRecord?.id) query.set("execution_id", String(currentRecord.id));
    router.push(`/audit/findings?${query.toString()}`);
  }

  async function createFinding() {
    if (!auditPlan?.id || !action) return;
    if (!currentRecord) {
      const saved = await saveExecution();
      if (!saved) return;
      const query = new URLSearchParams();
      query.set("plan_id", String(auditPlan.id));
      query.set("control_id", String(action.control_id));
      query.set("execution_id", String(saved.id));
      router.push(`/audit/findings?${query.toString()}`);
      return;
    }
    openFindings();
  }

  const findingRequired = result === "NONCONFORMITY" || result === "PARTIAL_CONFORMITY" || result === "OBSERVATION";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold text-slate-100">Audit Execution</div>
          <div className="text-sm text-slate-400 mt-1">
            Execute the selected audit procedure, document observations and record the auditor conclusion.
          </div>
        </div>
        <button onClick={() => router.push("/audit/planning")} className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-900 text-sm hover:bg-slate-800">
          Back to Planning
        </button>
      </div>

      {loading && <Panel>Loading audit execution context...</Panel>}
      {error && <div className="rounded-xl border border-red-700/40 bg-red-950/30 p-4 text-sm text-red-200 whitespace-pre-wrap">{error}</div>}
      {saveMessage && <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-4 text-sm text-emerald-200">{saveMessage}</div>}

      {auditPlan && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="text-xs text-slate-500">Audit Plan</div>
          <div className="text-2xl font-semibold text-slate-100 mt-1">{auditPlan.reference} — {auditPlan.name}</div>
          <div className="flex flex-wrap gap-2 mt-3 text-xs">
            <Badge>Type: {auditPlan.audit_type || "Internal"}</Badge>
            <Badge>Status: {auditPlan.status || "DRAFT"}</Badge>
            {auditPlan.planned_start && <Badge>{auditPlan.planned_start} → {auditPlan.planned_end || "-"}</Badge>}
          </div>
        </div>
      )}

      {auditPlan && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Panel>
            <div className="text-lg font-semibold text-slate-100">Audit Objective</div>
            <div className="mt-3 text-sm text-slate-400 whitespace-pre-wrap">{auditPlan.objective || "No objective has been defined for this audit plan."}</div>
          </Panel>
          <Panel>
            <div className="text-lg font-semibold text-slate-100">Audit Scope</div>
            <div className="mt-3 text-sm text-slate-400 whitespace-pre-wrap">{auditPlan.scope || "No scope has been defined for this audit plan."}</div>
          </Panel>
        </div>
      )}

      {riskPlan && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-slate-100">Risk-Based Execution Queue</div>
              <div className="text-sm text-slate-400 mt-1">The queue prioritizes controls using risk, coverage weakness, escalation probability and expected score change.</div>
            </div>
            <div className="text-right text-xs text-slate-500"><div>{riskPlan.total_actions} actions</div><div>{riskPlan.critical_actions} critical</div></div>
          </div>
          <div className="mt-4 grid gap-2">
            {riskPlan.actions.map((item) => {
              const selected = selectedControlId === item.control_id;
              const completed = records.some((record) => record.control_id === item.control_id && record.status === "COMPLETED");
              return (
                <button key={item.control_id} type="button" onClick={() => selectAction(item)} className={`text-left rounded-xl border p-4 transition ${selected ? "border-indigo-500 bg-indigo-950/20" : "border-slate-800 bg-slate-950/40 hover:bg-slate-800/70"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-100">{item.control_code || `Control #${item.control_id}`}</div>
                      <div className="text-xs text-slate-500 mt-1">{item.standard_code || "-"} · {item.clause_code || "-"} · {item.requirement_code || "-"}</div>
                    </div>
                    <div className="flex items-center gap-3 text-xs"><span className="text-slate-400">AI {item.ai_priority_score.toFixed(1)}</span><span className="text-slate-400">Risk {item.max_risk_score ?? "-"}</span><span className="text-slate-400">Esc. {Math.round(item.escalation_probability * 100)}%</span>{completed && <span className="text-emerald-300">Completed</span>}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {action && (
        <>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="text-xs text-slate-500">Selected Audit Target</div>
            <div className="text-2xl font-semibold text-slate-100 mt-1">{action.control_code || `Control #${action.control_id}`}</div>
            <div className="text-sm text-slate-400 mt-2">{action.standard_code || "-"} · {action.clause_code || "-"} · {action.requirement_code || "-"}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Metric label="AI Priority" value={action.ai_priority_score.toFixed(1)} />
            <Metric label="Risk Score" value={String(action.max_risk_score ?? "-")} />
            <Metric label="Escalation" value={`${Math.round(action.escalation_probability * 100)}%`} />
            <Metric label="Expected Delta" value={`${(action.expected_score_delta ?? 0) >= 0 ? "+" : ""}${(action.expected_score_delta ?? 0).toFixed(2)}`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <div className="text-lg font-semibold text-slate-100">Audit Procedure</div>
              <div className="text-sm text-slate-400 mt-1">Perform the procedure against the requirement and document objective audit evidence.</div>

              <div className="mt-5 space-y-3">
                <ProcedureStep n="01" title="Confirm implementation" text="Verify that the control is implemented within the defined audit scope." />
                <ProcedureStep n="02" title="Inspect evidence" text={`Review evidence supporting ${action.requirement_code || "the applicable requirement"}.`} />
                <ProcedureStep n="03" title="Evaluate effectiveness" text="Determine whether the control is operating as intended and addresses the identified risk." />
                <ProcedureStep n="04" title="Document conclusion" text="Record factual observations, exceptions and the final auditor conclusion." />
              </div>

              <div className="mt-6">
                <div className="text-xs text-slate-400 mb-2">Auditor Observation</div>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Record objective evidence, interviews, samples, exceptions and observations..." className="w-full min-h-36 rounded-xl bg-slate-950 border border-slate-800 p-4 text-sm text-slate-100 outline-none focus:border-slate-600" />
              </div>

              <div className="mt-5">
                <div className="text-xs text-slate-400 mb-2">Auditor Conclusion</div>
                <textarea value={conclusion} onChange={(e) => setConclusion(e.target.value)} placeholder="Summarize the audit conclusion for this control..." className="w-full min-h-28 rounded-xl bg-slate-950 border border-slate-800 p-4 text-sm text-slate-100 outline-none focus:border-slate-600" />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 h-fit">
              <div className="text-lg font-semibold text-slate-100">Execution Result</div>

              <label className="block mt-5 text-xs text-slate-400">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-2 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-slate-100">
                <option value="READY">Ready</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="EXCEPTION">Exception</option>
              </select>

              <label className="block mt-5 text-xs text-slate-400">Audit Result</label>
              <select value={result} onChange={(e) => setResult(e.target.value)} className="mt-2 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-slate-100">
                <option value="CONFORMITY">Conformity</option>
                <option value="PARTIAL_CONFORMITY">Partial Conformity</option>
                <option value="NONCONFORMITY">Nonconformity</option>
                <option value="OBSERVATION">Observation</option>
                <option value="NOT_APPLICABLE">Not Applicable</option>
              </select>

              <div className="mt-6 text-xs text-slate-500">Suggested evidence</div>
              <div className="mt-2 space-y-2">{(action.suggested_evidence_types || []).map((x) => <div key={x} className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300">{x}</div>)}</div>

              <button type="button" onClick={saveExecution} disabled={saving || !auditPlan} className="mt-6 w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-3 text-sm font-semibold text-white">
                {saving ? "Saving..." : "Save Execution Record"}
              </button>

              {findingRequired ? (
                <button type="button" onClick={createFinding} disabled={saving || !auditPlan || !action} className="mt-3 w-full rounded-lg border border-indigo-700/60 bg-indigo-950/30 px-4 py-3 text-sm font-semibold text-indigo-200 hover:bg-indigo-950/50 disabled:opacity-50">
                  {saving ? "Saving Execution..." : "Create Finding"}
                </button>
              ) : (
                <button type="button" onClick={openFindings} className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800">
                  View Findings
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {!loading && !auditPlan && !riskPlan && !action && !error && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8">
          <div className="text-lg font-semibold text-slate-100">Select an audit target</div>
          <div className="text-sm text-slate-400 mt-2">Open an audit plan or select a risk-based control from Audit Planning to begin execution.</div>
          <button onClick={() => router.push("/audit/planning")} className="mt-5 px-4 py-2 rounded-lg bg-slate-100 text-slate-950 font-semibold hover:bg-white">Go to Audit Planning</button>
        </div>
      )}
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) { return <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-400">{children}</div>; }
function Badge({ children }: { children: ReactNode }) { return <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-slate-300">{children}</span>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-2 text-xl font-semibold text-slate-100">{value}</div></div>; }
function ProcedureStep({ n, title, text }: { n: string; title: string; text: string }) { return <div className="flex gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4"><span className="text-xs font-semibold text-indigo-300">{n}</span><div><div className="text-sm font-semibold text-slate-200">{title}</div><div className="text-sm text-slate-400 mt-1">{text}</div></div></div>; }
async function safeText(res: Response) { try { return (await res.text()).slice(0, 500); } catch { return ""; } }
