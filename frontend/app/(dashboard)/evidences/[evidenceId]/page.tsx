"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import EvidenceStatusBadge from "@/app/components/EvidenceStatusBadge";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://compliance-intelligence-os-pro-2.onrender.com";

const EVIDENCE_BASE = `${API_URL}/company/evidences`;

type EvidenceFile = {
  id: number;
  file_name: string;
  version: number;
  status: string;
  uploaded_at?: string;
};

type Risk = {
  id: number;
  title: string;
  score?: number;
  risk_level?: string;
};

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("access_token") ||
    sessionStorage.getItem("token")
  );
}

function fmt(dt?: string | null) {
  if (!dt) return "-";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function normalizeStatus(s?: string | null) {
  return (s ?? "").toLowerCase().trim();
}

async function safeFetch(res: Response) {
  if (res.status === 401) {
    throw new Error("Not authenticated");
  }
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || "Request failed");
  }
  return res.json();
}

export default function EvidenceDetailPage() {
  const { evidenceId } = useParams<{ evidenceId: string }>();
  const router = useRouter();

  const [meta, setMeta] = useState<any>(null);
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [showRiskModal, setShowRiskModal] = useState(false);
  const [allRisks, setAllRisks] = useState<Risk[]>([]);
  const [riskQuery, setRiskQuery] = useState("");
  const [selectedRiskIds, setSelectedRiskIds] = useState<number[]>([]);
  const [linkingRisks, setLinkingRisks] = useState(false);
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskError, setRiskError] = useState<string | null>(null);

  const ev = meta?.evidence ?? null;
  const risks: Risk[] = Array.isArray(meta?.risks) ? meta.risks : [];

  const filteredRisks = useMemo(() => {
    const q = riskQuery.trim().toLowerCase();
    if (!q) return allRisks;
    return allRisks.filter((r) =>
      `${r.id} ${r.title ?? ""} ${r.risk_level ?? ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [allRisks, riskQuery]);

  async function fetchAll() {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const [detailRes, filesRes] = await Promise.all([
        fetch(`${EVIDENCE_BASE}/${evidenceId}/detail`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${EVIDENCE_BASE}/${evidenceId}/files`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const detailJson = await safeFetch(detailRes);
      const filesJson = await safeFetch(filesRes);

      setMeta(detailJson);
      setFiles(Array.isArray(filesJson) ? filesJson : []);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load evidence");
    }
  }

  async function fetchRisks() {
    const token = getToken();
    if (!token) return;

    setRiskLoading(true);
    setRiskError(null);

    try {
      const res = await fetch(
        `${EVIDENCE_BASE}/${evidenceId}/available-risks`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to load available risks");
      }

      const json = await res.json();
      const raw = Array.isArray(json)
        ? json
        : Array.isArray(json?.items)
        ? json.items
        : [];

      setAllRisks(
        raw.map((r: any) => ({
          id: Number(r.id ?? r.risk_id),
          title: r.title ?? r.risk_title ?? `Risk #${r.id ?? r.risk_id}`,
          score: r.score ?? undefined,
          risk_level: r.risk_level ?? undefined,
        }))
      );
    } catch (err: any) {
      setAllRisks([]);
      setRiskError(err.message || "Failed to load available risks");
    } finally {
      setRiskLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
  }, [evidenceId]);

  async function uploadFiles(fileList: FileList | null) {
    const token = getToken();
    if (!fileList || !token) return;

    const fd = new FormData();
    Array.from(fileList).forEach((f) => fd.append("files", f));

    const res = await fetch(`${EVIDENCE_BASE}/${evidenceId}/files`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });

    if (!res.ok) {
      setError((await res.text()) || "File upload failed");
      return;
    }

    await fetchAll();
  }

  async function fileAction(
    fileId: number,
    action: "submit" | "approve" | "reject" | "rollback"
  ) {
    const token = getToken();
    if (!token) return;

    const res = await fetch(`${API_URL}/evidences/files/${fileId}/${action}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      setError((await res.text()) || `File ${action} failed`);
      return;
    }

    await fetchAll();
  }

  async function deleteFile(fileId: number) {
    const token = getToken();
    if (!token) return;
    if (!confirm("Remove this file?")) return;

    const res = await fetch(`${API_URL}/evidences/files/${fileId}/delete`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      setError((await res.text()) || "Remove failed");
      return;
    }

    await fetchAll();
  }

  async function openRiskModal() {
    setRiskQuery("");
    setSelectedRiskIds([]);
    setRiskError(null);
    setShowRiskModal(true);
    await fetchRisks();
  }

  function toggleRiskSelection(id: number) {
    setSelectedRiskIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function linkSelectedRisks() {
    const token = getToken();
    if (!token || selectedRiskIds.length === 0 || files.length === 0) return;

    setLinkingRisks(true);
    setRiskError(null);

    try {
      const res = await fetch(`${EVIDENCE_BASE}/${evidenceId}/link-risk`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ risk_ids: selectedRiskIds }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Risk linking failed");
      }

      await fetchAll();
      setShowRiskModal(false);
    } catch (err: any) {
      setRiskError(err.message || "Risk linking failed");
    } finally {
      setLinkingRisks(false);
    }
  }

  async function unlinkRisk(riskId: number) {
    const token = getToken();
    if (!token) return;
    if (!confirm("Unlink this risk?")) return;

    const res = await fetch(`${EVIDENCE_BASE}/${evidenceId}/unlink-risk`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ risk_id: riskId }),
    });

    if (!res.ok) {
      setError((await res.text()) || "Unlink failed");
      return;
    }

    await fetchAll();
  }

  if (error) {
    return <div className="p-6 text-red-400 text-sm">{error}</div>;
  }

if (!ev) return null;

  const evidenceStatus = normalizeStatus(ev.status);
  const coverageStatus =
    ev.coverage_status ??
    ev.coverage ??
    meta?.coverage ??
    "Not assessed";

  const approvalStatus =
    ev.approval_status ??
    meta?.approval_status ??
    (evidenceStatus === "approved" ? "Approved" : "Pending");

  const evidenceTitle =
    ev.title ??
    ev.name ??
    ev.evidence_title ??
    "Evidence Detail";

  const standardLabel =
    ev.standard_code ??
    ev.standard ??
    meta?.standard_code ??
    "Standard";

  const requirementLabel =
    ev.requirement_code ??
    ev.requirement ??
    meta?.requirement_code ??
    "Requirement";

  const controlLabel =
    ev.control_code ??
    ev.control ??
    meta?.control_code ??
    "Control";

  return (
    <div className="min-h-full bg-[#f7f9fc] px-6 py-8 text-slate-950">
      <div className="mx-auto max-w-[1440px] space-y-6">

        {/* =====================================================
            PAGE HEADER
        ====================================================== */}

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

          <div className="min-w-0">

            <button
              onClick={() => router.back()}
              className="mb-4 inline-flex items-center text-sm font-medium text-slate-500 transition hover:text-slate-900"
            >
              ← Evidence Library
            </button>

            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-600">
              Evidence Intelligence
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-[28px] font-semibold tracking-tight text-slate-950">
                {evidenceTitle}
              </h1>

              <EvidenceStatusBadge
                status={evidenceStatus}
                size="sm"
              />
            </div>

            <div className="mt-2 text-sm text-slate-500">
              Evidence ID: <span className="font-semibold text-slate-700">EV-{evidenceId}</span>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">

              <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                {standardLabel}
              </span>

              <span className="text-slate-300">→</span>

              <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                {requirementLabel}
              </span>

              <span className="text-slate-300">→</span>

              <span className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                {controlLabel}
              </span>

            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">

            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Evidence Record
            </div>

            <div className="mt-1 text-lg font-semibold text-slate-950">
              EV-{evidenceId}
            </div>

            <div className="mt-1 text-xs text-slate-500">
              Controlled evidence object
            </div>

          </div>
        </div>

        {/* =====================================================
            KPI STRIP
        ====================================================== */}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Status
            </div>
            <div className="mt-3">
              <EvidenceStatusBadge
                status={evidenceStatus}
                size="sm"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Coverage
            </div>
            <div className="mt-3 text-lg font-semibold text-slate-950">
              {String(coverageStatus)}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Approval
            </div>
            <div className="mt-3 text-lg font-semibold text-slate-950">
              {String(approvalStatus)}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Versions
            </div>
            <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              {files.length}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Linked Risks
            </div>
            <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              {risks.length}
            </div>
          </div>

        </section>

        {/* =====================================================
            EVIDENCE OVERVIEW
        ====================================================== */}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-100 px-6 py-5">

            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-600">
              Evidence Overview
            </div>

            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              Governance Context
            </h2>

          </div>

          <div className="grid gap-8 px-6 py-6 lg:grid-cols-[1.5fr_1fr]">

            <div>

              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Description
              </div>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                {ev.description ??
                  ev.compliance_context ??
                  "No description has been provided for this evidence record."}
              </p>

            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-5">

              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Owner
                </div>
                <div className="mt-1.5 text-sm font-semibold text-slate-900">
                  {ev.owner_name ?? ev.owner ?? "Not assigned"}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Assessment
                </div>
                <div className="mt-1.5 text-sm font-semibold capitalize text-slate-900">
                  {ev.assessment_type ?? "—"}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Created
                </div>
                <div className="mt-1.5 text-sm font-medium text-slate-700">
                  {fmt(ev.created_at)}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Updated
                </div>
                <div className="mt-1.5 text-sm font-medium text-slate-700">
                  {fmt(ev.updated_at)}
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* =====================================================
            RELATED RISKS
        ====================================================== */}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-600">
                Risk Intelligence
              </div>

              <h2 className="mt-1 text-lg font-semibold text-slate-950">
                Related Risks
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Evidence-to-risk traceability.
              </p>
            </div>

            <button
              onClick={openRiskModal}
              className="inline-flex items-center justify-center rounded-xl bg-[#0b5cff] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#084ed6]"
            >
              + Add Related Risk
            </button>

          </div>

          <div className="p-6">

            {risks.length === 0 ? (

              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">

                <div className="text-sm font-semibold text-slate-700">
                  No related risks
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  Link a risk to establish evidence traceability.
                </div>

              </div>

            ) : (

              <div className="overflow-hidden rounded-xl border border-slate-200">

                <div className="grid grid-cols-[minmax(0,1fr)_120px_100px_90px] gap-4 bg-slate-50 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">

                  <span>Risk</span>
                  <span>Level</span>
                  <span>Score</span>
                  <span className="text-right">Action</span>

                </div>

                {risks.map((r) => (

                  <div
                    key={r.id}
                    className="grid grid-cols-[minmax(0,1fr)_120px_100px_90px] items-center gap-4 border-t border-slate-100 px-4 py-4"
                  >

                    <div className="min-w-0">

                      <div className="flex items-center gap-2">

                        <span className="rounded-md bg-slate-900 px-2 py-1 text-[10px] font-bold text-white">
                          RISK-{r.id}
                        </span>

                        <span className="truncate text-sm font-semibold text-slate-900">
                          {r.title}
                        </span>

                      </div>

                    </div>

                    <div className="text-xs font-semibold text-slate-600">
                      {r.risk_level ?? "—"}
                    </div>

                    <div className="text-sm font-semibold text-slate-900">
                      {r.score ?? "—"}
                    </div>

                    <div className="text-right">

                      <button
                        onClick={() => unlinkRisk(r.id)}
                        className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        Unlink
                      </button>

                    </div>

                  </div>

                ))}

              </div>

            )}

          </div>
        </section>

        {/* =====================================================
            FILES & VERSIONS
        ====================================================== */}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-600">
                Evidence Lifecycle
              </div>

              <h2 className="mt-1 text-lg font-semibold text-slate-950">
                Files & Versions
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Controlled evidence files, versions and approval lifecycle.
              </p>

            </div>

            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
              {files.length} {files.length === 1 ? "version" : "versions"}
            </div>

          </div>

          <div className="p-6">

            {/* VERSION UPLOAD */}

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                uploadFiles(e.dataTransfer.files);
              }}
              className={`rounded-2xl border-2 border-dashed p-7 text-center transition ${
                dragOver
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 bg-slate-50/70 hover:border-blue-300"
              }`}
            >

              <div className="text-sm font-semibold text-slate-800">
                Upload New Evidence Version
              </div>

              <div className="mt-1 text-xs text-slate-500">
                Drag & drop documents here or select files manually.
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Upload New Version
              </button>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => uploadFiles(e.target.files)}
              />

            </div>

            {/* VERSION TABLE */}

            <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">

              <div className="hidden grid-cols-[90px_minmax(0,1fr)_180px_150px_260px] gap-4 bg-slate-50 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 lg:grid">

                <span>Version</span>
                <span>File</span>
                <span>Uploaded</span>
                <span>Status</span>
                <span className="text-right">Actions</span>

              </div>

              {files.length === 0 ? (

                <div className="px-6 py-10 text-center">

                  <div className="text-sm font-semibold text-slate-700">
                    No evidence files
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    Upload the first controlled evidence version above.
                  </div>

                </div>

              ) : (

                <div>

                  {files.map((f) => {

                    const status = normalizeStatus(f.status);

                    return (
                      <div
                        key={f.id}
                        className="grid gap-4 border-t border-slate-100 px-4 py-4 lg:grid-cols-[90px_minmax(0,1fr)_180px_150px_260px] lg:items-center"
                      >

                        <div>
                          <span className="inline-flex rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-bold text-white">
                            v{f.version}
                          </span>
                        </div>

                        <div className="min-w-0">

                          <div className="truncate text-sm font-semibold text-slate-900">
                            {f.file_name}
                          </div>

                          <div className="mt-1 text-xs text-slate-400">
                            File ID {f.id}
                          </div>

                        </div>

                        <div className="text-xs text-slate-500">
                          {fmt(f.uploaded_at)}
                        </div>

                        <div>
                          <EvidenceStatusBadge
                            status={status}
                            size="sm"
                          />
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2">

                          {(status === "uploaded" || status === "rejected") && (
                            <button
                              onClick={() => fileAction(f.id, "submit")}
                              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                            >
                              Submit
                            </button>
                          )}

                          {status === "waiting_approval" && (
                            <>
                              <button
                                onClick={() => fileAction(f.id, "approve")}
                                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                              >
                                Approve
                              </button>

                              <button
                                onClick={() => fileAction(f.id, "reject")}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {status === "approved" && (
                            <button
                              onClick={() => fileAction(f.id, "rollback")}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              Rollback
                            </button>
                          )}

                          <button
                            onClick={() => deleteFile(f.id)}
                            className="rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          >
                            Remove
                          </button>

                        </div>

                      </div>
                    );
                  })}

                </div>

              )}

            </div>
          </div>
        </section>

        {/* =====================================================
            RISK LINK MODAL
        ====================================================== */}

        {showRiskModal && (

          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">

            <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">

              <div className="border-b border-slate-100 px-6 py-5">

                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-600">
                  Risk Intelligence
                </div>

                <h3 className="mt-1 text-lg font-semibold text-slate-950">
                  Link Risks
                </h3>

              </div>

              <div className="min-h-0 flex-1 p-6">

                {files.length === 0 ? (

                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    Upload at least one evidence file before linking risks.
                  </div>

                ) : (

                  <>
                    <input
                      value={riskQuery}
                      onChange={(e) => setRiskQuery(e.target.value)}
                      placeholder="Search risks by ID, title or level..."
                      className="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    />

                    <div className="max-h-[48vh] overflow-y-auto">

                      {riskLoading ? (

                        <div className="py-8 text-center text-sm text-slate-500">
                          Loading available risks…
                        </div>

                      ) : riskError ? (

                        <div className="whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                          {riskError}
                        </div>

                      ) : filteredRisks.length === 0 ? (

                        <div className="py-8 text-center text-sm text-slate-500">
                          No available risks found.
                        </div>

                      ) : (

                        filteredRisks.map((r) => (

                          <label
                            key={r.id}
                            className="mb-2 flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:bg-blue-50/30"
                          >

                            <input
                              type="checkbox"
                              checked={selectedRiskIds.includes(r.id)}
                              onChange={() => toggleRiskSelection(r.id)}
                            />

                            <div className="min-w-0 flex-1">

                              <div className="text-sm font-semibold text-slate-900">

                                RISK-{r.id}

                                <span className="ml-2 font-normal text-slate-500">
                                  {r.title}
                                </span>

                              </div>

                              <div className="mt-1 text-xs text-slate-500">
                                Score: {r.score ?? "-"} · Level: {r.risk_level ?? "-"}
                              </div>

                            </div>

                          </label>

                        ))

                      )}

                    </div>
                  </>
                )}

              </div>

              <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">

                <div className="text-xs text-slate-500">

                  {selectedRiskIds.length > 0
                    ? `${selectedRiskIds.length} risk${selectedRiskIds.length > 1 ? "s" : ""} selected`
                    : "No risks selected"}

                </div>

                <div className="flex gap-2">

                  <button
                    onClick={() => setShowRiskModal(false)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={linkSelectedRisks}
                    disabled={
                      linkingRisks ||
                      selectedRiskIds.length === 0 ||
                      files.length === 0
                    }
                    className="rounded-xl bg-[#0b5cff] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#084ed6] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {linkingRisks ? "Adding…" : "Link Selected Risks"}
                  </button>

                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
