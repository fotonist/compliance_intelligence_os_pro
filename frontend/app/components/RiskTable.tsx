"use client";

import { useRouter } from "next/navigation";

type Risk = {
  id: number;
  title: string;
  score: number;
  risk_level?: string;
  treatment?: string | null;
  coverage?: string | null;
  evidence_count?: number;
};

type Props = {
  risks: Risk[];
  loading: boolean;
  onDeleteRisk: (riskId: number) => void;
};

export default function RiskTable({
  risks,
  loading,
  onDeleteRisk,
}: Props) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="p-6 text-sm text-slate-400">
        Loading risk intelligence…
      </div>
    );
  }

  return (
    <div className="overflow-hidden">
      {/* TABLE */}
      <table className="w-full border-collapse text-sm">
        <thead className="bg-slate-900/80 text-slate-400 uppercase text-xs tracking-wide">
          <tr>
            <th className="px-6 py-4 text-left">ID</th>
            <th className="px-6 py-4 text-left">Risk</th>
            <th className="px-6 py-4 text-left">Severity</th>
            <th className="px-6 py-4 text-left">Score</th>
            <th className="px-6 py-4 text-left">Treatment</th>
            <th className="px-6 py-4 text-left">Coverage</th>
            <th className="px-6 py-4 text-left">Evidence</th>
            <th className="px-6 py-4 text-right">Action</th>
          </tr>
        </thead>

        <tbody>
          {risks.map((risk) => {
            const severityTone = getSeverityTone(risk.risk_level);
            const coverageTone = getCoverageTone(risk.coverage);
            const governanceSignal = getGovernanceSignal(
              risk.score,
              risk.evidence_count
            );

            return (
              <tr
                key={risk.id}
                onClick={() => router.push(`/risks/${risk.id}`)}
                className="
                  group
                  cursor-pointer
                  border-t border-slate-800/70
                  hover:bg-gradient-to-r hover:from-slate-900 hover:to-slate-800
                  transition
                "
              >
                {/* ID */}
                <td className="px-6 py-4 text-slate-500">
                  #{risk.id}
                </td>

                {/* TITLE */}
                <td className="px-6 py-4 text-white font-medium">
                  {risk.title}
                </td>

                {/* SEVERITY */}
                <td className="px-6 py-4">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${severityTone}`}
                  >
                    {risk.risk_level || "Unknown"}
                  </span>
                </td>

                {/* SCORE */}
                <td className="px-6 py-4">
                  <span className="text-lg font-semibold text-white">
                    {risk.score}
                  </span>
                </td>

                {/* TREATMENT */}
                <td className="px-6 py-4 text-slate-300">
                  {risk.treatment || "—"}
                </td>

                {/* COVERAGE */}
                <td className="px-6 py-4">
                  <span
                    className={`px-3 py-1 rounded-md text-xs border ${coverageTone}`}
                  >
                    {risk.coverage || "not_achieved"}
                  </span>
                </td>

                {/* EVIDENCE + GOVERNANCE SIGNAL */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-300">
                      {risk.evidence_count ?? 0}
                    </span>

                    <span
                      className={`text-xs px-2 py-1 rounded border ${governanceSignal}`}
                    >
                      Gov
                    </span>
                  </div>
                </td>

              {/* DELETE ACTION - DEMO LOCK */}
<td className="px-6 py-4 text-right">
  <button
    onClick={(e) => {
      e.stopPropagation();
      e.preventDefault();

      alert(
        "Risk modification requires Risk Intelligence License activation."
      );
    }}
    className="
      opacity-0
      group-hover:opacity-100
      transition
      text-xs
      border border-slate-700
      text-slate-500
      px-3 py-1
      rounded-md
      cursor-not-allowed
    "
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

/* ================= TONE SYSTEM ================= */

function getSeverityTone(level?: string) {
  const l = (level || "").toLowerCase();

  if (l.includes("critical"))
    return "bg-rose-500/10 text-rose-300 border-rose-500/40";

  if (l.includes("high"))
    return "bg-orange-500/10 text-orange-300 border-orange-500/40";

  if (l.includes("medium"))
    return "bg-amber-500/10 text-amber-300 border-amber-500/40";

  if (l.includes("low"))
    return "bg-emerald-500/10 text-emerald-300 border-emerald-500/40";

  return "bg-slate-800 text-slate-300 border-slate-700";
}

function getCoverageTone(coverage?: string | null) {
  const c = (coverage || "").toLowerCase();

  if (c.includes("covered"))
    return "bg-emerald-500/10 text-emerald-300 border-emerald-500/40";

  if (c.includes("partial"))
    return "bg-amber-500/10 text-amber-300 border-amber-500/40";

  return "bg-rose-500/10 text-rose-300 border-rose-500/40";
}

function getGovernanceSignal(
  score: number,
  evidence?: number | null
) {
  const e = evidence || 0;

  if (score >= 15 && e === 0)
    return "bg-rose-500/10 text-rose-300 border-rose-500/40";

  if (score >= 10 && e <= 1)
    return "bg-amber-500/10 text-amber-300 border-amber-500/40";

  return "bg-emerald-500/10 text-emerald-300 border-emerald-500/40";
}