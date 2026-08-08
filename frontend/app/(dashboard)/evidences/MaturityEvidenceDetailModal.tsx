"use client";

import { useEffect, useState } from "react";

const API_BASE = "https://compliance-intelligence-os-pro-2.onrender.com";

type EvidenceFile = {
  id: number;
  file_name: string;
  uploaded_at: string;
};

type Props = {
  evidenceId: number;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
};

function getToken(): string | null {
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token")
  );
}

function isAdminFromToken(token: string | null): boolean {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return Array.isArray(payload.roles) && payload.roles.includes("admin");
  } catch {
    return false;
  }
}

export default function MaturityEvidenceDetailModal({
  evidenceId,
  open,
  onClose,
  onChanged,
}: Props) {
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  async function load() {
    if (!token || !evidenceId) return;

    setLoading(true);
    try {
      const r = await fetch(
        `${API_BASE}/maturity/evidences/${evidenceId}/files`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await r.json();
      setFiles(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  async function deleteFile(fileId: number) {
    if (!token) return;

    const r = await fetch(
      `${API_BASE}/maturity/evidences/${evidenceId}/files/${fileId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (r.ok) {
      load();
      onChanged?.();
    }
  }

  useEffect(() => {
    const t = getToken();
    setToken(t);
    setIsAdmin(isAdminFromToken(t));
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, token]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg border border-slate-700 bg-slate-900 p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-3">
          Evidence Files
        </h3>

        {loading ? (
          <div className="text-xs text-slate-400">Loading…</div>
        ) : files.length === 0 ? (
          <div className="text-xs text-slate-500 italic">
            No files uploaded.
          </div>
        ) : (
          <ul className="space-y-2">
            {files.map((f) => (
              <li
                key={f.id}
                className="flex justify-between items-center text-xs bg-slate-800/50 px-2 py-1 rounded"
              >
                <span>{f.file_name}</span>

                {isAdmin && (
                  <button
                    onClick={() => deleteFile(f.id)}
                    className="text-[10px] px-2 py-0.5 rounded border border-slate-600 text-slate-400 hover:text-slate-200"
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="text-xs px-3 py-1 rounded border border-slate-600 text-slate-400 hover:text-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
