"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronDown, ChevronRight, Layers3, RefreshCw } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/api";

type Standard = { id: number; code: string; title?: string | null; type?: string | null };
type Process = { id: number; code: string; name: string; purpose?: string | null; category_code: string; category_name: string; group_code: string; group_name: string; outcomes: any[]; base_practices: any[]; work_products: any[] };
type Category = { id: number; code: string; name: string; groups: { id: number; code: string; name: string; processes: Process[] }[] };
type PamData = { standard: any; version: any; framework_model: any; reference_model: any; capability_measurement_framework: any; adoption: any; categories: Category[]; counts: any; };

type ControlRow = { clause_code?: string; clause_description?: string; requirement_code?: string; requirement_description?: string; control_code?: string; control_description?: string; coverage_status?: string; risk_level?: string };

export default function ComplianceMatrixPage() {
  const [standards, setStandards] = useState<Standard[]>([]);
  const [assessmentType, setAssessmentType] = useState<"control" | "pam">("pam");
  const [standardId, setStandardId] = useState<number | "">("");
  const [pam, setPam] = useState<PamData | null>(null);
  const [controls, setControls] = useState<ControlRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<number[]>([]);

  const maturityStandards = useMemo(() => standards.filter(s => String(s.type ?? "").toUpperCase() === "MATURITY_BASED"), [standards]);
  const controlStandards = useMemo(() => standards.filter(s => String(s.type ?? "").toUpperCase() === "CONTROL_BASED"), [standards]);

  useEffect(() => {
    (async () => {
      try { const r = await apiFetch("/framework/standards"); const b = await r.json(); setStandards(Array.isArray(b) ? b : []); }
      catch { setError("Frameworks could not be loaded."); }
    })();
  }, []);

  useEffect(() => {
    const list = assessmentType === "pam" ? maturityStandards : controlStandards;
    setStandardId(list[0]?.id ?? "");
  }, [assessmentType, standards]);

  async function load() {
    if (!standardId) return;
    setLoading(true); setError("");
    try {
      if (assessmentType === "pam") {
        const r = await apiFetch(`/matrix/pam?standard_id=${standardId}`); const b = await r.json();
        if (!r.ok) throw new Error(b?.detail || "Canonical PAM could not be loaded.");
        setPam(b); setControls([]); setExpanded(b.categories?.map((c: Category) => c.id) ?? []);
      } else {
        const r = await apiFetch(`/matrix/?standard_id=${standardId}`); const b = await r.json();
        if (!r.ok) throw new Error(b?.detail || "Compliance matrix could not be loaded.");
        setControls(Array.isArray(b?.rows) ? b.rows : Array.isArray(b) ? b : []); setPam(null);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Matrix could not be loaded."); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (standardId) load(); }, [standardId, assessmentType]);

  return (
    <main className="min-h-full bg-slate-50 px-6 py-7 lg:px-8">
      <div className="mx-auto max-w-[1700px] space-y-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"><Layers3 className="h-4 w-4" /> Compliance Management</div><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Compliance Matrix</h1><p className="mt-1 text-sm text-slate-500">Operational matrix view. For maturity frameworks, the matrix displays the canonical PAM structure; assessment results live in PAM Assessment.</p></div>
          <div className="flex gap-2"><Link href="/matrix/builder" className="inline-flex h-9 items-center gap-2 bg-slate-950 px-4 text-sm font-semibold text-white">Matrix Builder <ArrowRight className="h-4 w-4" /></Link><Link href="/matrix/instances" className="inline-flex h-9 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700">Instances</Link></div>
        </header>

        <section className="grid gap-4 border border-slate-200 bg-white p-5 lg:grid-cols-[220px_1fr_auto] lg:items-end">
          <div><label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">View</label><select value={assessmentType} onChange={e => setAssessmentType(e.target.value as "control" | "pam")} className="h-10 w-full border border-slate-300 bg-white px-3 text-sm"><option value="pam">PAM / Maturity</option><option value="control">Control Based</option></select></div>
          <div><label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Framework</label><select value={standardId} onChange={e => setStandardId(e.target.value ? Number(e.target.value) : "")} className="h-10 w-full border border-slate-300 bg-white px-3 text-sm"><option value="">Select framework</option>{(assessmentType === "pam" ? maturityStandards : controlStandards).map(s => <option key={s.id} value={s.id}>{s.code} — {s.title || s.code}</option>)}</select></div>
          <button onClick={load} disabled={!standardId || loading} className="inline-flex h-10 items-center justify-center gap-2 border border-slate-300 bg-white px-5 text-sm font-medium disabled:opacity-50"><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Refresh</button>
        </section>

        {error && <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {pam && <>
          <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">{[["Framework", pam.standard.code], ["Version", pam.version.version_code], ["Model", pam.framework_model.code], ["Categories", pam.counts.categories], ["Groups", pam.counts.groups], ["Processes", pam.counts.processes]].map(([label, value]) => <div key={String(label)} className="border border-slate-200 bg-white p-4"><div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-2 font-semibold text-slate-950">{value}</div></div>)}</section>
          <section className="border border-slate-200 bg-white"><div className="border-b border-slate-200 bg-slate-50 p-5"><h2 className="font-semibold">Canonical PAM Process Dimension</h2><p className="mt-1 text-xs text-slate-500">Definition snapshot only — no capability ratings, evidence, gaps or assessment status are stored here.</p></div>{pam.categories.map(category => { const open = expanded.includes(category.id); return <div key={category.id} className="border-b border-slate-200 last:border-b-0"><button onClick={() => setExpanded(x => open ? x.filter(id => id !== category.id) : [...x, category.id])} className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-slate-50">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}<span className="font-mono text-sm font-semibold text-blue-700">{category.code}</span><span className="font-semibold">{category.name}</span><span className="ml-auto text-xs text-slate-500">{category.groups.length} groups</span></button>{open && <div className="bg-slate-50/50">{category.groups.map(group => <div key={group.id} className="border-t border-slate-100"><div className="flex items-center gap-3 px-12 py-3"><span className="font-mono text-xs font-semibold">{group.code}</span><span className="text-sm font-medium">{group.name}</span><span className="ml-auto text-xs text-slate-500">{group.processes.length} processes</span></div><div className="grid gap-2 px-12 pb-4 lg:grid-cols-2">{group.processes.map(p => <div key={p.id} className="border border-slate-200 bg-white p-4"><div className="flex items-center gap-2"><span className="font-mono text-xs font-semibold text-blue-700">{p.code}</span><span className="text-sm font-semibold">{p.name}</span></div>{p.purpose && <p className="mt-2 text-xs leading-5 text-slate-500">{p.purpose}</p>}<div className="mt-3 flex gap-2 text-[10px] text-slate-500"><span className="rounded border px-2 py-1">{p.outcomes.length} outcomes</span><span className="rounded border px-2 py-1">{p.base_practices.length} base practices</span><span className="rounded border px-2 py-1">{p.work_products.length} work products</span></div></div>)}</div></div>)}</div>}</div>; })}</section>
          <div className="flex justify-end"><Link href="/maturity/workspace" className="inline-flex items-center gap-2 border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">Open PAM Assessment Workspace <ArrowRight className="h-4 w-4" /></Link></div>
        </>}

        {assessmentType === "control" && <section className="overflow-hidden border border-slate-200 bg-white">{loading ? <div className="p-8 text-sm text-slate-500">Loading...</div> : controls.length === 0 ? <div className="p-12 text-center text-sm text-slate-500">No controls found.</div> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Clause</th><th className="px-4 py-3">Requirement</th><th className="px-4 py-3">Control</th><th className="px-4 py-3">Coverage</th><th className="px-4 py-3">Risk</th></tr></thead><tbody className="divide-y divide-slate-100">{controls.map((r, i) => <tr key={`${r.control_code}-${i}`}><td className="px-4 py-3 font-mono text-xs">{r.clause_code || "—"}</td><td className="px-4 py-3 font-mono text-xs">{r.requirement_code || "—"}</td><td className="px-4 py-3"><div className="font-mono text-xs font-semibold">{r.control_code || "—"}</div><div className="mt-1 text-xs text-slate-500">{r.control_description || "—"}</div></td><td className="px-4 py-3 text-xs">{r.coverage_status || "—"}</td><td className="px-4 py-3 text-xs">{r.risk_level || "—"}</td></tr>)}</tbody></table></div>}</section>}
      </div>
    </main>
  );
}
