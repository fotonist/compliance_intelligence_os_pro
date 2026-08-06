"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import RiskTable from "@/components/RiskTable";
import ViewRiskModal from "./ViewRiskModal";
import UpdateRiskModal from "./UpdateRiskModal";
import DeleteConfirmModal from "./DeleteConfirmModal";
import { fetchRisks, type RiskItem } from "../../../services/risk";

const PAGE_SIZE = 10;

/* ================= PAGE ================= */

export default function RisksPage() {
  const router = useRouter();

  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [editRisk, setEditRisk] = useState<RiskItem | null>(null);
  const [deletePopup, setDeletePopup] = useState<{
    open: boolean;
    message: string;
  }>({
    open: false,
    message: "",
  });

  /* ================= DERIVED METRICS ================= */

  const criticalCount = useMemo(
    () =>
      risks.filter((r) =>
        r.risk_level?.toLowerCase().includes("critical")
      ).length,
    [risks]
  );

  const avgScore = useMemo(() => {
    if (!risks.length) return 0;
    const sum = risks.reduce((acc, r) => acc + (r.score || 0), 0);
    return (sum / risks.length).toFixed(1);
  }, [risks]);

  const totalEvidence = useMemo(
    () =>
      risks.reduce((acc, r) => acc + (r.evidence_count || 0), 0),
    [risks]
  );

  /* ================= LOAD ================= */

  useEffect(() => {
    loadRisks(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function loadRisks(pageNumber: number) {
    setLoading(true);
    try {
      const data = await fetchRisks(pageNumber);

      setRisks(Array.isArray(data?.items) ? data.items : []);
      setTotal(data?.total ?? 0);
      setTotalPages(data?.total_pages ?? 1);
      setPage(data?.page ?? 1);
    } catch (err) {
      console.error("Failed to load risks", err);
      setRisks([]);
    } finally {
      setLoading(false);
    }
  }

  /* ================= DELETE ================= */

  async function onDeleteRiskRequest(riskId: number) {
    const res = await fetch(`http://localhost:8000/risks/${riskId}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setDeletePopup({
        open: true,
        message:
          data?.detail ||
          "This risk cannot be deleted because it has related risks or evidences.",
      });
      return;
    }

    loadRisks(page);
  }

  /* ================= RENDER ================= */

  return (
    <div className="space-y-10 p-8">

      {/* ================= HEADER ================= */}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Risk Intelligence
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Enterprise risk exposure, governance & control overview
          </p>
        </div>

        <button
          onClick={() => router.push("/risks/create")}
          className="
            px-5 py-2.5
            rounded-xl
            bg-gradient-to-r from-blue-600 to-indigo-600
            hover:opacity-90
            text-white text-sm font-medium
            shadow-lg shadow-blue-900/30
          "
        >
          + Create Risk
        </button>
      </div>

      {/* ================= METRIC STRIP ================= */}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard label="Total Risks" value={total} />
        <MetricCard label="Critical Risks" value={criticalCount} highlight />
        <MetricCard label="Average Score" value={avgScore} />
        <MetricCard label="Total Evidence" value={totalEvidence} />
      </div>

      {/* ================= TABLE PANEL ================= */}

      <div
        className="
          rounded-3xl
          border border-slate-800/60
          bg-gradient-to-br from-slate-950 to-slate-900
          backdrop-blur
          shadow-2xl shadow-black/40
          overflow-hidden
        "
      >
        <RiskTable
          risks={risks}
          loading={loading}
          onDeleteRisk={onDeleteRiskRequest}
          onCompleteRisk={(riskId: number) =>
            router.push(`/risks/${riskId}`)
          }
        />

        {/* EMPTY STATE */}

        {!loading && risks.length === 0 && (
          <div className="py-16 text-center text-slate-500">
            No risks found.
          </div>
        )}

        {/* ================= PAGINATION ================= */}

        <div className="flex items-center justify-between px-8 py-5 border-t border-slate-800/60 text-sm text-slate-400">
          <div>
            Page {page} / {totalPages} — {total} total
          </div>

          <div className="flex gap-3">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="
                rounded-xl
                bg-slate-800
                hover:bg-slate-700
                px-5 py-2
                disabled:opacity-40
                text-slate-200
                transition
              "
            >
              Previous
            </button>

            <button
              disabled={page === totalPages}
              onClick={() =>
                setPage((p) => Math.min(totalPages, p + 1))
              }
              className="
                rounded-xl
                bg-slate-800
                hover:bg-slate-700
                px-5 py-2
                disabled:opacity-40
                text-slate-200
                transition
              "
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ================= MODALS ================= */}

     {viewRisk && (
  <ViewRiskModal
    riskId={viewRisk.id}
    onClose={() => setViewRisk(null)}
  />
)}

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
          onConfirm={() =>
            setDeletePopup({
              open: false,
              message: "",
            })
          }
        />
      )}
    </div>
  );
}

/* ================= METRIC CARD ================= */

function MetricCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: any;
  highlight?: boolean;
}) {
  return (
    <div
      className={`
        rounded-3xl
        border
        ${
          highlight
            ? "border-rose-500/40 bg-rose-500/10"
            : "border-slate-800/60 bg-slate-900/60"
        }
        backdrop-blur
        shadow-xl shadow-black/20
        p-6
        transition
      `}
    >
      <div className="text-sm text-slate-400 mb-3">
        {label}
      </div>
      <div className="text-3xl font-semibold text-white">
        {value}
      </div>
    </div>
  );
}
