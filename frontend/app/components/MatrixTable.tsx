"use client";

import RiskLevelBadge from "@/components/RiskLevelBadge";

interface MatrixRow {
  standard_code: string | null;
  standard_title: string | null;
  clause_code: string | null;
  clause_title: string | null;
  requirement_code: string | null;
  requirement_title: string | null;
  control_id: number | null;
  control_code: string | null;
  control_title: string | null;
  control_description: string | null;
  risk_id: number | null;
  risk_title: string | null;
  impact: number | null;
  likelihood: number | null;
  score?: number | null;         // EKLEDİM
  risk_level?: string | null;    // EKLEDİM
  evidence_id: number | null;
  evidence_title: string | null;
  evidence_status: string | null;
}

export default function ComplianceMatrixTable({ rows }: { rows: MatrixRow[] }) {
  if (!rows || rows.length === 0) {
    return <p className="text-gray-500 mt-4">Kayıt bulunamadı.</p>;
  }

  return (
    <div className="overflow-x-auto mt-4">
      <table className="min-w-full border border-gray-700 text-sm">
        <thead className="bg-gray-900 text-gray-200">
          <tr>
            <th className="border p-2 text-left">Standard</th>
            <th className="border p-2 text-left">Clause</th>
            <th className="border p-2 text-left">Requirement</th>
            <th className="border p-2 text-left">Control</th>
            <th className="border p-2 text-left">Evidence</th>
            <th className="border p-2 text-center">Evidence Status</th>
            <th className="border p-2 text-center">Impact</th>
            <th className="border p-2 text-center">Likelihood</th>
            <th className="border p-2 text-center">Risk Level</th> {/* EKLEDİM */}
          </tr>
        </thead>

        <tbody className="bg-gray-800 text-gray-100">
          {rows.map((row, idx) => (
            <tr key={idx} className="border-t border-gray-700">
              <td className="border p-2">
                {row.standard_code} – {row.standard_title}
              </td>

              <td className="border p-2">
                {row.clause_code} – {row.clause_title}
              </td>

              <td className="border p-2">
                {row.requirement_code} – {row.requirement_title}
              </td>

              <td className="border p-2">
                {row.control_code} – {row.control_title}
              </td>

              <td className="border p-2">
                {row.evidence_title}
              </td>

              <td className="border p-2 text-center">
                {row.evidence_status}
              </td>

              <td className="border p-2 text-center">
                {row.impact ?? "-"}
              </td>

              <td className="border p-2 text-center">
                {row.likelihood ?? "-"}
              </td>

              {/* 🔥 BURASI ARTIK BACKEND'DEN GELEN DOĞRU LEVEL'İ GÖSTERECEK */}
              <td className="border p-2 text-center">
                {row.risk_level ? (
                  <RiskLevelBadge level={row.risk_level} />
                ) : (
                  "-"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
