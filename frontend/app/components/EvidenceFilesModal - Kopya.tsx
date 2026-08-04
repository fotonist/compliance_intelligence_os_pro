"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

type EvidenceFile = {
  id: number;
  file_name: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
  download_url?: string;
};

type EvidenceFilesModalProps = {
  evidenceId: number | null;
  evidenceTitle?: string;
  open: boolean;
  onClose: () => void;
};

type FetchState = "idle" | "loading" | "error";

export default function EvidenceFilesModal({
  evidenceId,
  evidenceTitle,
  open,
  onClose,
}: EvidenceFilesModalProps) {
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>("idle");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<number | null>(null);

  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const getAuthHeaders = () => {
    if (typeof window === "undefined") return {};
    const token = localStorage.getItem("token");
    return token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {};
  };

  const loadFiles = useCallback(async () => {
    if (!evidenceId || !open) return;
    setFetchState("loading");
    try {
      const res = await fetch(`${API_BASE_URL}/evidences/${evidenceId}/files`, {
        headers: { ...getAuthHeaders() },
      });

      if (!res.ok) throw new Error(`Failed to load files: ${res.status}`);

      const data = (await res.json()) as EvidenceFile[];
      setFiles(data);
      setFetchState("idle");
    } catch (err) {
      console.error(err);
      setFetchState("error");
    }
  }, [evidenceId, open]);

  useEffect(() => {
    if (open) loadFiles();
    else {
      setFiles([]);
      setFetchState("idle");
    }
  }, [open, loadFiles]);

  const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const formatSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    const kb = size / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (!evidenceId) return;
    const dt = e.dataTransfer;
    if (!dt.files || dt.files.length === 0) return;

    await uploadFiles(dt.files);
  };

  // ✔ DÜZGÜN TEK VERSİYON uploadFiles
  const uploadFiles = async (incoming: FileList | File[]) => {
    try {
      setUploading(true);
      setUploadError(null);

      const form = new FormData();
      Array.from(incoming).forEach((f) => form.append("files", f)); // ✔ doğru field name

      const res = await fetch(
        `${API_BASE_URL}/evidences/${evidenceId}/files`,
        {
          method: "POST",
          headers: { ...getAuthHeaders() },
          body: form,
        }
      );

      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);

      await loadFiles();
    } catch (err) {
      console.error(err);
      setUploadError("Dosya yüklenirken hata oluştu.");
    } finally {
      setUploading(false);
    }
  };

  const handleFileInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!e.target.files) return;
    await uploadFiles(e.target.files);
    e.target.value = "";
  };

  const handleDelete = async (fileId: number) => {
    setDeleteLoadingId(fileId);

    try {
      const res = await fetch(`${API_BASE_URL}/evidences/file/${fileId}`, {
        method: "DELETE",
        headers: { ...getAuthHeaders() },
      });

      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);

      setFiles((prev) => prev.filter((x) => x.id !== fileId));
    } catch (err) {
      console.error(err);
      alert("Dosya silinirken hata oluştu.");
    } finally {
      setDeleteLoadingId(null);
    }
  };

  const handleDownload = (file: EvidenceFile) => {
    const url =
      file.download_url ||
      `${API_BASE_URL}/evidences/file/${file.id}/download`;
    window.open(url, "_blank");
  };

  if (!open || !evidenceId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackgroundClick}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-neutral-900 p-4 text-neutral-50 shadow-xl">
        {/* HEADER */}
        <div className="mb-4 flex items-center justify-between border-b border-neutral-700 pb-2">
          <div>
            <h2 className="text-lg font-semibold">Evidence Files</h2>
            <p className="text-xs text-neutral-400">{evidenceTitle}</p>
            <p className="text-[11px] text-neutral-500">
              Evidence ID: {evidenceId}
            </p>
          </div>

          <button
            className="rounded-full px-2 py-1 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* UPLOAD AREA */}
        <div
          className={`mb-4 rounded-xl border-2 border-dashed p-4 text-sm ${
            dragActive
              ? "border-emerald-400 bg-emerald-400/5"
              : "border-neutral-700 bg-neutral-900/60"
          }`}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(false);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <span className="text-2xl">⬆️</span>
            <p className="text-sm">
              Dosyaları bu alana sürükleyip bırakabilir
              <br />
              veya
            </p>

            <button
              type="button"
              className="mt-1 rounded-full px-3 py-1 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/60 hover:bg-emerald-500/10"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              Dosya Seç
            </button>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileInputChange}
            />

            {uploading && (
              <p className="mt-1 text-xs text-emerald-300">Yükleniyor…</p>
            )}

            {uploadError && (
              <p className="mt-1 text-xs text-red-400">{uploadError}</p>
            )}
          </div>
        </div>

        {/* FILE LIST */}
        <div className="flex-1 overflow-auto rounded-xl border border-neutral-800 bg-neutral-950/60">
          {fetchState === "loading" && (
            <div className="flex h-32 items-center justify-center text-sm text-neutral-400">
              Dosyalar yükleniyor…
            </div>
          )}

          {fetchState === "error" && (
            <div className="flex h-32 items-center justify-center text-sm text-red-400">
              Dosyalar yüklenirken hata oluştu.
            </div>
          )}

          {fetchState === "idle" && files.length === 0 && (
            <div className="flex h-32 items-center justify-center text-sm text-neutral-500">
              Bu evidence için henüz yüklenmiş dosya yok.
            </div>
          )}

          {fetchState === "idle" && files.length > 0 && (
            <table className="min-w-full text-left text-xs">
              <thead className="sticky top-0 bg-neutral-950/95">
                <tr className="border-b border-neutral-800 text-[11px] uppercase tracking-wide text-neutral-400">
                  <th className="px-3 py-2 font-medium">Dosya Adı</th>
                  <th className="px-3 py-2 font-medium">Boyut</th>
                  <th className="px-3 py-2 font-medium">Mime Type</th>
                  <th className="px-3 py-2 font-medium">Tarih</th>
                  <th className="px-3 py-2 text-right font-medium">İşlemler</th>
                </tr>
              </thead>

              <tbody>
                {files.map((file) => (
                  <tr
                    key={file.id}
                    className="border-b border-neutral-900/60 hover:bg-neutral-900/60"
                  >
                    <td className="max-w-[230px] truncate px-3 py-2">
                      {file.file_name}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-neutral-300">
                      {formatSize(file.file_size)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-neutral-400">
                      {file.mime_type}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-neutral-400">
                      {new Date(file.uploaded_at).toLocaleString()}
                    </td>

                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-full px-2 py-1 text-xs text-emerald-300 ring-1 ring-emerald-500/60 hover:bg-emerald-500/10"
                          onClick={() => handleDownload(file)}
                        >
                          Download
                        </button>

                        <button
                          type="button"
                          className="rounded-full px-2 py-1 text-xs text-red-300 ring-1 ring-red-500/60 hover:bg-red-500/10"
                          onClick={() => handleDelete(file.id)}
                          disabled={deleteLoadingId === file.id}
                        >
                          {deleteLoadingId === file.id
                            ? "Siliniyor..."
                            : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* FOOTER */}
        <div className="mt-3 flex items-center justify-end text-[11px] text-neutral-500">
          <button
            className="rounded-full px-3 py-1 text-xs text-neutral-300 ring-1 ring-neutral-600 hover:bg-neutral-800"
            onClick={onClose}
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
