"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

export default function EvidenceUploadPage() {

  const [evidenceId, setEvidenceId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function upload() {

    if (!file || !evidenceId) {
      alert("Select file and evidence id");
      return;
    }

    try {

      setUploading(true);

      const form = new FormData();
      form.append("file", file);

      const res = await apiFetch(`/evidences/${evidenceId}/files`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        console.error("UPLOAD FAILED", res.status);
        return;
      }

      alert("File uploaded");

      setFile(null);
      setEvidenceId("");

    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }

  }

  return (

    <div className="p-6 space-y-6">

      <div>
        <div className="text-xs text-slate-400">
          Evidence
        </div>

        <div className="text-xl text-white font-semibold">
          Upload Evidence File
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded p-4 space-y-4">

        <div className="space-y-1">

          <div className="text-xs text-slate-400">
            Evidence ID
          </div>

          <input
            value={evidenceId}
            onChange={(e) => setEvidenceId(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm"
          />

        </div>

        <div className="space-y-1">

          <div className="text-xs text-slate-400">
            File
          </div>

          <input
            type="file"
            onChange={(e) =>
              setFile(e.target.files ? e.target.files[0] : null)
            }
            className="text-sm"
          />

        </div>

        <button
          disabled={uploading}
          onClick={upload}
          className="bg-blue-600 px-4 py-2 rounded text-sm"
        >
          Upload
        </button>

      </div>

    </div>
  );

}