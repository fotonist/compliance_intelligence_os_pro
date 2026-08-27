"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "../../lib/api";


type User = {
  id: number;
  email: string;
  full_name?: string | null;
};

type Policy = {
  id: number;
  policy_code: string;
  title: string;
  description?: string | null;
  category?: string | null;
  status: string;
  version: string;
  owner_id?: number | null;
  approver_id?: number | null;
  effective_date?: string | null;
  review_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type Procedure = {
  id: number;
  policy_id: number;
  procedure_code: string;
  title: string;
  description?: string | null;
  status: string;
  version: string;
  owner_id?: number | null;
  effective_date?: string | null;
  review_date?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type PolicyForm = {
  policy_code: string;
  title: string;
  description: string;
  category: string;
  status: string;
  version: string;
  owner_id: string;
  approver_id: string;
  effective_date: string;
  review_date: string;
};

type ProcedureForm = {
  policy_id: string;
  procedure_code: string;
  title: string;
  description: string;
  owner_id: string;
  status: string;
  version: string;
  effective_date: string;
  review_date: string;
};

type Toast = {
  type: "success" | "error" | "info";
  message: string;
};

const POLICY_CATEGORIES = [
  ["information_security", "Information Security"],
  ["quality", "Quality"],
  ["compliance", "Compliance"],
  ["risk", "Risk"],
  ["operation", "Operation"],
  ["hr", "Human Resources"],
  ["other", "Other"],
];

const STATUSES = [
  ["draft", "Draft"],
  ["under_review", "Under Review"],
  ["approved", "Approved"],
  ["expired", "Expired"],
  ["archived", "Archived"],
];

const emptyPolicyForm: PolicyForm = {
  policy_code: "",
  title: "",
  description: "",
  category: "other",
  status: "draft",
  version: "1.0",
  owner_id: "",
  approver_id: "",
  effective_date: "",
  review_date: "",
};

const emptyProcedureForm: ProcedureForm = {
  policy_id: "",
  procedure_code: "",
  title: "",
  description: "",
  owner_id: "",
  status: "draft",
  version: "1.0",
  effective_date: "",
  review_date: "",
};


function userName(
  users: User[],
  id?: number | null
) {
  if (!id) return "—";

  const user = users.find(
    (item) => item.id === id
  );

  return (
    user?.full_name ||
    user?.email ||
    `User #${id}`
  );
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

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIso(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function statusLabel(status: string) {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClasses(status: string) {
  switch (status) {
    case "approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "under_review":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "expired":
      return "border-orange-200 bg-orange-50 text-orange-700";

    case "archived":
      return "border-slate-200 bg-slate-100 text-slate-600";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function inputClass() {
  return "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200";
}

function countStatus<T extends { status: string }>(
  items: T[],
  status: string
) {
  return items.filter((item) => item.status === status).length;
}

export default function GovernancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [policies, setPolicies] = useState<Policy[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [uploadingProcedureId, setUploadingProcedureId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState<"all" | "policies" | "procedures">(
    "all"
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [procedureModalOpen, setProcedureModalOpen] = useState(false);

  const [editingPolicyId, setEditingPolicyId] = useState<number | null>(null);

  const [policyForm, setPolicyForm] = useState<PolicyForm>(emptyPolicyForm);
  const [procedureForm, setProcedureForm] =
    useState<ProcedureForm>(emptyProcedureForm);

  const [savingPolicy, setSavingPolicy] = useState(false);
  const [savingProcedure, setSavingProcedure] = useState(false);

  const [actionKey, setActionKey] = useState("");

  const [toast, setToast] = useState<Toast | null>(null);

  function showToast(type: Toast["type"], message: string) {
    setToast({ type, message });

    window.setTimeout(() => {
      setToast(null);
    }, 4500);
  }

  async function loadData(initial = false) {
    try {
      if (initial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      const [policiesRes, proceduresRes, usersRes] = await Promise.all([
        apiFetch("/governance/policies"),
        apiFetch("/governance/procedures"),
        apiFetch("/users"),
      ]);

      if (!policiesRes.ok) {
        throw new Error(
          (await policiesRes.text()) || "Failed to load policies"
        );
      }

      if (!proceduresRes.ok) {
        throw new Error(
          (await proceduresRes.text()) || "Failed to load procedures"
        );
      }

      if (!usersRes.ok) {
        throw new Error(
          (await usersRes.text()) || "Failed to load users"
        );
      }

      const policiesData = await policiesRes.json();
      const proceduresData = await proceduresRes.json();
      const usersData = await usersRes.json();

      const nextPolicies = Array.isArray(policiesData)
        ? policiesData
        : policiesData.items || [];

      const nextProcedures = Array.isArray(proceduresData)
        ? proceduresData
        : proceduresData.items || [];

      const nextUsers = Array.isArray(usersData)
        ? usersData
        : usersData.items || [];

      setPolicies(nextPolicies);
      setProcedures(nextProcedures);
      setUsers(nextUsers);
    } catch (err: any) {
      const message = err?.message || "Failed to load governance data";
      setError(message);

      if (!initial) {
        showToast("error", message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData(true);
  }, []);

  const policyById = useMemo(() => {
    const map = new Map<number, Policy>();

    for (const policy of policies) {
      map.set(policy.id, policy);
    }

    return map;
  }, [policies]);

  const filteredPolicies = useMemo(() => {
    const query = search.trim().toLowerCase();

    return policies.filter((policy) => {
      const matchesSearch =
        !query ||
        policy.title.toLowerCase().includes(query) ||
        policy.policy_code.toLowerCase().includes(query) ||
        String(policy.owner_id ?? "").includes(query);

      const matchesStatus =
        statusFilter === "all" || policy.status === statusFilter;

      const matchesCategory =
        categoryFilter === "all" || policy.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [policies, search, statusFilter, categoryFilter]);

  const filteredProcedures = useMemo(() => {
    const query = search.trim().toLowerCase();

    return procedures.filter((procedure) => {
      const policy = policyById.get(procedure.policy_id);

      const matchesSearch =
        !query ||
        procedure.title.toLowerCase().includes(query) ||
        procedure.procedure_code.toLowerCase().includes(query) ||
        String(procedure.owner_id ?? "").includes(query) ||
        policy?.title.toLowerCase().includes(query) ||
        policy?.policy_code.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" || procedure.status === statusFilter;

      const matchesCategory =
        categoryFilter === "all" ||
        policy?.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [
    procedures,
    policies,
    policyById,
    search,
    statusFilter,
    categoryFilter,
  ]);

  function openCreatePolicy() {
    setEditingPolicyId(null);
    setPolicyForm(emptyPolicyForm);
    setPolicyModalOpen(true);
  }

  async function openEditPolicy(policyId: number) {
    try {
      setActionKey(`load-policy-${policyId}`);

      const res = await apiFetch(`/governance/policies/${policyId}`);

      if (!res.ok) {
        throw new Error((await res.text()) || "Failed to load policy");
      }

      const policy = await res.json();

      setEditingPolicyId(policyId);

      setPolicyForm({
        policy_code: policy.policy_code || "",
        title: policy.title || "",
        description: policy.description || "",
        category: policy.category || "other",
        status: policy.status || "draft",
        version: policy.version || "1.0",
        owner_id:
          policy.owner_id !== null && policy.owner_id !== undefined
            ? String(policy.owner_id)
            : "",
        approver_id:
          policy.approver_id !== null &&
          policy.approver_id !== undefined
            ? String(policy.approver_id)
            : "",
        effective_date: toDateTimeLocal(policy.effective_date),
        review_date: toDateTimeLocal(policy.review_date),
      });

      setPolicyModalOpen(true);
    } catch (err: any) {
      showToast(
        "error",
        err?.message || "Failed to load policy"
      );
    } finally {
      setActionKey("");
    }
  }

  useEffect(() => {
    const policyIdParam = searchParams.get("policyId");

    if (!policyIdParam) {
      return;
    }

    const policyId = Number(policyIdParam);

    if (!Number.isInteger(policyId) || policyId <= 0) {
      router.replace("/governance");
      return;
    }

    openEditPolicy(policyId).finally(() => {
      router.replace("/governance");
    });
  }, [searchParams, router]);
  async function savePolicy() {
    if (!policyForm.policy_code.trim()) {
      showToast("error", "Policy code is required.");
      return;
    }

    if (!policyForm.title.trim()) {
      showToast("error", "Policy title is required.");
      return;
    }

    try {
      setSavingPolicy(true);

      const payload = {
        ...(editingPolicyId === null
          ? {
              policy_code: policyForm.policy_code.trim(),
            }
          : {}),
        title: policyForm.title.trim(),
        description: policyForm.description.trim() || null,
        category: policyForm.category,
        status: policyForm.status,
        version: policyForm.version.trim() || "1.0",
        owner_id: policyForm.owner_id
          ? Number(policyForm.owner_id)
          : null,
        approver_id: policyForm.approver_id
          ? Number(policyForm.approver_id)
          : null,
        effective_date: toIso(policyForm.effective_date),
        review_date: toIso(policyForm.review_date),
      };

      const endpoint =
        editingPolicyId === null
          ? "/governance/policies"
          : `/governance/policies/${editingPolicyId}`;

      const res = await apiFetch(endpoint, {
        method: editingPolicyId === null ? "POST" : "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(
          (await res.text()) ||
            (editingPolicyId === null
              ? "Failed to create policy"
              : "Failed to update policy")
        );
      }

      setPolicyModalOpen(false);
      setEditingPolicyId(null);
      setPolicyForm(emptyPolicyForm);

      await loadData();

      showToast(
        "success",
        editingPolicyId === null
          ? "Policy created successfully."
          : "Policy updated successfully."
      );
    } catch (err: any) {
      showToast(
        "error",
        err?.message ||
          (editingPolicyId === null
            ? "Failed to create policy"
            : "Failed to update policy")
      );
    } finally {
      setSavingPolicy(false);
    }
  }

  function openCreateProcedure() {
    setProcedureForm({
      ...emptyProcedureForm,
      policy_id: policies.length > 0 ? String(policies[0].id) : "",
    });

    setProcedureModalOpen(true);
  }

  async function saveProcedure() {
    if (!procedureForm.policy_id) {
      showToast("error", "Parent policy is required.");
      return;
    }

    if (!procedureForm.procedure_code.trim()) {
      showToast("error", "Procedure code is required.");
      return;
    }

    if (!procedureForm.title.trim()) {
      showToast("error", "Procedure title is required.");
      return;
    }

    try {
      setSavingProcedure(true);

      const payload = {
        policy_id: Number(procedureForm.policy_id),
        procedure_code: procedureForm.procedure_code.trim(),
        title: procedureForm.title.trim(),
        description: procedureForm.description.trim() || null,
        owner_id: procedureForm.owner_id
          ? Number(procedureForm.owner_id)
          : null,
        status: procedureForm.status,
        version: procedureForm.version.trim() || "1.0",
        effective_date: toIso(procedureForm.effective_date),
        review_date: toIso(procedureForm.review_date),
      };

      const res = await apiFetch("/governance/procedures", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(
          (await res.text()) || "Failed to create procedure"
        );
      }

      const created = await res.json();

      setProcedureModalOpen(false);
      setProcedureForm(emptyProcedureForm);

      await loadData();

      showToast("success", "Procedure created successfully.");

      if (created?.id) {
        router.push(`/governance/procedures/${created.id}`);
      }
    } catch (err: any) {
      showToast(
        "error",
        err?.message || "Failed to create procedure"
      );
    } finally {
      setSavingProcedure(false);
    }
  }

  async function executePolicyLifecycle(
    policy: Policy,
    action: "submit" | "approve" | "archive"
  ) {
    const labels = {
      submit: "Submit this policy for review?",
      approve: "Approve this policy?",
      archive: "Archive this policy? It will become read-only.",
    };

    if (!window.confirm(labels[action])) {
      return;
    }

    try {
      setActionKey(`policy-${policy.id}-${action}`);

      const res = await apiFetch(
        `/governance/policies/${policy.id}/${action}`,
        {
          method: "POST",
        }
      );

      if (!res.ok) {
        throw new Error(
          (await res.text()) ||
            `Failed to ${action} policy`
        );
      }

      await loadData();

      showToast(
        "success",
        `Policy ${action === "submit" ? "submitted for review" : action + "d"} successfully.`
      );
    } catch (err: any) {
      showToast(
        "error",
        err?.message || `Failed to ${action} policy`
      );
    } finally {
      setActionKey("");
    }
  }

  async function executeProcedureLifecycle(
    procedure: Procedure,
    action: "submit" | "approve" | "archive"
  ) {
    const labels = {
      submit: "Submit this procedure for review?",
      approve: "Approve this procedure?",
      archive: "Archive this procedure? It will become read-only.",
    };

    if (!window.confirm(labels[action])) {
      return;
    }

    try {
      setActionKey(`procedure-${procedure.id}-${action}`);

      const res = await apiFetch(
        `/governance/procedures/${procedure.id}/${action}`,
        {
          method: "POST",
        }
      );

      if (!res.ok) {
        throw new Error(
          (await res.text()) ||
            `Failed to ${action} procedure`
        );
      }

      await loadData();

      showToast(
        "success",
        `Procedure ${action === "submit" ? "submitted for review" : action + "d"} successfully.`
      );
    } catch (err: any) {
      showToast(
        "error",
        err?.message || `Failed to ${action} procedure`
      );
    } finally {
      setActionKey("");
    }
  }


  // =====================================================
  // PROCEDURE DOCUMENT MANAGEMENT
  // =====================================================

  async function uploadProcedureDocument(
    procedureId: number,
    file: File
  ) {

    const formData = new FormData();

    formData.append(
      "file",
      file
    );

    const res = await apiFetch(
      `/governance/procedures/${procedureId}/documents`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!res.ok) {
      throw new Error(
        (await res.text()) ||
        "Document upload failed"
      );
    }

    return res.json();
  }



  async function handleProcedureUpload(
    procedureId: number,
    file: File
  ) {

    try {

      setUploadingProcedureId(procedureId);

      await uploadProcedureDocument(
        procedureId,
        file
      );

      showToast(
        "success",
        "Procedure document uploaded successfully."
      );

      await loadData();

    } catch (err: any) {

      showToast(
        "error",
        err?.message || "Document upload failed"
      );

    } finally {

      setUploadingProcedureId(null);

    }
  }


  async function getProcedureDocuments(
    procedureId: number
  ) {

    const res = await apiFetch(
      `/governance/procedures/${procedureId}/documents`
    );

    if (!res.ok) {
      throw new Error(
        "Failed to load documents"
      );
    }

    return res.json();
  }


  function downloadDocument(
    documentId: number
  ) {

    window.open(
      `/governance/documents/${documentId}/download`,
      "_blank"
    );

  }


  async function getDocumentHistory(
    documentId: number
  ) {

    const res = await apiFetch(
      `/governance/documents/${documentId}/history`
    );

    if (!res.ok) {
      throw new Error(
        "Failed to load document history"
      );
    }

    return res.json();

  }


  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setCategoryFilter("all");
  }

  const visibleCount =
    activeTab === "policies"
      ? filteredPolicies.length
      : activeTab === "procedures"
        ? filteredProcedures.length
        : filteredPolicies.length + filteredProcedures.length;

  if (loading) {
    return (
      <div className="min-h-full bg-slate-50 p-6">
        <div className="mx-auto max-w-[1600px]">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-72 rounded bg-slate-200" />
            <div className="h-4 w-96 rounded bg-slate-200" />
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-24 rounded-xl bg-white ring-1 ring-slate-200"
                />
              ))}
            </div>
            <div className="h-96 rounded-xl bg-white ring-1 ring-slate-200" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50">
      {toast && (
        <div className="fixed right-6 top-6 z-[100] w-[380px]">
          <div
            className={`rounded-xl border bg-white px-4 py-3 shadow-lg ${
              toast.type === "success"
                ? "border-emerald-200"
                : toast.type === "error"
                  ? "border-red-200"
                  : "border-slate-200"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 h-2.5 w-2.5 rounded-full ${
                  toast.type === "success"
                    ? "bg-emerald-500"
                    : toast.type === "error"
                      ? "bg-red-500"
                      : "bg-slate-400"
                }`}
              />

              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-900">
                  {toast.type === "success"
                    ? "Completed"
                    : toast.type === "error"
                      ? "Action failed"
                      : "Information"}
                </div>

                <div className="mt-1 text-sm text-slate-600">
                  {toast.message}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setToast(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span>Governance</span>
              <span>/</span>
              <span className="text-slate-700">
                Policy & Procedure Management
              </span>
            </div>

            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Policies & Procedures
            </h1>

            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-500">
              Manage controlled governance documents, ownership,
              lifecycle status and review obligations across the
              organization.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => loadData()}
              disabled={refreshing}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className={refreshing ? "animate-spin" : ""}>
                ↻
              </span>
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              type="button"
              onClick={openCreatePolicy}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              <span className="text-base">+</span>
              New Policy
            </button>

            <button
              type="button"
              onClick={openCreateProcedure}
              disabled={policies.length === 0}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <span className="text-base">+</span>
              New Procedure
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-6 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-red-800">
                Governance data could not be loaded
              </div>
              <div className="mt-1 text-sm text-red-700">
                {error}
              </div>
            </div>

            <button
              type="button"
              onClick={() => loadData(true)}
              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
            >
              Retry
            </button>
          </div>
        )}

        <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[
            {
              label: "Policies",
              value: policies.length,
              detail: "Governance policies",
            },
            {
              label: "Procedures",
              value: procedures.length,
              detail: "Operational procedures",
            },
            {
              label: "Draft",
              value:
                countStatus(policies, "draft") +
                countStatus(procedures, "draft"),
              detail: "Work in progress",
            },
            {
              label: "Under Review",
              value:
                countStatus(policies, "under_review") +
                countStatus(procedures, "under_review"),
              detail: "Awaiting approval",
            },
            {
              label: "Approved",
              value:
                countStatus(policies, "approved") +
                countStatus(procedures, "approved"),
              detail: "Effective governance",
            },
            {
              label: "Archived",
              value:
                countStatus(policies, "archived") +
                countStatus(procedures, "archived"),
              detail: "Read-only records",
            },
          ].map((metric) => (
            <div
              key={metric.label}
              className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
            >
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {metric.label}
              </div>

              <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {metric.value}
              </div>

              <div className="mt-1 text-xs text-slate-500">
                {metric.detail}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-7 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-950">
                  Governance Registry
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Controlled policies and procedures within the current tenant.
                </p>
              </div>

              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                {[
                  ["all", "All"],
                  ["policies", "Policies"],
                  ["procedures", "Procedures"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setActiveTab(
                        value as "all" | "policies" | "procedures"
                      )
                    }
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                      activeTab === value
                        ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(280px,1fr)_180px_200px_auto]">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  ⌕
                </span>

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search code, title or owner ID..."
                  className={`${inputClass()} pl-9`}
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className={inputClass()}
              >
                <option value="all">All statuses</option>
                {STATUSES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              <select
                value={categoryFilter}
                onChange={(event) =>
                  setCategoryFilter(event.target.value)
                }
                className={inputClass()}
              >
                <option value="all">All categories</option>
                {POLICY_CATEGORIES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={clearFilters}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Clear
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
              <span>
                Showing{" "}
                <span className="font-semibold text-slate-600">
                  {visibleCount}
                </span>{" "}
                records
              </span>

              {(search ||
                statusFilter !== "all" ||
                categoryFilter !== "all") && (
                <span>Filters applied</span>
              )}
            </div>
          </div>

          {(activeTab === "all" || activeTab === "procedures") && (
            <div className="border-b border-slate-200">
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Procedures
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Operational procedures governed by parent policies.
                  </p>
                </div>

                <span className="text-xs font-medium text-slate-400">
                  {filteredProcedures.length} records
                </span>
              </div>

              {filteredProcedures.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-slate-500">
                  No procedures match the current filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[1100px] w-full">
                    <thead>
                      <tr className="border-t border-slate-100 bg-slate-50 text-left">
                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Procedure
                        </th>
                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Parent Policy
                        </th>
                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Status
                        </th>
                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Owner ID
                        </th>
                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Version
                        </th>
                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Review
                        </th>
                        <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {filteredProcedures.map((procedure) => {
                        const policy = policyById.get(procedure.policy_id);
                        const actionPrefix = `procedure-${procedure.id}`;

                        return (
                          <tr
                            key={procedure.id}
                            className="group transition hover:bg-slate-50"
                          >
                            <td className="px-5 py-4">
                              <button
                                type="button"
                                onClick={() =>
                                  router.push(
                                    `/governance/procedures/${procedure.id}`
                                  )
                                }
                                className="text-left"
                              >
                                <div className="font-medium text-slate-900 group-hover:text-slate-700">
                                  {procedure.title}
                                </div>
                                <div className="mt-1 text-xs font-medium text-slate-400">
                                  {procedure.procedure_code}
                                </div>
                              </button>
                            </td>

                            <td className="px-5 py-4">
                              <div className="text-sm text-slate-700">
                                {policy?.title ||
                                  `Policy #${procedure.policy_id}`}
                              </div>
                              <div className="mt-1 text-xs text-slate-400">
                                {policy?.policy_code ||
                                  `ID ${procedure.policy_id}`}
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(
                                  procedure.status
                                )}`}
                              >
                                {statusLabel(procedure.status)}
                              </span>
                            </td>

                            <td className="px-5 py-4 text-sm text-slate-600">
                              {userName(users, procedure.owner_id)}
                            </td>

                            <td className="px-5 py-4 text-sm font-medium text-slate-700">
                              v{procedure.version}
                            </td>

                            <td className="px-5 py-4">
                              <div className="text-sm text-slate-600">
                                {formatDate(procedure.review_date)}
                              </div>

                              {procedure.effective_date && (
                                <div className="mt-1 text-xs text-slate-400">
                                  Effective{" "}
                                  {formatDate(
                                    procedure.effective_date
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex items-center justify-end gap-1.5">
<button
                                  type="button"
                                  onClick={() =>
                                    router.push(
                                      `/governance/procedures/${procedure.id}`
                                    )
                                  }
                                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                                >
                                  Open
                                </button>

                                {procedure.status === "draft" && (
                                  <button
                                    type="button"
                                    disabled={
                                      actionKey ===
                                      `${actionPrefix}-submit`
                                    }
                                    onClick={() =>
                                      executeProcedureLifecycle(
                                        procedure,
                                        "submit"
                                      )
                                    }
                                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                                  >
                                    Submit
                                  </button>
                                )}

                                {procedure.status === "under_review" && (
                                  <button
                                    type="button"
                                    disabled={
                                      actionKey ===
                                      `${actionPrefix}-approve`
                                    }
                                    onClick={() =>
                                      executeProcedureLifecycle(
                                        procedure,
                                        "approve"
                                      )
                                    }
                                    className="rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                                  >
                                    Approve
                                  </button>
                                )}

                                {procedure.status === "approved" && (
                                  <button
                                    type="button"
                                    disabled={
                                      actionKey ===
                                      `${actionPrefix}-archive`
                                    }
                                    onClick={() =>
                                      executeProcedureLifecycle(
                                        procedure,
                                        "archive"
                                      )
                                    }
                                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                                  >
                                    Archive
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {(activeTab === "all" || activeTab === "policies") && (
            <div>
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Policies
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Controlled governance policies and lifecycle records.
                  </p>
                </div>

                <span className="text-xs font-medium text-slate-400">
                  {filteredPolicies.length} records
                </span>
              </div>

              {filteredPolicies.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-slate-500">
                  No policies match the current filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[1150px] w-full">
                    <thead>
                      <tr className="border-t border-slate-100 bg-slate-50 text-left">
                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Policy
                        </th>
                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Category
                        </th>
                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Status
                        </th>
                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Owner
                        </th>
                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Approver
                        </th>
                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Version
                        </th>
                        <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Review
                        </th>
                        <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {filteredPolicies.map((policy) => {
                        const actionPrefix = `policy-${policy.id}`;

                        return (
                          <tr
                            key={policy.id}
                            className="group transition hover:bg-slate-50"
                          >
                            <td className="px-5 py-4">
                              <div className="text-sm font-medium text-slate-900">
                                {policy.title}
                              </div>

                              <div className="mt-1 text-xs font-medium text-slate-400">
                                {policy.policy_code}
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <span className="text-sm text-slate-600">
                                {POLICY_CATEGORIES.find(
                                  ([value]) =>
                                    value === policy.category
                                )?.[1] ||
                                  policy.category ||
                                  "Other"}
                              </span>
                            </td>

                            <td className="px-5 py-4">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(
                                  policy.status
                                )}`}
                              >
                                {statusLabel(policy.status)}
                              </span>
                            </td>

                            <td className="px-5 py-4 text-sm text-slate-600">
                              {userName(users, policy.owner_id)}
                            </td>

                            <td className="px-5 py-4 text-sm text-slate-600">
                              {userName(users, policy.approver_id)}
                            </td>

                            <td className="px-5 py-4 text-sm font-medium text-slate-700">
                              v{policy.version}
                            </td>

                            <td className="px-5 py-4">
                              <div className="text-sm text-slate-600">
                                {formatDate(policy.review_date)}
                              </div>

                              {policy.effective_date && (
                                <div className="mt-1 text-xs text-slate-400">
                                  Effective{" "}
                                  {formatDate(
                                    policy.effective_date
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex items-center justify-end gap-1.5">
<button
                                  type="button"
                                  disabled={
                                    actionKey ===
                                    `load-policy-${policy.id}`
                                  }
                                  onClick={() =>
                                    openEditPolicy(policy.id)
                                  }
                                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                                >
                                  Edit
                                </button>

                                {policy.status === "draft" && (
                                  <button
                                    type="button"
                                    disabled={
                                      actionKey ===
                                      `${actionPrefix}-submit`
                                    }
                                    onClick={() =>
                                      executePolicyLifecycle(
                                        policy,
                                        "submit"
                                      )
                                    }
                                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                                  >
                                    Submit
                                  </button>
                                )}

                                {policy.status === "under_review" && (
                                  <button
                                    type="button"
                                    disabled={
                                      actionKey ===
                                      `${actionPrefix}-approve`
                                    }
                                    onClick={() =>
                                      executePolicyLifecycle(
                                        policy,
                                        "approve"
                                      )
                                    }
                                    className="rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                                  >
                                    Approve
                                  </button>
                                )}

                                {policy.status === "approved" && (
                                  <button
                                    type="button"
                                    disabled={
                                      actionKey ===
                                      `${actionPrefix}-archive`
                                    }
                                    onClick={() =>
                                      executePolicyLifecycle(
                                        policy,
                                        "archive"
                                      )
                                    }
                                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                                  >
                                    Archive
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {policies.length === 0 && !loading && (
          <div className="mt-5 rounded-xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
            <div className="text-sm font-semibold text-slate-900">
              No governance policies exist yet
            </div>

            <div className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              Create the first policy before adding procedures, because every
              procedure must belong to a parent policy.
            </div>

            <button
              type="button"
              onClick={openCreatePolicy}
              className="mt-4 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Create Policy
            </button>
          </div>
        )}
      </div>

      {policyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  {editingPolicyId === null
                    ? "Create Governance Policy"
                    : "Update Governance Policy"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Define the controlled policy metadata and lifecycle settings.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPolicyModalOpen(false)}
                className="rounded-lg p-2 text-xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <div className="grid gap-5 px-6 py-6 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Policy Code *
                </span>
                <input
                  value={policyForm.policy_code}
                  disabled={editingPolicyId !== null}
                  onChange={(event) =>
                    setPolicyForm((current) => ({
                      ...current,
                      policy_code: event.target.value,
                    }))
                  }
                  placeholder="POL-001"
                  className={`${inputClass()} mt-2 disabled:bg-slate-100 disabled:text-slate-500`}
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Version
                </span>
                <input
                  value={policyForm.version}
                  onChange={(event) =>
                    setPolicyForm((current) => ({
                      ...current,
                      version: event.target.value,
                    }))
                  }
                  placeholder="1.0"
                  className={`${inputClass()} mt-2`}
                />
              </label>

              <label className="block md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Title *
                </span>
                <input
                  value={policyForm.title}
                  onChange={(event) =>
                    setPolicyForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Information Security Policy"
                  className={`${inputClass()} mt-2`}
                />
              </label>

              <label className="block md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Description
                </span>
                <textarea
                  value={policyForm.description}
                  onChange={(event) =>
                    setPolicyForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  rows={4}
                  placeholder="Purpose, scope and governance intent..."
                  className={`${inputClass()} mt-2 resize-y`}
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Category
                </span>
                <select
                  value={policyForm.category}
                  onChange={(event) =>
                    setPolicyForm((current) => ({
                      ...current,
                      category: event.target.value,
                    }))
                  }
                  className={`${inputClass()} mt-2`}
                >
                  {POLICY_CATEGORIES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </span>
                <select
                  value={policyForm.status}
                  onChange={(event) =>
                    setPolicyForm((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                  className={`${inputClass()} mt-2`}
                >
                  {STATUSES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
    Owner
  </span>

  <select
    value={policyForm.owner_id}
    onChange={(event) =>
      setPolicyForm((current) => ({
        ...current,
        owner_id: event.target.value,
      }))
    }
    className={`${inputClass()} mt-2`}
  >
    <option value="">Select owner</option>

    {users.map((user) => (
      <option key={user.id} value={user.id}>
        {user.full_name || user.email}
      </option>
    ))}
  </select>
</label>

<label className="block">
  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
    Approver
  </span>

  <select
    value={policyForm.approver_id}
    onChange={(event) =>
      setPolicyForm((current) => ({
        ...current,
        approver_id: event.target.value,
      }))
    }
    className={`${inputClass()} mt-2`}
  >
    <option value="">Select approver</option>

    {users.map((user) => (
      <option key={user.id} value={user.id}>
        {user.full_name || user.email}
      </option>
    ))}
  </select>
</label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Effective Date
                </span>
                <input
                  type="datetime-local"
                  value={policyForm.effective_date}
                  onChange={(event) =>
                    setPolicyForm((current) => ({
                      ...current,
                      effective_date: event.target.value,
                    }))
                  }
                  className={`${inputClass()} mt-2`}
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Review Date
                </span>
                <input
                  type="datetime-local"
                  value={policyForm.review_date}
                  onChange={(event) =>
                    setPolicyForm((current) => ({
                      ...current,
                      review_date: event.target.value,
                    }))
                  }
                  className={`${inputClass()} mt-2`}
                />
              </label>
              <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Controlled Document
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      Manage the controlled policy document, versions and downloads.
                    </p>
                  </div>

                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">
                    No Document
                  </span>
                </div>


                <div className="mt-5 grid gap-4 md:grid-cols-3">

                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      Current Version
                    </div>

                    <div className="mt-2 text-sm font-semibold text-slate-800">
                      v{policyForm.version}
                    </div>
                  </div>


                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      Status
                    </div>

                    <div className="mt-2 text-sm font-semibold text-slate-800">
                      Controlled
                    </div>
                  </div>


                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      History
                    </div>

                    <div className="mt-2 text-sm font-semibold text-slate-800">
                      0 Versions
                    </div>
                  </div>

                </div>


                <div className="mt-5 flex flex-wrap gap-2">

                  <button
                    type="button"
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    Upload New Version
                  </button>


                  <button
                    type="button"
                    disabled
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-400"
                  >
                    Download
                  </button>


                  <button
                    type="button"
                    disabled
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-400"
                  >
                    Version History
                  </button>

                </div>

              </div>

            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setPolicyModalOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={savePolicy}
                disabled={savingPolicy}
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingPolicy
                  ? "Saving..."
                  : editingPolicyId === null
                    ? "Create Policy"
                    : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {procedureModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Create Governance Procedure
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Create a controlled procedure under an existing policy.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setProcedureModalOpen(false)}
                className="rounded-lg p-2 text-xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <div className="grid gap-5 px-6 py-6 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Parent Policy *
                </span>

                <select
                  value={procedureForm.policy_id}
                  onChange={(event) =>
                    setProcedureForm((current) => ({
                      ...current,
                      policy_id: event.target.value,
                    }))
                  }
                  className={`${inputClass()} mt-2`}
                >
                  <option value="">Select parent policy</option>

                  {policies
                    .filter((policy) => policy.status !== "archived")
                    .map((policy) => (
                      <option
                        key={policy.id}
                        value={policy.id}
                      >
                        {policy.policy_code} — {policy.title}
                      </option>
                    ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Procedure Code *
                </span>

                <input
                  value={procedureForm.procedure_code}
                  onChange={(event) =>
                    setProcedureForm((current) => ({
                      ...current,
                      procedure_code: event.target.value,
                    }))
                  }
                  placeholder="PROC-001"
                  className={`${inputClass()} mt-2`}
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Version
                </span>

                <input
                  value={procedureForm.version}
                  onChange={(event) =>
                    setProcedureForm((current) => ({
                      ...current,
                      version: event.target.value,
                    }))
                  }
                  placeholder="1.0"
                  className={`${inputClass()} mt-2`}
                />
              </label>

              <label className="block md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Title *
                </span>

                <input
                  value={procedureForm.title}
                  onChange={(event) =>
                    setProcedureForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Access Control Procedure"
                  className={`${inputClass()} mt-2`}
                />
              </label>

              <label className="block md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Description
                </span>

                <textarea
                  value={procedureForm.description}
                  onChange={(event) =>
                    setProcedureForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  rows={4}
                  placeholder="Purpose, scope and operational requirements..."
                  className={`${inputClass()} mt-2 resize-y`}
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Owner ID
                </span>

                <input
                  type="number"
                  min="1"
                  value={procedureForm.owner_id}
                  onChange={(event) =>
                    setProcedureForm((current) => ({
                      ...current,
                      owner_id: event.target.value,
                    }))
                  }
                  placeholder="Actual user ID"
                  className={`${inputClass()} mt-2`}
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </span>

                <select
                  value={procedureForm.status}
                  onChange={(event) =>
                    setProcedureForm((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                  className={`${inputClass()} mt-2`}
                >
                  {STATUSES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Effective Date
                </span>

                <input
                  type="datetime-local"
                  value={procedureForm.effective_date}
                  onChange={(event) =>
                    setProcedureForm((current) => ({
                      ...current,
                      effective_date: event.target.value,
                    }))
                  }
                  className={`${inputClass()} mt-2`}
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Review Date
                </span>

                <input
                  type="datetime-local"
                  value={procedureForm.review_date}
                  onChange={(event) =>
                    setProcedureForm((current) => ({
                      ...current,
                      review_date: event.target.value,
                    }))
                  }
                  className={`${inputClass()} mt-2`}
                />
              </label>
              <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Controlled Document
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      Manage the controlled policy document, versions and downloads.
                    </p>
                  </div>

                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">
                    No Document
                  </span>
                </div>


                <div className="mt-5 grid gap-4 md:grid-cols-3">

                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      Current Version
                    </div>

                    <div className="mt-2 text-sm font-semibold text-slate-800">
                      v{policyForm.version}
                    </div>
                  </div>


                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      Status
                    </div>

                    <div className="mt-2 text-sm font-semibold text-slate-800">
                      Controlled
                    </div>
                  </div>


                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      History
                    </div>

                    <div className="mt-2 text-sm font-semibold text-slate-800">
                      0 Versions
                    </div>
                  </div>

                </div>


                <div className="mt-5 flex flex-wrap gap-2">

                  <button
                    type="button"
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    Upload New Version
                  </button>


                  <button
                    type="button"
                    disabled
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-400"
                  >
                    Download
                  </button>


                  <button
                    type="button"
                    disabled
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-400"
                  >
                    Version History
                  </button>

                </div>

              </div>

            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setProcedureModalOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={saveProcedure}
                disabled={savingProcedure}
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingProcedure
                  ? "Creating..."
                  : "Create Procedure"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

















