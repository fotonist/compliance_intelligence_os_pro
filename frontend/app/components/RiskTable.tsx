"use client";

import { useRouter } from "next/navigation";
import type { RiskItem } from "@/services/risk";

type Props = {
  risks: RiskItem[];
  loading: boolean;
  onDeleteRisk: (riskId: number) => void;
  onCompleteRisk: (riskId: number) => void;
};

export default function RiskTable({ risks, loading }: Props) {
  const router = useRouter();

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading risk intelligence…</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-6 py-4 text-left font-semibold">ID</th>
            <th className="px-6 py-4 text-left font-semibold">Risk</th>
            <th className="px-6 py-4 text-left font-semibold">Severity</th>
            <th className="px-6 py-4 text-left font-semibold">Score</th>
            <th className="px-6 py-4 text-left font-semibold">Treatment</th>
            <th className="px-6 py-4 text-left font-semibold">Coverage</th>
            <th className="px-6 py-4 text-left font-semibold">Evidence</th>
            <th className="px-6 py-4 text-right font-semibold">Action</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {risks.map((risk: RiskItem) => {
            const severityTone = getSeverityTone(risk.risk_level);
            const governanceSignal = getGovernanceSignal(risk.score ?? 0, risk.evidence_count);

            return (
              <tr
                key={risk.id}
                onClick={() => router.push(`/risks/${risk.id}`)}
                className="group cursor-pointer transition hover:bg-slate-50"
              >
                <td className="px-6 py-4 font-medium text-slate-500">#{risk.id}</td>

                <td className="px-6 py-4 font-medium text-slate-900">{risk.title}</td>

                <td className="px-6 py-4">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${severityTone}`}>
                    {risk.risk_level || "Unknown"}
                  </span>
                </td>

                <td className="px-6 py-4">
                  <span className="font-semibold text-slate-900">{risk.score ?? 0}</span>
                </td>

                <td className="px-6 py-4 text-slate-600">{risk.treatment || "—"}</td>

                <td className="px-6 py-4">
                  <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">
                    Not assessed
                  </span>
                </td>

                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-slate-700">{risk.evidence_count ?? 0}</span>
                    <span className={`rounded border px-2 py-1 text-xs ${governanceSignal}`}>Governance</span>
                  </div>
                </td>

                <td className="px-6 py-4 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      alert("Risk modification requires Risk Intelligence License activation.");
                    }}
                    className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 opacity-0 transition group-hover:opacity-100 hover:bg-slate-50"
                  >
                    🔒 Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function getSeverityTone(level?: string) {
  const l = (level || "").toLowerCase();
  if (l.includes("critical")) return "border-rose-200 bg-rose-50 text-rose-700";
  if (l.includes("high")) return "border-orange-200 bg-orange-50 text-orange-700";
  if (l.includes("medium")) return "border-amber-200 bg-amber-50 text-amber-700";
  if (l.includes("low")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function getGovernanceSignal(score: number, evidence?: number | null) {
  const e = evidence || 0;
  if (score >= 15 && e === 0) return "border-rose-200 bg-rose-50 text-rose-700";
  if (score >= 10 && e <= 1) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}
