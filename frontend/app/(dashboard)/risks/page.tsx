"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import RiskTable from "@/app/components/RiskTable";
import UpdateRiskModal from "./UpdateRiskModal";
import DeleteConfirmModal from "./DeleteConfirmModal";
import { fetchRisks, type RiskItem } from "../../../services/risk";

const PAGE_SIZE = 10;
const KPI_PAGE_SIZE = 100;

export default function RisksPage() {
  const router = useRouter();
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [kpiRisks, setKpiRisks] = useState<RiskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [editRisk, setEditRisk] = useState<RiskItem | null>(null);
  const [deletePopup, setDeletePopup] = useState({ open: false, message: "" });

  const criticalCount = useMemo(
    () => kpiRisks.filter((r) => r.risk_level?.toLowerCase().includes("critical")).length,
    [kpiRisks]
  );

  const avgScore = useMemo(() => {
    if (!kpiRisks.length) return 0;
    const scored = kpiRisks.filter((r) => r.score != null);
    if (!scored.length) return 0;
    const sum = scored.reduce((acc, r) => acc + Number(r.score || 0), 0);
    return (sum / scored.length).toFixed(1);
  }, [kpiRisks]);

  const totalEvidence = useMemo(
    () => kpiRisks.reduce((acc, r) => acc + Number(r.evidence_count || 0), 0),
    [kpiRisks]
  );

  useEffect(() => {
    loadRisks(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function loadRisks(pageNumber: number) {
    setLoading(true);
    try {
      const tableData = await fetchRisks(pageNumber, PAGE_SIZE, "all");
      const kpiData = await fetchRisks(1, KPI_PAGE_SIZE, "all");
      setRisks(Array.isArray(tableData?.items) ? tableData.items : []);
      setKpiRisks(Array.isArray(kpiData?.items) ? kpiData.items : []);
      setTotal(Number(tableData?.total ?? 0));
      setTotalPages(Number(tableData?.total_pages ?? 1));
      setPage(Number(tableData?.page ?? 1));
    } catch (err) {
      console.error("Failed to load risks", err);
      setRisks([]);
      setKpiRisks([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }

  async function onDeleteRiskRequest(riskId: number) {
    const res = await fetch(`https://compliance-intelligence-os-pro-2.onrender.com/risks/${riskId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setDeletePopup({
        open: true,
        message: data?.detail || "This risk cannot be deleted because it has related risks or evidences.",
      });
      return;
    }
    loadRisks(page);
  }

  return (
    <div className="min-h-full bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-[1500px] space-y-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Risk Management</h1>
            <p className="mt-1 text-sm text-slate-500">Risk register, assessment and treatment management</p>
          </div>
          <button
            onClick={() => router.push("/risks/create")}
            className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-800"
          >
            + Create Risk
          </button>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
          <MetricCard label="Total Risks" value={total} />
          <MetricCard label="Critical Risks" value={criticalCount} highlight />
          <MetricCard label="Average Score" value={avgScore} />
          <MetricCard label="Total Evidence" value={totalEvidence} />
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <RiskTable
            risks={risks}
            loading={loading}
            onDeleteRisk={onDeleteRiskRequest}
            onCompleteRisk={(riskId: number) => router.push(`/risks/${riskId}`)}
          />

          {!loading && risks.length === 0 && (
            <div className="border-t border-slate-100 py-16 text-center">
              <div className="text-sm font-medium text-slate-700">No risks found</div>
              <div className="mt-1 text-xs text-slate-400">No risk records are currently available for this organization.</div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 text-sm text-slate-500">
            <div>Page {page} / {totalPages} — {total} total</div>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {editRisk && (
        <UpdateRiskModal
          risk={editRisk}
          onClose={() => setEditRisk(null)}
          onUpdated={() => {
            setEditRisk(null);
            loadRisks(page);
          }}
        />
      )}

      {deletePopup.open && (
        <DeleteConfirmModal
          title="Cannot Delete Risk"
          message={deletePopup.message}
          confirmText="OK"
          onConfirm={() => setDeletePopup({ open: false, message: "" })}
          onClose={() => setDeletePopup({ open: false, message: "" })}
        />
      )}
    </div>
  );
}

function MetricCard({ label, value, highlight }: { label: string; value: any; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border bg-white p-5 shadow-sm ${highlight ? "border-rose-200" : "border-slate-200"}`}>
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</div>
    </div>
  );
}
