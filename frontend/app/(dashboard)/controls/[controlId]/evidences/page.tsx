"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  FileCheck2,
  FileText,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldAlert,
  Upload,
  X,
} from "lucide-react";
import EvidenceStatusBadge from "@/app/components/EvidenceStatusBadge";
import { apiFetch } from "@/app/lib/api";

type EvidenceRow = {
  id?: number;
  evidence_id?: number;
  title: string;
  status?: string | null;
  coverage?: string | null;
  coverage_status?: string | null;
  files_count?: number;
  related_risks_count?: number;
  control_id?: number;
  control?: {
    code?: string | null;
    title?: string | null;
  };
  requirement?: {
    code?: string | null;
    title?: string | null;
  };
  standard?: {
    code?: string | null;
    title?: string | null;
  };
};

function normalizeStatus(status?: string | null) {
  return String(status || "draft")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function isCovered(value?: string | null) {
  return String(value || "").toLowerCase() === "achieved";
}

function StatCard({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">
        {icon}
        <span>{label}</span>
      </div>

      <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
        {value}
      </div>

      <div className="mt-1 text-xs text-slate-500">
        {description}
      </div>
    </div>
  );
}

export default function ControlEvidencesPage() {
  const { controlId } = useParams<{ controlId: string }>();
  const router = useRouter();

  const [rows, setRows] = useState<EvidenceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [coverageFilter, setCoverageFilter] = useState("all");

  async function loadEvidence() {
    if (!controlId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch(
        `/evidences?control_id=${encodeURIComponent(controlId)}`
      );

      const data = await res.json();

      const items = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : [];

      setRows(items);
    } catch (err: any) {
      console.error("Control evidence load error:", err);
      setError(err?.message || "Unable to load evidence.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvidence();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlId]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      const title = String(row.title || "").toLowerCase();
      const status = normalizeStatus(row.status);
      const coverage = String(
        row.coverage_status || row.coverage || ""
      ).toLowerCase();

      const matchesSearch =
        !q ||
        title.includes(q) ||
        String(row.standard?.code || "").toLowerCase().includes(q) ||
        String(row.requirement?.code || "").toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" || status === statusFilter;

      const matchesCoverage =
        coverageFilter === "all" ||
        (coverageFilter === "covered" && coverage === "achieved") ||
        (coverageFilter === "uncovered" && coverage !== "achieved");

      return matchesSearch && matchesStatus && matchesCoverage;
    });
  }, [rows, search, statusFilter, coverageFilter]);

  const totalEvidence = rows.length;

  const coveredEvidence = rows.filter((r) =>
    isCovered(r.coverage_status || r.coverage)
  ).length;

  const fileCount = rows.reduce(
    (sum, r) => sum + Number(r.files_count || 0),
    0
  );

  const riskCount = rows.reduce(
    (sum, r) => sum + Number(r.related_risks_count || 0),
    0
  );

  const first = rows[0];

  const controlCode =
    first?.control?.code || `CTRL-${controlId}`;

  const controlTitle =
    first?.control?.title || "Control Evidence";

  const standardLabel =
    first?.standard?.code || "Standard context unavailable";

  const requirementLabel =
    first?.requirement?.code || "Requirement context unavailable";

  return (
    <div className="min-h-full bg-[#f6f8fb]">
      <div className="mx-auto max-w-[1480px] px-6 py-7">

        {/* ===================================================== */}
        {/* HEADER */}
        {/* ===================================================== */}

        <header className="border-b border-slate-200 pb-6">
          <div className="flex items-start justify-between gap-6">

            <div className="min-w-0">
              <button
                onClick={() => router.back()}
                className="mb-4 inline-flex items-center gap-2 text-xs font-medium text-slate-500 transition hover:text-slate-900"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Control
              </button>

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50 text-cyan-600">
                  <ShieldCheck className="h-5 w-5" />
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-semibold tracking-tight text-slate-950">
                      Evidence Intelligence
                    </h1>

                    <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-cyan-600">
                      Control Evidence
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    Evidence posture, coverage and risk linkage for this control.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">
                    Control
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {controlCode}
                  </div>
                </div>

                <div className="h-7 w-px bg-slate-200" />

                <div>
                  <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">
                    Requirement
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    {requirementLabel}
                  </div>
                </div>

                <div className="h-7 w-px bg-slate-200" />

                <div>
                  <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">
                    Standard
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    {standardLabel}
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() =>
                router.push(
                  `/controls/${controlId}/evidences/create`
                )
              }
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              <Upload className="h-3.5 w-3.5" />
              Add Evidence
            </button>
          </div>
        </header>

        {/* ===================================================== */}
        {/* CONTROL IDENTITY */}
        {/* ===================================================== */}

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-start justify-between gap-5">

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-600">
                Control Identity
              </div>

              <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
                {controlTitle}
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                {controlCode} · Evidence lifecycle and assurance posture
              </p>
            </div>

            <button
              onClick={loadEvidence}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-950 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  loading ? "animate-spin" : ""
                }`}
              />
              Refresh
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard
              label="Evidence"
              value={totalEvidence}
              description="Evidence records linked to control"
              icon={<FileText className="h-3.5 w-3.5 text-cyan-500" />}
            />

            <StatCard
              label="Covered"
              value={coveredEvidence}
              description={`${totalEvidence ? Math.round((coveredEvidence / totalEvidence) * 100) : 0}% evidence coverage`}
              icon={<FileCheck2 className="h-3.5 w-3.5 text-emerald-500" />}
            />

            <StatCard
              label="Files"
              value={fileCount}
              description="Supporting files attached"
              icon={<FileText className="h-3.5 w-3.5 text-violet-500" />}
            />

            <StatCard
              label="Linked Risks"
              value={riskCount}
              description="Risks connected through evidence"
              icon={<ShieldAlert className="h-3.5 w-3.5 text-amber-500" />}
            />
          </div>
        </section>

        {/* ===================================================== */}
        {/* ERROR */}
        {/* ===================================================== */}

        {error && (
          <div className="mt-5 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <div>
              <div className="text-xs font-semibold text-red-700">
                Evidence data unavailable
              </div>
              <div className="mt-1 text-xs text-red-600">
                {error}
              </div>
            </div>

            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ===================================================== */}
        {/* INVENTORY */}
        {/* ===================================================== */}

        <section className="mt-6 rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">

          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-600">
                  Evidence Inventory
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  {filteredRows.length} of {totalEvidence} evidence records
                </div>
              </div>

              <div className="flex flex-col gap-2 md:flex-row">

                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />

                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search evidence..."
                    className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-300 focus:bg-white md:w-64"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 outline-none focus:border-cyan-300"
                >
                  <option value="all">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="waiting_approval">
                    Waiting Approval
                  </option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>

                <select
                  value={coverageFilter}
                  onChange={(e) => setCoverageFilter(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 outline-none focus:border-cyan-300"
                >
                  <option value="all">All Coverage</option>
                  <option value="covered">Covered</option>
                  <option value="uncovered">Uncovered</option>
                </select>
              </div>
            </div>
          </div>

          {/* TABLE */}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Evidence
                  </th>

                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Coverage
                  </th>

                  <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Files
                  </th>

                  <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Risks
                  </th>

                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Status
                  </th>

                  <th className="w-10 px-3 py-3" />
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-5 py-14 text-center">
                      <div className="inline-flex items-center gap-2 text-xs text-slate-500">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Loading evidence intelligence...
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-14 text-center">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                        <FileText className="h-4 w-4 text-slate-400" />
                      </div>

                      <div className="mt-3 text-sm font-medium text-slate-700">
                        No evidence records found
                      </div>

                      <div className="mt-1 text-xs text-slate-400">
                        Try changing the filters or add new evidence.
                      </div>
                    </td>
                  </tr>
                )}

                {!loading &&
                  filteredRows.map((e, index) => {
                    const evidenceId =
                      e.id ?? e.evidence_id;

                    const covered = isCovered(
                      e.coverage_status || e.coverage
                    );

                    return (
                      <tr
                        key={
                          evidenceId ??
                          `${controlId}-${index}`
                        }
                        onClick={() => {
                          if (evidenceId) {
                            router.push(
                              `/evidences/${evidenceId}`
                            );
                          }
                        }}
                        className="group cursor-pointer border-b border-slate-100 transition last:border-b-0 hover:bg-slate-50"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 group-hover:border-cyan-200 group-hover:text-cyan-600">
                              <FileText className="h-4 w-4" />
                            </div>

                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-slate-900">
                                {e.title}
                              </div>

                              <div className="mt-0.5 text-[10px] text-slate-400">
                                {e.standard?.code || "Evidence"}{" "}
                                {e.requirement?.code
                                  ? `· ${e.requirement.code}`
                                  : ""}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                              covered
                                ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                                : "border-amber-200 bg-amber-50 text-amber-600"
                            }`}
                          >
                            <span
                              className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                                covered
                                  ? "bg-emerald-500"
                                  : "bg-amber-500"
                              }`}
                            />
                            {covered
                              ? "Covered"
                              : "Uncovered"}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-center text-sm font-medium text-slate-700">
                          {Number(e.files_count || 0)}
                        </td>

                        <td className="px-4 py-4 text-center">
                          <span
                            className={`text-sm font-medium ${
                              Number(
                                e.related_risks_count || 0
                              ) > 0
                                ? "text-amber-600"
                                : "text-slate-500"
                            }`}
                          >
                            {Number(
                              e.related_risks_count || 0
                            )}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <EvidenceStatusBadge
                            status={normalizeStatus(e.status)}
                            size="sm"
                          />
                        </td>

                        <td className="px-3 py-4">
                          <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-cyan-500" />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* FOOTER */}

          {!loading && (
            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
              <div className="text-[11px] text-slate-400">
                Showing {filteredRows.length} evidence records
              </div>

              <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-slate-400">
                Control-scoped evidence inventory
              </div>
            </div>
          )}
        </section>

        {/* ===================================================== */}
        {/* ASSURANCE POSTURE */}
        {/* ===================================================== */}

        <section className="mt-6 grid gap-5 xl:grid-cols-2">

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-600">
              Evidence Lifecycle
            </div>

            <div className="mt-4 flex items-center gap-2">
              {[
                ["Draft", "draft"],
                ["Review", "waiting_approval"],
                ["Approved", "approved"],
              ].map(([label, value], index) => (
                <div
                  key={value}
                  className="flex flex-1 items-center gap-2"
                >
                  <div className="flex-1">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="text-xs font-semibold text-slate-800">
                        {label}
                      </div>

                      <div className="mt-1 text-[10px] text-slate-400">
                        {rows.filter(
                          (r) =>
                            normalizeStatus(r.status) ===
                            value
                        ).length}{" "}
                        records
                      </div>
                    </div>
                  </div>

                  {index < 2 && (
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-600">
              Coverage Signal
            </div>

            <div className="mt-4">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-3xl font-semibold tracking-tight text-slate-950">
                    {totalEvidence
                      ? Math.round(
                          (coveredEvidence /
                            totalEvidence) *
                            100
                        )
                      : 0}
                    %
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    Evidence coverage for this control
                  </div>
                </div>

                <div className="text-right text-xs text-slate-500">
                  <div>
                    {coveredEvidence} covered
                  </div>
                  <div>
                    {totalEvidence - coveredEvidence} uncovered
                  </div>
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-cyan-400 transition-all"
                  style={{
                    width: `${
                      totalEvidence
                        ? Math.min(
                            100,
                            (coveredEvidence /
                              totalEvidence) *
                              100
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
