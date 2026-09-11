"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, Layers3, Play, RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/api";

type Standard = { id: number; code: string; title?: string | null; type?: string | null };
type Process = { id: number; code: string; name: string; purpose?: string | null; description?: string | null; group_id: number; group_code: string; group_name: string; category_id: number; category_code: string; category_name: string };
type Group = { id: number; code: string; name: string; description?: string | null; processes: Process[] };
type Category = { id: number; code: string; name: string; description?: string | null; groups: Group[] };
type PamResponse = {
  standard: { id: number; code: string; title?: string | null };
  version: { id: number; version_code: string; status: string };
  framework_model: { id: number; code: string; name: string; model_type: string };
  reference_model?: { id: number; code: string; name: string; model_type: string } | null;
  capability_measurement_framework?: { id: number; code: string; name: string; model_type: string } | null;
  adoption?: { id: number; status: string } | null;
  categories: Category[];
  counts: { categories: number; groups: number; processes: number };
};

export default function MatrixBuilderPage() {
  const [standards, setStandards] = useState<Standard[]>([]);
  const [standardId, setStandardId] = useState<number | "">("");
  const [versions, setVersions] = useState<any[]>([]);
  const [versionId, setVersionId] = useState<number | "">("");
  const [data, setData] = useState<PamResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStandards, setLoadingStandards] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState<number[]>([]);

  const maturityStandards = useMemo(
    () => standards.filter((s) => String(s.type ?? "").toUpperCase() === "MATURITY_BASED"),
    [standards]
  );

  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch("/framework/standards");
        const body = await r.json();
        setStandards(Array.isArray(body) ? body : []);
      } catch {
        setError("Frameworks could not be loaded.");
      } finally {
        setLoadingStandards(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!standardId) {
      setVersions([]);
      setVersionId("");
      setData(null);
      return;
    }
    (async () => {
      try {
        const r = await apiFetch(`/framework/standards/${standardId}/versions`);
        const body = await r.json();
        const list = Array.isArray(body) ? body : [];
        setVersions(list);
        const preferred = list.find((v: any) => ["active", "published", "draft"].includes(String(v.status).toLowerCase())) ?? list[0];
        setVersionId(preferred?.id ?? "");
      } catch {
        setVersions([]);
        setVersionId("");
      }
    })();
  }, [standardId]);

  async function loadPam() {
    if (!standardId || !versionId) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const r = await apiFetch(`/matrix/pam?standard_id=${standardId}&standard_version_id=${versionId}`);
      const body = await r.json();
      if (!r.ok) throw new Error(body?.detail || "Canonical PAM could not be loaded.");
      setData(body);
      setExpanded(body.categories?.map((c: Category) => c.id) ?? []);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Canonical PAM could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function generate() {
    if (!standardId || !versionId) return;
    setGenerating(true);
    setError("");
    setMessage("");
    try {
      const r = await apiFetch("/matrix/pam/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ standard_id: standardId, standard_version_id: versionId }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.detail || "Matrix generation failed.");
      setMessage(`Matrix instance #${body.matrix_instance_id} generated with ${body.row_count} PAM processes.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Matrix generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="min-h-full bg-slate-50 px-6 py-7 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"><Layers3 className="h-4 w-4" /> Compliance Management</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Matrix Builder</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">Build a structural matrix snapshot from the canonical Process Assessment Model. Assessment results are not stored in the matrix.</p>
          </div>
          <Link href="/matrix" className="inline-flex h-9 items-center justify-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700"><ArrowLeft className="h-4 w-4" /> Compliance Matrix</Link>
        </header>

        <section className="grid gap-4 border border-slate-200 bg-white p-5 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <div><label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Framework</label><select value={standardId} onChange={(e) => setStandardId(e.target.value ? Number(e.target.value) : "")} className="h-10 w-full border border-slate-300 bg-white px-3 text-sm"><option value="">Select maturity framework</option>{maturityStandards.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.title || s.code}</option>)}</select></div>
          <div><label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Framework Version</label><select value={versionId} onChange={(e) => setVersionId(e.target.value ? Number(e.target.value) : "")} disabled={!versions.length} className="h-10 w-full border border-slate-300 bg-white px-3 text-sm"><option value="">Select version</option>{versions.map((v) => <option key={v.id} value={v.id}>{v.version_code} — {v.status}</option>)}</select></div>
          <button onClick={loadPam} disabled={!standardId || !versionId || loading} className="inline-flex h-10 items-center justify-center gap-2 bg-slate-950 px-5 text-sm font-semibold text-white disabled:opacity-50"><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Load PAM</button>
        </section>

        {error && <div className="flex items-start gap-2 border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
        {message && <div className="flex items-start gap-2 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{message}</div>}

        {data && <>
          <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            {[['Categories', data.counts.categories], ['Groups', data.counts.groups], ['Processes', data.counts.processes], ['PAM', data.framework_model.code], ['Reference Model', data.reference_model?.code || 'Not configured'], ['CMF', data.capability_measurement_framework?.code || 'Not configured']].map(([label, value]) => <div key={String(label)} className="border border-slate-200 bg-white p-4"><div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-2 text-lg font-semibold text-slate-950">{value}</div></div>)}
          </section>

          <section className="border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div><h2 className="font-semibold text-slate-950">Canonical PAM Structure</h2><p className="mt-1 text-xs text-slate-500">Process Category → Process Group → PAM Process</p></div>
              <div className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4" /> {data.adoption ? `Active adoption #${data.adoption.id}` : "No active adoption"}</div>
            </div>
            {data.categories.map((category) => <div key={category.id} className="border-b border-slate-200 last:border-b-0">
              <button onClick={() => setExpanded((x) => x.includes(category.id) ? x.filter((id) => id !== category.id) : [...x, category.id])} className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-slate-50"><span>{expanded.includes(category.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span><span className="font-mono text-sm font-semibold text-blue-700">{category.code}</span><span className="font-semibold">{category.name}</span><span className="ml-auto text-xs text-slate-500">{category.groups.length} groups</span></button>
              {expanded.includes(category.id) && <div className="bg-slate-50/60">{category.groups.map((group) => <div key={group.id} className="border-t border-slate-100">
                <div className="flex items-center gap-3 px-12 py-3"><span className="font-mono text-xs font-semibold text-slate-700">{group.code}</span><span className="text-sm font-medium">{group.name}</span><span className="ml-auto text-xs text-slate-500">{group.processes.length} processes</span></div>
                <div className="grid gap-2 px-12 pb-4 lg:grid-cols-2">{group.processes.map((process) => <div key={process.id} className="border border-slate-200 bg-white p-4"><div className="flex items-center gap-2"><span className="font-mono text-xs font-semibold text-blue-700">{process.code}</span><span className="text-sm font-semibold text-slate-900">{process.name}</span></div>{process.purpose && <p className="mt-2 text-xs leading-5 text-slate-500">{process.purpose}</p>}</div>)}</div>
              </div>)}</div>}
            </div>)}
          </section>

          <div className="flex justify-end"><button onClick={generate} disabled={generating || !data.adoption} className="inline-flex h-10 items-center gap-2 bg-slate-950 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"><Play className="h-4 w-4" />{generating ? "Generating..." : "Generate Matrix Instance"}</button></div>
        </>}
      </div>
    </main>
  );
}
