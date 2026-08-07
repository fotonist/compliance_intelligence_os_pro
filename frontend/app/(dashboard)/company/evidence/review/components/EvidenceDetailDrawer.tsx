"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/api";
import { X } from "lucide-react";

type Evidence = {
  id: number;
  title?: string;
  description?: string;
  status?: string;
  created_at?: string;
};

type EvidenceFile = {
  id: number;
  filename?: string;
  uploaded_at?: string;
};

type RiskLink = {
  risk_id: number;
  risk_title?: string;
  score?: number | null;
  risk_level?: string | null;
};

type Risk = {
  id: number;
  title?: string;
};

export default function EvidenceDetailDrawer({
  evidenceId,
  open,
  onClose,
}: {
  evidenceId: number | null;
  open: boolean;
  onClose: () => void;
}) {

  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [risks, setRisks] = useState<RiskLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // 🔥 NEW
  const [riskModalOpen, setRiskModalOpen] = useState(false);
  const [allRisks, setAllRisks] = useState<Risk[]>([]);
  const [selectedRisks, setSelectedRisks] = useState<number[]>([]);

  async function load() {
    if (!evidenceId) return;

    setLoading(true);

    try {

      const evRes = await apiFetch(`/evidences/${evidenceId}`);

      if (evRes.ok) {
        const ev = await evRes.json();
        setEvidence(ev.evidence ?? ev); // 🔥 FIX
      } else {
        setEvidence(null);
      }

      const fileRes = await apiFetch(`/evidences/${evidenceId}/files`);

      if (fileRes.ok) {
        const f = await fileRes.json();
        setFiles(Array.isArray(f) ? f : f.items ?? []);
      } else {
        setFiles([]);
      }

      const riskRes = await apiFetch(`/evidences/${evidenceId}/risks`);

      if (riskRes.ok) {
        const r = await riskRes.json();
        setRisks(Array.isArray(r) ? r : []);
      } else {
        setRisks([]);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadAllRisks() {
    const res = await apiFetch("/risks");
    const data = await res.json();
    setAllRisks(data.items ?? data);
  }

  useEffect(() => {
    if (!open || !evidenceId) return;
    load();
  }, [open, evidenceId]);

  useEffect(() => {
    if (riskModalOpen) {
      loadAllRisks();
    }
  }, [riskModalOpen]);

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {

    if (!e.target.files || !e.target.files[0] || !evidenceId) return;

    const file = e.target.files[0];

    const form = new FormData();
    form.append("files", file);

    try {

      setUploading(true);

      const res = await apiFetch(`/evidences/${evidenceId}/files`, {
        method: "POST",
        body: form
      });

      if (!res.ok) {
        console.error("UPLOAD FAILED", res.status);
        return;
      }

      await load();

    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  }

  async function deleteFile(fileId: number) {

    if (!confirm("Delete file?")) return;

    try {

      const res = await apiFetch(`/evidences/files/${fileId}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        console.error("DELETE FAILED", res.status);
        return;
      }

      setFiles(files.filter(f => f.id !== fileId));

    } catch (err) {
      console.error(err);
    }
  }

  // 🔥 NEW
  async function linkRisks() {
    if (!evidenceId || selectedRisks.length === 0) return;

    await apiFetch(`/evidences/${evidenceId}/link-risk`, {
      method: "POST",
      body: JSON.stringify({
        risk_ids: selectedRisks,
      }),
    });

    setRiskModalOpen(false);
    setSelectedRisks([]);
    await load();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">

      <div className="w-[520px] h-full bg-slate-950 border-l border-slate-800 p-6 overflow-y-auto">

        <div className="flex justify-between items-center mb-6">

          <div className="text-lg font-semibold text-white">
            Evidence Detail
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>

        </div>

        {loading && (
          <div className="text-sm text-slate-400">
            Loading evidence...
          </div>
        )}

        {!loading && !evidence && (
          <div className="text-sm text-slate-500">
            Evidence not found
          </div>
        )}

        {!loading && evidence && (

          <div className="space-y-6">

            <div>
              <div className="text-xs text-slate-400">Title</div>
              <div className="text-white">
                {evidence.title ?? "Untitled"}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-400">Status</div>
              <div className="text-white">
                {evidence.status ?? "-"}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-400">Created</div>
              <div className="text-white">
                {evidence.created_at
                  ? new Date(evidence.created_at).toLocaleString()
                  : "-"}
              </div>
            </div>

            <div>

              <div className="flex justify-between items-center mb-2">

                <div className="text-xs text-slate-400">
                  Files
                </div>

                <label className="text-xs bg-blue-600 px-2 py-1 rounded cursor-pointer">

                  {uploading ? "Uploading..." : "Upload"}

                  <input
                    type="file"
                    className="hidden"
                    onChange={uploadFile}
                  />

                </label>

              </div>

              {files.length === 0 && (
                <div className="text-xs text-slate-500">
                  No files
                </div>
              )}

              <div className="space-y-2">

                {files.map((f) => (

                  <div
                    key={f.id}
                    className="border border-slate-800 bg-slate-900 p-2 rounded flex justify-between items-center"
                  >

                    <div className="text-sm text-white">
                      {f.filename ?? `file_${f.id}`}
                    </div>

                    <button
                      onClick={() => deleteFile(f.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>

                  </div>

                ))}

              </div>

            </div>

            <div>

              <div className="flex justify-between items-center mb-2">
                <div className="text-xs text-slate-400">
                  Linked Risks
                </div>

                {/* 🔥 NEW BUTTON */}
                <button
                  onClick={() => setRiskModalOpen(true)}
                  className="text-xs bg-blue-600 px-2 py-1 rounded"
                >
                  + Link Risk
                </button>
              </div>

              {risks.length === 0 && (
                <div className="text-xs text-slate-500">
                  No linked risks
                </div>
              )}

              <div className="space-y-2">

                {risks.map((r) => (

  <div
    key={r.risk_id}
    className="border border-slate-800 bg-slate-900 p-3 rounded"
  >

    {/* TITLE */}
    <div className="text-white font-medium">
      {r.risk_title ?? `Risk ${r.risk_id}`}
    </div>

    {/* META */}
    <div className="text-xs text-slate-400 mt-1">
      Score: {r.score ?? "-"} | Level: {r.risk_level ?? "-"}
    </div>

    {/* ACTIONS */}
    <div className="flex gap-3 mt-2">

      {/* VIEW */}
      <button
        onClick={() => window.open(`/risks/${r.risk_id}`, "_blank")}
        className="text-xs text-blue-400 hover:text-blue-300"
      >
        View
      </button>

      {/* UNLINK */}
      <button
        onClick={async () => {
          await apiFetch(`/evidences/${evidenceId}/unlink-risk`, {
            method: "POST",
            body: JSON.stringify({ risk_id: r.risk_id }),
          });
          await load();
        }}
        className="text-xs text-red-400 hover:text-red-300"
      >
        Unlink
      </button>

    </div>

  </div>

))}

              </div>

            </div>

          </div>

        )}

      </div>

      {/* 🔥 MODAL */}
      {riskModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">

          <div className="bg-slate-900 p-4 rounded w-[400px] max-h-[500px] overflow-auto">

            <div className="text-white mb-3">Select Risks</div>

            {allRisks.map((r) => (
              <label key={r.id} className="flex gap-2 text-white mb-2">
                <input
                  type="checkbox"
                  checked={selectedRisks.includes(r.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedRisks(prev => [...prev, r.id]);
                    } else {
                      setSelectedRisks(prev => prev.filter(id => id !== r.id));
                    }
                  }}
                />
                {r.title}
              </label>
            ))}

            <div className="flex justify-end gap-2 mt-4">

              <button
                onClick={() => setRiskModalOpen(false)}
                className="px-3 py-1 bg-gray-600 text-white rounded"
              >
                Cancel
              </button>

              <button
                onClick={linkRisks}
                className="px-3 py-1 bg-green-600 text-white rounded"
              >
                Link
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}