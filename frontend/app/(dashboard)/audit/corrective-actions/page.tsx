"use client";

import { useState } from "react";

export default function CorrectiveActionsPage() {
  const [view, setView] = useState("ACTIVE");
  return <div className="space-y-6">
    <div className="flex items-start justify-between gap-4"><div><div className="text-2xl font-semibold">Corrective Actions</div><div className="text-sm text-slate-400 mt-1">Track remediation commitments raised from internal audit findings.</div></div><button className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium">Create Action</button></div>
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4"><Metric label="Active Actions" value="0" /><Metric label="Due This Month" value="0" /><Metric label="Overdue" value="0" /><Metric label="Completed" value="0" /></div>
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5"><div className="flex items-center justify-between gap-3"><div><div className="font-semibold">Action Portfolio</div><div className="text-xs text-slate-500 mt-1">Corrective actions remain linked to their originating finding and audit control.</div></div><div className="flex gap-2">{["ACTIVE", "OVERDUE", "COMPLETED"].map((x) => <button key={x} onClick={() => setView(x)} className={`px-3 py-1.5 rounded-md text-xs border ${view === x ? "bg-slate-700 border-slate-600 text-white" : "border-slate-800 text-slate-400"}`}>{x}</button>)}</div></div></div>
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 text-center"><div className="text-slate-200 font-medium">No corrective actions in {view.toLowerCase()} view</div><div className="text-sm text-slate-500 mt-2">Actions will be created from audit findings and assigned to accountable owners.</div></div>
  </div>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="text-xs text-slate-500">{label}</div><div className="text-2xl font-semibold mt-2">{value}</div></div>; }
