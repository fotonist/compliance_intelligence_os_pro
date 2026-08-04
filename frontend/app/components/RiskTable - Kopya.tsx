"use client";

import { useRouter } from "next/navigation";
import RiskLevelBadge from "./RiskLevelBadge";

type Risk = {
  id: number;
  title: string;
  score: number;
  risk_level?: string | null;
  treatment?: string | null;
  control_coverage_status?: string | null;
  evidence_count?: number | null;
};

type Props = {
  risks: Risk[];
  loading?: boolean;
  onDeleted?: () => void;
};

export default function RiskTable({ risks, loading, onDeleted }: Props) {
  const router = useRouter();

  const handleDelete = async (
    e: React.MouseEvent,
    risk: Risk
  ) => {
    e.stopPropagation();

    const ok = confirm(`Delete risk "${risk.title}" ?`);
    if (!ok) return;

    const res = await fetch(
      `http://localhost:8000/risks/${risk.id}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    if (!res.ok) {
      alert("Risk delete failed");
      return;
    }

    onDeleted?.();
  };

  if (loading) {
    return (
      <div className="p-4 text-sm text-slate-400">
        Loading risks…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur">
      {/* HEADER */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
        <span className="text-sm font-semibold text-slate-100">
          Risks
        </span>

        <button
          onClick={() => router.push("/risks/create")}
          title="Create New Risk"
          className="h-8 w-8 flex items-center justify-center rounded-md
                     border border-slate-700 text-slate-300
                     hover:bg-slate-800 hover:text-white"
        >
          +
        </button>
      </div>

      {/* TABLE */}
      <table className="w-full text-sm">
        <thead className="bg-slate-900/70 text-slate-300">
          <tr className="border-b border-slate-800">
            <th className="px-5 py-3 text-left font-semibold">
              Risk
            </th>
            <th className="px-5 py-3 text-center font-semibold">
              Score
            </th>
            <th className="px-5 py-3 text-center font-semibold">
              Level
            </th>
            <th className="px-5 py-3 text-left font-semibold">
              Treatment
            </th>
            <th className="px-5 py-3 text-left font-semibold">
              Control
            </th>
            <th className="px-5 py-3 text-center font-semibold">
              Evidence
            </th>
            <th className="px-4 py-3 text-center w-12"></th>
          </tr>
        </thead>

        <tbody>
          {risks.map((r) => (
            <tr
              key={r.id}
              onClick={() => router.push(`/risks/${r.id}`)}
              className="border-b border-slate-800
                         hover:bg-slate-800/40
                         transition-colors cursor-pointer"
            >
              <td className="px-5 py-3 text-slate-100 font-medium">
                {r.title}
              </td>

              <td className="px-5 py-3 text-center text-slate-100 font-semibold">
                {r.score}
              </td>

              <td className="px-5 py-3 text-center">
                <RiskLevelBadge score={r.score} />
              </td>

              <td className="px-5 py-3 text-slate-300">
                {r.treatment ?? "-"}
              </td>

              <td className="px-5 py-3 text-slate-300 capitalize">
                {r.control_coverage_status
                  ? r.control_coverage_status
                      .toLowerCase()
                      .replaceAll("_", " ")
                  : "-"}
              </td>

              <td className="px-5 py-3 text-center text-slate-300">
                {r.evidence_count ?? 0}
              </td>

              <td className="px-4 py-3 text-center">
                <button
                  onClick={(e) => handleDelete(e, r)}
                  title="Delete Risk"
                  className="h-7 w-7 inline-flex items-center justify-center
                             rounded-md border border-slate-700
                             text-slate-400
                             hover:bg-red-900/40 hover:text-red-300"
                >
                  −
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
