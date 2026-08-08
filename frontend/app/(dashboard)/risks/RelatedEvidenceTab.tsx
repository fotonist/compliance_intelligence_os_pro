// C:\Projects\compliance_app\frontend\app\(dashboard)\risks\RelatedEvidenceTab.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Evidence = {
  id: number;
  title: string;
  clause_code?: string | null;
  control_code?: string | null;
  status?: string | null;
};

type Props = {
  riskId: number;
};

const API_BASE = "https://compliance-intelligence-os-pro-2.onrender.com";

export default function RelatedEvidenceTab({ riskId }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [riskId]);

  async function load() {
    setLoading(true);
    try {
      const token =
        localStorage.getItem("access_token") ||
        localStorage.getItem("token");

      /**
       * Backend expectation:
       * - Aynı risk_id’ye sahip evidencelar
       * - VEYA farklı control / clause altında
       *   ama ortak risk ilişkisi bulunan evidencelar
       *
       * Endpoint placeholder ama kırılmaz
       */
     const res = await fetch(
  `${API_BASE}/risks/${riskId}/related-evidences`,
  {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  }
);

if (!res.ok) {
  setRows([]);
  return;
}


      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="text-slate-400">Loading evidences…</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="text-slate-400">
        No related evidences found for this risk.
      </div>
    );
  }

  return (
    <div className="border border-slate-700 rounded bg-slate-900">
      <table className="w-full text-sm">
        <thead className="bg-slate-800">
          <tr>
            <th className="p-2 text-left">Evidence</th>
            <th className="p-2 text-center">Clause</th>
            <th className="p-2 text-center">Control</th>
            <th className="p-2 text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr
              key={e.id}
              className="border-t border-slate-700 hover:bg-slate-800 cursor-pointer"
              onClick={() => router.push(`/evidences/${e.id}`)}
            >
              <td className="p-2">{e.title}</td>
              <td className="p-2 text-center">
                {e.clause_code ?? "-"}
              </td>
              <td className="p-2 text-center">
                {e.control_code ?? "-"}
              </td>
              <td className="p-2 text-center">
                {e.status ?? "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
