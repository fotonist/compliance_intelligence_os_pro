"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/app/lib/api";

type EvidenceListItem = {
  evidence_id: number;
  evidence_title: string;
  status: string;
  files_count: number;
  related_risks_count: number;
  task_ids?: number[];
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
  const text = value || "Ã¢â‚¬â€";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(value)}`}>{text.replaceAll("_", " ")}</span>;
}

function EvidencesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const taskIdParam = searchParams.get("task_id");
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
      const taskQuery = taskIdParam ? `&task_id=${encodeURIComponent(taskIdParam)}` : "";
      const res = await apiFetch(`/company/evidences/?page=${page}&page_size=${pageSize}${taskQuery}`, { method: "GET" });
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
    <div className="min-h-full bg-[#f7f9fc] px-6 py-8 text-slate-950">
      <div className="mx-auto max-w-[1440px] space-y-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-600">Evidence Intelligence</div>
            <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-slate-950">Evidence Library</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Controlled evidence register with approval, versioning, coverage and risk linkage.</p>
          </div>
          <button onClick={() => router.push("/evidences/create")} className="inline-flex items-center justify-center rounded-xl bg-[#0f9fb5] px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-[#0f9fb5]/20 transition hover:bg-[#0b8799] focus:outline-none focus:ring-4 focus:ring-[#0f9fb5]/15">+ Create Evidence</button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Total Evidence" value={total} />
          <Kpi label="Approved" value={approved} />
          <Kpi label="Pending Review" value={pending} />
          <Kpi label="Unlinked Evidence" value={orphan} />
        </div>

        <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search evidence, standard, requirement or control..." className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10" />
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10">
              <option value="">All Status</option><option value="draft">Draft</option><option value="uploaded">Uploaded</option><option value="waiting_approval">Pending Review</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
            </select>
            <button onClick={load} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">Refresh</button>
          </div>
        </section>

        {err && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{err}</div>}

        <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                <tr>{["Evidence","Task","Standard","Requirement","Control","Status","Coverage","Files","Risks","Action"].map((h) => <th key={h} className="px-5 py-3.5">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-500">Loading evidence...</td></tr>}
                {!loading && filtered.length === 0 && <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-500">No evidence found.</td></tr>}
                {!loading && filtered.map((r) => (
                  <tr key={r.evidence_id} className="transition-colors hover:bg-slate-50/70">
                    <td className="px-5 py-4 font-semibold text-slate-950">{r.evidence_title}</td>
                    <td className="px-5 py-4">
                      {(r.task_ids || []).length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {(r.task_ids || []).map((taskId) => (
                            <button
                              key={taskId}
                              type="button"
                              onClick={() => router.push(`/company/tasks/${taskId}`)}
                              className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                            >
                              TASK-{taskId}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">Unlinked</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{r.standard?.code || "Ã¢â‚¬â€"}</td>
                    <td className="px-5 py-4 text-slate-600">{r.requirement?.code || "Ã¢â‚¬â€"}</td>
                    <td className="px-5 py-4 text-slate-600">{r.control?.code || "Ã¢â‚¬â€"}</td>
                    <td className="px-5 py-3.5"><Badge value={r.status} /></td>
                    <td className="px-5 py-3.5"><Badge value={r.coverage_status || r.coverage} /></td>
                    <td className="px-5 py-4 font-semibold text-slate-800">{r.files_count ?? 0}</td>
                    <td className="px-5 py-4 font-semibold text-slate-800">{r.related_risks_count ?? 0}</td>
                    <td className="px-5 py-3.5"><button onClick={() => router.push(`/evidences/${r.evidence_id}`)} className="inline-flex items-center rounded-lg px-2.5 py-1.5 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 hover:text-blue-800">Open â†’</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-5 py-4 text-sm text-slate-500">
            <span>Page {page} of {pageCount}</span>
            <div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Previous</button><button disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next</button></div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div></div>;
}
export default function EvidencesPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
        Loading evidence library...
      </div>
    }>
      <EvidencesPageContent />
    </Suspense>
  );
}
