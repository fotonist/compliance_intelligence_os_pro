"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = "https://compliance-intelligence-os-pro-2.onrender.com";

type Standard = {
  id: number;
  code: string;
  title?: string | null;
  type?: string | null;
  version?: string | null;
  status?: string | null;
};

type MatrixSummary = { controls: number; ready: boolean };

const assessmentLabel = (type?: string | null) => type === "MATURITY_BASED" ? "Maturity-Based" : "Control-Based";
const statusLabel = (status?: string | null) => status === "published" ? "Active" : status === "archived" ? "Archived" : "Draft";
const statusClass = (status?: string | null) => status === "published" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : status === "archived" ? "bg-slate-100 text-slate-500 border border-slate-200" : "bg-amber-50 text-amber-700 border border-amber-200";

export default function StandardsPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [items, setItems] = useState<Standard[]>([]);
  const [matrixSummary, setMatrixSummary] = useState<Record<number, MatrixSummary>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"CONTROL_BASED" | "MATURITY_BASED">("CONTROL_BASED");
  const [version, setVersion] = useState("");
  const [activateStandard, setActivateStandard] = useState<Standard | null>(null);
  const [activating, setActivating] = useState(false);

  useEffect(() => setToken(localStorage.getItem("access_token") || localStorage.getItem("token") || ""), []);

  async function loadMatrixSummary(standards: Standard[]) {
    if (!token) return;
    const results: Record<number, MatrixSummary> = {};
    await Promise.all(standards.map(async (standard) => {
      try {
        const res = await fetch(`${API_BASE}/matrix?standard_id=${standard.id}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const data = await res.json();
        const rows = Array.isArray(data?.rows) ? data.rows : [];
        results[standard.id] = { controls: rows.filter((row: any) => row?.control_id != null).length, ready: rows.length > 0 };
      } catch {}
    }));
    setMatrixSummary(results);
  }

  async function loadStandards() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/standards/`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const standards = Array.isArray(data) ? data : [];
      setItems(standards);
      setPage(1);
      await loadMatrixSummary(standards);
    } catch (e: any) {
      setError(e.message || "Failed to load standards");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStandards(); }, [token]);

  async function createStandard() {
    if (!code.trim()) { alert("Code is required"); return; }
    try {
      const res = await fetch(`${API_BASE}/standards/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code, title, type, version }),
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      setOpen(false); setCode(""); setTitle(""); setVersion(""); setType("CONTROL_BASED");
      await loadStandards();
    } catch (e: any) { alert(e.message || "Create failed"); }
  }

  async function activateSelectedStandard() {
    if (!activateStandard) return;
    setActivating(true);
    try {
      const res = await fetch(`${API_BASE}/standards/${activateStandard.id}/publish`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      setActivateStandard(null);
      await loadStandards();
    } catch (e: any) { alert(e.message || "Activation failed"); }
    finally { setActivating(false); }
  }

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const pagedItems = useMemo(() => items.slice((page - 1) * pageSize, page * pageSize), [items, page]);

  return (
    <div className="min-h-full bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-7 flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Standards</h1>
            <p className="mt-1 text-sm text-slate-500">Manage compliance standards, versions and organizational applicability.</p>
          </div>
          <button onClick={() => setOpen(true)} className="shrink-0 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-800">+ Add Standard</button>
        </div>

        {loading && <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500 shadow-sm">Loading standards…</div>}
        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">Error: {error}</div>}

        {!loading && !error && <>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50"><tr>
                  <th className="px-5 py-4 text-left font-semibold text-slate-700">Standard</th>
                  <th className="px-5 py-4 text-left font-semibold text-slate-700">Version</th>
                  <th className="px-5 py-4 text-left font-semibold text-slate-700">Assessment Model</th>
                  <th className="px-5 py-4 text-left font-semibold text-slate-700">Status</th>
                  <th className="px-5 py-4 text-center font-semibold text-slate-700">Controls</th>
                  <th className="px-5 py-4 text-left font-semibold text-slate-700">Scope</th>
                  <th className="px-5 py-4 text-right font-semibold text-slate-700">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedItems.map((standard) => {
                    const summary = matrixSummary[standard.id];
                    const isDraft = standard.status !== "published" && standard.status !== "archived";
                    return <tr key={standard.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-5"><div className="font-semibold text-slate-900">{standard.title || standard.code}</div><div className="mt-1 text-xs text-slate-500">{standard.code}</div></td>
                      <td className="px-5 py-5 font-medium text-slate-700">{standard.version || "—"}</td>
                      <td className="px-5 py-5"><span className="inline-flex rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{assessmentLabel(standard.type)}</span></td>
                      <td className="px-5 py-5"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(standard.status)}`}>{statusLabel(standard.status)}</span></td>
                      <td className="px-5 py-5 text-center font-semibold text-slate-800">{summary?.controls ?? "—"}</td>
                      <td className="px-5 py-5"><div className="text-sm text-slate-600">Not defined</div><div className="mt-1 text-xs text-slate-400">Organizational scope</div></td>
                      <td className="px-5 py-5"><div className="flex justify-end gap-2">
                        <button onClick={() => router.push(`/standards/${standard.id}/setup`)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">Open Setup</button>
                        <button onClick={() => router.push(`/matrix/builder?standard_id=${standard.id}`)} disabled={!isDraft} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">{summary?.ready ? "View Matrix" : "Build Matrix"}</button>
                        {isDraft && <button onClick={() => setActivateStandard(standard)} disabled={!summary?.ready} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400" title={!summary?.ready ? "Build the compliance matrix before activation" : "Activate this standard"}>Activate</button>}
                      </div></td>
                    </tr>;
                  })}
                  {pagedItems.length === 0 && <tr><td colSpan={7} className="px-5 py-14 text-center text-sm text-slate-500">No standards found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-slate-500"><span>Page {page} / {totalPages}</span><div className="flex gap-2"><button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 disabled:opacity-40">Prev</button><button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 disabled:opacity-40">Next</button></div></div>
        </>}
      </div>

      {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"><div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <h2 className="text-xl font-semibold text-slate-900">Create New Standard</h2><p className="mt-1 text-sm text-slate-500">Create the standard definition first. Matrix and activation are completed during setup.</p>
        <div className="mt-6 space-y-5">
          <div><label className="mb-1.5 block text-sm font-medium text-slate-700">Code *</label><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ISO27001" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" /></div>
          <div><label className="mb-1.5 block text-sm font-medium text-slate-700">Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ISO/IEC 27001" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" /></div>
          <div><label className="mb-1.5 block text-sm font-medium text-slate-700">Assessment Model</label><select value={type} onChange={(e) => setType(e.target.value as "CONTROL_BASED" | "MATURITY_BASED")} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"><option value="CONTROL_BASED">Control-Based</option><option value="MATURITY_BASED">Maturity-Based</option></select></div>
          <div><label className="mb-1.5 block text-sm font-medium text-slate-700">Version</label><input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="2022" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" /></div>
        </div>
        <div className="mt-7 flex justify-end gap-3"><button onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button><button onClick={createStandard} className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-800">Create Standard</button></div>
      </div></div>}

      {activateStandard && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"><div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Standard Activation</div><h2 className="mt-1 text-xl font-semibold text-slate-900">Activate {activateStandard.title || activateStandard.code}</h2><p className="mt-1 text-sm text-slate-500">Publish the configured version so it becomes the active compliance standard.</p>
        <div className="mt-6 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm"><div><div className="text-xs text-slate-500">Standard</div><div className="mt-1 font-medium">{activateStandard.code}</div></div><div><div className="text-xs text-slate-500">Version</div><div className="mt-1 font-medium">{activateStandard.version || "—"}</div></div><div><div className="text-xs text-slate-500">Assessment Model</div><div className="mt-1 font-medium">{assessmentLabel(activateStandard.type)}</div></div><div><div className="text-xs text-slate-500">Controls</div><div className="mt-1 font-medium">{matrixSummary[activateStandard.id]?.controls ?? "—"}</div></div></div>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Organizational scope is not defined in the current standard setup contract. Activation publishes the configured version; scope management remains a separate setup step.</div>
        <div className="mt-7 flex justify-end gap-3"><button onClick={() => setActivateStandard(null)} disabled={activating} className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button><button onClick={activateSelectedStandard} disabled={activating} className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">{activating ? "Activating…" : "Activate Standard"}</button></div>
      </div></div>}
    </div>
  );
}
