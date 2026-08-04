
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ComplianceMatrixTable from "@/components/ComplianceMatrixTable";

const API_BASE = "http://localhost:8000";

interface Standard {
  id: number;
  code: string;
  title: string;
  type: "CONTROL_BASED" | "MATURITY_BASED";
}

export default function CompliancePage() {
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [selectedStandardId, setSelectedStandardId] =
    useState<number | null>(null);

  const [rows, setRows] = useState<any[]>([]);
  const [mode, setMode] = useState<"control" | "maturity">("control");
  const [loading, setLoading] = useState(false);

  /* ================= AUTH ================= */
  useEffect(() => {
    const t = localStorage.getItem("access_token");
    if (!t) {
      router.replace("/login");
      return;
    }
    setToken(t);
  }, [router]);

  /* ================= LOAD STANDARDS ================= */
  useEffect(() => {
    if (!token) return;

    fetch(`${API_BASE}/standards`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setStandards(data || []);
        if (data?.length) {
          setSelectedStandardId((prev) => prev ?? data[0].id);
        }
      });
  }, [token]);

  /* ================= LOAD MATRIX ================= */
  useEffect(() => {
    if (!token || !selectedStandardId) return;

    setLoading(true);

    fetch(`${API_BASE}/matrix?standard_id=${selectedStandardId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) {
          throw new Error(`Matrix load failed: ${r.status}`);
        }
        return r.json();
      })
      .then((data) => {
        setMode(data.mode);
        setRows(data.rows || []);
      })
      .catch((err) => {
        console.error(err);
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [token, selectedStandardId]);

  if (loading) {
    return <div className="p-6 text-slate-400">Matrix yükleniyor…</div>;
  }

  return (
    <div className="p-6">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Compliance Matrix</h1>

        <select
          className="bg-slate-800 border border-slate-600 text-slate-200 text-sm rounded px-3 py-2"
          value={selectedStandardId ?? ""}
          onChange={(e) =>
            setSelectedStandardId(Number(e.target.value))
          }
        >
          {standards.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code}
            </option>
          ))}
        </select>
      </div>

      {/* MATRIX */}
      <ComplianceMatrixTable
        rows={rows}
        mode={mode}
        onView={(row) => {
          if (mode === "maturity") {
            router.push(
              `/maturity/${row.session_id}?practice_id=${row.practice_id}`
            );
          } else {
            router.push(
              `/control-assessments?control_id=${row.control_id}`
            );
          }
        }}
      />
    </div>
  );
}
