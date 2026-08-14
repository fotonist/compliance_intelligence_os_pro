"use client";

export default function AuditReportsPage() {
  return (
    <div className="min-h-full bg-slate-950 p-8 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <div className="text-xs uppercase tracking-[0.2em] text-sky-400">Internal Audit</div>
        <h1 className="mt-2 text-3xl font-semibold">Audit Reports</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Consolidate audit scope, procedures, findings, risk exposure, evidence and corrective actions into management-ready audit reports.
        </p>

        <div className="mt-8 grid grid-cols-3 gap-4">
          <Metric label="Audit Reports" value="0" />
          <Metric label="Drafts" value="0" />
          <Metric label="Finalized" value="0" />
        </div>

        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-lg font-semibold">Report Register</h2>
          <div className="mt-6 rounded-lg border border-dashed border-slate-700 p-10 text-center text-sm text-slate-500">
            No audit reports have been generated yet.
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-white">{value}</div>
    </div>
  );
}
