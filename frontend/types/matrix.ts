"use client";

import { useEffect, useState } from "react";
import { getComplianceMatrix } from "@/services/api";
import MatrixTable from "@/components/MatrixTable";
import ComplianceMatrix from "@/types/matrix";

export default function CompliancePage() {
  const [data, setData] = useState<ComplianceMatrix[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMatrix() {
      try {
        const res = await getComplianceMatrix();
        setData(Array.isArray(res) ? res : []);
      } catch {
        setError("Compliance matrix could not be loaded.");
        setData([]);
      } finally {
        setLoading(false);
      }
    }

    loadMatrix();
  }, []);

  if (loading) {
    return <div className="p-6 text-gray-400">Loading compliance matrix…</div>;
  }

  if (error) {
    return <div className="p-6 text-red-400">{error}</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">
        Compliance Matrix
      </h1>
      <MatrixTable data={data} />
    </div>
  );
}
