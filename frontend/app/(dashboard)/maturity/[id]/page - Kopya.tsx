"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AddEvidenceMaturityModal from "../../evidences/AddEvidenceMaturityModal";
import SelectEvidenceMaturityModal from "../../evidences/SelectEvidenceMaturityModal";

const API_BASE = "https://compliance-intelligence-os-pro-2.onrender.com";

type Evidence = { id: number; title: string; status: string; files_count: number };
type PracticeRow = { id: number; process_area_id: number; process_area_name: string; practice_code: string | null; practice_title: string; evidences: Evidence[] };
type ProcessAreaGroup = { process_area_id: number; process_area_name: string; practices: PracticeRow[] };

export default function MaturityWorkspacePage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.id as string;
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PracticeRow[]>([]);
  const [createFor, setCreateFor] = useState<number | null>(null);
  const [linkFor, setLinkFor] = useState<number | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
    if (!t) { router.replace("/login"); return; }
    setToken(t);
  }, [router]);

  async function load() {
    if (!token || !sessionId) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/maturity/workspace/${sessionId}/practices`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error();
      setRows(await r.json());
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [token, sessionId]);

  const groups: ProcessAreaGroup[] = useMemo(() => {
    const map = new Map<number, ProcessAreaGroup>();
    for (const r of rows) {
      if (!map.has(r.process_area_id)) map.set(r.process_area_id, { process_area_id: r.process_area_id, process_area_name: r.process_area_name, practices: [] });
      map.get(r.process_area_id)!.practices.push(r);
    }
    return Array.from(map.values());
  }, [rows]);

  if (loading) return <div className="text-slate-400">Loading workspace...</div>;

  return (
    <div className="max-w-7xl space-y-10">
      <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-6"><h1 className="text-xl font-semibold text-slate-100">Maturity Workspace - Session #{sessionId}</h1></section>
      {groups.map((pa) => (
        <section key={pa.process_area_id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="mb-4 text-lg font-semibold text-indigo-400">{pa.process_area_name}</h2>
          <div className="space-y-4">
            {pa.practices.map((p) => (
              <div key={p.id} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-200">{p.practice_code ? `${p.practice_code} - ${p.practice_title}` : p.practice_title}</div>
                  <div className="flex gap-2">
                    <button onClick={() => setCreateFor(p.id)} className="rounded bg-indigo-600 px-2 py-1 text-xs">+ Evidence</button>
                    <button onClick={() => setLinkFor(p.id)} className="rounded bg-emerald-600 px-2 py-1 text-xs">Link</button>
                  </div>
                </div>
                {(!p.evidences || p.evidences.length === 0) ? <div className="text-xs italic text-slate-500">No evidence linked</div> : <ul className="mt-2 space-y-1">{p.evidences.map((e) => <li key={e.id} className="flex items-center justify-between rounded bg-slate-800/40 px-2 py-1 text-xs"><div className="flex items-center gap-2"><span>{e.title}</span><span className="rounded bg-emerald-700/80 px-2 text-[10px] text-emerald-100">Linked</span></div><div className="flex items-center gap-2"><span>{e.status}</span><span className="rounded bg-slate-700 px-2 text-[10px]">{e.files_count} file</span></div></li>)}</ul>}
              </div>
            ))}
          </div>
        </section>
      ))}
      {createFor && <AddEvidenceMaturityModal practiceEvaluationId={createFor} onClose={() => setCreateFor(null)} onCreated={load} />}
      {linkFor && token && <SelectEvidenceMaturityModal open token={token} evaluationId={linkFor} onClose={() => setLinkFor(null)} onLinked={load} />}
    </div>
  );
}
