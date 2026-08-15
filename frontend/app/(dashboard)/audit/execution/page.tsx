"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
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
  ai_priority_score: number;
  suggested_owner_role: string;
  suggested_due_date: string;
  suggested_evidence_types: string[];
};

type RiskPlan = { actions: Action[] };

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
  const processId = params.get("process_id");
  const controlId = params.get("control_id");
  const planId = params.get("plan_id");
  const [action, setAction] = useState<Action | null>(null);
  const [auditPlan, setAuditPlan] = useState<AuditPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("READY");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (processId && controlId) {
      loadSelectedControl();
      return;
    }
    if (planId) {
      loadAuditPlan(planId);
      return;
    }
    setAction(null);
    setAuditPlan(null);
    setError("");
  }, [processId, controlId, planId]);

  async function loadSelectedControl() {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/company/coverage/processes/${processId}/audit-plan`);
      if (!res.ok) throw new Error("Audit plan could not be loaded.");
      const data = (await res.json()) as RiskPlan;
      const found = data.actions?.find((x) => String(x.control_id) === String(controlId));
      setAction(found || null);
      if (!found) setError("The selected control is no longer present in the audit plan.");
    } catch (e: any) {
      setError(e?.message || "Failed to load audit execution context.");
    } finally {
      setLoading(false);
    }
  }

  async function loadAuditPlan(id: string) {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/audit/plans/${id}`);
      if (!res.ok) throw new Error("Audit plan could not be loaded.");
      setAuditPlan((await res.json()) as AuditPlan);
    } catch (e: any) {
      setError(e?.message || "Failed to load audit plan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold">Audit Execution</div>
          <div className="text-sm text-slate-400 mt-1">
            Execute the selected risk-based audit procedure and record auditor observations.
          </div>
        </div>
        <button
          onClick={() => router.push("/audit/planning")}
          className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-900 text-sm hover:bg-slate-800"
        >
          Back to Planning
        </button>
      </div>

      {loading && <Panel>Loading audit execution...</Panel>}

      {error && (
        <div className="rounded-xl border border-red-700/40 bg-red-950/30 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {!loading && !error && !action && !auditPlan && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8">
          <div className="text-lg font-semibold text-slate-100">Select an audit target</div>
          <div className="text-sm text-slate-400 mt-2">
            Open a control from Audit Planning or open a created audit plan to begin execution.
          </div>
          <button
            onClick={() => router.push("/audit/planning")}
            className="mt-5 px-4 py-2 rounded-lg bg-slate-100 text-slate-950 font-semibold hover:bg-white"
          >
            Go to Audit Planning
          </button>
        </div>
      )}

      {auditPlan && !action && (
        <>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="text-xs text-slate-500">Audit Plan</div>
            <div className="text-2xl font-semibold text-slate-100 mt-1">
              {auditPlan.reference} — {auditPlan.name}
            </div>
            <div className="flex flex-wrap gap-2 mt-3 text-xs">
              <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-slate-300">
                Type: {auditPlan.audit_type || "Internal"}
              </span>
              <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-slate-300">
                Status: {auditPlan.status || "DRAFT"}
              </span>
              {auditPlan.planned_start && (
                <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-slate-300">
                  {auditPlan.planned_start} → {auditPlan.planned_end || "-"}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Panel>
              <div className="text-lg font-semibold text-slate-100">Audit Objective</div>
              <div className="mt-3 text-sm text-slate-400 whitespace-pre-wrap">
                {auditPlan.objective || "No objective has been defined for this audit plan."}
              </div>
            </Panel>
            <Panel>
              <div className="text-lg font-semibold text-slate-100">Audit Scope</div>
              <div className="mt-3 text-sm text-slate-400 whitespace-pre-wrap">
                {auditPlan.scope || "No scope has been defined for this audit plan."}
              </div>
            </Panel>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="text-lg font-semibold text-slate-100">Execution Queue</div>
            <div className="text-sm text-slate-400 mt-1">
              Select a risk-based control from Audit Planning to start an execution record.
            </div>
            <button
              onClick={() => router.push("/audit/planning")}
              className="mt-5 px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800"
            >
              Open Risk-Based Audit Queue
            </button>
          </div>
        </>
      )}

      {action && (
        <>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <div className="text-xs text-slate-500">Audit Target</div>
            <div className="text-2xl font-semibold mt-1">
              {action.control_code || `Control #${action.control_id}`}
            </div>
            <div className="text-sm text-slate-400 mt-2">
              {action.standard_code || "-"} · {action.clause_code || "-"} · {action.requirement_code || "-"}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Metric label="AI Priority" value={action.ai_priority_score.toFixed(1)} />
            <Metric label="Risk Score" value={String(action.max_risk_score ?? "-")} />
            <Metric label="Escalation" value={`${Math.round(action.escalation_probability * 100)}%`} />
            <Metric label="Owner" value={action.suggested_owner_role} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="text-lg font-semibold">Audit Procedure</div>
              <div className="text-sm text-slate-400 mt-1">
                Review the control implementation, inspect evidence and document the auditor conclusion.
              </div>

              <div className="mt-5 space-y-3">
                <Step n="01" text="Confirm control implementation and scope." />
                <Step n="02" text="Inspect available evidence against the requirement." />
                <Step n="03" text="Record observations, exceptions and conclusion." />
              </div>

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Auditor observations..."
                className="mt-5 w-full min-h-32 rounded-lg bg-slate-950 border border-slate-800 p-3 text-sm outline-none focus:border-slate-600"
              />
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="text-lg font-semibold">Execution Status</div>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-4 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm"
              >
                <option>READY</option>
                <option>IN_PROGRESS</option>
                <option>COMPLETED</option>
                <option>EXCEPTION</option>
              </select>

              <div className="mt-5 text-xs text-slate-500">Suggested evidence</div>
              <div className="mt-2 space-y-2">
                {(action.suggested_evidence_types || []).map((x) => (
                  <div key={x} className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
                    {x}
                  </div>
                ))}
              </div>

              <button className="mt-6 w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-sm font-medium">
                Save Execution Record
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-400">
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function Step({ n, text }: { n: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <span className="text-xs font-semibold text-indigo-300">{n}</span>
      <span className="text-sm text-slate-300">{text}</span>
    </div>
  );
}
