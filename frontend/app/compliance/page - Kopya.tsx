"use client";

import { useEffect, useState } from "react";
import { getComplianceMatrix } from "@/services/api";

import MatrixTable from "@/components/MatrixTable";
import { ComplianceMatrix } from "@/types/matrix";

export default function CompliancePage() {
  const [data, setData] = useState<ComplianceMatrix | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getComplianceMatrix()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-6">Matrix yükleniyor...</div>;
  }

  if (!data) {
    return <div className="p-6">Veri bulunamadı.</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        {data.standard} - Uyumluluk Matrisi
      </h1>

      <MatrixTable clauses={data.clauses} />
    </div>
  );
}
