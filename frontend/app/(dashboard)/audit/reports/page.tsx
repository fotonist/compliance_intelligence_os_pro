"use client";

import { useState } from "react";

export default function AuditReportsPage() {
  const [reportType, setReportType] = useState("Audit Summary");
  return <div className="space-y-6">
    <div><div className="text-2xl font-semibold">Audit Reports</div><div className="text-sm text-slate-400 mt-1">Generate management-ready reports from audit scope, execution results and findings.</div></div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><div className="rounded-xl border border-slate-800 bg-slate-900 p-5"><div className="text-xs text-slate-500">Report Generator</div><div className="text-lg font-semibold mt-1">Create Audit Report</div><select value={reportType} onChange={(e) => setReportType(e.target.value)} className="mt-5 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm"><option>Audit Summary</option><option>Findings & Corrective Actions</option><option>Executive Audit Report</option><option>Control Effectiveness Report</option></select><button className="mt-4 w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-sm font-medium">Generate Report</button></div>
      <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900 p-5"><div className="text-xs text-slate-500">Report Content</div><div className="text-lg font-semibold mt-1">{reportType}</div><div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5"><Metric label="Audits" value="0" /><Metric label="Controls Tested" value="0" /><Metric label="Findings" value="0" /><Metric label="Actions" value="0" /></div><div className="mt-5 rounded-lg border border-slate-800 bg-slate-950 p-5"><div className="text-sm text-slate-300">No completed audit data available</div><div className="text-xs text-slate-500 mt-2">Complete audit execution to populate this report with traceable results.</div></div></div></div>
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5"><div className="font-semibold">Report History</div><div className="text-sm text-slate-500 mt-2">Generated audit reports will be listed here with owner, period and generation timestamp.</div><div className="mt-5 rounded-lg border border-slate-800 bg-slate-950 p-10 text-center text-sm text-slate-500">No reports generated yet.</div></div>
  </div>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="text-xs text-slate-500">{label}</div><div className="text-xl font-semibold mt-1">{value}</div></div>; }
