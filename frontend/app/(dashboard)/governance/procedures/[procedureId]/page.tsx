"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "../../../../lib/api";

type Procedure = {
  id: number;
  tenant_id?: number;
  policy_id: number;
  procedure_code: string;
  title: string;
  description?: string | null;
  owner_id?: number | null;
  status: string;
  version: string;
  effective_date?: string | null;
  review_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  is_deleted?: boolean;
};

type LinkedControl = {
  id: number;
  control_id: number;
  control_code?: string | null;
  control_title?: string | null;
};

type ProcedureDocument = {
  id: number;
  procedure_id: number;
  version: string;
  file_name?: string | null;
  storage_key?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  checksum?: string | null;
  status: string;
  is_current: boolean;
  is_archived: boolean;

  uploaded_by?: number | null;
  uploaded_at?: string | null;

  archived_at?: string | null;

  reviewer_id?: number | null;
  reviewed_at?: string | null;

  approved_by?: number | null;
  approved_at?: string | null;

  rejected_by?: number | null;
  rejected_at?: string | null;

  review_comment?: string | null;
};

type DocumentHistoryItem = {
  id: number;
  document_id: number;
  action: string;
  old_status?: string | null;
  new_status?: string | null;
  comment?: string | null;
  performed_by?: number | null;
  created_at?: string | null;
};

type Policy = {
  id: number;
  policy_code?: string | null;
  title?: string | null;
  status?: string | null;
  version?: string | null;
};

type FormState = {
  title: string;
  description: string;
  owner_id: string;
  version: string;
  effective_date: string;
  review_date: string;
};

function normalizeList<T>(value: any): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.items)) {
    return value.items;
  }

  return [];
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (number: number) =>
    String(number).padStart(2, "0");

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function formatBytes(value?: number | null) {
  if (!value || value <= 0) {
    return "—";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatVersion(version?: string | null) {
  if (!version) return "—";

  return version.startsWith("v")
    ? version
    : `v${version}`;
}

function humanizeStatus(value?: string | null) {
  if (!value) return "Unknown";

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function humanizeAction(value?: string | null) {
  if (!value) return "Activity";

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function statusClass(status?: string | null) {
  switch (status) {
    case "approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "under_review":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "expired":
      return "border-red-200 bg-red-50 text-red-700";

    case "archived":
      return "border-slate-200 bg-slate-100 text-slate-600";

    case "rejected":
      return "border-red-200 bg-red-50 text-red-700";

    case "uploaded":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "draft":
      return "border-slate-200 bg-white text-slate-700";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function documentStatusClass(status?: string | null) {
  switch (status) {
    case "approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "under_review":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "rejected":
      return "border-red-200 bg-red-50 text-red-700";

    case "archived":
      return "border-slate-200 bg-slate-100 text-slate-600";

    case "uploaded":
      return "border-blue-200 bg-blue-50 text-blue-700";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function isDocumentReviewable(
  document: ProcedureDocument
) {
  return (
    document.status === "uploaded" ||
    document.status === "under_review" ||
    document.status === "rejected"
  );
}

function userReference(id?: number | null) {
  if (id === null || id === undefined) {
    return "Not recorded";
  }

  return `User ID ${id}`;
}

function checksumShort(value?: string | null) {
  if (!value) return "—";

  if (value.length <= 24) {
    return value;
  }

  return `${value.slice(0, 12)}…${value.slice(-10)}`;
}

export default function ProcedureDetailPage() {
  const router = useRouter();
  const params = useParams();

  const procedureId = Number(
    Array.isArray(params?.procedureId)
      ? params.procedureId[0]
      : params?.procedureId
  );

  const [procedure, setProcedure] =
    useState<Procedure | null>(null);

  const [controls, setControls] =
    useState<LinkedControl[]>([]);

  const [documents, setDocuments] =
    useState<ProcedureDocument[]>([]);

  const [policy, setPolicy] =
    useState<Policy | null>(null);

  const [history, setHistory] =
    useState<DocumentHistoryItem[]>([]);

  const [selectedHistoryDocumentId, setSelectedHistoryDocumentId] =
    useState<number | null>(null);

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [historyLoading, setHistoryLoading] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [uploadingDocument, setUploadingDocument] =
    useState(false);

  const [actionLoading, setActionLoading] =
    useState(false);

  const [removingControlId, setRemovingControlId] =
    useState<number | null>(null);

  const [editing, setEditing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const [form, setForm] = useState<FormState>({
    title: "",
    description: "",
    owner_id: "",
    version: "",
    effective_date: "",
    review_date: "",
  });

  const isDraft =
    procedure?.status === "draft";

  const isUnderReview =
    procedure?.status === "under_review";

  const isApproved =
    procedure?.status === "approved";

  const isArchived =
    procedure?.status === "archived";

  const currentDocument = useMemo(
    () =>
      documents.find(
        (document) => document.is_current
      ) ||
      documents.find(
        (document) => !document.is_archived
      ) ||
      documents[0] ||
      null,
    [documents]
  );

  const sortedDocuments = useMemo(
    () =>
      [...documents].sort(
        (a, b) =>
          Number(b.version) -
          Number(a.version)
      ),
    [documents]
  );

  const approvedDocumentCount = useMemo(
    () =>
      documents.filter(
        (document) =>
          document.status === "approved"
      ).length,
    [documents]
  );

  async function loadProcedure(
    options?: {
      silent?: boolean;
    }
  ) {
    try {
      if (options?.silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const requests = [
        apiFetch(
          `/governance/procedures/${procedureId}`
        ),
        apiFetch(
          `/governance/procedures/${procedureId}/controls`
        ),
        apiFetch(
          `/governance/procedures/${procedureId}/documents`
        ),
      ];

      const [
        procedureRes,
        controlsRes,
        documentsRes,
      ] = await Promise.all(requests);

      if (!procedureRes.ok) {
        throw new Error(
          "Failed to load procedure."
        );
      }

      if (!controlsRes.ok) {
        throw new Error(
          "Failed to load linked controls."
        );
      }

      if (!documentsRes.ok) {
        throw new Error(
          "Failed to load procedure documents."
        );
      }

      const procedureData =
        await procedureRes.json();

      const controlsData =
        await controlsRes.json();

      const documentsData =
        await documentsRes.json();

      setProcedure(procedureData);

      setControls(
        normalizeList<LinkedControl>(
          controlsData
        )
      );

      setDocuments(
        normalizeList<ProcedureDocument>(
          documentsData
        )
      );

      setForm({
        title: procedureData.title || "",
        description:
          procedureData.description || "",
        owner_id:
          procedureData.owner_id !== null &&
          procedureData.owner_id !== undefined
            ? String(procedureData.owner_id)
            : "",
        version:
          procedureData.version || "",
        effective_date:
          toDateTimeLocal(
            procedureData.effective_date
          ),
        review_date:
          toDateTimeLocal(
            procedureData.review_date
          ),
      });

      if (procedureData.policy_id) {
        try {
          const policyRes = await apiFetch(
            `/governance/policies/${procedureData.policy_id}`
          );

          if (policyRes.ok) {
            setPolicy(
              await policyRes.json()
            );
          }
        } catch {
          setPolicy(null);
        }
      }
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to load procedure."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (
      !procedureId ||
      Number.isNaN(procedureId)
    ) {
      return;
    }

    loadProcedure();
  }, [procedureId]);

  function startEdit() {
    if (!procedure) return;

    if (!isDraft) {
      setError(
        "Only draft procedures can be edited."
      );
      return;
    }

    setForm({
      title: procedure.title || "",
      description:
        procedure.description || "",
      owner_id:
        procedure.owner_id !== null &&
        procedure.owner_id !== undefined
          ? String(procedure.owner_id)
          : "",
      version:
        procedure.version || "",
      effective_date:
        toDateTimeLocal(
          procedure.effective_date
        ),
      review_date:
        toDateTimeLocal(
          procedure.review_date
        ),
    });

    setEditing(true);
    setError("");
    setSuccessMessage("");
  }

  function cancelEdit() {
    if (!procedure) return;

    setForm({
      title: procedure.title || "",
      description:
        procedure.description || "",
      owner_id:
        procedure.owner_id !== null &&
        procedure.owner_id !== undefined
          ? String(procedure.owner_id)
          : "",
      version:
        procedure.version || "",
      effective_date:
        toDateTimeLocal(
          procedure.effective_date
        ),
      review_date:
        toDateTimeLocal(
          procedure.review_date
        ),
    });

    setEditing(false);
    setError("");
  }

  async function saveProcedure() {
    if (!procedure) return;

    if (!form.title.trim()) {
      setError(
        "Procedure title is required."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      const payload = {
        title: form.title.trim(),
        description:
          form.description.trim() ||
          null,
        owner_id: form.owner_id
          ? Number(form.owner_id)
          : null,
        version:
          form.version.trim() ||
          procedure.version,
        effective_date:
          form.effective_date
            ? new Date(
                form.effective_date
              ).toISOString()
            : null,
        review_date:
          form.review_date
            ? new Date(
                form.review_date
              ).toISOString()
            : null,
      };

      const res = await apiFetch(
        `/governance/procedures/${procedureId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const text =
          await res.text();

        throw new Error(
          text ||
            "Failed to save procedure."
        );
      }

      const updated =
        await res.json();

      setProcedure(
        (current) =>
          current
            ? {
                ...current,
                ...updated,
              }
            : updated
      );

      setEditing(false);

      setSuccessMessage(
        "Procedure changes saved successfully."
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to save procedure."
      );
    } finally {
      setSaving(false);
    }
  }

  async function executeLifecycleAction(
    action:
      | "submit"
      | "approve"
      | "archive"
  ) {
    if (!procedure) return;

    const messages = {
      submit:
        "Submit this procedure for review?",
      approve:
        "Approve this procedure?",
      archive:
        "Archive this procedure? It will become read-only.",
    };

    if (
      !window.confirm(
        messages[action]
      )
    ) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccessMessage("");

      const res = await apiFetch(
        `/governance/procedures/${procedureId}/${action}`,
        {
          method: "POST",
        }
      );

      if (!res.ok) {
        const text =
          await res.text();

        throw new Error(
          text ||
            `Failed to ${action} procedure.`
        );
      }

      const result =
        await res.json();

      setProcedure(
        (current) =>
          current
            ? {
                ...current,
                status:
                  result.status ||
                  current.status,
              }
            : current
      );

      setEditing(false);

      setSuccessMessage(
        `Procedure ${humanizeAction(
          action
        ).toLowerCase()} successfully.`
      );

      await loadProcedure({
        silent: true,
      });
    } catch (err: any) {
      setError(
        err?.message ||
          `Failed to ${action} procedure.`
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function uploadDocument() {
    if (!selectedFile) {
      setError(
        "Select a document before uploading."
      );
      return;
    }

    if (isArchived) {
      setError(
        "Archived procedures are read-only."
      );
      return;
    }

    try {
      setUploadingDocument(true);
      setError("");
      setSuccessMessage("");

      const formData =
        new FormData();

      formData.append(
        "file",
        selectedFile
      );

      const res = await apiFetch(
        `/governance/procedures/${procedureId}/documents`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!res.ok) {
        const text =
          await res.text();

        throw new Error(
          text ||
            "Failed to upload procedure document."
        );
      }

      await res.json();

      setSelectedFile(null);

      const input =
        window.document.getElementById(
          "procedure-document-upload"
        ) as HTMLInputElement | null;

      if (input) {
        input.value = "";
      }

      setSuccessMessage(
        "Document uploaded successfully. A new version has been created."
      );

      await loadProcedure({
        silent: true,
      });
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to upload procedure document."
      );
    } finally {
      setUploadingDocument(false);
    }
  }

  async function downloadDocument(
    documentId: number
  ) {
    try {
      setError("");
      setSuccessMessage("");

      const res = await apiFetch(
        `/governance/documents/${documentId}/download`
      );

      if (!res.ok) {
        throw new Error(
          "Failed to download procedure document."
        );
      }

      const blob =
        await res.blob();

      const url =
        window.URL.createObjectURL(
          blob
        );

      const link =
        window.document.createElement(
          "a"
        );

      link.href = url;

      const documentItem =
        documents.find(
          (item) =>
            item.id === documentId
        );

      link.download =
        documentItem?.file_name ||
        "procedure-document";

      window.document.body.appendChild(
        link
      );

      link.click();
      link.remove();

      window.URL.revokeObjectURL(
        url
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to download procedure document."
      );
    }
  }

  async function loadDocumentHistory(
    documentId: number
  ) {
    try {
      setHistoryLoading(true);
      setError("");

      const res = await apiFetch(
        `/governance/documents/${documentId}/history`
      );

      if (!res.ok) {
        throw new Error(
          "Failed to load document history."
        );
      }

      const data =
        await res.json();

      setHistory(
        Array.isArray(data)
          ? data
          : []
      );

      setSelectedHistoryDocumentId(
        documentId
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to load document history."
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  async function documentAction(
    documentId: number,
    action:
      | "submit-review"
      | "approve"
      | "reject"
  ) {
    const documentItem =
      documents.find(
        (item) =>
          item.id === documentId
      );

    if (!documentItem) {
      setError(
        "Document could not be found."
      );
      return;
    }

    let body: string | undefined;

    if (action === "submit-review") {
      if (
        !window.confirm(
          "Submit this document for review?"
        )
      ) {
        return;
      }
    }

    if (action === "approve") {
      if (
        !window.confirm(
          `Approve ${documentItem.file_name || "this document"} ${formatVersion(
            documentItem.version
          )}?`
        )
      ) {
        return;
      }
    }

    if (action === "reject") {
      const comment =
        window.prompt(
          "Enter the rejection reason:"
        );

      if (
        comment === null
      ) {
        return;
      }

      if (
        comment.trim().length < 5
      ) {
        setError(
          "Rejection reason must contain at least 5 characters."
        );
        return;
      }

      body = JSON.stringify({
        review_comment:
          comment.trim(),
      });
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccessMessage("");

      const res = await apiFetch(
        `/governance/documents/${documentId}/${action}`,
        {
          method: "POST",
          ...(body
            ? {
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body,
              }
            : {}),
        }
      );

      if (!res.ok) {
        const text =
          await res.text();

        throw new Error(
          text ||
            `Failed to ${action} document.`
        );
      }

      setSuccessMessage(
        `Document ${humanizeAction(
          action
        ).toLowerCase()} successfully.`
      );

      await loadProcedure({
        silent: true,
      });

      await loadDocumentHistory(
        documentId
      );
    } catch (err: any) {
      setError(
        err?.message ||
          `Failed to ${action} document.`
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function removeControl(
    controlId: number
  ) {
    if (!isDraft) {
      setError(
        "Controls can only be removed while the procedure is in draft."
      );
      return;
    }

    if (
      !window.confirm(
        "Remove this control from the procedure?"
      )
    ) {
      return;
    }

    try {
      setRemovingControlId(
        controlId
      );

      setError("");
      setSuccessMessage("");

      const res = await apiFetch(
        `/governance/procedures/${procedureId}/controls/${controlId}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        const text =
          await res.text();

        throw new Error(
          text ||
            "Failed to remove control."
        );
      }

      setControls(
        (current) =>
          current.filter(
            (control) =>
              control.control_id !==
              controlId
          )
      );

      setSuccessMessage(
        "Control removed successfully."
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to remove control."
      );
    } finally {
      setRemovingControlId(
        null
      );
    }
  }

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0] ||
      null;

    setSelectedFile(file);
    setError("");
    setSuccessMessage("");
  }

  if (loading) {
    return (
      <div className="min-h-full bg-slate-50">
        <div className="mx-auto max-w-[1600px] px-6 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-4 w-32 rounded bg-slate-200" />
            <div className="h-10 w-2/3 rounded bg-slate-200" />
            <div className="h-32 rounded-xl bg-white border border-slate-200" />
            <div className="h-64 rounded-xl bg-white border border-slate-200" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !procedure) {
    return (
      <div className="min-h-full bg-slate-50">
        <div className="mx-auto max-w-[1600px] px-6 py-8">
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
            <div className="text-sm font-semibold text-red-800">
              Unable to load procedure
            </div>
            <div className="mt-1 text-sm text-red-700">
              {error}
            </div>
            <button
              type="button"
              onClick={() =>
                loadProcedure()
              }
              className="mt-4 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!procedure) {
    return (
      <div className="min-h-full bg-slate-50">
        <div className="mx-auto max-w-[1600px] px-6 py-8 text-sm text-slate-500">
          Procedure not found.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-[1600px] px-6 py-7">
        {/* =====================================================
            BREADCRUMB
        ====================================================== */}

        <div className="mb-5 flex items-center gap-2 text-xs text-slate-500">
          <button
            type="button"
            onClick={() =>
              router.push(
                "/governance"
              )
            }
            className="font-medium hover:text-slate-900"
          >
            Governance
          </button>

          <span>/</span>

          <span className="text-slate-400">
            Procedures
          </span>

          <span>/</span>

          <span className="font-medium text-slate-700">
            {procedure.procedure_code}
          </span>
        </div>

        {/* =====================================================
            SYSTEM MESSAGES
        ====================================================== */}

        {error && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
            <div>
              <div className="text-sm font-semibold text-red-800">
                Action could not be completed
              </div>
              <div className="mt-1 text-sm text-red-700">
                {error}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              className="text-xs font-medium text-red-700 hover:text-red-900"
            >
              Dismiss
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
            <div>
              <div className="text-sm font-semibold text-emerald-800">
                Completed
              </div>
              <div className="mt-1 text-sm text-emerald-700">
                {successMessage}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setSuccessMessage("")
              }
              className="text-xs font-medium text-emerald-700 hover:text-emerald-900"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* =====================================================
            HEADER
        ====================================================== */}

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="px-6 py-6">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-950">
                    {procedure.title}
                  </h1>

                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(
                      procedure.status
                    )}`}
                  >
                    {humanizeStatus(
                      procedure.status
                    )}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
                  <span className="font-medium text-slate-700">
                    {procedure.procedure_code}
                  </span>

                  <span>
                    Procedure ID:{" "}
                    {procedure.id}
                  </span>

                  <span>
                    Policy ID:{" "}
                    {procedure.policy_id}
                  </span>

                  {policy?.policy_code && (
                    <span>
                      Parent Policy:{" "}
                      {policy.policy_code}
                    </span>
                  )}
                </div>

                {procedure.description && (
                  <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-600">
                    {procedure.description}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!editing &&
                  isDraft && (
                    <button
                      type="button"
                      onClick={startEdit}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                    >
                      Edit
                    </button>
                  )}

                {editing && (
                  <>
                    <button
                      type="button"
                      onClick={
                        cancelEdit
                      }
                      disabled={saving}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={
                        saveProcedure
                      }
                      disabled={saving}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving
                        ? "Saving..."
                        : "Save Changes"}
                    </button>
                  </>
                )}

                {!isArchived &&
                  isDraft && (
                    <button
                      type="button"
                      onClick={() =>
                        executeLifecycleAction(
                          "submit"
                        )
                      }
                      disabled={
                        actionLoading
                      }
                      className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
                    >
                      Submit for Review
                    </button>
                  )}

                {!isArchived &&
                  isUnderReview && (
                    <button
                      type="button"
                      onClick={() =>
                        executeLifecycleAction(
                          "approve"
                        )
                      }
                      disabled={
                        actionLoading
                      }
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Approve Procedure
                    </button>
                  )}

                {!isArchived &&
                  isApproved && (
                    <button
                      type="button"
                      onClick={() =>
                        executeLifecycleAction(
                          "archive"
                        )
                      }
                      disabled={
                        actionLoading
                      }
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Archive
                    </button>
                  )}

                <button
                  type="button"
                  onClick={() =>
                    loadProcedure({
                      silent: true,
                    })
                  }
                  disabled={refreshing}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {refreshing
                    ? "Refreshing..."
                    : "Refresh"}
                </button>
              </div>
            </div>
          </div>

          {/* ===================================================
              KPI STRIP
          ==================================================== */}

          <div className="grid grid-cols-2 border-t border-slate-200 md:grid-cols-4">
            <div className="border-r border-slate-200 px-6 py-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Current Version
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-950">
                {formatVersion(
                  procedure.version
                )}
              </div>
            </div>

            <div className="border-r border-slate-200 px-6 py-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Documents
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-950">
                {documents.length}
              </div>
            </div>

            <div className="border-r border-slate-200 px-6 py-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Approved Versions
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-950">
                {approvedDocumentCount}
              </div>
            </div>

            <div className="px-6 py-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Linked Controls
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-950">
                {controls.length}
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================
            ARCHIVED NOTICE
        ====================================================== */}

        {isArchived && (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-100 px-5 py-4">
            <div className="text-sm font-semibold text-slate-800">
              This procedure is archived
            </div>
            <div className="mt-1 text-sm text-slate-600">
              The procedure is read-only. Existing
              documents and historical records remain
              available for audit and traceability.
            </div>
          </div>
        )}

        {/* =====================================================
            MAIN GRID
        ====================================================== */}

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            {/* =================================================
                PROCEDURE INFORMATION
            ================================================== */}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-5">
                <div className="text-base font-semibold text-slate-950">
                  Procedure Information
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  Controlled metadata and lifecycle information
                  for this procedure.
                </div>
              </div>

              <div className="p-6">
                {editing ? (
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Procedure Title
                      </label>
                      <input
                        value={form.title}
                        onChange={(event) =>
                          setForm(
                            (current) => ({
                              ...current,
                              title:
                                event.target
                                  .value,
                            })
                          )
                        }
                        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-0 focus:border-slate-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Description
                      </label>
                      <textarea
                        rows={4}
                        value={
                          form.description
                        }
                        onChange={(event) =>
                          setForm(
                            (current) => ({
                              ...current,
                              description:
                                event.target
                                  .value,
                            })
                          )
                        }
                        className="mt-2 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Owner ID
                      </label>
                      <input
                        type="number"
                        value={
                          form.owner_id
                        }
                        onChange={(event) =>
                          setForm(
                            (current) => ({
                              ...current,
                              owner_id:
                                event.target
                                  .value,
                            })
                          )
                        }
                        placeholder="User ID"
                        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-slate-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Version
                      </label>
                      <input
                        value={
                          form.version
                        }
                        onChange={(event) =>
                          setForm(
                            (current) => ({
                              ...current,
                              version:
                                event.target
                                  .value,
                            })
                          )
                        }
                        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-slate-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Effective Date
                      </label>
                      <input
                        type="datetime-local"
                        value={
                          form.effective_date
                        }
                        onChange={(event) =>
                          setForm(
                            (current) => ({
                              ...current,
                              effective_date:
                                event.target
                                  .value,
                            })
                          )
                        }
                        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-slate-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Review Date
                      </label>
                      <input
                        type="datetime-local"
                        value={
                          form.review_date
                        }
                        onChange={(event) =>
                          setForm(
                            (current) => ({
                              ...current,
                              review_date:
                                event.target
                                  .value,
                            })
                          )
                        }
                        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-slate-500"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Procedure Code
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {procedure.procedure_code}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Version
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {formatVersion(
                          procedure.version
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Owner
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {userReference(
                          procedure.owner_id
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Status
                      </div>
                      <div className="mt-1">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                            procedure.status
                          )}`}
                        >
                          {humanizeStatus(
                            procedure.status
                          )}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Effective Date
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {formatDate(
                          procedure.effective_date
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Next Review
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {formatDate(
                          procedure.review_date
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Created
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {formatDateTime(
                          procedure.created_at
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Last Updated
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {formatDateTime(
                          procedure.updated_at
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* =================================================
                DOCUMENT CONTROL
            ================================================== */}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-base font-semibold text-slate-950">
                      Document Control
                    </div>

                    <div className="mt-1 text-sm text-slate-500">
                      Controlled procedure documents,
                      versions, review and approval lifecycle.
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>
                      {documents.length} version
                      {documents.length === 1
                        ? ""
                        : "s"}
                    </span>
                  </div>
                </div>
              </div>

              {/* UPLOAD AREA */}

              {!isArchived && (
                <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                    <div className="min-w-0 flex-1">
                      <label
                        htmlFor="procedure-document-upload"
                        className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
                      >
                        Upload New Version
                      </label>

                      <input
                        id="procedure-document-upload"
                        type="file"
                        onChange={
                          handleFileChange
                        }
                        className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700"
                      />

                      {selectedFile && (
                        <div className="mt-2 text-xs text-slate-500">
                          Selected:{" "}
                          <span className="font-medium text-slate-700">
                            {selectedFile.name}
                          </span>
                          {" · "}
                          {formatBytes(
                            selectedFile.size
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={
                        uploadDocument
                      }
                      disabled={
                        uploadingDocument ||
                        !selectedFile
                      }
                      className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {uploadingDocument
                        ? "Uploading..."
                        : "Upload New Version"}
                    </button>
                  </div>

                  <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-800">
                    Uploading a new document creates the
                    next controlled version. The current
                    document is archived by the backend
                    document lifecycle.
                  </div>
                </div>
              )}

              {/* CURRENT DOCUMENT */}

              <div className="p-6">
                {currentDocument ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50">
                    <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                            Current
                          </span>

                          <span className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                            {formatVersion(
                              currentDocument.version
                            )}
                          </span>

                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${documentStatusClass(
                              currentDocument.status
                            )}`}
                          >
                            {humanizeStatus(
                              currentDocument.status
                            )}
                          </span>
                        </div>

                        <div className="mt-3 break-all text-base font-semibold text-slate-950">
                          {currentDocument.file_name ||
                            "Unnamed document"}
                        </div>

                        <div className="mt-2 text-sm text-slate-500">
                          {currentDocument.mime_type ||
                            "Unknown file type"}
                          {" · "}
                          {formatBytes(
                            currentDocument.file_size
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            downloadDocument(
                              currentDocument.id
                            )
                          }
                          className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Download
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            loadDocumentHistory(
                              currentDocument.id
                            )
                          }
                          className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          History
                        </button>

                        {!isArchived &&
                          currentDocument.status ===
                            "uploaded" && (
                            <button
                              type="button"
                              onClick={() =>
                                documentAction(
                                  currentDocument.id,
                                  "submit-review"
                                )
                              }
                              disabled={
                                actionLoading
                              }
                              className="rounded-lg border border-amber-300 bg-white px-3.5 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                            >
                              Submit Review
                            </button>
                          )}

                        {!isArchived &&
                          currentDocument.status ===
                            "under_review" && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  documentAction(
                                    currentDocument.id,
                                    "approve"
                                  )
                                }
                                disabled={
                                  actionLoading
                                }
                                className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                Approve
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  documentAction(
                                    currentDocument.id,
                                    "reject"
                                  )
                                }
                                disabled={
                                  actionLoading
                                }
                                className="rounded-lg border border-red-300 bg-white px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 border-t border-slate-200 md:grid-cols-2 lg:grid-cols-4">
                      <div className="border-b border-slate-200 px-5 py-4 lg:border-b-0 lg:border-r">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Uploaded By
                        </div>
                        <div className="mt-1 text-sm font-medium text-slate-900">
                          {userReference(
                            currentDocument.uploaded_by
                          )}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {formatDateTime(
                            currentDocument.uploaded_at
                          )}
                        </div>
                      </div>

                      <div className="border-b border-slate-200 px-5 py-4 lg:border-b-0 lg:border-r">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Reviewer
                        </div>
                        <div className="mt-1 text-sm font-medium text-slate-900">
                          {userReference(
                            currentDocument.reviewer_id
                          )}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {formatDateTime(
                            currentDocument.reviewed_at
                          )}
                        </div>
                      </div>

                      <div className="border-b border-slate-200 px-5 py-4 md:border-r lg:border-b-0">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Approved By
                        </div>
                        <div className="mt-1 text-sm font-medium text-slate-900">
                          {userReference(
                            currentDocument.approved_by
                          )}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {formatDateTime(
                            currentDocument.approved_at
                          )}
                        </div>
                      </div>

                      <div className="px-5 py-4">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          File Integrity
                        </div>
                        <div className="mt-1 break-all text-xs font-medium text-slate-700">
                          {checksumShort(
                            currentDocument.checksum
                          )}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          SHA-256 checksum
                        </div>
                      </div>
                    </div>

                    {currentDocument.review_comment && (
                      <div className="border-t border-red-200 bg-red-50 px-5 py-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-red-700">
                          Review Comment
                        </div>

                        <div className="mt-1 text-sm leading-6 text-red-800">
                          {
                            currentDocument.review_comment
                          }
                        </div>

                        {currentDocument.rejected_by && (
                          <div className="mt-2 text-xs text-red-700">
                            Rejected by{" "}
                            {userReference(
                              currentDocument.rejected_by
                            )}{" "}
                            on{" "}
                            {formatDateTime(
                              currentDocument.rejected_at
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
                    <div className="text-sm font-semibold text-slate-800">
                      No procedure document uploaded
                    </div>

                    <div className="mt-1 text-sm text-slate-500">
                      Upload the controlled document to
                      establish the first document version.
                    </div>
                  </div>
                )}
              </div>

              {/* VERSION HISTORY */}

              <div className="border-t border-slate-200">
                <div className="px-6 py-5">
                  <div className="text-sm font-semibold text-slate-950">
                    Version History
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    Complete document version trail for
                    this procedure.
                  </div>
                </div>

                {sortedDocuments.length === 0 ? (
                  <div className="border-t border-slate-200 px-6 py-8 text-sm text-slate-500">
                    No version history is available.
                  </div>
                ) : (
                  <div className="overflow-x-auto border-t border-slate-200">
                    <table className="w-full min-w-[980px] text-sm">
                      <thead className="bg-slate-50">
                        <tr className="border-b border-slate-200 text-left">
                          <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Version
                          </th>
                          <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Document
                          </th>
                          <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Status
                          </th>
                          <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Uploaded
                          </th>
                          <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Review
                          </th>
                          <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Approval
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Actions
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-200">
                        {sortedDocuments.map(
                          (document) => (
                            <tr
                              key={
                                document.id
                              }
                              className={
                                document.is_current
                                  ? "bg-blue-50/40"
                                  : "bg-white"
                              }
                            >
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-900">
                                    {formatVersion(
                                      document.version
                                    )}
                                  </span>

                                  {document.is_current && (
                                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                                      Current
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="max-w-[300px] px-6 py-4">
                                <div className="truncate font-medium text-slate-900">
                                  {document.file_name ||
                                    "Unnamed document"}
                                </div>

                                <div className="mt-1 text-xs text-slate-500">
                                  {formatBytes(
                                    document.file_size
                                  )}
                                  {" · "}
                                  {document.mime_type ||
                                    "Unknown type"}
                                </div>
                              </td>

                              <td className="px-6 py-4">
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${documentStatusClass(
                                    document.status
                                  )}`}
                                >
                                  {humanizeStatus(
                                    document.status
                                  )}
                                </span>
                              </td>

                              <td className="px-6 py-4">
                                <div className="text-sm text-slate-800">
                                  {formatDateTime(
                                    document.uploaded_at
                                  )}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {userReference(
                                    document.uploaded_by
                                  )}
                                </div>
                              </td>

                              <td className="px-6 py-4">
                                <div className="text-sm text-slate-800">
                                  {formatDateTime(
                                    document.reviewed_at
                                  )}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {userReference(
                                    document.reviewer_id
                                  )}
                                </div>
                              </td>

                              <td className="px-6 py-4">
                                <div className="text-sm text-slate-800">
                                  {formatDateTime(
                                    document.approved_at
                                  )}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {userReference(
                                    document.approved_by
                                  )}
                                </div>
                              </td>

                              <td className="px-6 py-4">
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      downloadDocument(
                                        document.id
                                      )
                                    }
                                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    Download
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      loadDocumentHistory(
                                        document.id
                                      )
                                    }
                                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    History
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>

            {/* =================================================
                DOCUMENT HISTORY DETAIL
            ================================================== */}

            {selectedHistoryDocumentId && (
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-base font-semibold text-slate-950">
                      Document Activity
                    </div>

                    <div className="mt-1 text-sm text-slate-500">
                      Audit trail for document ID{" "}
                      {selectedHistoryDocumentId}.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedHistoryDocumentId(
                        null
                      );
                      setHistory([]);
                    }}
                    className="self-start rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>

                <div className="p-6">
                  {historyLoading ? (
                    <div className="py-8 text-center text-sm text-slate-500">
                      Loading document activity...
                    </div>
                  ) : history.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
                      No activity has been recorded for this
                      document.
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="absolute bottom-4 left-[11px] top-4 w-px bg-slate-200" />

                      <div className="space-y-6">
                        {history.map(
                          (item) => (
                            <div
                              key={
                                item.id
                              }
                              className="relative flex gap-4"
                            >
                              <div className="relative z-10 mt-1 h-6 w-6 shrink-0 rounded-full border-4 border-white bg-slate-300 ring-1 ring-slate-200" />

                              <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                  <div>
                                    <div className="text-sm font-semibold text-slate-900">
                                      {humanizeAction(
                                        item.action
                                      )}
                                    </div>

                                    <div className="mt-1 text-xs text-slate-500">
                                      {formatDateTime(
                                        item.created_at
                                      )}
                                      {" · "}
                                      {userReference(
                                        item.performed_by
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 text-xs">
                                    {item.old_status && (
                                      <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-600">
                                        {humanizeStatus(
                                          item.old_status
                                        )}
                                      </span>
                                    )}

                                    {item.old_status &&
                                      item.new_status && (
                                        <span className="text-slate-400">
                                          →
                                        </span>
                                      )}

                                    {item.new_status && (
                                      <span className="rounded-md border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700">
                                        {humanizeStatus(
                                          item.new_status
                                        )}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {item.comment && (
                                  <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-700">
                                    {item.comment}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* =================================================
                LINKED CONTROLS
            ================================================== */}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-base font-semibold text-slate-950">
                    Linked Controls
                  </div>

                  <div className="mt-1 text-sm text-slate-500">
                    Controls governed by this procedure.
                  </div>
                </div>

                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {controls.length} linked
                </div>
              </div>

              {controls.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <div className="text-sm font-medium text-slate-700">
                    No controls are linked
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Link controls to establish traceability
                    between this procedure and the compliance
                    control framework.
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {controls.map(
                    (control) => (
                      <div
                        key={
                          control.id
                        }
                        className="flex flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900">
                            {control.control_title ||
                              `Control #${control.control_id}`}
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {control.control_code ||
                              `Control ID: ${control.control_id}`}
                          </div>
                        </div>

                        {isDraft && (
                          <button
                            type="button"
                            onClick={() =>
                              removeControl(
                                control.control_id
                              )
                            }
                            disabled={
                              removingControlId ===
                              control.control_id
                            }
                            className="self-start rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 md:self-auto"
                          >
                            {removingControlId ===
                            control.control_id
                              ? "Removing..."
                              : "Remove"}
                          </button>
                        )}
                      </div>
                    )
                  )}
                </div>
              )}
            </section>
          </div>

          {/* ===================================================
              RIGHT SIDEBAR
          ==================================================== */}

          <aside className="space-y-6">
            {/* POLICY */}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="text-sm font-semibold text-slate-950">
                  Parent Policy
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  Governance hierarchy
                </div>
              </div>

              <div className="p-5">
                {policy ? (
                  <>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {policy.policy_code ||
                        `Policy #${policy.id}`}
                    </div>

                    <div className="mt-2 text-sm font-semibold text-slate-900">
                      {policy.title ||
                        `Policy #${policy.id}`}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {policy.status && (
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                            policy.status
                          )}`}
                        >
                          {humanizeStatus(
                            policy.status
                          )}
                        </span>
                      )}

                      {policy.version && (
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {formatVersion(
                            policy.version
                          )}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        router.push(`/governance?policyId=${policy.id}`)
                      }
                      className="mt-5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Open Policy
                    </button>
                  </>
                ) : (
                  <div className="text-sm text-slate-500">
                    Parent policy information is not
                    available from the current API response.
                  </div>
                )}
              </div>
            </section>

            {/* LIFECYCLE */}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="text-sm font-semibold text-slate-950">
                  Lifecycle
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  Procedure governance state
                </div>
              </div>

              <div className="p-5">
                <div className="space-y-4">
                  {[
                    {
                      label: "Draft",
                      active:
                        procedure.status ===
                        "draft",
                    },
                    {
                      label: "Under Review",
                      active:
                        procedure.status ===
                        "under_review",
                    },
                    {
                      label: "Approved",
                      active:
                        procedure.status ===
                        "approved",
                    },
                    {
                      label: "Archived",
                      active:
                        procedure.status ===
                        "archived",
                    },
                  ].map(
                    (step, index) => (
                      <div
                        key={
                          step.label
                        }
                        className="flex items-start gap-3"
                      >
                        <div
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                            step.active
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-400"
                          }`}
                        >
                          {index + 1}
                        </div>

                        <div>
                          <div
                            className={`text-sm font-medium ${
                              step.active
                                ? "text-slate-950"
                                : "text-slate-500"
                            }`}
                          >
                            {step.label}
                          </div>

                          {step.active && (
                            <div className="mt-0.5 text-xs text-slate-500">
                              Current state
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </section>

            {/* AUDIT METADATA */}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="text-sm font-semibold text-slate-950">
                  Record Metadata
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  System traceability
                </div>
              </div>

              <div className="divide-y divide-slate-200">
                <div className="px-5 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Procedure ID
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-900">
                    {procedure.id}
                  </div>
                </div>

                <div className="px-5 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Tenant ID
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-900">
                    {procedure.tenant_id ??
                      "Not returned"}
                  </div>
                </div>

                <div className="px-5 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Created
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    {formatDateTime(
                      procedure.created_at
                    )}
                  </div>
                </div>

                <div className="px-5 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Last Updated
                  </div>
                  <div className="mt-1 text-sm text-slate-700">
                    {formatDateTime(
                      procedure.updated_at
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* DOCUMENT REVIEW SUMMARY */}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="text-sm font-semibold text-slate-950">
                  Document Review
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  Current controlled document state
                </div>
              </div>

              <div className="p-5">
                {!currentDocument ? (
                  <div className="text-sm text-slate-500">
                    No document has been uploaded.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-slate-600">
                        Current version
                      </span>
                      <span className="text-sm font-semibold text-slate-900">
                        {formatVersion(
                          currentDocument.version
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-slate-600">
                        Status
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${documentStatusClass(
                          currentDocument.status
                        )}`}
                      >
                        {humanizeStatus(
                          currentDocument.status
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-slate-600">
                        Reviewer
                      </span>
                      <span className="text-right text-xs font-medium text-slate-700">
                        {userReference(
                          currentDocument.reviewer_id
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-slate-600">
                        Approved
                      </span>
                      <span className="text-right text-xs font-medium text-slate-700">
                        {currentDocument.approved_at
                          ? formatDateTime(
                              currentDocument.approved_at
                            )
                          : "Not approved"}
                      </span>
                    </div>

                    {isDocumentReviewable(
                      currentDocument
                    ) &&
                      !isArchived && (
                        <div className="pt-2">
                          {currentDocument.status ===
                            "uploaded" && (
                            <button
                              type="button"
                              onClick={() =>
                                documentAction(
                                  currentDocument.id,
                                  "submit-review"
                                )
                              }
                              disabled={
                                actionLoading
                              }
                              className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                            >
                              Submit Document for Review
                            </button>
                          )}

                          {currentDocument.status ===
                            "under_review" && (
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  documentAction(
                                    currentDocument.id,
                                    "approve"
                                  )
                                }
                                disabled={
                                  actionLoading
                                }
                                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                Approve
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  documentAction(
                                    currentDocument.id,
                                    "reject"
                                  )
                                }
                                disabled={
                                  actionLoading
                                }
                                className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
