"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Edit3,
  FileCheck2,
  Filter,
  History,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { apiFetch } from "@/app/lib/api";

type User = {
  id: number;
  email?: string;
  full_name?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
};

type Authority = {
  id: number;
  tenant_id: number;
  authority_code: string;
  name: string;
  authority_type: string;
  scope?: string | null;
  approver_id?: number | null;
  approval_limit?: string | number | null;
  currency?: string | null;
  effective_date?: string | null;
  review_date?: string | null;
  status: string;
  created_by?: number | null;
  updated_by?: number | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

type Delegation = {
  id: number;
  tenant_id: number;
  authority_id?: number | null;
  delegation_code: string;
  name: string;
  delegator_id?: number | null;
  delegate_id?: number | null;
  scope?: string | null;
  authority_limit?: string | number | null;
  currency?: string | null;
  start_date: string;
  end_date: string;
  reason?: string | null;
  status: string;
  created_by?: number | null;
  updated_by?: number | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

type HistoryItem = {
  id: number;
  tenant_id: number;
  authority_id?: number | null;
  delegation_id?: number | null;
  action: string;
  field_name?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  comment?: string | null;
  performed_by?: number | null;
  created_at: string;
};

type Summary = {
  active_authorities: number;
  active_delegations: number;
  expiring_soon: number;
  expired: number;
};

type AuthorityForm = {
  authority_code: string;
  name: string;
  authority_type: string;
  scope: string;
  approver_id: string;
  approval_limit: string;
  currency: string;
  effective_date: string;
  review_date: string;
  status: string;
};

type DelegationForm = {
  authority_id: string;
  delegation_code: string;
  name: string;
  delegator_id: string;
  delegate_id: string;
  scope: string;
  authority_limit: string;
  currency: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
};

const emptyAuthority: AuthorityForm = {
  authority_code: "",
  name: "",
  authority_type: "",
  scope: "",
  approver_id: "",
  approval_limit: "",
  currency: "",
  effective_date: "",
  review_date: "",
  status: "ACTIVE",
};

const emptyDelegation: DelegationForm = {
  authority_id: "",
  delegation_code: "",
  name: "",
  delegator_id: "",
  delegate_id: "",
  scope: "",
  authority_limit: "",
  currency: "",
  start_date: "",
  end_date: "",
  reason: "",
  status: "ACTIVE",
};

function formatDate(value?: string | null) {
  if (!value) return "Not set";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function userName(user?: User | null) {
  if (!user) return "Unassigned";

  if (user.full_name) return user.full_name;
  if (user.name) return user.name;

  const combined = [user.first_name, user.last_name]
    .filter(Boolean)
    .join(" ");

  return combined || user.email || `User #${user.id}`;
}

function statusLabel(value?: string | null) {
  if (!value) return "Unknown";

  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(value?: string | null) {
  const status = (value || "").toUpperCase();

  if (status === "ACTIVE") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "EXPIRED") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (status === "REVOKED") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "SUSPENDED") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "An unexpected error occurred.";
}

function inputClass() {
  return "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100";
}

function labelClass() {
  return "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500";
}

export default function ApprovalsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [authorities, setAuthorities] = useState<Authority[]>([]);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [activeRegister, setActiveRegister] = useState<"authorities" | "delegations">(
    "authorities",
  );

  const [authoritySearch, setAuthoritySearch] = useState("");
  const [authorityStatus, setAuthorityStatus] = useState("ALL");
  const [authorityType, setAuthorityType] = useState("ALL");

  const [delegationSearch, setDelegationSearch] = useState("");
  const [delegationStatus, setDelegationStatus] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [selectedAuthority, setSelectedAuthority] = useState<Authority | null>(null);
  const [selectedDelegation, setSelectedDelegation] = useState<Delegation | null>(null);
  const [authorityHistory, setAuthorityHistory] = useState<HistoryItem[]>([]);
  const [delegationHistory, setDelegationHistory] = useState<HistoryItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [authorityModal, setAuthorityModal] = useState(false);
  const [delegationModal, setDelegationModal] = useState(false);
  const [editingAuthority, setEditingAuthority] = useState<Authority | null>(null);
  const [editingDelegation, setEditingDelegation] = useState<Delegation | null>(null);

  const [authorityForm, setAuthorityForm] = useState<AuthorityForm>(emptyAuthority);
  const [delegationForm, setDelegationForm] = useState<DelegationForm>(emptyDelegation);

  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<
    { type: "authority" | "delegation"; id: number; name: string } | null
  >(null);

  const authorityTypes = useMemo(
    () =>
      Array.from(
        new Set(
          authorities
            .map((item) => item.authority_type)
            .filter(Boolean),
        ),
      ).sort(),
    [authorities],
  );

  const filteredAuthorities = useMemo(() => {
    const search = authoritySearch.trim().toLowerCase();

    return authorities.filter((item) => {
      const matchesStatus =
        authorityStatus === "ALL" || item.status === authorityStatus;

      const matchesType =
        authorityType === "ALL" || item.authority_type === authorityType;

      const haystack = [
        item.authority_code,
        item.name,
        item.authority_type,
        item.scope || "",
      ]
        .join(" ")
        .toLowerCase();

      return matchesStatus && matchesType && (!search || haystack.includes(search));
    });
  }, [authorities, authoritySearch, authorityStatus, authorityType]);

  const filteredDelegations = useMemo(() => {
    const search = delegationSearch.trim().toLowerCase();

    return delegations.filter((item) => {
      const matchesStatus =
        delegationStatus === "ALL" || item.status === delegationStatus;

      const authority = authorities.find((authority) => authority.id === item.authority_id);

      const haystack = [
        item.delegation_code,
        item.name,
        item.scope || "",
        item.reason || "",
        authority?.authority_code || "",
        authority?.name || "",
      ]
        .join(" ")
        .toLowerCase();

      return matchesStatus && (!search || haystack.includes(search));
    });
  }, [delegations, delegationSearch, delegationStatus, authorities]);

  async function loadAll(showSpinner = true) {
    if (showSpinner) setLoading(true);
    setRefreshing(!showSpinner);
    setError("");

    try {
      const [summaryResponse, authorityResponse, delegationResponse, userResponse] =
        await Promise.all([
          apiFetch("/governance-approvals/summary"),
          apiFetch("/governance-approvals/authorities?limit=200"),
          apiFetch("/governance-approvals/delegations?limit=200"),
          apiFetch("/users"),
        ]);

      const summaryData = (await summaryResponse.json()) as Summary;
      const authorityData = (await authorityResponse.json()) as {
        items: Authority[];
        total: number;
      };
      const delegationData = (await delegationResponse.json()) as {
        items: Delegation[];
        total: number;
      };
      const userData = (await userResponse.json()) as User[];

      setSummary(summaryData);
      setAuthorities(authorityData.items || []);
      setDelegations(delegationData.items || []);
      setUsers(Array.isArray(userData) ? userData : []);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function openAuthority(authority: Authority) {
    setSelectedAuthority(authority);
    setSelectedDelegation(null);
    setDetailLoading(true);
    setAuthorityHistory([]);

    try {
      const [detailResponse, historyResponse] = await Promise.all([
        apiFetch(`/governance-approvals/authorities/${authority.id}`),
        apiFetch(
          `/governance-approvals/authorities/${authority.id}/history`,
        ),
      ]);

      const detail = (await detailResponse.json()) as Authority;
      const history = (await historyResponse.json()) as HistoryItem[];

      setSelectedAuthority(detail);
      setAuthorityHistory(Array.isArray(history) ? history : []);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  }

  async function openDelegation(delegation: Delegation) {
    setSelectedDelegation(delegation);
    setSelectedAuthority(null);
    setDetailLoading(true);
    setDelegationHistory([]);

    try {
      const [detailResponse, historyResponse] = await Promise.all([
        apiFetch(
          `/governance-approvals/delegations/${delegation.id}`,
        ),
        apiFetch(
          `/governance-approvals/delegations/${delegation.id}/history`,
        ),
      ]);

      const detail = (await detailResponse.json()) as Delegation;
      const history = (await historyResponse.json()) as HistoryItem[];

      setSelectedDelegation(detail);
      setDelegationHistory(Array.isArray(history) ? history : []);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  }

  function openCreateAuthority() {
    setEditingAuthority(null);
    setAuthorityForm(emptyAuthority);
    setAuthorityModal(true);
  }

  function openEditAuthority(authority: Authority) {
    setEditingAuthority(authority);

    setAuthorityForm({
      authority_code: authority.authority_code || "",
      name: authority.name || "",
      authority_type: authority.authority_type || "",
      scope: authority.scope || "",
      approver_id: authority.approver_id ? String(authority.approver_id) : "",
      approval_limit:
        authority.approval_limit !== null && authority.approval_limit !== undefined
          ? String(authority.approval_limit)
          : "",
      currency: authority.currency || "",
      effective_date: authority.effective_date || "",
      review_date: authority.review_date || "",
      status: authority.status || "ACTIVE",
    });

    setAuthorityModal(true);
  }

  function openCreateDelegation() {
    setEditingDelegation(null);
    setDelegationForm({
      ...emptyDelegation,
      authority_id: selectedAuthority?.id
        ? String(selectedAuthority.id)
        : "",
    });
    setDelegationModal(true);
  }

  function openEditDelegation(delegation: Delegation) {
    setEditingDelegation(delegation);

    setDelegationForm({
      authority_id: delegation.authority_id
        ? String(delegation.authority_id)
        : "",
      delegation_code: delegation.delegation_code || "",
      name: delegation.name || "",
      delegator_id: delegation.delegator_id
        ? String(delegation.delegator_id)
        : "",
      delegate_id: delegation.delegate_id
        ? String(delegation.delegate_id)
        : "",
      scope: delegation.scope || "",
      authority_limit:
        delegation.authority_limit !== null &&
        delegation.authority_limit !== undefined
          ? String(delegation.authority_limit)
          : "",
      currency: delegation.currency || "",
      start_date: delegation.start_date || "",
      end_date: delegation.end_date || "",
      reason: delegation.reason || "",
      status: delegation.status || "ACTIVE",
    });

    setDelegationModal(true);
  }

  async function saveAuthority() {
    if (
      !authorityForm.authority_code.trim() ||
      !authorityForm.name.trim() ||
      !authorityForm.authority_type.trim()
    ) {
      setError("Authority code, name and authority type are required.");
      return;
    }

    if (
      authorityForm.effective_date &&
      authorityForm.review_date &&
      authorityForm.review_date < authorityForm.effective_date
    ) {
      setError("Review date cannot be before effective date.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        authority_code: authorityForm.authority_code.trim(),
        name: authorityForm.name.trim(),
        authority_type: authorityForm.authority_type.trim(),
        scope: authorityForm.scope.trim() || null,
        approver_id: authorityForm.approver_id
          ? Number(authorityForm.approver_id)
          : null,
        approval_limit: authorityForm.approval_limit
          ? Number(authorityForm.approval_limit)
          : null,
        currency: authorityForm.currency.trim() || null,
        effective_date: authorityForm.effective_date || null,
        review_date: authorityForm.review_date || null,
        status: authorityForm.status,
      };

      if (editingAuthority) {
        await apiFetch(
          `/governance-approvals/authorities/${editingAuthority.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
        );
      } else {
        await apiFetch("/governance-approvals/authorities", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setAuthorityModal(false);
      setEditingAuthority(null);
      await loadAll(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveDelegation() {
    if (
      !delegationForm.delegation_code.trim() ||
      !delegationForm.name.trim() ||
      !delegationForm.start_date ||
      !delegationForm.end_date
    ) {
      setError(
        "Delegation code, name, start date and end date are required.",
      );
      return;
    }

    if (delegationForm.end_date < delegationForm.start_date) {
      setError("End date cannot be before start date.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        authority_id: delegationForm.authority_id
          ? Number(delegationForm.authority_id)
          : null,
        delegation_code: delegationForm.delegation_code.trim(),
        name: delegationForm.name.trim(),
        delegator_id: delegationForm.delegator_id
          ? Number(delegationForm.delegator_id)
          : null,
        delegate_id: delegationForm.delegate_id
          ? Number(delegationForm.delegate_id)
          : null,
        scope: delegationForm.scope.trim() || null,
        authority_limit: delegationForm.authority_limit
          ? Number(delegationForm.authority_limit)
          : null,
        currency: delegationForm.currency.trim() || null,
        start_date: delegationForm.start_date,
        end_date: delegationForm.end_date,
        reason: delegationForm.reason.trim() || null,
        status: delegationForm.status,
      };

      if (editingDelegation) {
        await apiFetch(
          `/governance-approvals/delegations/${editingDelegation.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
        );
      } else {
        await apiFetch("/governance-approvals/delegations", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setDelegationModal(false);
      setEditingDelegation(null);
      await loadAll(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteTargetConfirm() {
    if (!deleteTarget) return;

    setSaving(true);
    setError("");

    try {
      if (deleteTarget.type === "authority") {
        await apiFetch(
          `/governance-approvals/authorities/${deleteTarget.id}`,
          { method: "DELETE" },
        );

        if (selectedAuthority?.id === deleteTarget.id) {
          setSelectedAuthority(null);
        }
      } else {
        await apiFetch(
          `/governance-approvals/delegations/${deleteTarget.id}`,
          { method: "DELETE" },
        );

        if (selectedDelegation?.id === deleteTarget.id) {
          setSelectedDelegation(null);
        }
      }

      setDeleteTarget(null);
      await loadAll(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function authorityUser(id?: number | null) {
    if (!id) return null;
    return users.find((user) => user.id === id) || null;
  }

  function authorityForDelegation(delegation: Delegation) {
    return authorities.find((authority) => authority.id === delegation.authority_id);
  }

  const selectedAuthorityDelegations = selectedAuthority
    ? delegations.filter(
        (delegation) =>
          delegation.authority_id === selectedAuthority.id &&
          !delegation.is_deleted,
      )
    : [];

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-[1600px] px-6 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-72 rounded bg-slate-200" />
            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="h-28 rounded-xl bg-white shadow-sm" />
              ))}
            </div>
            <div className="h-[500px] rounded-xl bg-white shadow-sm" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1600px] px-6 py-7">
        <div className="mb-7 flex items-start justify-between gap-6">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-400">
              <span>Governance</span>
              <ChevronRight size={13} />
              <span className="text-slate-600">Approvals &amp; Delegations</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
                <ShieldCheck size={21} className="text-slate-700" />
              </div>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                  Approvals &amp; Delegations
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Manage approval authority, delegated authority and governance history.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadAll(false)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                size={15}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={openCreateAuthority}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
            >
              <Plus size={16} />
              New Authority
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <div className="flex-1">{error}</div>
            <button
              type="button"
              onClick={() => setError("")}
              className="text-red-400 hover:text-red-700"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={<ShieldCheck size={18} />}
            label="Active Authorities"
            value={summary?.active_authorities ?? 0}
            helper="Current approval authorities"
          />
          <KpiCard
            icon={<UserCheck size={18} />}
            label="Active Delegations"
            value={summary?.active_delegations ?? 0}
            helper="Delegations valid today"
          />
          <KpiCard
            icon={<Clock3 size={18} />}
            label="Expiring Soon"
            value={summary?.expiring_soon ?? 0}
            helper="Within the next 30 days"
            emphasis="warning"
          />
          <KpiCard
            icon={<XCircle size={18} />}
            label="Expired"
            value={summary?.expired ?? 0}
            helper="Past review or end date"
            emphasis="danger"
          />
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 pt-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Governance Register
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Controlled register of approval authorities and delegations.
                </p>
              </div>

              <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setActiveRegister("authorities")}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    activeRegister === "authorities"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Authorities
                  <span className="ml-1.5 text-[10px] text-slate-400">
                    {authorities.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveRegister("delegations")}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    activeRegister === "delegations"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Delegations
                  <span className="ml-1.5 text-[10px] text-slate-400">
                    {delegations.length}
                  </span>
                </button>
              </div>
            </div>

            {activeRegister === "authorities" ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 pb-4">
                <div className="relative min-w-[280px] flex-1">
                  <Search
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={authoritySearch}
                    onChange={(event) => setAuthoritySearch(event.target.value)}
                    placeholder="Search authority code, name or scope..."
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </div>

                <div className="relative">
                  <Filter
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <select
                    value={authorityStatus}
                    onChange={(event) => setAuthorityStatus(event.target.value)}
                    className="rounded-lg border border-slate-200 bg-white py-2.5 pl-8 pr-8 text-sm text-slate-700 outline-none"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="SUSPENDED">Suspended</option>
                  </select>
                </div>

                <select
                  value={authorityType}
                  onChange={(event) => setAuthorityType(event.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
                >
                  <option value="ALL">All Types</option>
                  {authorityTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap items-center gap-2 pb-4">
                <div className="relative min-w-[280px] flex-1">
                  <Search
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={delegationSearch}
                    onChange={(event) => setDelegationSearch(event.target.value)}
                    placeholder="Search delegation, authority, person or scope..."
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  />
                </div>

                <div className="relative">
                  <Filter
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <select
                    value={delegationStatus}
                    onChange={(event) => setDelegationStatus(event.target.value)}
                    className="rounded-lg border border-slate-200 bg-white py-2.5 pl-8 pr-8 text-sm text-slate-700 outline-none"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="EXPIRED">Expired</option>
                    <option value="REVOKED">Revoked</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={openCreateDelegation}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <Plus size={15} />
                  New Delegation
                </button>
              </div>
            )}
          </div>

          {activeRegister === "authorities" ? (
            <AuthorityTable
              items={filteredAuthorities}
              users={users}
              onOpen={openAuthority}
              onEdit={openEditAuthority}
              onDelete={(item) =>
                setDeleteTarget({
                  type: "authority",
                  id: item.id,
                  name: item.name,
                })
              }
            />
          ) : (
            <DelegationTable
              items={filteredDelegations}
              authorities={authorities}
              users={users}
              onOpen={openDelegation}
              onEdit={openEditDelegation}
              onDelete={(item) =>
                setDeleteTarget({
                  type: "delegation",
                  id: item.id,
                  name: item.name,
                })
              }
            />
          )}
        </section>
      </div>

      {(selectedAuthority || selectedDelegation) && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/20">
          <div className="h-full w-full max-w-[620px] overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Governance Record
                </div>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                  {selectedAuthority?.name || selectedDelegation?.name}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedAuthority(null);
                  setSelectedDelegation(null);
                }}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {detailLoading ? (
              <div className="space-y-4 p-6">
                {[1, 2, 3, 4].map((item) => (
                  <div
                    key={item}
                    className="h-24 animate-pulse rounded-xl bg-slate-100"
                  />
                ))}
              </div>
            ) : selectedAuthority ? (
              <AuthorityDrawer
                authority={selectedAuthority}
                delegations={selectedAuthorityDelegations}
                users={users}
                history={authorityHistory}
                onEdit={() => openEditAuthority(selectedAuthority)}
                onDelete={() =>
                  setDeleteTarget({
                    type: "authority",
                    id: selectedAuthority.id,
                    name: selectedAuthority.name,
                  })
                }
                onNewDelegation={openCreateDelegation}
                onOpenDelegation={openDelegation}
              />
            ) : selectedDelegation ? (
              <DelegationDrawer
                delegation={selectedDelegation}
                authority={authorityForDelegation(selectedDelegation)}
                users={users}
                history={delegationHistory}
                onEdit={() => openEditDelegation(selectedDelegation)}
                onDelete={() =>
                  setDeleteTarget({
                    type: "delegation",
                    id: selectedDelegation.id,
                    name: selectedDelegation.name,
                  })
                }
              />
            ) : null}
          </div>
        </div>
      )}

      {authorityModal && (
        <Modal
          title={editingAuthority ? "Edit Approval Authority" : "New Approval Authority"}
          subtitle="Define the controlled approval authority and its governance lifecycle."
          onClose={() => setAuthorityModal(false)}
          wide
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Authority Code" required>
              <input
                value={authorityForm.authority_code}
                onChange={(event) =>
                  setAuthorityForm({
                    ...authorityForm,
                    authority_code: event.target.value,
                  })
                }
                className={inputClass()}
                placeholder="e.g. FIN-APP-001"
              />
            </Field>

            <Field label="Name" required>
              <input
                value={authorityForm.name}
                onChange={(event) =>
                  setAuthorityForm({
                    ...authorityForm,
                    name: event.target.value,
                  })
                }
                className={inputClass()}
                placeholder="Approval authority name"
              />
            </Field>

            <Field label="Authority Type" required>
              <input
                value={authorityForm.authority_type}
                onChange={(event) =>
                  setAuthorityForm({
                    ...authorityForm,
                    authority_type: event.target.value,
                  })
                }
                className={inputClass()}
                placeholder="e.g. Financial, Contractual, Operational"
              />
            </Field>

            <Field label="Approver">
              <select
                value={authorityForm.approver_id}
                onChange={(event) =>
                  setAuthorityForm({
                    ...authorityForm,
                    approver_id: event.target.value,
                  })
                }
                className={inputClass()}
              >
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {userName(user)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Approval Limit">
              <input
                type="number"
                min="0"
                step="0.01"
                value={authorityForm.approval_limit}
                onChange={(event) =>
                  setAuthorityForm({
                    ...authorityForm,
                    approval_limit: event.target.value,
                  })
                }
                className={inputClass()}
                placeholder="0.00"
              />
            </Field>

            <Field label="Currency">
              <input
                value={authorityForm.currency}
                onChange={(event) =>
                  setAuthorityForm({
                    ...authorityForm,
                    currency: event.target.value.toUpperCase(),
                  })
                }
                maxLength={10}
                className={inputClass()}
                placeholder="USD"
              />
            </Field>

            <Field label="Effective Date">
              <input
                type="date"
                value={authorityForm.effective_date}
                onChange={(event) =>
                  setAuthorityForm({
                    ...authorityForm,
                    effective_date: event.target.value,
                  })
                }
                className={inputClass()}
              />
            </Field>

            <Field label="Review Date">
              <input
                type="date"
                value={authorityForm.review_date}
                onChange={(event) =>
                  setAuthorityForm({
                    ...authorityForm,
                    review_date: event.target.value,
                  })
                }
                className={inputClass()}
              />
            </Field>

            <Field label="Status">
              <select
                value={authorityForm.status}
                onChange={(event) =>
                  setAuthorityForm({
                    ...authorityForm,
                    status: event.target.value,
                  })
                }
                className={inputClass()}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </Field>

            <div className="md:col-span-2">
              <Field label="Scope">
                <textarea
                  rows={4}
                  value={authorityForm.scope}
                  onChange={(event) =>
                    setAuthorityForm({
                      ...authorityForm,
                      scope: event.target.value,
                    })
                  }
                  className={inputClass()}
                  placeholder="Define the business, process, transaction or organizational scope covered by this authority."
                />
              </Field>
            </div>
          </div>

          <ModalFooter
            onCancel={() => setAuthorityModal(false)}
            onSave={saveAuthority}
            saving={saving}
            label={editingAuthority ? "Save Changes" : "Create Authority"}
          />
        </Modal>
      )}

      {delegationModal && (
        <Modal
          title={editingDelegation ? "Edit Delegation" : "New Delegation"}
          subtitle="Assign delegated authority for a defined scope and effective period."
          onClose={() => setDelegationModal(false)}
          wide
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Delegation Code" required>
              <input
                value={delegationForm.delegation_code}
                onChange={(event) =>
                  setDelegationForm({
                    ...delegationForm,
                    delegation_code: event.target.value,
                  })
                }
                className={inputClass()}
                placeholder="e.g. DEL-2026-001"
              />
            </Field>

            <Field label="Name" required>
              <input
                value={delegationForm.name}
                onChange={(event) =>
                  setDelegationForm({
                    ...delegationForm,
                    name: event.target.value,
                  })
                }
                className={inputClass()}
                placeholder="Delegation name"
              />
            </Field>

            <Field label="Approval Authority">
              <select
                value={delegationForm.authority_id}
                onChange={(event) =>
                  setDelegationForm({
                    ...delegationForm,
                    authority_id: event.target.value,
                  })
                }
                className={inputClass()}
              >
                <option value="">No linked authority</option>
                {authorities
                  .filter((authority) => !authority.is_deleted)
                  .map((authority) => (
                    <option key={authority.id} value={authority.id}>
                      {authority.authority_code} - {authority.name}
                    </option>
                  ))}
              </select>
            </Field>

            <Field label="Delegator">
              <select
                value={delegationForm.delegator_id}
                onChange={(event) =>
                  setDelegationForm({
                    ...delegationForm,
                    delegator_id: event.target.value,
                  })
                }
                className={inputClass()}
              >
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {userName(user)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Delegate">
              <select
                value={delegationForm.delegate_id}
                onChange={(event) =>
                  setDelegationForm({
                    ...delegationForm,
                    delegate_id: event.target.value,
                  })
                }
                className={inputClass()}
              >
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {userName(user)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Authority Limit">
              <input
                type="number"
                min="0"
                step="0.01"
                value={delegationForm.authority_limit}
                onChange={(event) =>
                  setDelegationForm({
                    ...delegationForm,
                    authority_limit: event.target.value,
                  })
                }
                className={inputClass()}
                placeholder="0.00"
              />
            </Field>

            <Field label="Currency">
              <input
                value={delegationForm.currency}
                onChange={(event) =>
                  setDelegationForm({
                    ...delegationForm,
                    currency: event.target.value.toUpperCase(),
                  })
                }
                maxLength={10}
                className={inputClass()}
                placeholder="USD"
              />
            </Field>

            <Field label="Start Date" required>
              <input
                type="date"
                value={delegationForm.start_date}
                onChange={(event) =>
                  setDelegationForm({
                    ...delegationForm,
                    start_date: event.target.value,
                  })
                }
                className={inputClass()}
              />
            </Field>

            <Field label="End Date" required>
              <input
                type="date"
                value={delegationForm.end_date}
                onChange={(event) =>
                  setDelegationForm({
                    ...delegationForm,
                    end_date: event.target.value,
                  })
                }
                className={inputClass()}
              />
            </Field>

            <Field label="Status">
              <select
                value={delegationForm.status}
                onChange={(event) =>
                  setDelegationForm({
                    ...delegationForm,
                    status: event.target.value,
                  })
                }
                className={inputClass()}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="REVOKED">Revoked</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </Field>

            <div className="md:col-span-2">
              <Field label="Scope">
                <textarea
                  rows={3}
                  value={delegationForm.scope}
                  onChange={(event) =>
                    setDelegationForm({
                      ...delegationForm,
                      scope: event.target.value,
                    })
                  }
                  className={inputClass()}
                  placeholder="Define the delegated authority scope."
                />
              </Field>
            </div>

            <div className="md:col-span-2">
              <Field label="Reason">
                <textarea
                  rows={3}
                  value={delegationForm.reason}
                  onChange={(event) =>
                    setDelegationForm({
                      ...delegationForm,
                      reason: event.target.value,
                    })
                  }
                  className={inputClass()}
                  placeholder="Business reason or governance rationale."
                />
              </Field>
            </div>
          </div>

          <ModalFooter
            onCancel={() => setDelegationModal(false)}
            onSave={saveDelegation}
            saving={saving}
            label={editingDelegation ? "Save Changes" : "Create Delegation"}
          />
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title={
            deleteTarget.type === "authority"
              ? "Deactivate Approval Authority"
              : "Revoke Delegation"
          }
          subtitle="This action changes the governance record state and preserves its history."
          onClose={() => setDeleteTarget(null)}
        >
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex gap-3">
              <AlertCircle size={19} className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-900">
                  {deleteTarget.name}
                </p>
                <p className="mt-1 text-xs leading-5 text-amber-700">
                  {deleteTarget.type === "authority"
                    ? "The authority will be soft-deleted and marked inactive."
                    : "The delegation will be soft-deleted and marked revoked."}
                </p>
              </div>
            </div>
          </div>

          <ModalFooter
            onCancel={() => setDeleteTarget(null)}
            onSave={deleteTargetConfirm}
            saving={saving}
            label={
              deleteTarget.type === "authority"
                ? "Deactivate Authority"
                : "Revoke Delegation"
            }
            destructive
          />
        </Modal>
      )}
    </main>
  );
}

function KpiCard({
  icon,
  label,
  value,
  helper,
  emphasis,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  helper: string;
  emphasis?: "warning" | "danger";
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
          {icon}
        </div>

        {emphasis === "warning" && (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
            Attention
          </span>
        )}

        {emphasis === "danger" && (
          <span className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-700">
            Review
          </span>
        )}
      </div>

      <div className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
        {value}
      </div>

      <div className="mt-1 text-sm font-medium text-slate-700">{label}</div>
      <div className="mt-1 text-xs text-slate-400">{helper}</div>
    </div>
  );
}

function AuthorityTable({
  items,
  users,
  onOpen,
  onEdit,
  onDelete,
}: {
  items: Authority[];
  users: User[];
  onOpen: (item: Authority) => void;
  onEdit: (item: Authority) => void;
  onDelete: (item: Authority) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead className="border-b border-slate-200 bg-slate-50/80">
          <tr className="text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            <th className="px-5 py-3">Authority</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Approver</th>
            <th className="px-4 py-3">Approval Limit</th>
            <th className="px-4 py-3">Lifecycle</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr
              key={item.id}
              className="group transition hover:bg-slate-50/70"
            >
              <td className="px-5 py-4">
                <button
                  type="button"
                  onClick={() => onOpen(item)}
                  className="text-left"
                >
                  <div className="font-mono text-[11px] font-semibold text-slate-500">
                    {item.authority_code}
                  </div>
                  <div className="mt-1 max-w-[290px] truncate text-sm font-semibold text-slate-800 group-hover:text-slate-950">
                    {item.name}
                  </div>
                  {item.scope && (
                    <div className="mt-1 max-w-[330px] truncate text-xs text-slate-400">
                      {item.scope}
                    </div>
                  )}
                </button>
              </td>

              <td className="px-4 py-4 text-sm text-slate-600">
                {item.authority_type}
              </td>

              <td className="px-4 py-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
                    {(userName(users.find((user) => user.id === item.approver_id))[0] || "?").toUpperCase()}
                  </div>
                  <span className="max-w-[160px] truncate text-sm text-slate-600">
                    {userName(users.find((user) => user.id === item.approver_id))}
                  </span>
                </div>
              </td>

              <td className="px-4 py-4">
                {item.approval_limit !== null &&
                item.approval_limit !== undefined ? (
                  <span className="font-mono text-sm font-medium text-slate-700">
                    {Number(item.approval_limit).toLocaleString("en-US")}
                    {item.currency ? ` ${item.currency}` : ""}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">No limit</span>
                )}
              </td>

              <td className="px-4 py-4">
                <div className="text-xs text-slate-500">
                  <div>{formatDate(item.effective_date)}</div>
                  <div className="mt-1 text-slate-400">
                    Review {formatDate(item.review_date)}
                  </div>
                </div>
              </td>

              <td className="px-4 py-4">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusClass(
                    item.status,
                  )}`}
                >
                  {statusLabel(item.status)}
                </span>
              </td>

              <td className="px-4 py-4">
                <div className="flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => onOpen(item)}
                    title="Open"
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <ArrowUpRight size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(item)}
                    title="Edit"
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <Edit3 size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(item)}
                    title="Deactivate"
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!items.length && (
        <EmptyState
          icon={<ShieldCheck size={22} />}
          title="No approval authorities found"
          description="Adjust the filters or create the first approval authority."
        />
      )}
    </div>
  );
}

function DelegationTable({
  items,
  authorities,
  users,
  onOpen,
  onEdit,
  onDelete,
}: {
  items: Delegation[];
  authorities: Authority[];
  users: User[];
  onOpen: (item: Delegation) => void;
  onEdit: (item: Delegation) => void;
  onDelete: (item: Delegation) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead className="border-b border-slate-200 bg-slate-50/80">
          <tr className="text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            <th className="px-5 py-3">Delegation</th>
            <th className="px-4 py-3">Authority</th>
            <th className="px-4 py-3">Delegator</th>
            <th className="px-4 py-3">Delegate</th>
            <th className="px-4 py-3">Limit</th>
            <th className="px-4 py-3">Period</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {items.map((item) => {
            const authority = authorities.find(
              (candidate) => candidate.id === item.authority_id,
            );

            return (
              <tr
                key={item.id}
                className="group transition hover:bg-slate-50/70"
              >
                <td className="px-5 py-4">
                  <button
                    type="button"
                    onClick={() => onOpen(item)}
                    className="text-left"
                  >
                    <div className="font-mono text-[11px] font-semibold text-slate-500">
                      {item.delegation_code}
                    </div>
                    <div className="mt-1 max-w-[250px] truncate text-sm font-semibold text-slate-800">
                      {item.name}
                    </div>
                  </button>
                </td>

                <td className="px-4 py-4">
                  {authority ? (
                    <button
                      type="button"
                      onClick={() => onOpen(item)}
                      className="text-left"
                    >
                      <div className="font-mono text-[10px] font-semibold text-slate-500">
                        {authority.authority_code}
                      </div>
                      <div className="mt-0.5 max-w-[180px] truncate text-xs text-slate-600">
                        {authority.name}
                      </div>
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">Unlinked</span>
                  )}
                </td>

                <td className="px-4 py-4 text-sm text-slate-600">
                  {userName(users.find((user) => user.id === item.delegator_id))}
                </td>

                <td className="px-4 py-4 text-sm font-medium text-slate-700">
                  {userName(users.find((user) => user.id === item.delegate_id))}
                </td>

                <td className="px-4 py-4">
                  {item.authority_limit !== null &&
                  item.authority_limit !== undefined ? (
                    <span className="font-mono text-sm text-slate-700">
                      {Number(item.authority_limit).toLocaleString("en-US")}
                      {item.currency ? ` ${item.currency}` : ""}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">No limit</span>
                  )}
                </td>

                <td className="px-4 py-4">
                  <div className="text-xs text-slate-500">
                    <div>{formatDate(item.start_date)}</div>
                    <div className="mt-1 text-slate-400">
                      Until {formatDate(item.end_date)}
                    </div>
                  </div>
                </td>

                <td className="px-4 py-4">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusClass(
                      item.status,
                    )}`}
                  >
                    {statusLabel(item.status)}
                  </span>
                </td>

                <td className="px-4 py-4">
                  <div className="flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => onOpen(item)}
                      title="Open"
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <ArrowUpRight size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      title="Edit"
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item)}
                      title="Revoke"
                      className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {!items.length && (
        <EmptyState
          icon={<UserCheck size={22} />}
          title="No delegations found"
          description="Adjust the filters or create the first delegation."
        />
      )}
    </div>
  );
}

function AuthorityDrawer({
  authority,
  delegations,
  users,
  history,
  onEdit,
  onDelete,
  onNewDelegation,
  onOpenDelegation,
}: {
  authority: Authority;
  delegations: Delegation[];
  users: User[];
  history: HistoryItem[];
  onEdit: () => void;
  onDelete: () => void;
  onNewDelegation: () => void;
  onOpenDelegation: (item: Delegation) => void;
}) {
  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-xs font-semibold text-slate-400">
            {authority.authority_code}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusClass(
                authority.status,
              )}`}
            >
              {statusLabel(authority.status)}
            </span>
            <span className="text-xs text-slate-400">
              {authority.authority_type}
            </span>
          </div>
        </div>

        <div className="flex gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
          >
            <Edit3 size={15} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <DetailSection title="Authority Profile">
        <div className="grid gap-4 sm:grid-cols-2">
          <DetailItem
            label="Approver"
            value={userName(users.find((user) => user.id === authority.approver_id))}
          />
          <DetailItem
            label="Approval Limit"
            value={
              authority.approval_limit !== null &&
              authority.approval_limit !== undefined
                ? `${Number(authority.approval_limit).toLocaleString("en-US")}${authority.currency ? ` ${authority.currency}` : ""}`
                : "No limit"
            }
          />
          <DetailItem
            label="Effective Date"
            value={formatDate(authority.effective_date)}
          />
          <DetailItem
            label="Review Date"
            value={formatDate(authority.review_date)}
          />
        </div>

        <div className="mt-4">
          <div className={labelClass()}>Scope</div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
            {authority.scope || "No scope defined."}
          </div>
        </div>
      </DetailSection>

      <DetailSection
        title="Delegated Authority"
        action={
          <button
            type="button"
            onClick={onNewDelegation}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Plus size={13} />
            Add Delegation
          </button>
        }
      >
        {delegations.length ? (
          <div className="space-y-2">
            {delegations.map((delegation) => (
              <button
                key={delegation.id}
                type="button"
                onClick={() => onOpenDelegation(delegation)}
                className="w-full rounded-lg border border-slate-200 p-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-[10px] font-semibold text-slate-400">
                      {delegation.delegation_code}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-700">
                      {delegation.name}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {userName(users.find((user) => user.id === delegation.delegate_id))}
                    </div>
                  </div>

                  <span
                    className={`rounded-full border px-2 py-1 text-[9px] font-semibold uppercase ${statusClass(
                      delegation.status,
                    )}`}
                  >
                    {statusLabel(delegation.status)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-xs text-slate-400">
            No delegations are linked to this authority.
          </div>
        )}
      </DetailSection>

      <HistoryList history={history} users={users} />
    </div>
  );
}

function DelegationDrawer({
  delegation,
  authority,
  users,
  history,
  onEdit,
  onDelete,
}: {
  delegation: Delegation;
  authority?: Authority;
  users: User[];
  history: HistoryItem[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-xs font-semibold text-slate-400">
            {delegation.delegation_code}
          </div>
          <div className="mt-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusClass(
                delegation.status,
              )}`}
            >
              {statusLabel(delegation.status)}
            </span>
          </div>
        </div>

        <div className="flex gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
          >
            <Edit3 size={15} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <DetailSection title="Delegation Profile">
        <div className="grid gap-4 sm:grid-cols-2">
          <DetailItem label="Authority" value={authority?.name || "Unlinked"} />
          <DetailItem
            label="Authority Code"
            value={authority?.authority_code || "Unlinked"}
          />
          <DetailItem
            label="Delegator"
            value={userName(users.find((user) => user.id === delegation.delegator_id))}
          />
          <DetailItem
            label="Delegate"
            value={userName(users.find((user) => user.id === delegation.delegate_id))}
          />
          <DetailItem
            label="Authority Limit"
            value={
              delegation.authority_limit !== null &&
              delegation.authority_limit !== undefined
                ? `${Number(delegation.authority_limit).toLocaleString("en-US")}${delegation.currency ? ` ${delegation.currency}` : ""}`
                : "No limit"
            }
          />
          <DetailItem
            label="Effective Period"
            value={`${formatDate(delegation.start_date)} - ${formatDate(
              delegation.end_date,
            )}`}
          />
        </div>

        <div className="mt-4">
          <div className={labelClass()}>Scope</div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
            {delegation.scope || "No scope defined."}
          </div>
        </div>

        <div className="mt-4">
          <div className={labelClass()}>Reason</div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
            {delegation.reason || "No reason recorded."}
          </div>
        </div>
      </DetailSection>

      <HistoryList history={history} users={users} />
    </div>
  );
}

function HistoryList({
  history,
  users,
}: {
  history: HistoryItem[];
  users: User[];
}) {
  return (
    <DetailSection title="Governance History">
      {history.length ? (
        <div className="relative ml-2 border-l border-slate-200 pl-5">
          {history.map((item) => (
            <div key={item.id} className="relative pb-5 last:pb-0">
              <div className="absolute -left-[25px] top-1 flex h-4 w-4 items-center justify-center rounded-full border border-slate-200 bg-white">
                <History size={9} className="text-slate-400" />
              </div>

              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-700">
                    {statusLabel(item.action)}
                  </div>

                  {item.field_name && (
                    <div className="mt-1 text-xs text-slate-500">
                      {item.field_name}
                    </div>
                  )}

                  {item.comment && (
                    <div className="mt-1 text-xs leading-5 text-slate-400">
                      {item.comment}
                    </div>
                  )}

                  {item.old_value !== null &&
                    item.old_value !== undefined &&
                    item.new_value !== null &&
                    item.new_value !== undefined && (
                      <div className="mt-2 rounded-md bg-slate-50 px-2.5 py-2 font-mono text-[10px] text-slate-500">
                        {item.old_value} → {item.new_value}
                      </div>
                    )}
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-[10px] text-slate-400">
                    {formatDateTime(item.created_at)}
                  </div>
                  <div className="mt-1 text-[10px] text-slate-300">
                    {userName(users.find((user) => user.id === item.performed_by))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-xs text-slate-400">
          No governance history recorded.
        </div>
      )}
    </DetailSection>
  );
}

function DetailSection({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="mt-7 first:mt-0">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className={labelClass()}>{label}</div>
      <div className="text-sm font-medium text-slate-700">{value}</div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClass()}>
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/30 p-5 backdrop-blur-[2px]">
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl ${
          wide ? "max-w-3xl" : "max-w-lg"
        }`}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-6">{children}</div>
      </div>
    </div>
  );
}

function ModalFooter({
  onCancel,
  onSave,
  saving,
  label,
  destructive,
}: {
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  label: string;
  destructive?: boolean;
}) {
  return (
    <div className="mt-7 flex justify-end gap-2 border-t border-slate-100 pt-5">
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        Cancel
      </button>

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className={`rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-sm disabled:opacity-50 ${
          destructive
            ? "bg-red-600 hover:bg-red-700"
            : "bg-slate-900 hover:bg-slate-800"
        }`}
      >
        {saving ? "Saving..." : label}
      </button>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400">
        {icon}
      </div>
      <div className="mt-4 text-sm font-semibold text-slate-700">{title}</div>
      <div className="mt-1 max-w-sm text-xs leading-5 text-slate-400">
        {description}
      </div>
    </div>
  );
}






