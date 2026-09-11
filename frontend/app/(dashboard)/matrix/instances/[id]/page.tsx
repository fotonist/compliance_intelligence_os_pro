"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, Layers3 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/app/lib/api";

type Row = { id: number; row_key: string; category_id?: number; group_id?: number; pam_process_id?: number; payload: any };
type Instance = { id: number; status: string; standard_code?: string; standard_version_code?: string; framework_model?: { code: string; name: string } | null; framework_adoption_id?: number | null; row_count: number; created_at: string };

export default function MatrixInstanceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params?.id ?? "");
  const [item, setItem] = useState<Instance | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<number[]>([]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [a, b] = await Promise.all([apiFetch(`/matrix/pam/instances/${id}`), apiFetch(`/matrix/pam/instances/${id}/rows?limit=500&offset=0`)]);
        const ad = await a.json(); const bd = await b.json();
        if (!a.ok) throw new Error(ad?.detail || "Matrix instance could not be loaded.");
        setItem(ad); setRows(Array.isArray(bd?.items) ? bd.items : []);
      } catch (e) { setError(e instanceof Error ? e.message : "Matrix instance could not be loaded."); }
    })();
  }, [id]);

  const grouped = rows.reduce<Record<string, Row[]>>((acc, row) => {
    const key = `${row.payload?.category_code || "OTHER"}|${row.payload?.category_name || "Other"}`;
    (acc[key] ||= []).push(row);
    return acc;
  }, {});

  return (
    <main className="min-h-full bg-slate-50 px-6 py-7 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><Layers3 className="h-4 w-4" /> Matrix Instance</div><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Instance #{id}</h1><p className="mt-1 text-sm text-slate-500">Canonical PAM structure snapshot. Assessment results remain in PAM Assessment execution.</p></div>
          <button onClick={() => router.back()} className="inline-flex h-9 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700"><ArrowLeft className="h-4 w-4" /> Back</button>
        </header>
        {error && <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {item && <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-5"><div className="border border-slate-200 bg-white p-4"><div className="text-[10px] font-semibold uppercase text-slate-500">Framework</div><div className="mt-2 font-mono font-semibold text-blue-700">{item.standard_code}</div></div><div className="border border-slate-200 bg-white p-4"><div className="text-[10px] font-semibold uppercase text-slate-500">Version</div><div className="mt-2 font-semibold">{item.standard_version_code || "—"}</div></div><div className="border border-slate-200 bg-white p-4"><div className="text-[10px] font-semibold uppercase text-slate-500">Model</div><div className="mt-2 font-semibold">{item.framework_model?.code || "PAM"}</div></div><div className="border border-slate-200 bg-white p-4"><div className="text-[10px] font-semibold uppercase text-slate-500">Rows</div><div className="mt-2 text-2xl font-semibold">{item.row_count}</div></div><div className="border border-slate-200 bg-white p-4"><div className="text-[10px] font-semibold uppercase text-slate-500">Lifecycle</div><div className="mt-2 font-semibold">{item.status}</div></div></section>}

        <section className="border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 p-5"><h2 className="font-semibold text-slate-950">PAM Process Dimension Snapshot</h2><p className="mt-1 text-xs text-slate-500">Process Category → Process Group → PAM Process</p></div>
          {Object.entries(grouped).map(([key, categoryRows]) => { const cid = categoryRows[0]?.category_id || 0; const open = expanded.includes(cid); return <div key={key} className="border-b border-slate-200 last:border-b-0"><button onClick={() => setExpanded(x => x.includes(cid) ? x.filter(v => v !== cid) : [...x, cid])} className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-slate-50">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}<span className="font-mono text-sm font-semibold text-blue-700">{categoryRows[0]?.payload?.category_code}</span><span className="font-semibold">{categoryRows[0]?.payload?.category_name}</span><span className="ml-auto text-xs text-slate-500">{categoryRows.length} processes</span></button>{open && <div className="bg-slate-50/50">{categoryRows.map(row => <div key={row.id} className="border-t border-slate-100 px-12 py-4"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-semibold text-slate-700">{row.payload?.group_code}</span><span className="text-xs text-slate-500">{row.payload?.group_name}</span><span className="font-mono text-sm font-semibold text-slate-950">{row.payload?.code}</span><span className="text-sm font-medium">{row.payload?.name}</span></div>{row.payload?.purpose && <p className="mt-2 max-w-4xl text-xs leading-5 text-slate-500">{row.payload.purpose}</p>}<div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-500"><span className="rounded border bg-white px-2 py-1">{row.payload?.outcomes?.length || 0} outcomes</span><span className="rounded border bg-white px-2 py-1">{row.payload?.base_practices?.length || 0} base practices</span><span className="rounded border bg-white px-2 py-1">{row.payload?.work_products?.length || 0} work products</span></div></div>)}</div>}</div>; })}
        </section>
        <div className="flex justify-end"><Link href="/maturity/workspace" className="border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">Open PAM Assessment Workspace</Link></div>
      </div>
    </main>
  );
}
