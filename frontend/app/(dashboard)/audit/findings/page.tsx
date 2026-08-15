"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/app/lib/api";

 type Finding = {
  id: number;
  audit_plan_id: number;
  execution_id?: number | null;
  process_id?: number | null;
  control_id: number;
  title: string;
  description: string;
  requirement?: string | null;
  objective_evidence?: string | null;
  severity: string;
  status: string;
  owner?: string | null;
  due_date?: string | null;
  root_cause?: string | null;
  recommendation?: string | null;
  created_at?: string;
};

const severities = ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"];
const statuses = ["ALL", "OPEN", "IN_PROGRESS", "CLOSED"];

export default function FindingsPage() {
  const params = useSearchParams();
  const planId = params.get("plan_id");
  const controlId = params.get("control_id");
  const executionId = params.get("execution_id");

  const [findings, setFindings] = useState<Finding[]>([]);
  const [severity, setSeverity] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(Boolean(planId && controlId));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requirement, setRequirement] = useState("");
  const [objectiveEvidence, setObjectiveEvidence] = useState("");
  const [findingSeverity, setFindingSeverity] = useState("MEDIUM");
  const [owner, setOwner] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [recommendation, setRecommendation] = useState("");

  async function loadFindings() {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams();
      if (planId) query.set("plan_id", planId);
      if (status !== "ALL") query.set("status", status);
      if (severity !== "ALL") query.set("severity", severity);
      const res = await apiFetch(`/audit/findings?${query.toString()}`);
      if (!res.ok) throw new Error(await safeText(res));
      setFindings((await res.json()) as Finding[]);
    } catch (e: any) {
      setError(e?.message || "Failed to load findings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFindings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, status, severity]);

  async function createFinding() {
    if (!planId || !controlId || !title.trim() || !description.trim()) {
      setError("Audit plan, control, finding title and description are required.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await apiFetch("/audit/findings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audit_plan_id: Number(planId),
          control_id: Number(controlId),
          execution_id: executionId ? Number(executionId) : null,
          title: title.trim(),
          description: description.trim(),
          requirement: requirement.trim() || null,
          objective_evidence: objectiveEvidence.trim() || null,
          severity: findingSeverity,
          owner: owner.trim() || null,
          due_date: dueDate || null,
          root_cause: rootCause.trim() || null,
          recommendation: recommendation.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(await safeText(res));
      const created = (await res.json()) as Finding;
      setFindings((current) => [created, ...current]);
      setMessage("Finding created successfully.");
      setShowForm(false);
      setTitle("");
      setDescription("");
      setRequirement("");
      setObjectiveEvidence("");
      setRootCause("");
      setRecommendation("");
      setOwner("");
      setDueDate("");
    } catch (e: any) {
      setError(e?.message || "Failed to create finding.");
    } finally {
      setSaving(false);
    }
  }

  const kpis = useMemo(() => ({
    open: findings.filter((x) => x.status !== "CLOSED").length,
    critical: findings.filter((x) => x.severity === "CRITICAL").length,
    high: findings.filter((x) => x.severity === "HIGH").length,
    overdue: findings.filter((x) => x.status !== "CLOSED" && x.due_date && x.due_date < new Date().toISOString().slice(0, 10)).length,
  }), [findings]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold text-slate-100">Audit Findings</div>
          <div className="text-sm text-slate-400 mt-1">Central register for observations, nonconformities and audit findings.</div>
        </div>
        <button type="button" onClick={() => setShowForm(true)} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">
          + New Finding
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-700/40 bg-red-950/30 p-4 text-sm text-red-200 whitespace-pre-wrap">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-4 text-sm text-emerald-200">{message}</div>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Open Findings" value={String(kpis.open)} />
        <Kpi label="Critical" value={String(kpis.critical)} />
        <Kpi label="High" value={String(kpis.high)} />
        <Kpi label="Overdue" value={String(kpis.overdue)} />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="font-semibold text-slate-100">Finding Register</div>
            <div className="text-xs text-slate-500 mt-1">Findings are created from Audit Execution and remain linked to the audit plan and control.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200">
              {statuses.map((x) => <option key={x}>{x}</option>)}
            </select>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200">
              {severities.map((x) => <option key={x}>{x}</option>)}
            </select>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-indigo-700/40 bg-slate-900 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-slate-100">Create Audit Finding</div>
              <div className="text-sm text-slate-400 mt-1">Record the factual finding discovered during audit execution.</div>
            </div>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">Close</button>
          </div>

          {!planId || !controlId ? (
            <div className="mt-5 rounded-lg border border-amber-700/40 bg-amber-950/20 p-4 text-sm text-amber-200">Open Findings from an Audit Execution control to automatically link the finding to an audit plan and control.</div>
          ) : (
            <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Field label="Finding Title *"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Privileged access review not evidenced" className={inputClass} /></Field>
              <Field label="Severity"><select value={findingSeverity} onChange={(e) => setFindingSeverity(e.target.value)} className={inputClass}><option>CRITICAL</option><option>HIGH</option><option>MEDIUM</option><option>LOW</option></select></Field>
              <Field label="Requirement"><input value={requirement} onChange={(e) => setRequirement(e.target.value)} placeholder="Clause / requirement" className={inputClass} /></Field>
              <Field label="Owner"><input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Responsible owner" className={inputClass} /></Field>
              <Field label="Due Date"><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} /></Field>
              <div />
              <Field label="Finding Description *" wide><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the nonconformity, observation or condition found..." className={textareaClass} /></Field>
              <Field label="Objective Evidence" wide><textarea value={objectiveEvidence} onChange={(e) => setObjectiveEvidence(e.target.value)} placeholder="Samples, records, interviews, screenshots or other objective evidence..." className={textareaClass} /></Field>
              <Field label="Root Cause" wide><textarea value={rootCause} onChange={(e) => setRootCause(e.target.value)} placeholder="Known or suspected root cause..." className={textareaClass} /></Field>
              <Field label="Recommendation" wide><textarea value={recommendation} onChange={(e) => setRecommendation(e.target.value)} placeholder="Recommended corrective action or improvement..." className={textareaClass} /></Field>
              <div className="lg:col-span-2 flex justify-end gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-300">Cancel</button>
                <button type="button" onClick={createFinding} disabled={saving} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Create Finding"}</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead className="bg-slate-800/80"><tr>{["ID", "Audit Area", "Finding", "Severity", "Owner", "Status", "Due Date"].map((c) => <th key={c} className="px-4 py-3 text-left text-xs font-semibold text-slate-300">{c}</th>)}</tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="px-4 py-16 text-center text-slate-500">Loading findings...</td></tr> : findings.length === 0 ? <tr><td colSpan={7} className="px-4 py-16 text-center"><div className="text-slate-300 font-medium">No findings recorded</div><div className="text-sm text-slate-500 mt-2">Create a finding from an Audit Execution result or use New Finding.</div></td></tr> : findings.map((finding) => (
                <tr key={finding.id} className="border-t border-slate-800 hover:bg-slate-800/30">
                  <td className="px-4 py-4 text-sm text-slate-400">#{finding.id}</td>
                  <td className="px-4 py-4 text-sm text-slate-300">Plan #{finding.audit_plan_id}<div className="text-xs text-slate-500">Control #{finding.control_id}</div></td>
                  <td className="px-4 py-4"><div className="font-medium text-slate-100">{finding.title}</div><div className="text-xs text-slate-500 mt-1 max-w-xl truncate">{finding.description}</div></td>
                  <td className="px-4 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs ${severityClass(finding.severity)}`}>{finding.severity}</span></td>
                  <td className="px-4 py-4 text-sm text-slate-400">{finding.owner || "—"}</td>
                  <td className="px-4 py-4 text-sm text-slate-300">{finding.status}</td>
                  <td className="px-4 py-4 text-sm text-slate-400">{finding.due_date || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const inputClass = "w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-slate-600";
const textareaClass = "w-full min-h-28 rounded-lg border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-100 outline-none focus:border-slate-600";

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={wide ? "lg:col-span-2" : ""}><div className="mb-2 text-xs text-slate-400">{label}</div>{children}</label>;
}
function Kpi({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="text-xs text-slate-500">{label}</div><div className="text-2xl font-semibold mt-2 text-slate-100">{value}</div></div>; }
function severityClass(value: string) { if (value === "CRITICAL") return "border-red-700/50 bg-red-950/30 text-red-300"; if (value === "HIGH") return "border-orange-700/50 bg-orange-950/30 text-orange-300"; if (value === "LOW") return "border-slate-700 text-slate-400"; return "border-yellow-700/50 bg-yellow-950/20 text-yellow-300"; }
async function safeText(res: Response) { try { return (await res.text()).slice(0, 500); } catch { return ""; } }
