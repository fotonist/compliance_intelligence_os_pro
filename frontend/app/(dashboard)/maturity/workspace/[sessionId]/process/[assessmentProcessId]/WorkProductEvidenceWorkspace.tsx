"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileClock,
  FileText,
  History,
  Link2,
  Loader2,
  Pencil,
  RotateCcw,
  Send,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type WorkProductItem = {
  link_id: number;
  id: number;
  code: string;
  name: string;
  description?: string | null;
  localized_title?: string | null;
  localized_description?: string | null;
  content_language?: string | null;
  content_origin?: string | null;
  source_language?: string | null;
  characteristics?: unknown;
  direction: string;
  sort_order: number;
};

type EvidenceItem = {
  evidence_id: number;
  title: string;
  description?: string | null;
  status: string;
  assessment_type: string;
  standard_id: number;
  standard_version_id: number;
  relevance?: string | null;
  note?: string | null;
};

type EvidenceFileItem = {
  id: number;
  evidence_id: number;
  version: number;
  file_name: string;
  file_path?: string | null;
  mime_type?: string | null;
  size?: number | null;
  status: string;
  uploaded_by?: number | null;
  uploaded_at?: string | null;
  submitted_by?: number | null;
  submitted_at?: string | null;
  review_due_at?: string | null;
  approved_by?: number | null;
  approved_at?: string | null;
  rejected_by?: number | null;
  rejected_at?: string | null;
  archive_path?: string | null;
  archived_at?: string | null;
  rolled_from_file_id?: number | null;
};

type EvidenceFileHistoryItem = {
  id: number;
  action: string;
  old_status?: string | null;
  new_status?: string | null;
  comment?: string | null;
  performed_by?: number | null;
  created_at?: string | null;
};

type AssessmentContext = {
  tenant_id: number;
  assessment_id: number;
  framework_adoption_id: number;
  standard_id: number;
  standard_code?: string | null;
  standard_title?: string | null;
  standard_type?: string | null;
  standard_version_id: number;
  standard_version_code?: string | null;
};

type EvidenceDraft = {
  relevance: string;
  note: string;
};

function getToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return (
    window.localStorage.getItem("access_token") ||
    window.sessionStorage.getItem("access_token") ||
    window.localStorage.getItem("token") ||
    window.sessionStorage.getItem("token") ||
    ""
  );
}

async function readError(response: Response) {
  const body = await response.text();

  if (!body) {
    return `Request failed with status ${response.status}.`;
  }

  try {
    const parsed = JSON.parse(body);

    if (typeof parsed?.detail === "string") {
      return parsed.detail;
    }

    return body;
  } catch {
    return body;
  }
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatBytes(value?: number | null) {
  if (value === null || value === undefined) {
    return "-";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(status: string) {
  switch (status) {
    case "uploaded":
      return "Uploaded";
    case "waiting_approval":
      return "Waiting Approval";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    default:
      return status || "Unknown";
  }
}

function statusClass(status: string) {
  switch (status) {
    case "approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "rejected":
      return "border-red-200 bg-red-50 text-red-700";
    case "waiting_approval":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export default function WorkProductEvidenceWorkspace({
  assessmentId,
  assessmentProcessId,
  items,
}: {
  assessmentId: number;
  assessmentProcessId: number;
  items: WorkProductItem[];
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
        <FileText className="mx-auto h-8 w-8 text-slate-300" />
        <div className="mt-3 text-sm font-semibold text-slate-700">
          No work products available
        </div>
        <div className="mt-1 text-sm text-slate-500">
          No canonical work products are defined for this process.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="grid grid-cols-[48px_110px_minmax(260px,1fr)_120px_110px_160px] border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <div />
          <div>Code</div>
          <div>Work Product</div>
          <div>Direction</div>
          <div>Evidence</div>
          <div className="text-right">Actions</div>
        </div>

        {items.map((item) => (
          <WorkProductRow
            key={item.link_id || item.id}
            item={item}
            assessmentId={assessmentId}
            assessmentProcessId={assessmentProcessId}
          />
        ))}
      </div>
    </div>
  );
}

function WorkProductRow({
  item,
  assessmentId,
  assessmentProcessId,
}: {
  item: WorkProductItem;
  assessmentId: number;
  assessmentProcessId: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const evidenceUrl =
    `${API_BASE}/pam/assessments/${assessmentId}` +
    `/processes/${assessmentProcessId}` +
    `/work-products/${item.id}/evidences`;

  const loadEvidence = useCallback(async () => {
    const token = getToken();

    if (!token) {
      setError("Authentication token is unavailable.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(evidenceUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const data = await response.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load evidence."
      );
    } finally {
      setLoading(false);
    }
  }, [evidenceUrl]);

  useEffect(() => {
    void loadEvidence();
  }, [loadEvidence]);

  async function loadContext(token: string) {
    const response = await fetch(
      `${API_BASE}/pam/assessments/${assessmentId}/context`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error(await readError(response));
    }

    return (await response.json()) as AssessmentContext;
  }

  async function createEvidence(
    token: string,
    context: AssessmentContext,
    file: File
  ) {
    const response = await fetch(`${API_BASE}/evidences`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assessment_type: "maturity",
        title: file.name,
        description: `Evidence for work product ${item.code}`,
        standard_id: context.standard_id,
        standard_version_id: context.standard_version_id,
      }),
    });

    if (!response.ok) {
      throw new Error(await readError(response));
    }

    return (await response.json()) as { id: number };
  }

  async function uploadEvidenceFile(
    token: string,
    evidenceId: number,
    file: File
  ) {
    const body = new FormData();
    body.append("files", file);

    const response = await fetch(
      `${API_BASE}/evidences/${evidenceId}/files`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body,
      }
    );

    if (!response.ok) {
      throw new Error(await readError(response));
    }
  }

  async function linkEvidence(token: string, evidenceId: number) {
    const response = await fetch(evidenceUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        evidence_id: evidenceId,
        relevance: "direct",
        note: null,
      }),
    });

    if (!response.ok) {
      throw new Error(await readError(response));
    }
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const token = getToken();

    if (!token) {
      setError("Authentication token is unavailable.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const context = await loadContext(token);
      const evidence = await createEvidence(token, context, file);

      await uploadEvidenceFile(token, evidence.id, file);
      await linkEvidence(token, evidence.id);

      setExpanded(true);
      await loadEvidence();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Evidence upload failed."
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <div className="grid grid-cols-[48px_110px_minmax(260px,1fr)_120px_110px_160px] items-center gap-x-3 px-5 py-4">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          aria-label={expanded ? "Collapse evidence" : "Expand evidence"}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <div>
          <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
            {item.code}
          </span>
        </div>

        <div className="min-w-0 pr-4">
          {item.localized_title ? (
            <>
              <div className="text-sm font-semibold text-slate-900">
                {item.localized_title}
              </div>

              {item.localized_description ? (
                <div className="mt-1 text-xs leading-5 text-slate-500">
                  {item.localized_description}
                </div>
              ) : null}

              <div className="mt-2 flex flex-wrap gap-2">
                
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-500">
              English localization is not available.
            </div>
          )}
        </div>

        <div className="text-sm font-medium text-slate-700">
          {item.direction || "-"}
        </div>

        <div className="text-sm text-slate-600">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          ) : (
            `${items.length} linked`
          )}
        </div>

        <div className="flex justify-end">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFile}
          />

          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Add Evidence
          </button>
        </div>
      </div>

      {error ? (
        <div className="border-t border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {expanded ? (
        <EvidenceProjection
          items={items}
          loading={loading}
          evidenceUrl={evidenceUrl}
          onReload={loadEvidence}
        />
      ) : null}
    </div>
  );
}

function EvidenceProjection({
  items,
  loading,
  evidenceUrl,
  onReload,
}: {
  items: EvidenceItem[];
  loading: boolean;
  evidenceUrl: string;
  onReload: () => Promise<void>;
}) {
  if (loading) {
    return (
      <div className="border-t border-slate-100 bg-slate-50 px-16 py-6">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading evidence...
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50 px-16 py-5">
      <div className="mb-3 flex items-center gap-2">
        <Link2 className="h-4 w-4 text-indigo-600" />
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Output Evidence
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-6 text-sm text-slate-500">
          No evidence linked to this work product.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((evidence) => (
            <EvidenceRow
              key={evidence.evidence_id}
              evidence={evidence}
              evidenceUrl={evidenceUrl}
              onReload={onReload}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EvidenceRow({
  evidence,
  evidenceUrl,
  onReload,
}: {
  evidence: EvidenceItem;
  evidenceUrl: string;
  onReload: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [files, setFiles] = useState<EvidenceFileItem[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [error, setError] = useState("");

  const [draft, setDraft] = useState<EvidenceDraft>({
    relevance: evidence.relevance || "",
    note: evidence.note || "",
  });

  const loadFiles = useCallback(async () => {
    const token = getToken();

    if (!token) {
      setError("Authentication token is unavailable.");
      setFilesLoading(false);
      return;
    }

    setFilesLoading(true);

    try {
      const response = await fetch(
        `${API_BASE}/evidences/${evidence.evidence_id}/files`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const data = await response.json();
      setFiles(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load evidence files."
      );
    } finally {
      setFilesLoading(false);
    }
  }, [evidence.evidence_id]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  async function save() {
    const token = getToken();

    if (!token) {
      setError("Authentication token is unavailable.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(evidenceUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          evidence_id: evidence.evidence_id,
          relevance: draft.relevance.trim() || null,
          note: draft.note.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      setEditing(false);
      await onReload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update evidence link."
      );
    } finally {
      setSaving(false);
    }
  }

  async function unlink() {
    const token = getToken();

    if (!token) {
      setError("Authentication token is unavailable.");
      return;
    }

    setRemoving(true);
    setError("");

    try {
      const response = await fetch(
        `${evidenceUrl}/${evidence.evidence_id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      await onReload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to unlink evidence."
      );
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-start justify-between gap-5 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <FileText className="h-4 w-4 text-slate-400" />

            <div className="truncate text-sm font-semibold text-slate-900">
              {evidence.title}
            </div>

            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              Evidence: {evidence.status}
            </span>
          </div>

          {evidence.description ? (
            <div className="mt-2 text-sm text-slate-500">
              {evidence.description}
            </div>
          ) : null}

          {!editing ? (
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
              <span>
                Relevance:{" "}
                <strong className="font-semibold text-slate-700">
                  {evidence.relevance || "Not set"}
                </strong>
              </span>

              <span>
                Note:{" "}
                <strong className="font-semibold text-slate-700">
                  {evidence.note || "Not set"}
                </strong>
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {editing ? (
              <X className="h-3.5 w-3.5" />
            ) : (
              <Pencil className="h-3.5 w-3.5" />
            )}

            {editing ? "Cancel" : "Edit Link"}
          </button>

          <button
            type="button"
            disabled={removing}
            onClick={unlink}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {removing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}

            Unlink
          </button>
        </div>
      </div>

      {editing ? (
        <div className="grid gap-4 border-t border-slate-100 bg-slate-50 px-5 py-4 md:grid-cols-[220px_1fr_auto]">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Relevance
            </span>

            <input
              value={draft.relevance}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  relevance: event.target.value,
                }))
              }
              placeholder="direct"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-400"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Note
            </span>

            <input
              value={draft.note}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
              placeholder="Assessment note"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-400"
            />
          </label>

          <div className="flex items-end">
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Save
            </button>
          </div>
        </div>
      ) : null}

      <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
        <div className="mb-3 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              File Lifecycle
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Evidence file versions and review state
            </div>
          </div>

          <div className="text-xs font-medium text-slate-500">
            {filesLoading ? "Loading..." : `${files.length} version(s)`}
          </div>
        </div>

        {filesLoading ? (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading file lifecycle...
          </div>
        ) : files.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-500">
            No evidence files are available.
          </div>
        ) : (
          <div className="space-y-2">
            {files.map((file) => (
              <EvidenceFileLifecycle
                key={file.id}
                file={file}
                onReload={loadFiles}
              />
            ))}
          </div>
        )}
      </div>

      {error ? (
        <div className="border-t border-red-100 bg-red-50 px-5 py-2 text-xs text-red-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}

function EvidenceFileLifecycle({
  file,
  onReload,
}: {
  file: EvidenceFileItem;
  onReload: () => Promise<void>;
}) {
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<EvidenceFileHistoryItem[]>([]);

  async function lifecycleAction(
    action: "submit" | "approve" | "reject" | "rollback"
  ) {
    const token = getToken();

    if (!token) {
      setError("Authentication token is unavailable.");
      return;
    }

    setWorking(action);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/evidences/files/${file.id}/${action}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      await onReload();

      if (historyOpen) {
        await loadHistory();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Unable to ${action} evidence file.`
      );
    } finally {
      setWorking("");
    }
  }

  async function loadHistory() {
    const token = getToken();

    if (!token) {
      setError("Authentication token is unavailable.");
      return;
    }

    setHistoryLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/evidences/files/${file.id}/history`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const data = await response.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load file history."
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  async function toggleHistory() {
    const next = !historyOpen;
    setHistoryOpen(next);

    if (next) {
      await loadHistory();
    }
  }

  const canSubmit =
    file.status === "uploaded" || file.status === "rejected";

  const canReview = file.status === "waiting_approval";

  const canRollback =
    file.status !== "approved" &&
    file.status !== "uploaded";

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <FileText className="h-4 w-4 text-slate-400" />

              <div className="truncate text-sm font-semibold text-slate-900">
                {file.file_name}
              </div>

              <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                Version {file.version}
              </span>

              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass(
                  file.status
                )}`}
              >
                {statusLabel(file.status)}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
              <span>Size: {formatBytes(file.size)}</span>
              <span>Uploaded: {formatDate(file.uploaded_at)}</span>

              {file.submitted_at ? (
                <span>
                  Submitted: {formatDate(file.submitted_at)}
                </span>
              ) : null}

              {file.review_due_at ? (
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  Review due: {formatDate(file.review_due_at)}
                </span>
              ) : null}

              {file.approved_at ? (
                <span>
                  Approved: {formatDate(file.approved_at)}
                </span>
              ) : null}

              {file.rejected_at ? (
                <span>
                  Rejected: {formatDate(file.rejected_at)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {canSubmit ? (
              <button
                type="button"
                disabled={Boolean(working)}
                onClick={() => void lifecycleAction("submit")}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {working === "submit" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Submit for Review
              </button>
            ) : null}

            {canReview ? (
              <>
                <button
                  type="button"
                  disabled={Boolean(working)}
                  onClick={() => void lifecycleAction("approve")}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                >
                  {working === "approve" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Approve
                </button>

                <button
                  type="button"
                  disabled={Boolean(working)}
                  onClick={() => void lifecycleAction("reject")}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  {working === "reject" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                  Reject
                </button>
              </>
            ) : null}

            {canRollback ? (
              <button
                type="button"
                disabled={Boolean(working)}
                onClick={() => void lifecycleAction("rollback")}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {working === "rollback" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                Rollback
              </button>
            ) : null}

            <button
              type="button"
              disabled={historyLoading}
              onClick={() => void toggleHistory()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {historyLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <History className="h-3.5 w-3.5" />
              )}
              {historyOpen ? "Hide History" : "History"}
            </button>
          </div>
        </div>

        {file.status === "approved" ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            <Check className="h-3.5 w-3.5" />
            Approved versions are immutable. Upload a new version to replace
            this file.
          </div>
        ) : null}

        {error ? (
          <div className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        ) : null}
      </div>

      {historyOpen ? (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-4">
          <div className="mb-3 flex items-center gap-2">
            <FileClock className="h-4 w-4 text-slate-400" />
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Lifecycle History
            </div>
          </div>

          {historyLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading history...
            </div>
          ) : history.length === 0 ? (
            <div className="text-sm text-slate-500">
              No lifecycle events recorded.
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((event) => (
                <div
                  key={event.id}
                  className="grid gap-2 rounded-lg border border-slate-200 bg-white px-3 py-3 md:grid-cols-[160px_1fr_180px]"
                >
                  <div className="text-xs font-semibold text-slate-800">
                    {event.action}
                  </div>

                  <div className="text-xs text-slate-600">
                    {event.old_status || "-"}
                    {" -> "}
                    {event.new_status || "-"}
                    {event.comment ? ` | ${event.comment}` : ""}
                  </div>

                  <div className="text-xs text-slate-400 md:text-right">
                    {formatDate(event.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
