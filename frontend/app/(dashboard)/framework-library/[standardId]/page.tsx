"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronDown, ChevronRight, Layers3, ShieldCheck, CheckCircle2, Plus, X } from "lucide-react";
import { apiFetch } from "../../../lib/api";

type Version = { id: number; version_code: string; status?: string | null };
type Standard = { id: number; code: string; title?: string | null; description?: string | null; type?: string | null; version?: string | null };
type Process = { id: number; code: string; title?: string | null; text?: string | null; process_area_id?: number | null };
type Group = { id: number; code: string; title?: string | null; practices?: Group[] };
type Category = { id: number; code: string; name?: string | null; description?: string | null; practices?: Group[] };
type Structure = { process_areas?: Category[]; practices?: Process[] };
type Adoption = { id: number; standard_version_id: number; status: string; applicability: string; effective_date?: string | null; process_ids: number[] };
type CompanyProcess = { id: number; code: string; name: string };

const LEVELS = [
  ["CL0", "Incomplete process"], ["CL1", "Performed process"], ["CL2", "Managed process"],
  ["CL3", "Established process"], ["CL4", "Predictable process"], ["CL5", "Optimizing process"],
] as const;
const ATTRIBUTES = [
  ["PA 1.1", "Process performance"], ["PA 2.1", "Performance management"], ["PA 2.2", "Work product management"],
  ["PA 3.1", "Process definition"], ["PA 3.2", "Process deployment"], ["PA 4.1", "Process measurement"],
  ["PA 4.2", "Process control"], ["PA 5.1", "Process innovation"], ["PA 5.2", "Process innovation implementation"],
] as const;

function statusClass(status?: string | null) {
  if (status === "published" || status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "deprecated" || status === "archived") return "border-slate-200 bg-slate-100 text-slate-500";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export default function FrameworkDetailPage() {
  const params = useParams<{ standardId: string }>();
  const standardId = Number(params.standardId);
  const [standard, setStandard] = useState<Standard | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [structure, setStructure] = useState<Structure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<number[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<number[]>([]);
  const [tab, setTab] = useState<"structure" | "adoption">("structure");
  const [adoption, setAdoption] = useState<Adoption | null>(null);
  const [companyProcesses, setCompanyProcesses] = useState<CompanyProcess[]>([]);
  const [adoptionError, setAdoptionError] = useState("");
  const [adoptionMessage, setAdoptionMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [applicability, setApplicability] = useState("APPLICABLE");
  const [effectiveDate, setEffectiveDate] = useState("");

  const selectedVersionObject = useMemo(() => versions.find(v => v.version_code === selectedVersion), [versions, selectedVersion]);
  const categories = structure?.process_areas ?? [];
  const processes = structure?.practices ?? [];
  const groupCount = categories.reduce((n, c) => n + (c.practices?.length ?? 0), 0);
  const is15504 = String(standard?.code ?? "").toUpperCase().includes("15504");

  async function loadFramework() {
    try {
      setLoading(true); setError("");
      const [s, v] = await Promise.all([apiFetch(`/framework/standards/${standardId}`), apiFetch(`/framework/standards/${standardId}/versions`)]);
      if (!s.ok || !v.ok) throw new Error("Unable to load framework.");
      const sd = await s.json(); const vd = await v.json();
      const list = Array.isArray(vd) ? vd : (vd?.versions ?? []);
      setStandard(sd); setVersions(list);
      setSelectedVersion(list.find((x: Version) => x.status === "active" || x.status === "published")?.version_code || list[0]?.version_code || "");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load framework."); }
    finally { setLoading(false); }
  }

  async function loadStructure(versionCode: string) {
    if (!versionCode) return;
    try {
      setError("");
      const r = await apiFetch(`/framework/standards/${standardId}/versions/${encodeURIComponent(versionCode)}/structure`);
      if (!r.ok) throw new Error(`Unable to load framework structure (${r.status}).`);
      setStructure(await r.json()); setExpandedCategories([]); setExpandedGroups([]);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load framework structure."); }
  }

  async function loadAdoption() {
    if (!selectedVersionObject) return;
    try {
      setAdoptionError("");
      const [a, p] = await Promise.all([apiFetch(`/framework/standards/${standardId}/adoption`), apiFetch("/company/processes")]);
      if (!a.ok || !p.ok) throw new Error("Unable to load adoption data.");
      const adoptionData = await a.json();
      const processData = await p.json();
      const match = (Array.isArray(adoptionData) ? adoptionData : []).find((x: Adoption) => x.standard_version_id === selectedVersionObject.id) || null;
      setAdoption(match); setCompanyProcesses(Array.isArray(processData) ? processData : (processData?.items ?? []));
      setApplicability(match?.applicability || "APPLICABLE"); setEffectiveDate(match?.effective_date?.slice(0, 10) || "");
    } catch (e) { setAdoptionError(e instanceof Error ? e.message : "Unable to load adoption data."); }
  }

  useEffect(() => { loadFramework(); }, [standardId]);
  useEffect(() => { if (selectedVersion) loadStructure(selectedVersion); }, [selectedVersion]);
  useEffect(() => { if (tab === "adoption") loadAdoption(); }, [tab, selectedVersionObject?.id]);

  async function createOrSaveAdoption() {
    try {
      setSaving(true); setAdoptionError(""); setAdoptionMessage("");
      const url = adoption ? `/framework/adoptions/${adoption.id}` : "/framework/adoptions";
      const method = adoption ? "PATCH" : "POST";
      const r = await apiFetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ standard_id: standardId, standard_version_id: selectedVersionObject?.id, applicability, effective_date: effectiveDate ? `${effectiveDate}T00:00:00` : null }) });
      const b = await r.json().catch(() => null); if (!r.ok) throw new Error(b?.detail || "Unable to save adoption.");
      setAdoption(b); setAdoptionMessage(adoption ? "Adoption settings saved." : "Framework adoption created.");
    } catch (e) { setAdoptionError(e instanceof Error ? e.message : "Unable to save adoption."); }
    finally { setSaving(false); }
  }

  async function toggleScope(processId: number, inScope: boolean) {
    if (!adoption) return;
    try {
      setSaving(true); setAdoptionError("");
      const r = await apiFetch(`/framework/adoptions/${adoption.id}/scope${inScope ? `/${processId}` : ""}`, inScope ? { method: "DELETE" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ process_id: processId }) });
      const b = await r.json().catch(() => null); if (!r.ok) throw new Error(b?.detail || "Unable to update scope."); setAdoption(b);
    } catch (e) { setAdoptionError(e instanceof Error ? e.message : "Unable to update scope."); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="p-8 text-sm text-slate-500">Loading framework...</div>;
  if (!standard) return <div className="p-8 text-sm text-rose-600">{error || "Framework not found."}</div>;

  return <div className="space-y-6 p-6">
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-sm font-medium text-slate-500"><Layers3 className="h-4 w-4" /> Framework Library</div><h1 className="mt-2 text-2xl font-semibold text-slate-900">{standard.title || standard.code}</h1><p className="mt-1 text-sm text-slate-500">{standard.description || "Canonical framework definition."}</p></div><div className="flex items-center gap-3"><span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusClass(selectedVersionObject?.status)}`}>{selectedVersionObject?.status || "draft"}</span><select value={selectedVersion} onChange={e => setSelectedVersion(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">{versions.map(v => <option key={v.id} value={v.version_code}>{v.version_code}</option>)}</select></div></div></div>
    <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white p-1"><button onClick={() => setTab("structure")} className={`rounded-lg px-4 py-3 text-sm font-semibold ${tab === "structure" ? "bg-slate-900 text-white" : "text-slate-700"}`}>Structure</button><button onClick={() => setTab("adoption")} className={`rounded-lg px-4 py-3 text-sm font-semibold ${tab === "adoption" ? "bg-slate-900 text-white" : "text-slate-700"}`}>Adoption</button></div>
    {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
    {tab === "structure" && <>
      <div className="grid gap-4 md:grid-cols-4"><div className="rounded-xl border bg-white p-5"><div className="text-xs uppercase tracking-wide text-slate-500">Process Categories</div><div className="mt-2 text-3xl font-semibold">{categories.length}</div></div><div className="rounded-xl border bg-white p-5"><div className="text-xs uppercase tracking-wide text-slate-500">Process Groups</div><div className="mt-2 text-3xl font-semibold">{groupCount}</div></div><div className="rounded-xl border bg-white p-5"><div className="text-xs uppercase tracking-wide text-slate-500">Processes</div><div className="mt-2 text-3xl font-semibold">{processes.length}</div></div><div className="rounded-xl border bg-white p-5"><div className="text-xs uppercase tracking-wide text-slate-500">Version</div><div className="mt-2 text-3xl font-semibold">{selectedVersionObject?.version_code || standard.version || "-"}</div></div></div>
      {is15504 && <div className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex gap-3"><ShieldCheck className="h-5 w-5 text-slate-600" /><div><h2 className="font-semibold text-slate-900">Process Assessment Model</h2><p className="mt-1 text-sm text-slate-500">Canonical ISO/IEC 15504 process dimension. Framework definition is separate from tenant assessment results.</p></div></div></div>}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-200 bg-slate-50 p-5"><h2 className="font-semibold text-slate-900">Process Dimension</h2><p className="mt-1 text-sm text-slate-500">Process Category → Process Group → PAM Process</p></div>{categories.map(category => <div key={category.id} className="border-b border-slate-200 last:border-b-0"><button onClick={() => setExpandedCategories(x => x.includes(category.id) ? x.filter(i => i !== category.id) : [...x, category.id])} className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-slate-50">{expandedCategories.includes(category.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}<span className="font-mono text-sm font-semibold text-blue-600">{category.code}</span><span className="font-semibold">{category.name}</span><span className="ml-auto text-xs text-slate-500">{category.practices?.length ?? 0} process groups</span></button>{expandedCategories.includes(category.id) && <div className="bg-slate-50/60">{(category.practices ?? []).map(group => { const groupProcesses = processes.filter(p => p.process_area_id === group.id); return <div key={group.id} className="border-t border-slate-100"><button onClick={() => setExpandedGroups(x => x.includes(group.id) ? x.filter(i => i !== group.id) : [...x, group.id])} className="flex w-full items-center gap-3 px-12 py-3 text-left hover:bg-white">{expandedGroups.includes(group.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}<span className="font-mono text-sm font-semibold text-slate-700">{group.code}</span><span className="text-sm font-medium">{group.title}</span><span className="ml-auto text-xs text-slate-500">{groupProcesses.length} processes</span></button>{expandedGroups.includes(group.id) && <div className="space-y-2 px-16 pb-4">{groupProcesses.map(process => <div key={process.id} className="rounded-lg border border-slate-200 bg-white px-4 py-3"><span className="font-mono text-xs font-semibold text-blue-600">{process.code}</span><span className="ml-3 text-sm font-medium">{process.title}</span>{process.text && <p className="mt-1 text-xs text-slate-500">{process.text}</p>}</div>)}</div>}</div>})}</div>}</div>)}</div>
      {is15504 && <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-200 bg-slate-50 p-5"><h2 className="font-semibold">Capability Dimension</h2><p className="mt-1 text-sm text-slate-500">Six capability levels and nine process attributes.</p></div><div className="grid gap-3 p-5 md:grid-cols-3">{LEVELS.map(([code, name]) => <div key={code} className="rounded-lg border border-slate-200 p-4"><span className="font-mono text-sm font-semibold text-blue-600">{code}</span><div className="mt-2 font-medium">{name}</div></div>)}</div><div className="border-t border-slate-200 p-5"><div className="mb-3 text-sm font-semibold">Process Attributes</div><div className="grid gap-2 md:grid-cols-3">{ATTRIBUTES.map(([code, name]) => <div key={code} className="rounded-lg bg-slate-50 px-3 py-2 text-xs"><span className="font-mono font-semibold">{code}</span><span className="ml-2 text-slate-600">{name}</span></div>)}</div></div></div>}
    </>}
    {tab === "adoption" && <div className="space-y-5"><div className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Framework Adoption</h2><p className="mt-1 text-sm text-slate-500">Tenant-specific adoption and organizational process scope.</p></div><div className="rounded-xl border border-slate-200 bg-white p-5"><div className="grid gap-4 md:grid-cols-3"><label className="text-sm text-slate-600">Applicability<select value={applicability} onChange={e => setApplicability(e.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2"><option value="APPLICABLE">Applicable</option><option value="PARTIALLY_APPLICABLE">Partially applicable</option><option value="NOT_APPLICABLE">Not applicable</option></select></label><label className="text-sm text-slate-600">Effective date<input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2" /></label><div className="flex items-end"><button disabled={saving} onClick={createOrSaveAdoption} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">{adoption ? "Save" : "Create Adoption"}</button></div></div>{adoption && <div className="mt-4 text-sm text-slate-600">Status: <strong>{adoption.status}</strong></div>}{adoptionMessage && <div className="mt-3 text-sm text-emerald-700"><CheckCircle2 className="mr-1 inline h-4 w-4" />{adoptionMessage}</div>}{adoptionError && <div className="mt-3 text-sm text-rose-600">{adoptionError}</div>}</div>{adoption && <div className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-semibold">Organizational Process Scope</h3><div className="mt-4 space-y-2">{companyProcesses.map(process => { const inScope = adoption.process_ids?.includes(process.id); return <div key={process.id} className="flex items-center justify-between rounded-lg border px-4 py-3"><div><div className="font-mono text-xs text-slate-500">{process.code}</div><div className="text-sm font-medium">{process.name}</div></div><button disabled={saving} onClick={() => toggleScope(process.id, inScope)} className="rounded-lg border px-3 py-1.5 text-xs font-medium">{inScope ? <><X className="mr-1 inline h-3 w-3" />Remove</> : <><Plus className="mr-1 inline h-3 w-3" />Add</>}</button></div>})}</div></div>}</div>}
  </div>;
}
