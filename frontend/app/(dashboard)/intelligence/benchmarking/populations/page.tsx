"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Shield,
  Trash2,
  Users,
  X,
} from "lucide-react";

import { apiFetch } from "@/app/lib/api";

type PopulationStatus =
  | "DRAFT"
  | "CONFIGURING"
  | "ACTIVE"
  | "SUSPENDED"
  | "RETIRED";

type MembershipType = "MANUAL" | "RULE_BASED" | "SYSTEM";
type EligibilityStatus = "ELIGIBLE" | "INELIGIBLE" | "PENDING";

type Population = {
  id: number;
  name: string;
  description: string | null;
  industry: string | null;
  geography: string | null;
  company_size_band: string | null;
  revenue_band: string | null;
  standard_id: number | null;
  minimum_sample_size: number;
  status: PopulationStatus;
  created_by: number | null;
  approved_by: number | null;
  created_at: string;
  updated_at: string;
};

type TenantCandidate = {
  id: number;
  code: string;
  name: string;
  status: string;
};

type Standard = {
  id: number;
  code: string;
  title: string;
  description?: string | null;
  type?: string | null;
  version?: string | null;
  status?: string | null;
};

type Member = {
  id: number;
  population_id: number;
  tenant_id: number;
  membership_type: MembershipType;
  eligibility_status: EligibilityStatus;
  effective_from: string | null;
  effective_to: string | null;
  created_at: string;
  updated_at: string;
};

type PopulationForm = {
  name: string;
  description: string;
  industry: string;
  geography: string;
  company_size_band: string;
  revenue_band: string;
  standard_id: string;
  minimum_sample_size: string;
  status: PopulationStatus;
};

const emptyForm: PopulationForm = {
  name: "",
  description: "",
  industry: "",
  geography: "",
  company_size_band: "",
  revenue_band: "",
  standard_id: "",
  minimum_sample_size: "5",
  status: "DRAFT",
};

const statusOptions: PopulationStatus[] = [
  "DRAFT",
  "CONFIGURING",
  "ACTIVE",
  "SUSPENDED",
  "RETIRED",
];

const membershipOptions: MembershipType[] = [
  "MANUAL",
  "RULE_BASED",
  "SYSTEM",
];

const eligibilityOptions: EligibilityStatus[] = [
  "ELIGIBLE",
  "INELIGIBLE",
  "PENDING",
];

function formatDate(value: string | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function statusClass(status: string) {
  if (status === "ACTIVE" || status === "ELIGIBLE") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (status === "SUSPENDED" || status === "INELIGIBLE") {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  if (status === "RETIRED") {
    return "bg-slate-100 text-slate-600 border-slate-200";
  }

  return "bg-blue-50 text-blue-700 border-blue-200";
}

export default function PeerPopulationsPage() {
  const [populations, setPopulations] = useState<Population[]>([]);
  const [tenants, setTenants] = useState<TenantCandidate[]>([]);
  const [standards, setStandards] = useState<Standard[]>([]);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  const [form, setForm] = useState<PopulationForm>(emptyForm);

  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addingMember, setAddingMember] = useState(false);

  const [editing, setEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);

  const [newTenantId, setNewTenantId] = useState("");
  const [newMembershipType, setNewMembershipType] =
    useState<MembershipType>("MANUAL");
  const [newEligibility, setNewEligibility] =
    useState<EligibilityStatus>("PENDING");
  const [newEffectiveFrom, setNewEffectiveFrom] = useState("");
  const [newEffectiveTo, setNewEffectiveTo] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedPopulation = useMemo(
    () =>
      populations.find((population) => population.id === selectedId) ?? null,
    [populations, selectedId]
  );

  const tenantMap = useMemo(
    () => new Map(tenants.map((tenant) => [tenant.id, tenant])),
    [tenants]
  );

  const standardMap = useMemo(
    () => new Map(standards.map((standard) => [standard.id, standard])),
    [standards]
  );

  const availableTenants = useMemo(() => {
    const memberIds = new Set(members.map((member) => member.tenant_id));

    return tenants.filter((tenant) => !memberIds.has(tenant.id));
  }, [members, tenants]);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const loadReferenceData = useCallback(async () => {
    const [tenantRes, standardRes] = await Promise.all([
      apiFetch("/admin/tenants"),
      apiFetch("/standards/"),
    ]);

    if (!tenantRes.ok) {
      throw new Error("Unable to load tenants");
    }

    if (!standardRes.ok) {
      throw new Error("Unable to load standards");
    }

    const tenantJson = await tenantRes.json();
    const standardJson = await standardRes.json();

    const tenantRows = Array.isArray(tenantJson)
      ? tenantJson.filter((tenant: TenantCandidate) => {
          const status = String(tenant.status ?? "").toLowerCase();
          return status === "active";
        })
      : [];

    setTenants(tenantRows);
    setStandards(Array.isArray(standardJson) ? standardJson : []);
  }, []);

  const loadPopulations = useCallback(async () => {
    const response = await apiFetch("/benchmarking/populations");

    if (!response.ok) {
      throw new Error("Unable to load peer populations");
    }

    const json = await response.json();
    const rows = Array.isArray(json) ? json : [];

    setPopulations(rows);

    if (selectedId !== null && !rows.some((item: Population) => item.id === selectedId)) {
      setSelectedId(null);
      setMembers([]);
    }
  }, [selectedId]);

  const loadMembers = useCallback(async (populationId: number) => {
    setLoadingMembers(true);

    try {
      const response = await apiFetch(
        `/benchmarking/populations/${populationId}/members`
      );

      if (!response.ok) {
        throw new Error("Unable to load population members");
      }

      const json = await response.json();
      setMembers(Array.isArray(json) ? json : []);
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    clearMessages();

    try {
      await Promise.all([loadReferenceData(), loadPopulations()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load data");
    } finally {
      setLoading(false);
    }
  }, [loadPopulations, loadReferenceData]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (selectedId === null) {
      setMembers([]);
      return;
    }

    loadMembers(selectedId).catch((err) => {
      setError(err instanceof Error ? err.message : "Unable to load members");
    });
  }, [loadMembers, selectedId]);

  const selectPopulation = (population: Population) => {
    clearMessages();
    setSelectedId(population.id);
    setEditing(false);
    setShowForm(false);

    setForm({
      name: population.name,
      description: population.description ?? "",
      industry: population.industry ?? "",
      geography: population.geography ?? "",
      company_size_band: population.company_size_band ?? "",
      revenue_band: population.revenue_band ?? "",
      standard_id:
        population.standard_id !== null
          ? String(population.standard_id)
          : "",
      minimum_sample_size: String(population.minimum_sample_size),
      status: population.status,
    });
  };

  const startCreate = () => {
    clearMessages();
    setSelectedId(null);
    setMembers([]);
    setForm(emptyForm);
    setEditing(false);
    setShowForm(true);
    setShowAddMember(false);
  };

  const startEdit = () => {
    if (!selectedPopulation) return;

    clearMessages();
    setForm({
      name: selectedPopulation.name,
      description: selectedPopulation.description ?? "",
      industry: selectedPopulation.industry ?? "",
      geography: selectedPopulation.geography ?? "",
      company_size_band: selectedPopulation.company_size_band ?? "",
      revenue_band: selectedPopulation.revenue_band ?? "",
      standard_id:
        selectedPopulation.standard_id !== null
          ? String(selectedPopulation.standard_id)
          : "",
      minimum_sample_size: String(selectedPopulation.minimum_sample_size),
      status: selectedPopulation.status,
    });
    setEditing(true);
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditing(false);
  };

  const savePopulation = async (event: FormEvent) => {
    event.preventDefault();

    clearMessages();

    if (!form.name.trim()) {
      setError("Population name is required");
      return;
    }

    const sampleSize = Number(form.minimum_sample_size);

    if (!Number.isInteger(sampleSize) || sampleSize < 1) {
      setError("Minimum sample size must be a positive integer");
      return;
    }

    setSaving(true);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      industry: form.industry.trim() || null,
      geography: form.geography.trim() || null,
      company_size_band: form.company_size_band.trim() || null,
      revenue_band: form.revenue_band.trim() || null,
      standard_id: form.standard_id ? Number(form.standard_id) : null,
      minimum_sample_size: sampleSize,
      status: form.status,
    };

    try {
      const response = editing && selectedId !== null
        ? await apiFetch(`/benchmarking/populations/${selectedId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await apiFetch("/benchmarking/populations", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Unable to save population");
      }

      const saved: Population = await response.json();

      await loadPopulations();

      setSelectedId(saved.id);
      setForm({
        name: saved.name,
        description: saved.description ?? "",
        industry: saved.industry ?? "",
        geography: saved.geography ?? "",
        company_size_band: saved.company_size_band ?? "",
        revenue_band: saved.revenue_band ?? "",
        standard_id:
          saved.standard_id !== null ? String(saved.standard_id) : "",
        minimum_sample_size: String(saved.minimum_sample_size),
        status: saved.status,
      });

      setShowForm(false);
      setEditing(false);
      setSuccess(editing ? "Population updated" : "Population created");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save population");
    } finally {
      setSaving(false);
    }
  };

  const deletePopulation = async () => {
    if (!selectedPopulation) return;

    const confirmed = window.confirm(
      `Delete population "${selectedPopulation.name}"?`
    );

    if (!confirmed) return;

    clearMessages();
    setDeleting(true);

    try {
      const response = await apiFetch(
        `/benchmarking/populations/${selectedPopulation.id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Unable to delete population");
      }

      setSelectedId(null);
      setMembers([]);
      setShowForm(false);
      setEditing(false);

      await loadPopulations();

      setSuccess("Population deleted");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete population"
      );
    } finally {
      setDeleting(false);
    }
  };

  const addMember = async (event: FormEvent) => {
    event.preventDefault();

    if (selectedId === null || !newTenantId) {
      setError("Select a tenant");
      return;
    }

    clearMessages();
    setAddingMember(true);

    const payload = {
      tenant_id: Number(newTenantId),
      membership_type: newMembershipType,
      eligibility_status: newEligibility,
      effective_from: newEffectiveFrom
        ? new Date(newEffectiveFrom).toISOString()
        : null,
      effective_to: newEffectiveTo
        ? new Date(newEffectiveTo).toISOString()
        : null,
    };

    try {
      const response = await apiFetch(
        `/benchmarking/populations/${selectedId}/members`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Unable to add member");
      }

      await loadMembers(selectedId);

      setNewTenantId("");
      setNewMembershipType("MANUAL");
      setNewEligibility("PENDING");
      setNewEffectiveFrom("");
      setNewEffectiveTo("");
      setShowAddMember(false);
      setSuccess("Tenant added to population");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add member");
    } finally {
      setAddingMember(false);
    }
  };

  const updateMember = async (
    member: Member,
    field: "membership_type" | "eligibility_status",
    value: string
  ) => {
    if (selectedId === null) return;

    clearMessages();

    try {
      const response = await apiFetch(
        `/benchmarking/populations/${selectedId}/members/${member.tenant_id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            [field]: value,
          }),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Unable to update member");
      }

      await loadMembers(selectedId);
      setSuccess("Member updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update member");
    }
  };

  const removeMember = async (member: Member) => {
    if (selectedId === null) return;

    const tenant = tenantMap.get(member.tenant_id);
    const tenantName = tenant?.name ?? `Tenant ${member.tenant_id}`;

    const confirmed = window.confirm(
      `Remove "${tenantName}" from this population?`
    );

    if (!confirmed) return;

    clearMessages();

    try {
      const response = await apiFetch(
        `/benchmarking/populations/${selectedId}/members/${member.tenant_id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Unable to remove member");
      }

      await loadMembers(selectedId);
      setSuccess("Tenant removed from population");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to remove member"
      );
    }
  };

  const selectedStandard = selectedPopulation?.standard_id
    ? standardMap.get(selectedPopulation.standard_id)
    : null;

  return (
    <div className="min-h-full min-w-0 overflow-x-hidden bg-[#f6f8fc] text-[#102a43]">
      <div className="mx-auto w-full min-w-0 max-w-[1600px] space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              <Shield size={15} />
              Benchmarking Administration
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#102a43]">
              Peer Populations
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Configure the peer groups used by benchmarking calculations and
              manage their tenant membership.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadAll}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>

            <button
              type="button"
              onClick={startCreate}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#102a43] px-4 text-sm font-semibold text-white transition hover:bg-[#163b5c]"
            >
              <Plus size={15} />
              Create Population
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle size={17} className="mt-0.5 shrink-0" />
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
            <span>{success}</span>
            <button
              type="button"
              onClick={() => setSuccess(null)}
              className="ml-auto text-emerald-500 hover:text-emerald-700"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {showForm && (
          <form
            onSubmit={savePopulation}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#102a43]">
                  {editing ? "Edit Population" : "Create Population"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Define the population eligibility dimensions and benchmark
                  threshold.
                </p>
              </div>

              <button
                type="button"
                onClick={cancelForm}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Population Name" required>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  className="input"
                  placeholder="Enter population name"
                />
              </Field>

              <Field label="Standard">
                <select
                  value={form.standard_id}
                  onChange={(event) =>
                    setForm({ ...form, standard_id: event.target.value })
                  }
                  className="input"
                >
                  <option value="">No standard filter</option>
                  {standards.map((standard) => (
                    <option key={standard.id} value={standard.id}>
                      {standard.code} - {standard.title}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Minimum Sample Size" required>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={form.minimum_sample_size}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      minimum_sample_size: event.target.value,
                    })
                  }
                  className="input"
                />
              </Field>

              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      status: event.target.value as PopulationStatus,
                    })
                  }
                  className="input"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Industry">
                <input
                  value={form.industry}
                  onChange={(event) =>
                    setForm({ ...form, industry: event.target.value })
                  }
                  className="input"
                  placeholder="Industry filter"
                />
              </Field>

              <Field label="Company Size Band">
                <input
                  value={form.company_size_band}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      company_size_band: event.target.value,
                    })
                  }
                  className="input"
                  placeholder="Company size filter"
                />
              </Field>

              <Field label="Geography">
                <input
                  value={form.geography}
                  onChange={(event) =>
                    setForm({ ...form, geography: event.target.value })
                  }
                  className="input"
                  placeholder="Geography filter"
                />
              </Field>

              <Field label="Revenue Band">
                <input
                  value={form.revenue_band}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      revenue_band: event.target.value,
                    })
                  }
                  className="input"
                  placeholder="Revenue filter"
                />
              </Field>

              <div className="md:col-span-2 xl:col-span-4">
                <Field label="Description">
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(event) =>
                      setForm({ ...form, description: event.target.value })
                    }
                    className="input resize-none"
                    placeholder="Describe the purpose and eligibility logic of this population"
                  />
                </Field>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={cancelForm}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#102a43] px-4 text-sm font-semibold text-white hover:bg-[#163b5c] disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Save size={15} />
                )}
                {editing ? "Save Changes" : "Create Population"}
              </button>
            </div>
          </form>
        )}

        <div className="grid min-h-[650px] min-w-0 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-semibold text-[#102a43]">Populations</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {populations.length} configured population
                  {populations.length === 1 ? "" : "s"}
                </p>
              </div>

              <Users size={18} className="text-slate-400" />
            </div>

            <div className="max-h-[700px] overflow-auto p-3">
              {loading && (
                <div className="flex items-center justify-center py-16 text-sm text-slate-500">
                  <Loader2 size={18} className="mr-2 animate-spin" />
                  Loading populations...
                </div>
              )}

              {!loading && populations.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 px-5 py-12 text-center">
                  <Users
                    size={28}
                    className="mx-auto mb-3 text-slate-300"
                  />
                  <p className="text-sm font-medium text-slate-700">
                    No peer populations
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Create the first population to configure peer
                    benchmarking.
                  </p>
                  <button
                    type="button"
                    onClick={startCreate}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#102a43] px-3 py-2 text-xs font-semibold text-white"
                  >
                    <Plus size={14} />
                    Create Population
                  </button>
                </div>
              )}

              {!loading &&
                populations.map((population) => {
                  const isSelected = selectedId === population.id;
                  const standard = population.standard_id
                    ? standardMap.get(population.standard_id)
                    : null;

                  return (
                    <button
                      key={population.id}
                      type="button"
                      onClick={() => selectPopulation(population)}
                      className={`mb-2 w-full rounded-xl border p-4 text-left transition ${
                        isSelected
                          ? "border-[#9bb4c9] bg-[#f4f8fb]"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 text-slate-400">
                          {isSelected ? (
                            <ChevronDown size={16} />
                          ) : (
                            <ChevronRight size={16} />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-[#102a43]">
                            {population.name}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass(
                                population.status
                              )}`}
                            >
                              {population.status}
                            </span>

                            {standard && (
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                {standard.code}
                              </span>
                            )}
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                            <span>
                              Sample:{" "}
                              <strong className="text-slate-700">
                                {population.minimum_sample_size}
                              </strong>
                            </span>
                            <span>
                              Updated:{" "}
                              <strong className="text-slate-700">
                                {formatDate(population.updated_at)}
                              </strong>
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </section>

          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
            {!selectedPopulation && !showForm && (
              <div className="flex h-full min-h-[650px] items-center justify-center p-8 text-center">
                <div className="max-w-md">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                    <Shield size={23} className="text-slate-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-[#102a43]">
                    Select a peer population
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Select a population from the list to inspect its
                    configuration and manage tenant membership.
                  </p>
                </div>
              </div>
            )}

            {selectedPopulation && (
              <div>
                <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-[#102a43]">
                        {selectedPopulation.name}
                      </h2>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusClass(
                          selectedPopulation.status
                        )}`}
                      >
                        {selectedPopulation.status}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      Population ID {selectedPopulation.id}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={startEdit}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Edit3 size={14} />
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={deletePopulation}
                      disabled={deleting}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deleting ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                      Delete
                    </button>
                  </div>
                </div>

                <div className="grid min-w-0 gap-6 p-6 xl:grid-cols-2">
                  <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/60 p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-[#102a43]">
                        Configuration
                      </h3>
                      <span className="text-xs text-slate-400">
                        ID {selectedPopulation.id}
                      </span>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <InfoItem
                        label="Standard"
                        value={
                          selectedStandard
                            ? `${selectedStandard.code} - ${selectedStandard.title}`
                            : "No standard filter"
                        }
                      />
                      <InfoItem
                        label="Minimum Sample"
                        value={String(
                          selectedPopulation.minimum_sample_size
                        )}
                      />
                      <InfoItem
                        label="Industry"
                        value={selectedPopulation.industry ?? "-"}
                      />
                      <InfoItem
                        label="Company Size"
                        value={selectedPopulation.company_size_band ?? "-"}
                      />
                      <InfoItem
                        label="Geography"
                        value={selectedPopulation.geography ?? "-"}
                      />
                      <InfoItem
                        label="Revenue Band"
                        value={selectedPopulation.revenue_band ?? "-"}
                      />
                    </div>

                    <div className="mt-4 border-t border-slate-200 pt-4">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Description
                      </div>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {selectedPopulation.description ||
                          "No description provided."}
                      </p>
                    </div>

                    <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2">
                      <InfoItem
                        label="Created"
                        value={formatDate(selectedPopulation.created_at)}
                      />
                      <InfoItem
                        label="Updated"
                        value={formatDate(selectedPopulation.updated_at)}
                      />
                    </div>
                  </div>

                  <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-[#102a43]">
                          Membership
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          {members.length} current member
                          {members.length === 1 ? "" : "s"}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowAddMember((value) => !value)}
                        className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#102a43] px-3 text-xs font-semibold text-white hover:bg-[#163b5c]"
                      >
                        <Plus size={14} />
                        Add Tenant
                      </button>
                    </div>

                    {showAddMember && (
                      <form
                        onSubmit={addMember}
                        className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label="Tenant" required>
                            <select
                              value={newTenantId}
                              onChange={(event) =>
                                setNewTenantId(event.target.value)
                              }
                              className="input"
                            >
                              <option value="">Select tenant</option>
                              {availableTenants.map((tenant) => (
                                <option key={tenant.id} value={tenant.id}>
                                  {tenant.name} ({tenant.code})
                                </option>
                              ))}
                            </select>
                          </Field>

                          <Field label="Membership Type">
                            <select
                              value={newMembershipType}
                              onChange={(event) =>
                                setNewMembershipType(
                                  event.target.value as MembershipType
                                )
                              }
                              className="input"
                            >
                              {membershipOptions.map((value) => (
                                <option key={value} value={value}>
                                  {value}
                                </option>
                              ))}
                            </select>
                          </Field>

                          <Field label="Eligibility">
                            <select
                              value={newEligibility}
                              onChange={(event) =>
                                setNewEligibility(
                                  event.target.value as EligibilityStatus
                                )
                              }
                              className="input"
                            >
                              {eligibilityOptions.map((value) => (
                                <option key={value} value={value}>
                                  {value}
                                </option>
                              ))}
                            </select>
                          </Field>

                          <Field label="Effective From">
                            <input
                              type="datetime-local"
                              value={newEffectiveFrom}
                              onChange={(event) =>
                                setNewEffectiveFrom(event.target.value)
                              }
                              className="input"
                            />
                          </Field>

                          <Field label="Effective To">
                            <input
                              type="datetime-local"
                              value={newEffectiveTo}
                              onChange={(event) =>
                                setNewEffectiveTo(event.target.value)
                              }
                              className="input"
                            />
                          </Field>
                        </div>

                        <div className="mt-4 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShowAddMember(false)}
                            className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700"
                          >
                            Cancel
                          </button>

                          <button
                            type="submit"
                            disabled={addingMember || availableTenants.length === 0}
                            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#102a43] px-3 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            {addingMember && (
                              <Loader2 size={13} className="animate-spin" />
                            )}
                            Add Tenant
                          </button>
                        </div>
                      </form>
                    )}

                    <div className="mt-5 min-w-0">
                      {loadingMembers && (
                        <div className="flex items-center justify-center py-10 text-sm text-slate-500">
                          <Loader2
                            size={17}
                            className="mr-2 animate-spin"
                          />
                          Loading members...
                        </div>
                      )}

                      {!loadingMembers && members.length === 0 && (
                        <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center">
                          <Users
                            size={24}
                            className="mx-auto mb-2 text-slate-300"
                          />
                          <p className="text-sm font-medium text-slate-700">
                            No members configured
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Add active tenants to build this peer population.
                          </p>
                        </div>
                      )}

                      {!loadingMembers && members.length > 0 && (
                        <div className="space-y-3">
                          {members.map((member) => {
                            const tenant = tenantMap.get(member.tenant_id);

                            return (
                              <div
                                key={member.id}
                                className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"
                              >
                                <div className="grid gap-4 md:grid-cols-2">
                                  <div className="min-w-0">
                                    <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                                      Tenant
                                    </div>
                                    <div className="truncate text-sm font-semibold text-slate-700">
                                      {tenant?.name ??
                                        `Tenant ${member.tenant_id}`}
                                    </div>
                                    <div className="mt-0.5 text-[10px] text-slate-400">
                                      {tenant?.code ?? "-"}
                                    </div>
                                  </div>

                                  <div className="min-w-0">
                                    <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                                      Membership Type
                                    </div>
                                    <select
                                      value={member.membership_type}
                                      onChange={(event) =>
                                        updateMember(
                                          member,
                                          "membership_type",
                                          event.target.value
                                        )
                                      }
                                      className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-slate-400"
                                    >
                                      {membershipOptions.map((value) => (
                                        <option key={value} value={value}>
                                          {value}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="min-w-0">
                                    <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                                      Eligibility
                                    </div>
                                    <select
                                      value={member.eligibility_status}
                                      onChange={(event) =>
                                        updateMember(
                                          member,
                                          "eligibility_status",
                                          event.target.value
                                        )
                                      }
                                      className={`h-9 w-full rounded-md border px-2 text-xs font-semibold outline-none ${statusClass(
                                        member.eligibility_status
                                      )}`}
                                    >
                                      {eligibilityOptions.map((value) => (
                                        <option key={value} value={value}>
                                          {value}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="min-w-0">
                                    <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                                      Effective Period
                                    </div>
                                    <div className="text-xs text-slate-600">
                                      <div>
                                        From: {formatDate(member.effective_from)}
                                      </div>
                                      <div className="mt-1">
                                        To: {formatDate(member.effective_to)}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-4 flex items-center justify-end border-t border-slate-200 pt-3">
                                  <button
                                    type="button"
                                    onClick={() => removeMember(member)}
                                    className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-red-600 hover:bg-red-50"
                                    title="Remove tenant"
                                  >
                                    <Trash2 size={13} />
                                    Remove
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                  </div>
                </div>
              </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          min-height: 40px;
          border-radius: 8px;
          border: 1px solid rgb(226 232 240);
          background: white;
          padding: 0 12px;
          font-size: 13px;
          color: rgb(51 65 85);
          outline: none;
        }

        textarea.input {
          padding-top: 10px;
          padding-bottom: 10px;
        }

        .input:focus {
          border-color: rgb(148 163 184);
          box-shadow: 0 0 0 3px rgb(226 232 240);
        }

        .input::placeholder {
          color: rgb(148 163 184);
        }
      `}</style>
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
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-medium text-slate-700">
        {value}
      </div>
    </div>
  );
}
