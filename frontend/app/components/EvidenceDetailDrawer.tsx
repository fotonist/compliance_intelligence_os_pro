"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type EvidenceFile = {
  id: number;
  version: number;
  file_name?: string;
  status: string;
  uploaded_at?: string;
  available_actions?: string[];
};

type EvidenceDetail = {
  id: number;
  title?: string;
  description?: string;
  status?: string;
  control_id?: number;
};

type RiskLink = {
  risk_id: number;
  risk_title?: string;
};

type Props = {
  evidenceId: number | null;
  open: boolean;
  onClose: () => void;
};

export default function EvidenceDetailDrawer({
  evidenceId,
  open,
  onClose,
}: Props) {

  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [evidence, setEvidence] = useState<EvidenceDetail | null>(null);
  const [risks, setRisks] = useState<RiskLink[]>([]);

  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejectFileId, setRejectFileId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  async function loadFiles() {

    if (!evidenceId) return;

    try {

      setLoading(true);

      const res = await apiFetch(`/evidences/${evidenceId}/files`);

      if (!res.ok) {
        setFiles([]);
        return;
      }

      const json = await res.json();

      if (Array.isArray(json)) setFiles(json);
      else setFiles([]);

    } catch (err) {
      console.error(err);
      setFiles([]);
    } finally {
      setLoading(false);
    }

  }

  async function loadEvidence() {

    if (!evidenceId) return;

    try {

      const res = await apiFetch(`/evidences/${evidenceId}/detail`);

      if (!res.ok) {
        setEvidence(null);
        return;
      }

      const json = await res.json();

      setEvidence(json?.evidence ?? null);
      setRisks(json?.risks ?? []);

    } catch (err) {
      console.error(err);
      setEvidence(null);
      setRisks([]);
    }

  }

  useEffect(() => {

    if (open && evidenceId) {
      loadFiles();
      loadEvidence();
    }

  }, [open, evidenceId]);

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {

    if (!e.target.files || !evidenceId) return;

    const form = new FormData();

    for (const f of Array.from(e.target.files)) {
      form.append("files", f);
    }

    const res = await apiFetch(`/evidences/${evidenceId}/files`, {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      console.error("UPLOAD FAILED");
      return;
    }

    await loadFiles();
  }

  async function submitFile(fileId: number) {

    setBusyId(fileId);

    const res = await apiFetch(`/evidences/files/${fileId}/submit`, {
      method: "POST",
    });

    if (!res.ok) console.error("SUBMIT FAILED");

    await loadFiles();
    setBusyId(null);
  }

  async function approveFile(fileId: number) {

    setBusyId(fileId);

    const res = await apiFetch(`/evidences/files/${fileId}/approve`, {
      method: "POST",
    });

    if (!res.ok) console.error("APPROVE FAILED");

    await loadFiles();
    setBusyId(null);
  }

  async function rejectFile() {

    if (!rejectFileId) return;

    setBusyId(rejectFileId);

    const res = await apiFetch(`/evidences/files/${rejectFileId}/reject`, {
      method: "POST",
    });

    if (!res.ok) console.error("REJECT FAILED");

    setRejectFileId(null);
    setRejectReason("");

    await loadFiles();
    setBusyId(null);
  }

  async function rollbackFile(fileId: number) {

    setBusyId(fileId);

    const res = await apiFetch(`/evidences/files/${fileId}/rollback`, {
      method: "POST",
    });

    if (!res.ok) console.error("ROLLBACK FAILED");

    await loadFiles();
    setBusyId(null);
  }

  if (!open) return null;

  return (

    <div className="fixed right-0 top-0 w-[520px] h-full bg-slate-900 border-l border-slate-800 p-6 overflow-y-auto z-40">

      {/* Header */}

      <div className="flex justify-between items-center mb-6">

        <div className="text-white font-semibold text-lg">
          Evidence Detail
        </div>

        <button
          onClick={onClose}
          className="text-sm text-slate-400"
        >
          Close
        </button>

      </div>

      {/* Evidence Info */}

      {evidence && (

        <div className="mb-6 space-y-2 border border-slate-800 bg-slate-950 p-4 rounded">

          <div className="text-sm text-white font-medium">
            {evidence.title ?? "Untitled Evidence"}
          </div>

          <div className="text-xs text-slate-400">
            Evidence ID: {evidence.id}
          </div>

          <div className="text-xs text-slate-400">
            Status: {evidence.status ?? "-"}
          </div>

          <div className="text-xs text-slate-500">
            Control: {evidence.control_id ?? "-"}
          </div>

        </div>

      )}

      {/* Linked Risks */}

      <div className="mb-6">

        <div className="text-sm text-slate-400 mb-2">
          Linked Risks
        </div>

        {risks.length === 0 && (
          <div className="text-xs text-slate-500">
            No linked risks
          </div>
        )}

        {risks.map((r) => (

          <div
            key={r.risk_id}
            className="text-xs text-white bg-slate-800 px-2 py-1 rounded mb-1"
          >
            {r.risk_title ?? `Risk ${r.risk_id}`}
          </div>

        ))}

      </div>

      {/* Upload */}

      <div className="mb-6">

        <div className="text-sm text-slate-300 mb-2">
          Upload File
        </div>

        <input
          type="file"
          multiple
          onChange={uploadFile}
          className="text-xs text-white"
        />

      </div>

      {/* Files */}

      <div className="space-y-2">

        <div className="text-sm text-slate-400">
          Files ({files.length})
        </div>

        {loading && (
          <div className="text-xs text-slate-500">
            Loading files...
          </div>
        )}

        {!loading && files.length === 0 && (
          <div className="text-xs text-slate-500">
            No files uploaded for this evidence.
          </div>
        )}

        {files.map((f) => {

          const uploaded =
            f.uploaded_at
              ? new Date(f.uploaded_at).toLocaleDateString()
              : "-";

          return (

            <div
              key={f.id}
              className="border border-slate-800 bg-slate-950 p-3 rounded flex justify-between items-center"
            >

              <div>

                <div className="text-xs text-white">
                  v{f.version} — {f.file_name ?? "Unnamed file"}
                </div>

                <div className="text-xs text-slate-500">
                  Status: {f.status}
                </div>

                <div className="text-xs text-slate-600">
                  Uploaded: {uploaded}
                </div>

              </div>

              <div className="flex gap-2">

                {f.available_actions?.includes("submit") && (
                  <button
                    disabled={busyId === f.id}
                    onClick={() => submitFile(f.id)}
                    className="text-xs bg-blue-600 px-2 py-1 rounded"
                  >
                    Submit
                  </button>
                )}

                {f.available_actions?.includes("approve") && (
                  <button
                    disabled={busyId === f.id}
                    onClick={() => approveFile(f.id)}
                    className="text-xs bg-green-600 px-2 py-1 rounded"
                  >
                    Approve
                  </button>
                )}

                {f.available_actions?.includes("reject") && (
                  <button
                    disabled={busyId === f.id}
                    onClick={() => setRejectFileId(f.id)}
                    className="text-xs bg-red-600 px-2 py-1 rounded"
                  >
                    Reject
                  </button>
                )}

                {f.available_actions?.includes("rollback") && (
                  <button
                    disabled={busyId === f.id}
                    onClick={() => rollbackFile(f.id)}
                    className="text-xs bg-yellow-600 px-2 py-1 rounded"
                  >
                    Rollback
                  </button>
                )}

              </div>

            </div>

          );

        })}

      </div>

      {/* Reject Modal */}

      {rejectFileId && (

        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">

          <div className="bg-slate-900 border border-slate-700 p-6 rounded w-[400px]">

            <div className="text-white mb-3">
              Reject Reason
            </div>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full bg-slate-800 text-white text-sm p-2 rounded"
            />

            <div className="flex justify-end gap-2 mt-4">

              <button
                onClick={() => setRejectFileId(null)}
                className="text-xs px-3 py-1 bg-slate-700 rounded"
              >
                Cancel
              </button>

              <button
                onClick={rejectFile}
                className="text-xs px-3 py-1 bg-red-600 rounded"
              >
                Reject
              </button>

            </div>

          </div>

        </div>

      )}

    </div>

  );
}