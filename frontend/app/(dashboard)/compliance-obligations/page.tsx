"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/api";

type Obligation = {
  id: number;
  tenant_id: number;
  code: string;
  title: string;
  description?: string | null;
  source_authority?: string | null;
  regulation_name?: string | null;
  jurisdiction?: string | null;
  reference_url?: string | null;
  effective_date?: string | null;
  expiry_date?: string | null;
  review_date?: string | null;
  status: string;
  criticality: string;
  owner_user_id?: number | null;
  applicability_status: string;
  applicability_reason?: string | null;
  created_at: string;
  updated_at: string;
};

type ObligationForm = {
  code: string;
  title: string;
  description: string;
  source_authority: string;
  regulation_name: string;
  jurisdiction: string;
  reference_url: string;
  effective_date: string;
  expiry_date: string;
  review_date: string;
  status: string;
  criticality: string;
  applicability_status: string;
  applicability_reason: string;
};

const EMPTY_FORM: ObligationForm = {
  code: "",
  title: "",
  description: "",
  source_authority: "",
  regulation_name: "",
  jurisdiction: "",
  reference_url: "",
  effective_date: "",
  expiry_date: "",
  review_date: "",
  status: "active",
  criticality: "medium",
  applicability_status: "under_review",
  applicability_reason: "",
};

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const CRITICALITY_OPTIONS = [
  { value: "all", label: "All criticality" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const APPLICABILITY_OPTIONS = [
  { value: "all", label: "All applicability" },
  { value: "applicable", label: "Applicable" },
  { value: "not_applicable", label: "Not applicable" },
  { value: "under_review", label: "Under review" },
];

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function normalize(value?: string | null) {
  return String(value || "").toLowerCase().replace(/[_-]/g, " ");
}

function criticalityClass(value: string) {
  switch (normalize(value)) {
    case "critical":
      return "bg-red-50 text-red-700 ring-red-200";
    case "high":
      return "bg-orange-50 text-orange-700 ring-orange-200";
    case "medium":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "low":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    default:
      return "bg-slate-50 text-slate-600 ring-slate-200";
  }
}

function applicabilityClass(value: string) {
  switch (normalize(value)) {
    case "applicable":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "not applicable":
      return "bg-slate-100 text-slate-600 ring-slate-200";
    case "under review":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    default:
      return "bg-slate-50 text-slate-600 ring-slate-200";
  }
}

function statusClass(value: string) {
  return normalize(value) === "active"
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : "bg-slate-100 text-slate-600 ring-slate-200";
}

function isReviewOverdue(obligation: Obligation) {
  if (!obligation.review_date) return false;
  if (normalize(obligation.status) !== "active") return false;

  const reviewDate = new Date(obligation.review_date);
  const today = new Date();

  reviewDate.setHours(23, 59, 59, 999);
  today.setHours(0, 0, 0, 0);

  return reviewDate < today;
}

function isReviewDueSoon(obligation: Obligation) {
  if (!obligation.review_date) return false;
  if (normalize(obligation.status) !== "active") return false;

  const reviewDate = new Date(obligation.review_date);
  const today = new Date();

  const diff = reviewDate.getTime() - today.getTime();
  const days = diff / (1000 * 60 * 60 * 24);

  return days >= 0 && days <= 30;
}

export default function ComplianceObligationsPage() {
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [criticalityFilter, setCriticalityFilter] = useState("all");
  const [applicabilityFilter, setApplicabilityFilter] = useState("all");

  const [selectedObligation, setSelectedObligation] =
    useState<Obligation | null>(null);

  const [editingObligation, setEditingObligation] =
    useState<Obligation | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showDeactivate, setShowDeactivate] = useState(false);

  const [form, setForm] = useState<ObligationForm>(EMPTY_FORM);

  const [reviewForm, setReviewForm] = useState({
    applicability_status: "applicable",
    applicability_reason: "",
    review_date: "",
  });

  async function loadObligations() {
    setLoading(true);
    setError("");

    try {
      const response = await apiFetch("/compliance-obligations/");

      if (!response.ok) {
        throw new Error(`Failed to load compliance obligations (${response.status})`);
      }

      const data = await response.json();
      setObligations(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load compliance obligations."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadObligations();
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => {
      setToast("");
    }, 3500);

    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredObligations = useMemo(() => {
    const query = search.trim().toLowerCase();

    return obligations.filter((obligation) => {
      const matchesSearch =
        !query ||
        [
          obligation.code,
          obligation.title,
          obligation.description,
          obligation.regulation_name,
          obligation.source_authority,
          obligation.jurisdiction,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));

      const matchesStatus =
        statusFilter === "all" ||
        normalize(obligation.status) === normalize(statusFilter);

      const matchesCriticality =
        criticalityFilter === "all" ||
        normalize(obligation.criticality) === normalize(criticalityFilter);

      const matchesApplicability =
        applicabilityFilter === "all" ||
        normalize(obligation.applicability_status) ===
          normalize(applicabilityFilter);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesCriticality &&
        matchesApplicability
      );
    });
  }, [
    obligations,
    search,
    statusFilter,
    criticalityFilter,
    applicabilityFilter,
  ]);

  const metrics = useMemo(() => {
    const active = obligations.filter(
      (item) => normalize(item.status) === "active"
    );

    const applicable = obligations.filter(
      (item) => normalize(item.applicability_status) === "applicable"
    );

    const underReview = obligations.filter(
      (item) => normalize(item.applicability_status) === "under review"
    );

    const notApplicable = obligations.filter(
      (item) => normalize(item.applicability_status) === "not applicable"
    );

    const critical = obligations.filter(
      (item) => normalize(item.criticality) === "critical"
    );

    const overdue = obligations.filter(isReviewOverdue);
    const dueSoon = obligations.filter(isReviewDueSoon);

    return {
      total: obligations.length,
      active: active.length,
      applicable: applicable.length,
      underReview: underReview.length,
      notApplicable: notApplicable.length,
      critical: critical.length,
      overdue: overdue.length,
      dueSoon: dueSoon.length,
    };
  }, [obligations]);

  function updateForm<K extends keyof ObligationForm>(
    field: K,
    value: ObligationForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openCreate() {
    setEditingObligation(null);
    setForm(EMPTY_FORM);
    setShowCreate(true);
  }

  function openEdit(obligation: Obligation) {
    setSelectedObligation(obligation);
    setEditingObligation(obligation);

    setForm({
      code: obligation.code || "",
      title: obligation.title || "",
      description: obligation.description || "",
      source_authority: obligation.source_authority || "",
      regulation_name: obligation.regulation_name || "",
      jurisdiction: obligation.jurisdiction || "",
      reference_url: obligation.reference_url || "",
      effective_date: obligation.effective_date || "",
      expiry_date: obligation.expiry_date || "",
      review_date: obligation.review_date || "",
      status: obligation.status || "active",
      criticality: obligation.criticality || "medium",
      applicability_status:
        obligation.applicability_status || "under_review",
      applicability_reason: obligation.applicability_reason || "",
    });

    setShowCreate(true);
  }

  function openReview(obligation: Obligation) {
    setSelectedObligation(obligation);

    setReviewForm({
      applicability_status:
        obligation.applicability_status || "under_review",
      applicability_reason: obligation.applicability_reason || "",
      review_date: obligation.review_date || "",
    });

    setShowReview(true);
  }

  function openDetail(obligation: Obligation) {
    setSelectedObligation(obligation);
    setShowDetail(true);
  }

  function closeModals() {
    if (saving || reviewing) return;

    setShowCreate(false);
    setShowReview(false);
    setShowDetail(false);
    setShowDeactivate(false);
    setSelectedObligation(null);
    setEditingObligation(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError("");

    try {
      const payload = {
        code: form.code.trim(),
        title: form.title.trim(),
        description: form.description.trim() || null,
        source_authority: form.source_authority.trim() || null,
        regulation_name: form.regulation_name.trim() || null,
        jurisdiction: form.jurisdiction.trim() || null,
        reference_url: form.reference_url.trim() || null,
        effective_date: form.effective_date || null,
        expiry_date: form.expiry_date || null,
        review_date: form.review_date || null,
        status: form.status,
        criticality: form.criticality,
        applicability_status: form.applicability_status,
        applicability_reason:
          form.applicability_reason.trim() || null,
      };

      const response = await apiFetch(
        editingObligation
          ? `/compliance-obligations/${editingObligation.id}`
          : "/compliance-obligations/",
        {
          method: editingObligation ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to ${editingObligation ? "update" : "create"} compliance obligation (${response.status})`
        );
      }

      setToast(
        editingObligation
          ? "Compliance obligation updated successfully."
          : "Compliance obligation created successfully."
      );

      closeModals();
      await loadObligations();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save compliance obligation."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedObligation) return;

    setReviewing(true);
    setError("");

    try {
      const response = await apiFetch(
        `/compliance-obligations/${selectedObligation.id}/review`,
        {
          method: "POST",
          body: JSON.stringify({
            applicability_status: reviewForm.applicability_status,
            applicability_reason:
              reviewForm.applicability_reason.trim() || null,
            review_date: reviewForm.review_date || null,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to complete applicability review (${response.status})`
        );
      }

      setToast("Applicability review completed successfully.");
      closeModals();
      await loadObligations();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to complete applicability review."
      );
    } finally {
      setReviewing(false);
    }
  }

  async function handleDeactivate() {
    if (!selectedObligation) return;

    setSaving(true);
    setError("");

    try {
      const response = await apiFetch(
        `/compliance-obligations/${selectedObligation.id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to deactivate compliance obligation (${response.status})`
        );
      }

      setToast("Compliance obligation deactivated successfully.");
      closeModals();
      await loadObligations();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to deactivate compliance obligation."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-[1600px] px-6 py-6">
        {/* HEADER */}
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              <span>Compliance</span>
              <span className="text-slate-300">/</span>
              <span>Regulatory Obligations</span>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Compliance Obligations
            </h1>

            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Central registry for legal, regulatory, contractual and other
              external compliance obligations applicable to the organization.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <span className="mr-2 text-base">+</span>
            Add Obligation
          </button>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <div className="flex items-start justify-between gap-4">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError("")}
                className="font-semibold text-red-700 hover:text-red-900"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* KPI GRID */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
          <MetricCard label="Total" value={metrics.total} />
          <MetricCard
            label="Active"
            value={metrics.active}
            valueClass="text-emerald-700"
          />
          <MetricCard
            label="Applicable"
            value={metrics.applicable}
            valueClass="text-blue-700"
          />
          <MetricCard
            label="Under Review"
            value={metrics.underReview}
            valueClass="text-amber-700"
          />
          <MetricCard
            label="Not Applicable"
            value={metrics.notApplicable}
            valueClass="text-slate-600"
          />
          <MetricCard
            label="Critical"
            value={metrics.critical}
            valueClass="text-red-700"
          />
          <MetricCard
            label="Review Due"
            value={metrics.dueSoon}
            valueClass="text-orange-700"
          />
          <MetricCard
            label="Overdue"
            value={metrics.overdue}
            valueClass="text-red-700"
          />
        </div>

        {/* REGISTRY */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Obligation Registry
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {filteredObligations.length} of {obligations.length}{" "}
                  obligations shown
                </p>
              </div>

              <div className="flex flex-col gap-2 md:flex-row">
                <div className="relative">
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search obligations..."
                    className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white md:w-64"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    ⌕
                  </span>
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <select
                  value={criticalityFilter}
                  onChange={(event) =>
                    setCriticalityFilter(event.target.value)
                  }
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400"
                >
                  {CRITICALITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <select
                  value={applicabilityFilter}
                  onChange={(event) =>
                    setApplicabilityFilter(event.target.value)
                  }
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400"
                >
                  {APPLICABILITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="px-5 py-16 text-center">
              <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
              <p className="text-sm text-slate-500">
                Loading compliance obligations...
              </p>
            </div>
          ) : filteredObligations.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-xl text-slate-400">
                §
              </div>

              <h3 className="text-sm font-semibold text-slate-900">
                {obligations.length === 0
                  ? "No compliance obligations"
                  : "No matching obligations"}
              </h3>

              <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                {obligations.length === 0
                  ? "Create the first compliance obligation to establish the organization's regulatory obligation register."
                  : "Try changing the search criteria or filters."}
              </p>

              {obligations.length === 0 && (
                <button
                  type="button"
                  onClick={openCreate}
                  className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Add First Obligation
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1250px] w-full text-left">
                <thead className="border-b border-slate-200 bg-slate-50/80">
                  <tr>
                    <TableHeader>Obligation</TableHeader>
                    <TableHeader>Regulation / Authority</TableHeader>
                    <TableHeader>Jurisdiction</TableHeader>
                    <TableHeader>Criticality</TableHeader>
                    <TableHeader>Applicability</TableHeader>
                    <TableHeader>Review</TableHeader>
                    <TableHeader>Status</TableHeader>
                    <TableHeader align="right">Actions</TableHeader>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredObligations.map((obligation) => {
                    const overdue = isReviewOverdue(obligation);
                    const dueSoon = isReviewDueSoon(obligation);

                    return (
                      <tr
                        key={obligation.id}
                        className="group transition hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4 align-top">
                          <button
                            type="button"
                            onClick={() => openDetail(obligation)}
                            className="text-left"
                          >
                            <div className="font-mono text-xs font-semibold text-slate-500">
                              {obligation.code}
                            </div>
                            <div className="mt-1 max-w-[280px] text-sm font-semibold text-slate-900 group-hover:text-blue-700">
                              {obligation.title}
                            </div>

                            {obligation.description && (
                              <div className="mt-1 line-clamp-2 max-w-[300px] text-xs leading-5 text-slate-500">
                                {obligation.description}
                              </div>
                            )}
                          </button>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="max-w-[240px]">
                            <div className="text-sm font-medium text-slate-800">
                              {obligation.regulation_name || "—"}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {obligation.source_authority || "No authority specified"}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <span className="text-sm text-slate-700">
                            {obligation.jurisdiction || "—"}
                          </span>
                        </td>

                        <td className="px-5 py-4 align-top">
                          <Badge
                            label={obligation.criticality}
                            className={criticalityClass(
                              obligation.criticality
                            )}
                          />
                        </td>

                        <td className="px-5 py-4 align-top">
                          <Badge
                            label={obligation.applicability_status}
                            className={applicabilityClass(
                              obligation.applicability_status
                            )}
                          />
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div
                            className={
                              overdue
                                ? "font-semibold text-red-700"
                                : dueSoon
                                  ? "font-semibold text-orange-700"
                                  : "text-slate-700"
                            }
                          >
                            {formatDate(obligation.review_date)}
                          </div>

                          {overdue && (
                            <div className="mt-1 text-[11px] font-medium text-red-600">
                              Overdue
                            </div>
                          )}

                          {!overdue && dueSoon && (
                            <div className="mt-1 text-[11px] font-medium text-orange-600">
                              Due within 30 days
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4 align-top">
                          <Badge
                            label={obligation.status}
                            className={statusClass(obligation.status)}
                          />
                        </td>

                        <td className="px-5 py-4 align-top">
                          <div className="flex justify-end gap-1 opacity-80 transition group-hover:opacity-100">
                            <ActionButton
                              label="View"
                              onClick={() => openDetail(obligation)}
                            />
                            <ActionButton
                              label="Edit"
                              onClick={() => openEdit(obligation)}
                            />
                            <ActionButton
                              label="Review"
                              onClick={() => openReview(obligation)}
                            />

                            {normalize(obligation.status) === "active" && (
                              <ActionButton
                                label="Deactivate"
                                danger
                                onClick={() => {
                                  setSelectedObligation(obligation);
                                  setShowDeactivate(true);
                                }}
                              />
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
        </section>
      </div>

      {/* CREATE / EDIT MODAL */}
      {showCreate && (
        <Modal
          title={
            editingObligation
              ? "Edit Compliance Obligation"
              : "Add Compliance Obligation"
          }
          subtitle={
            editingObligation
              ? "Update the obligation record and its regulatory metadata."
              : "Register a new legal, regulatory or external compliance obligation."
          }
          onClose={closeModals}
          wide
        >
          <form onSubmit={handleSubmit}>
            <div className="grid gap-5 md:grid-cols-2">
              <Field
                label="Obligation Code"
                required
                value={form.code}
                onChange={(value) => updateForm("code", value)}
                placeholder="e.g. GDPR-001"
              />

              <Field
                label="Title"
                required
                value={form.title}
                onChange={(value) => updateForm("title", value)}
                placeholder="Personal Data Protection Obligation"
              />

              <Field
                label="Regulation / Legal Instrument"
                value={form.regulation_name}
                onChange={(value) => updateForm("regulation_name", value)}
                placeholder="General Data Protection Regulation"
              />

              <Field
                label="Source Authority"
                value={form.source_authority}
                onChange={(value) => updateForm("source_authority", value)}
                placeholder="Data Protection Authority"
              />

              <Field
                label="Jurisdiction"
                value={form.jurisdiction}
                onChange={(value) => updateForm("jurisdiction", value)}
                placeholder="European Union"
              />

              <Field
                label="Reference URL"
                value={form.reference_url}
                onChange={(value) => updateForm("reference_url", value)}
                placeholder="https://..."
              />

              <SelectField
                label="Status"
                value={form.status}
                onChange={(value) => updateForm("status", value)}
                options={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
              />

              <SelectField
                label="Criticality"
                value={form.criticality}
                onChange={(value) => updateForm("criticality", value)}
                options={[
                  { value: "critical", label: "Critical" },
                  { value: "high", label: "High" },
                  { value: "medium", label: "Medium" },
                  { value: "low", label: "Low" },
                ]}
              />

              <SelectField
                label="Applicability"
                value={form.applicability_status}
                onChange={(value) =>
                  updateForm("applicability_status", value)
                }
                options={[
                  { value: "applicable", label: "Applicable" },
                  { value: "not_applicable", label: "Not applicable" },
                  { value: "under_review", label: "Under review" },
                ]}
              />

              <DateField
                label="Effective Date"
                value={form.effective_date}
                onChange={(value) => updateForm("effective_date", value)}
              />

              <DateField
                label="Expiry Date"
                value={form.expiry_date}
                onChange={(value) => updateForm("expiry_date", value)}
              />

              <DateField
                label="Review Date"
                value={form.review_date}
                onChange={(value) => updateForm("review_date", value)}
              />
            </div>

            <TextAreaField
              label="Description"
              value={form.description}
              onChange={(value) => updateForm("description", value)}
              placeholder="Describe the obligation, its scope and relevant compliance expectations."
            />

            <TextAreaField
              label="Applicability Reason"
              value={form.applicability_reason}
              onChange={(value) =>
                updateForm("applicability_reason", value)
              }
              placeholder="Explain why this obligation applies or does not apply to the organization."
            />

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={closeModals}
                disabled={saving}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : editingObligation
                    ? "Save Changes"
                    : "Create Obligation"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* REVIEW MODAL */}
      {showReview && selectedObligation && (
        <Modal
          title="Applicability Review"
          subtitle={`Review the applicability determination for ${selectedObligation.code}.`}
          onClose={closeModals}
        >
          <form onSubmit={handleReview}>
            <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="font-mono text-xs font-semibold text-slate-500">
                {selectedObligation.code}
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {selectedObligation.title}
              </div>
            </div>

            <SelectField
              label="Applicability Status"
              value={reviewForm.applicability_status}
              onChange={(value) =>
                setReviewForm((current) => ({
                  ...current,
                  applicability_status: value,
                }))
              }
              options={[
                { value: "applicable", label: "Applicable" },
                { value: "not_applicable", label: "Not applicable" },
                { value: "under_review", label: "Under review" },
              ]}
            />

            <DateField
              label="Review Date"
              value={reviewForm.review_date}
              onChange={(value) =>
                setReviewForm((current) => ({
                  ...current,
                  review_date: value,
                }))
              }
            />

            <TextAreaField
              label="Review Rationale"
              value={reviewForm.applicability_reason}
              onChange={(value) =>
                setReviewForm((current) => ({
                  ...current,
                  applicability_reason: value,
                }))
              }
              placeholder="Document the rationale supporting the applicability decision."
            />

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={closeModals}
                disabled={reviewing}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={reviewing}
                className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {reviewing ? "Saving Review..." : "Complete Review"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* DETAIL MODAL */}
      {showDetail && selectedObligation && (
        <Modal
          title={selectedObligation.title}
          subtitle={`${selectedObligation.code} · Compliance Obligation`}
          onClose={closeModals}
          wide
        >
          <div className="grid gap-5 md:grid-cols-2">
            <DetailItem
              label="Obligation Code"
              value={selectedObligation.code}
            />
            <DetailItem
              label="Status"
              value={selectedObligation.status}
            />
            <DetailItem
              label="Criticality"
              value={selectedObligation.criticality}
            />
            <DetailItem
              label="Applicability"
              value={selectedObligation.applicability_status}
            />
            <DetailItem
              label="Regulation / Legal Instrument"
              value={selectedObligation.regulation_name}
            />
            <DetailItem
              label="Source Authority"
              value={selectedObligation.source_authority}
            />
            <DetailItem
              label="Jurisdiction"
              value={selectedObligation.jurisdiction}
            />
            <DetailItem
              label="Owner"
              value={
                selectedObligation.owner_user_id
                  ? `User #${selectedObligation.owner_user_id}`
                  : "Unassigned"
              }
            />
            <DetailItem
              label="Effective Date"
              value={formatDate(selectedObligation.effective_date)}
            />
            <DetailItem
              label="Expiry Date"
              value={formatDate(selectedObligation.expiry_date)}
            />
            <DetailItem
              label="Review Date"
              value={formatDate(selectedObligation.review_date)}
            />
            <DetailItem
              label="Last Updated"
              value={formatDate(selectedObligation.updated_at)}
            />
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Description
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {selectedObligation.description || "No description provided."}
            </p>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Applicability Rationale
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {selectedObligation.applicability_reason ||
                "No applicability rationale has been documented."}
            </p>
          </div>

          {selectedObligation.reference_url && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Reference
              </div>

              <a
                href={selectedObligation.reference_url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block break-all text-sm font-medium text-blue-700 hover:underline"
              >
                {selectedObligation.reference_url}
              </a>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowDetail(false);
                openReview(selectedObligation);
              }}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Review Applicability
            </button>

            <button
              type="button"
              onClick={() => {
                setShowDetail(false);
                openEdit(selectedObligation);
              }}
              className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Edit Obligation
            </button>
          </div>
        </Modal>
      )}

      {/* DEACTIVATE MODAL */}
      {showDeactivate && selectedObligation && (
        <Modal
          title="Deactivate Obligation"
          subtitle="This action changes the lifecycle status to inactive. The record will not be deleted."
          onClose={closeModals}
        >
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="font-mono text-xs font-semibold text-amber-700">
              {selectedObligation.code}
            </div>

            <div className="mt-1 text-sm font-semibold text-slate-900">
              {selectedObligation.title}
            </div>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Deactivation preserves the obligation record for auditability
              while removing it from the active compliance lifecycle.
            </p>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeModals}
              disabled={saving}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleDeactivate}
              disabled={saving}
              className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {saving ? "Deactivating..." : "Deactivate Obligation"}
            </button>
          </div>
        </Modal>
      )}

      {/* TOAST */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[100] max-w-sm rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-xl">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
              ✓
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-900">
                Action completed
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                {toast}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  valueClass = "text-slate-900",
}: {
  label: string;
  value: number;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </div>
      <div className={`mt-2 text-2xl font-semibold ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

function TableHeader({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Badge({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  const displayLabel = label
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold capitalize ring-1 ring-inset ${className}`}
    >
      {displayLabel}
    </span>
  );
}

function ActionButton({
  label,
  onClick,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
        danger
          ? "border-red-200 bg-white text-red-600 hover:bg-red-50"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {label}
    </button>
  );
}

function Field({
  label,
  required,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>

      <input
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      />
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">
        {label}
      </span>

      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="mb-5 block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="mt-5 block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">
        {label}
      </span>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      />
    </label>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>

      <div className="mt-1 text-sm font-medium text-slate-800">
        {value || "—"}
      </div>
    </div>
  );
}

function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]">
      <div
        className={`max-h-[92vh] w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ${
          wide ? "max-w-5xl" : "max-w-2xl"
        }`}
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {title}
            </h2>

            {subtitle && (
              <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
                {subtitle}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="ml-4 flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ×
          </button>
        </div>

        <div className="max-h-[calc(92vh-100px)] overflow-y-auto px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}
