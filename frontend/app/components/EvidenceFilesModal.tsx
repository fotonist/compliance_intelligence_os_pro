"use client";

import { useEffect, useState } from "react";

type EvidenceFile = {
  id?: number;
  filename: string;
  url: string;
};

type Props = {
  evidenceId: number;
  open: boolean;
  onClose: () => void;
};

const API_URL = "http://127.0.0.1:8000";

export default function EvidenceFilesModal({
  evidenceId,
  open,
  onClose,
}: Props) {
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    async function loadFiles() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `${API_URL}/evidences/${evidenceId}/files`,
          { cache: "no-store" }
        );

        if (!res.ok) {
          throw new Error(`Failed to load files (${res.status})`);
        }

        const data = await res.json();
        setFiles(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setError("Failed to load files");
      } finally {
        setLoading(false);
      }
    }

    loadFiles();
  }, [open, evidenceId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-xl bg-slate-900 p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            Evidence Files
          </h3>
          <button
            onClick={onClose}
            className="text-xl text-slate-400 hover:text-white"
          >
            ×
          </button>
        </div>

        {loading && (
          <div className="text-slate-400">Loading files…</div>
        )}

        {error && (
          <div className="text-sm text-red-400">{error}</div>
        )}

        {!loading && !error && files.length === 0 && (
          <div className="text-slate-400">
            No files uploaded for this evidence.
          </div>
        )}

        {!loading && files.length > 0 && (
          <ul className="space-y-2">
            {files.map((file, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between rounded bg-slate-800 px-3 py-2"
              >
                <span className="text-slate-200">
                  {file.filename}
                </span>

                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-sky-400 hover:underline"
                >
                  Open
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

