"use client";

import Link from "next/link";

export default function AuditExecutionPage() {
  return (
    <div className="min-h-full bg-slate-950 p-8 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <div className="text-xs uppercase tracking-[0.2em] text-sky-400">Internal Audit</div>
        <h1 className="mt-2 text-3xl font-semibold">Audit Execution</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Execute planned audit procedures, review evidence, record auditor notes and document audit results.
        </p>

        <div className="mt-8 grid grid-cols-3 gap-4">
          <Metric label="Planned Procedures" value="0" />
          <Metric label="In Progress" value="0" />
          <Metric label="Completed" value="0" />
        </div>

        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-lg font-semibold">Audit Workbench</h2>
          <p className="mt-2 text-sm text-slate-500">
            Select an audit plan item to begin execution. Evidence, test results and auditor observations will be recorded against the audit session.
          </p>
          <div className="mt-6 rounded-lg border border-dashed border-slate-700 p-10 text-center text-sm text-slate-500">
            No audit execution items are currently assigned.
          </div>
          <Link href="/audit/planning" className="mt-5 inline-flex rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
            Back to Audit Planning
          </Link>
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
