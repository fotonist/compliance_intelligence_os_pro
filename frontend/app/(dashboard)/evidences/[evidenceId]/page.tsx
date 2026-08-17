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

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold text-white">Evidence Detail</h1>
        <button
          onClick={() => router.back()}
          className="text-sm underline text-slate-400"
        >
          ← Back
        </button>
      </div>

      <section className="bg-slate-900 border border-slate-700 rounded-xl p-5">
        <div className="flex justify-between mb-3">
          <h3 className="font-semibold">Related Risks</h3>
          <button
            onClick={openRiskModal}
            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm"
          >
            Add Related Risk
          </button>
        </div>

        {risks.length === 0 ? (
          <div className="text-sm text-slate-500">No related risks.</div>
        ) : (
          risks.map((r) => (
            <div
              key={r.id}
              className="bg-slate-800 p-3 rounded mb-2 flex justify-between"
            >
              <div>
                <b>{r.id}</b> — {r.title}
              </div>
              <button
                onClick={() => unlinkRisk(r.id)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Unlink
              </button>
            </div>
          ))
        )}
      </section>

      <section className="bg-slate-900 border border-slate-700 rounded-xl p-5">
        <h3 className="font-semibold mb-2">Files & Versions</h3>

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
          className={`mb-4 border-2 border-dashed rounded-lg p-4 text-center ${
            dragOver ? "border-emerald-400" : "border-slate-600"
          }`}
        >
          <p className="text-xs text-slate-400">Drag & drop files or</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mt-2 px-3 py-1 text-sm bg-slate-700 rounded"
          >
            Add files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => uploadFiles(e.target.files)}
          />
        </div>

        {files.map((f) => {
          const status = normalizeStatus(f.status);

          return (
            <div
              key={f.id}
              className="bg-slate-800 p-3 rounded mb-2 flex justify-between"
            >
              <div>
                <div className="font-medium">
                  v{f.version} — {f.file_name}
                </div>
                <div className="text-xs text-slate-400">
                  Uploaded @ {fmt(f.uploaded_at)}
                </div>
              </div>

              <div className="flex gap-2 items-center">
                <EvidenceStatusBadge status={status} />

                {(status === "uploaded" || status === "rejected") && (
                  <button
                    onClick={() => fileAction(f.id, "submit")}
                    className="px-2 py-1 text-xs bg-blue-700 rounded"
                  >
                    Submit
                  </button>
                )}

                {status === "waiting_approval" && (
                  <>
                    <button
                      onClick={() => fileAction(f.id, "approve")}
                      className="px-2 py-1 text-xs bg-emerald-700 rounded"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => fileAction(f.id, "reject")}
                      className="px-2 py-1 text-xs bg-slate-700 rounded"
                    >
                      Reject
                    </button>
                  </>
                )}

                {status === "approved" && (
                  <button
                    onClick={() => fileAction(f.id, "rollback")}
                    className="px-2 py-1 text-xs bg-slate-700 rounded"
                  >
                    Rollback
                  </button>
                )}

                <button
                  onClick={() => deleteFile(f.id)}
                  className="text-[11px] text-slate-400 hover:text-slate-200"
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {showRiskModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <h3 className="text-lg font-semibold mb-3 text-white">Link Risks</h3>

            {files.length === 0 ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                Upload at least one evidence file before linking risks.
              </div>
            ) : (
              <>
                <input
                  value={riskQuery}
                  onChange={(e) => setRiskQuery(e.target.value)}
                  placeholder="Search risks by ID, title or level..."
                  className="w-full mb-4 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder:text-slate-500 outline-none focus:border-slate-500"
                />

                <div className="overflow-y-auto flex-1 min-h-0 pr-1">
                  {riskLoading ? (
                    <div className="text-sm text-slate-400 py-4">
                      Loading available risks…
                    </div>
                  ) : riskError ? (
                    <div className="text-sm text-red-400 py-4 whitespace-pre-wrap">
                      {riskError}
                    </div>
                  ) : filteredRisks.length === 0 ? (
                    <div className="text-sm text-slate-400 py-4">
                      No available risks found.
                    </div>
                  ) : (
                    filteredRisks.map((r) => (
                      <label
                        key={r.id}
                        className="flex items-center gap-3 p-3 mb-2 rounded-lg bg-slate-800 hover:bg-slate-750 cursor-pointer border border-transparent hover:border-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={selectedRiskIds.includes(r.id)}
                          onChange={() => toggleRiskSelection(r.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-white">
                            <span className="font-semibold">RISK-{r.id}</span>
                            <span className="text-slate-300"> — {r.title}</span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            Score: {r.score ?? "-"} · Level: {r.risk_level ?? "-"}
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </>
            )}

            <div className="flex justify-between items-center gap-2 mt-4 pt-4 border-t border-slate-800">
              <div className="text-xs text-slate-500">
                {selectedRiskIds.length > 0
                  ? `${selectedRiskIds.length} risk${selectedRiskIds.length > 1 ? "s" : ""} selected`
                  : "No risks selected"}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowRiskModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={linkSelectedRisks}
                  disabled={linkingRisks || selectedRiskIds.length === 0 || files.length === 0}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {linkingRisks ? "Adding…" : "ADD"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
