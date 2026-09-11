"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, CheckCircle2, Layers3, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/app/lib/api";

type Instance = {
  id: number;
  standard_id: number;
  standard_code?: string | null;
  standard_version_id: number;
  standard_version_code?: string | null;
  status: string;
  framework_model?: { id: number; code: string; name: string } | null;
  framework_adoption_id?: number | null;
  created_at: string;
};

function statusClass(status: string) {
  const value = status.toUpperCase();
  if (value === "APPROVED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value === "SUBMITTED") return "border-blue-200 bg-blue-50 text-blue-700";
  if (value === "IN_PROGRESS") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function MatrixInstancesClient() {
  const params = useSearchParams();
  const standardId = params.get("standard_id");
  const [items, setItems] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const query = standardId ? `?standard_id=${encodeURIComponent(standardId)}` : "";
      const r = await apiFetch(`/matrix/pam/instances${query}`);
      const body = await r.json();
      if (!r.ok) throw new Error(body?.detail || "Matrix instances could not be loaded.");
      setItems(Array.isArray(body?.items) ? body.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Matrix instances could not be loaded.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [standardId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => [item.id, item.standard_code, item.standard_version_code, item.framework_model?.code, item.status].join(" ").toLowerCase().includes(q));
  }, [items, search]);

  const approved = items.filter((x) => x.status.toUpperCase() === "APPROVED").length;
  const active = items.filter((x) => ["GENERATED", "IN_PROGRESS"].includes(x.status.toUpperCase())).length;

  return (
    <main className="min-h-full bg-slate-50 px-6 py-7 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"><Layers3 className="h-4 w-4" /> Compliance Management</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Matrix Instances</h1>
            <p className="mt-1 text-sm text-slate-500">Tenant-owned structural snapshots of the adopted canonical PAM.</p>
          </div>
          <div className="flex gap-2"><Link href="/matrix" className="inline-flex h-9 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700"><ArrowLeft className="h-4 w-4" /> Matrix</Link><button onClick={load} disabled={loading} className="inline-flex h-9 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700"><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Refresh</button></div>
        </header>

        <section className="grid gap-4 md:grid-cols-3"><div className="border border-slate-200 bg-white p-5"><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total Instances</div><div className="mt-2 text-3xl font-semibold">{items.length}</div></div><div className="border border-slate-200 bg-white p-5"><div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500"><Activity className="h-4 w-4" /> Active</div><div className="mt-2 text-3xl font-semibold">{active}</div></div><div className="border border-slate-200 bg-white p-5"><div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500"><CheckCircle2 className="h-4 w-4" /> Approved</div><div className="mt-2 text-3xl font-semibold">{approved}</div></div></section>

        {error && <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <section className="border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 p-4"><div className="relative max-w-xl"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search instance, framework, version or status" className="h-10 w-full border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-slate-500" /></div></div>
          {loading ? <div className="p-8 text-sm text-slate-500">Loading instances...</div> : filtered.length === 0 ? <div className="p-12 text-center text-sm text-slate-500">No canonical PAM matrix instances found.</div> : <div className="divide-y divide-slate-100">
            {filtered.map((item) => <Link key={item.id} href={`/matrix/instances/${item.id}`} className="grid gap-4 px-5 py-5 hover:bg-slate-50 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-center">
              <div><div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Instance</div><div className="mt-1 font-semibold text-slate-950">#{item.id}</div><div className="mt-0.5 text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</div></div>
              <div><div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Framework</div><div className="mt-1 font-mono text-sm font-semibold text-blue-700">{item.standard_code || "—"}</div><div className="mt-0.5 text-xs text-slate-500">{item.framework_model?.code || "PAM"}</div></div>
              <div><div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Version</div><div className="mt-1 text-sm font-semibold text-slate-900">{item.standard_version_code || `#${item.standard_version_id}`}</div><div className="mt-0.5 text-xs text-slate-500">Adoption #{item.framework_adoption_id ?? "—"}</div></div>
              <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(item.status)}`}>{item.status}</span>
            </Link>)}
          </div>}
        </section>
      </div>
    </main>
  );
}
