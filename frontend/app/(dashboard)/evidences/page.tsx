"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/app/lib/api";

type EvidenceListItem = {
  evidence_id: number;
  evidence_title: string;
  status: string;
  files_count: number;
  related_risks_count: number;
  coverage?: string | null;
  coverage_status?: string | null;
  standard?: { code?: string | null; title?: string | null } | null;
  requirement?: { code?: string | null; title?: string | null } | null;
  control?: { code?: string | null; title?: string | null } | null;
};

type EvidencePagedResponse = { items: EvidenceListItem[]; total: number; page: number; page_size: number };

function statusClass(value?: string | null) {
  const v = (value || "").toLowerCase();
  if (v === "approved" || v === "achieved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (v === "waiting_approval" || v === "partially_achieved") return "border-amber-200 bg-amber-50 text-amber-700";
  if (v === "rejected") return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function Badge({ value }: { value?: string | null }) {
  const text = value || "—";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(value)}`}>{text.replaceAll("_", " ")}</span>;
}

export default function EvidencesPage() {
  const router = useRouter();
  const [items, setItems] = useState<EvidenceListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const pageSize = 20;

  async function load() {
    setLoading(true); setErr(null);
    try {
      const res = await apiFetch(`/company/evidences/?page=${page}&page_size=${pageSize}`, { method: "GET" });
      if (!res.ok) throw new Error((await res.text()) || "Failed to load evidences");
      const json = (await res.json()) as EvidencePagedResponse;
      setItems(json.items || []); setTotal(json.total || 0);
    } catch (e: any) { setErr(e?.message || "Failed to load evidences"); setItems([]); setTotal(0); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((it) => {
      if (statusFilter && (it.status || "").toLowerCase() !== statusFilter) return false;
      if (!needle) return true;
      return [it.evidence_title, it.standard?.code, it.standard?.title, it.requirement?.code, it.requirement?.title, it.control?.code, it.control?.title]
        .filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [items, q, statusFilter]);

  const approved = filtered.filter((x) => x.status?.toLowerCase() === "approved").length;
  const pending = filtered.filter((x) => x.status?.toLowerCase() === "waiting_approval").length;
  const orphan = filtered.filter((x) => !x.related_risks_count).length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="min-h-full bg-slate-50 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-blue-600">Evidence Intelligence</div>
            <h1 className="mt-1 text-2xl font-semibold">Evidence Library</h1>
            <p className="mt-1 text-sm text-slate-500">Controlled evidence register with approval, versioning, coverage and risk linkage.</p>
          </div>
          <button onClick={() => router.push("/evidences/create")} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">+ Create Evidence</button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Total Evidence" value={total} />
          <Kpi label="Approved" value={approved} />
          <Kpi label="Pending Review" value={pending} />
          <Kpi label="Without Risk Link" value={orphan} />
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row">
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search evidence, standard, requirement or control..." className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500">
              <option value="">All Status</option><option value="draft">Draft</option><option value="uploaded">Uploaded</option><option value="waiting_approval">Pending Review</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
            </select>
            <button onClick={load} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Refresh</button>
          </div>
        </section>

        {err && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>{["Evidence","Standard","Requirement","Control","Status","Coverage","Files","Risks","Action"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500">Loading evidence...</td></tr>}
                {!loading && filtered.length === 0 && <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">No evidence found.</td></tr>}
                {!loading && filtered.map((r) => (
                  <tr key={r.evidence_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">{r.evidence_title}</td>
                    <td className="px-4 py-3 text-slate-600">{r.standard?.code || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{r.requirement?.code || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{r.control?.code || "—"}</td>
                    <td className="px-4 py-3"><Badge value={r.status} /></td>
                    <td className="px-4 py-3"><Badge value={r.coverage_status || r.coverage} /></td>
                    <td className="px-4 py-3 font-medium">{r.files_count ?? 0}</td>
                    <td className="px-4 py-3 font-medium">{r.related_risks_count ?? 0}</td>
                    <td className="px-4 py-3"><button onClick={() => router.push(`/evidences/${r.evidence_id}`)} className="text-sm font-semibold text-blue-600 hover:text-blue-800">Open →</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
            <span>Page {page} of {pageCount}</span>
            <div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 disabled:opacity-40">Previous</button><button disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 disabled:opacity-40">Next</button></div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div></div>;
}
