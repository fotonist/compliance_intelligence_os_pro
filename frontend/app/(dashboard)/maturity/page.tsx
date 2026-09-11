"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ClipboardCheck, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/api";

type Adoption = { id: number; standard_id: number; standard_version_id: number; status: string; applicability: string; };
type Standard = { id: number; code: string; title?: string | null; type?: string | null };
type Assessment = { id: number; name: string; scope?: string | null; status: string; standard_code?: string | null; process_count: number; created_at: string; framework_adoption_id: number };

export default function MaturityAssessmentsPage() {
  const [standards, setStandards] = useState<Standard[]>([]);
  const [adoptions, setAdoptions] = useState<Adoption[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [standardId, setStandardId] = useState<number | "">("");
  const [adoptionId, setAdoptionId] = useState<number | "">("");
  const [name, setName] = useState("");
  const [scope, setScope] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const [s, a, p] = await Promise.all([apiFetch("/framework/standards"), apiFetch("/framework/adoptions?status=ACTIVE"), apiFetch("/maturity/assessments")]);
      const sd = await s.json(); const ad = await a.json(); const pd = await p.json();
      if (!s.ok || !a.ok || !p.ok) throw new Error("PAM assessment data could not be loaded.");
      const standardList = (Array.isArray(sd) ? sd : []).filter((x: Standard) => String(x.type ?? "").toUpperCase() === "MATURITY_BASED");
      const adoptionList = Array.isArray(ad) ? ad : [];
      setStandards(standardList); setAdoptions(adoptionList); setAssessments(Array.isArray(pd?.items) ? pd.items : []);
      if (!adoptionId && adoptionList[0]) { setAdoptionId(adoptionList[0].id); setStandardId(adoptionList[0].standard_id); }
    } catch (e) { setError(e instanceof Error ? e.message : "PAM assessment data could not be loaded."); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const selectedAdoption = adoptions.find(a => a.id === adoptionId);

  async function createAssessment() {
    if (!adoptionId || !name.trim()) return;
    setCreating(true); setError("");
    try {
      const r = await apiFetch("/maturity/assessments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ framework_adoption_id: adoptionId, name: name.trim(), scope: scope.trim() || null }) });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.detail || "Assessment could not be created.");
      setName(""); setScope(""); setShowCreate(false); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Assessment could not be created."); }
    finally { setCreating(false); }
  }

  return (
    <main className="min-h-full bg-slate-50 px-6 py-7 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><ClipboardCheck className="h-4 w-4" /> PAM Assessment</div><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Maturity Assessments</h1><p className="mt-1 text-sm text-slate-500">Execute capability assessments against the adopted canonical Process Assessment Model.</p></div><div className="flex gap-2"><Link href="/matrix" className="border border-slate-300 bg-white px-4 py-2 text-sm font-medium">Compliance Matrix</Link><button onClick={() => setShowCreate(true)} disabled={!adoptions.length} className="inline-flex items-center gap-2 bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"><Plus className="h-4 w-4" /> New Assessment</button></div></header>
        {error && <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {showCreate && <section className="border border-slate-200 bg-white p-5"><div className="grid gap-4 lg:grid-cols-3"><div><label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Active Adoption</label><select value={adoptionId} onChange={e => { const id = Number(e.target.value); setAdoptionId(id); setStandardId(adoptions.find(a => a.id === id)?.standard_id ?? ""); }} className="h-10 w-full border border-slate-300 px-3 text-sm">{adoptions.map(a => { const s = standards.find(x => x.id === a.standard_id); return <option key={a.id} value={a.id}>{s?.code || `Standard #${a.standard_id}`} — adoption #{a.id}</option>; })}</select></div><div><label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Assessment Name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Assessment name" className="h-10 w-full border border-slate-300 px-3 text-sm" /></div><div><label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Scope</label><input value={scope} onChange={e => setScope(e.target.value)} placeholder="Optional scope" className="h-10 w-full border border-slate-300 px-3 text-sm" /></div></div><div className="mt-4 flex justify-end gap-2"><button onClick={() => setShowCreate(false)} className="border border-slate-300 bg-white px-4 py-2 text-sm">Cancel</button><button onClick={createAssessment} disabled={creating || !name.trim() || !selectedAdoption} className="bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{creating ? "Creating..." : "Create Assessment"}</button></div></section>}
        <section className="grid gap-4 md:grid-cols-3"><div className="border border-slate-200 bg-white p-5"><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Assessments</div><div className="mt-2 text-3xl font-semibold">{assessments.length}</div></div><div className="border border-slate-200 bg-white p-5"><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Active Adoptions</div><div className="mt-2 text-3xl font-semibold">{adoptions.length}</div></div><div className="border border-slate-200 bg-white p-5"><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Execution Model</div><div className="mt-2 text-lg font-semibold">Canonical PAM</div></div></section>
        <section className="border border-slate-200 bg-white">{loading ? <div className="p-8 text-sm text-slate-500">Loading assessments...</div> : assessments.length === 0 ? <div className="p-12 text-center text-sm text-slate-500">No PAM assessments have been created yet.</div> : <div className="divide-y divide-slate-100">{assessments.map(a => <Link key={a.id} href={`/maturity/workspace/${a.id}`} className="grid gap-4 px-5 py-5 hover:bg-slate-50 lg:grid-cols-[1fr_auto_auto_auto] lg:items-center"><div><div className="font-semibold text-slate-950">{a.name}</div><div className="mt-1 text-xs text-slate-500">{a.standard_code || "PAM"} · adoption #{a.framework_adoption_id}</div></div><div className="text-xs text-slate-500">{a.process_count} processes</div><span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold">{a.status}</span><ArrowRight className="h-4 w-4 text-slate-400" /></Link>)}</div>}</section>
      </div>
    </main>
  );
}
