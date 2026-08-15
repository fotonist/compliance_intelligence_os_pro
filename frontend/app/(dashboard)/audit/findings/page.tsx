"use client";

import { useState } from "react";

const columns = ["ID", "Audit Area", "Finding", "Severity", "Owner", "Status", "Due Date"];

export default function FindingsPage() {
  const [filter, setFilter] = useState("ALL");
  return <div className="space-y-6">
    <Header title="Audit Findings" subtitle="Central register for observations, nonconformities and audit findings." />
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4"><Kpi label="Open Findings" value="0" /><Kpi label="Critical" value="0" /><Kpi label="High" value="0" /><Kpi label="Overdue" value="0" /></div>
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-semibold">Finding Register</div><div className="text-xs text-slate-500 mt-1">Findings generated during Audit Execution will appear here.</div></div><div className="flex gap-2">{["ALL", "OPEN", "CRITICAL", "CLOSED"].map((x) => <button key={x} onClick={() => setFilter(x)} className={`px-3 py-1.5 rounded-md text-xs border ${filter === x ? "bg-slate-700 border-slate-600 text-white" : "border-slate-800 text-slate-400"}`}>{x}</button>)}</div></div></div>
    <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden"><table className="w-full"><thead className="bg-slate-800/80"><tr>{columns.map((c) => <th key={c} className="px-4 py-3 text-left text-xs font-semibold text-slate-300">{c}</th>)}</tr></thead><tbody><tr><td colSpan={7} className="px-4 py-16 text-center"><div className="text-slate-300 font-medium">No findings recorded</div><div className="text-sm text-slate-500 mt-2">Complete an audit execution and record an exception to create a finding.</div></td></tr></tbody></table></div>
  </div>;
}
function Header({ title, subtitle }: { title: string; subtitle: string }) { return <div><div className="text-2xl font-semibold">{title}</div><div className="text-sm text-slate-400 mt-1">{subtitle}</div></div>; }
function Kpi({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="text-xs text-slate-500">{label}</div><div className="text-2xl font-semibold mt-2">{value}</div></div>; }
