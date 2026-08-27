"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  Edit3,
  Globe2,
  MapPin,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { apiFetch } from "@/app/lib/api";

type Location = {
  id: number;
  tenant_id?: number | null;
  organization_id?: number | null;
  name: string;
  code?: string | null;
  location_type?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  contact_person?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  status?: string | null;
  created_by?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type Organization = {
  id?: number;
  name?: string | null;
};

type LocationForm = {
  name: string;
  code: string;
  location_type: string;
  address: string;
  city: string;
  country: string;
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  status: string;
};

const EMPTY_FORM: LocationForm = {
  name: "",
  code: "",
  location_type: "",
  address: "",
  city: "",
  country: "",
  contact_person: "",
  contact_email: "",
  contact_phone: "",
  status: "ACTIVE",
};

const LOCATION_TYPES = [
  "Headquarters",
  "Office",
  "Branch",
  "Data Center",
  "Warehouse",
  "Facility",
  "Remote",
  "Other",
];

function statusLabel(status?: string | null) {
  if (!status) return "Unknown";

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClasses(status?: string | null) {
  switch ((status || "").toUpperCase()) {
    case "ACTIVE":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "INACTIVE":
      return "border-slate-200 bg-slate-100 text-slate-600";

    case "ARCHIVED":
      return "border-amber-200 bg-amber-50 text-amber-700";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function inputClass() {
  return "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200";
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [organization, setOrganization] =
    useState<Organization | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [form, setForm] =
    useState<LocationForm>(EMPTY_FORM);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [locationRes, organizationRes] =
        await Promise.all([
          apiFetch("/company/locations"),
          apiFetch("/organizations"),
        ]);

      if (!locationRes.ok) {
        throw new Error(
          (await locationRes.text()) ||
            "Failed to load locations"
        );
      }

      const locationData =
        await locationRes.json();

      let organizationData: any = null;

      if (organizationRes.ok) {
        organizationData =
          await organizationRes.json();
      }

      setLocations(
        Array.isArray(locationData)
          ? locationData
          : locationData?.items || []
      );

      if (
        Array.isArray(organizationData) &&
        organizationData.length > 0
      ) {
        setOrganization(organizationData[0]);
      } else if (
        organizationData &&
        !Array.isArray(organizationData)
      ) {
        setOrganization(organizationData);
      } else {
        setOrganization(null);
      }
    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to load location information."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredLocations = useMemo(() => {
    const query = search.trim().toLowerCase();

    return locations.filter((location) => {
      const matchesSearch =
        !query ||
        location.name
          ?.toLowerCase()
          .includes(query) ||
        location.code
          ?.toLowerCase()
          .includes(query) ||
        location.location_type
          ?.toLowerCase()
          .includes(query) ||
        location.city
          ?.toLowerCase()
          .includes(query) ||
        location.country
          ?.toLowerCase()
          .includes(query) ||
        location.contact_person
          ?.toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "ALL" ||
        (location.status || "ACTIVE").toUpperCase() ===
          statusFilter;

      const matchesType =
        typeFilter === "ALL" ||
        (location.location_type || "").toLowerCase() ===
          typeFilter.toLowerCase();

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType
      );
    });
  }, [
    locations,
    search,
    statusFilter,
    typeFilter,
  ]);

  const activeCount = locations.filter(
    (item) =>
      (item.status || "ACTIVE").toUpperCase() ===
      "ACTIVE"
  ).length;

  const inactiveCount = locations.filter(
    (item) =>
      (item.status || "").toUpperCase() ===
      "INACTIVE"
  ).length;

  const contactCount = locations.filter(
    (item) =>
      Boolean(
        item.contact_person ||
          item.contact_email ||
          item.contact_phone
      )
  ).length;

  const countryCount = new Set(
    locations
      .map((item) => item.country?.trim())
      .filter(Boolean)
  ).size;

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
    setNotice("");
    setModalOpen(true);
  }

  function openEdit(location: Location) {
    setEditingId(location.id);

    setForm({
      name: location.name || "",
      code: location.code || "",
      location_type:
        location.location_type || "",
      address: location.address || "",
      city: location.city || "",
      country: location.country || "",
      contact_person:
        location.contact_person || "",
      contact_email:
        location.contact_email || "",
      contact_phone:
        location.contact_phone || "",
      status:
        location.status?.toUpperCase() ||
        "ACTIVE",
    });

    setError("");
    setNotice("");
    setModalOpen(true);
  }

  async function saveLocation() {
    if (!form.name.trim()) {
      setError("Location name is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        ...(organization?.id
          ? {
              organization_id:
                organization.id,
            }
          : {}),
        name: form.name.trim(),
        code: form.code.trim() || null,
        location_type:
          form.location_type.trim() || null,
        address:
          form.address.trim() || null,
        city:
          form.city.trim() || null,
        country:
          form.country.trim() || null,
        contact_person:
          form.contact_person.trim() || null,
        contact_email:
          form.contact_email.trim() || null,
        contact_phone:
          form.contact_phone.trim() || null,
        status: form.status,
      };

      const url = editingId
        ? `/company/locations/${editingId}`
        : "/company/locations";

      const method = editingId
        ? "PUT"
        : "POST";

      const res = await apiFetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(
          (await res.text()) ||
            "Failed to save location"
        );
      }

      await loadData();

      setModalOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);

      setNotice(
        editingId
          ? "Location updated successfully."
          : "Location created successfully."
      );

      window.setTimeout(() => {
        setNotice("");
      }, 3500);
    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to save location."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteLocation(
    location: Location
  ) {
    const confirmed = window.confirm(
      `Delete location "${location.name}"?`
    );

    if (!confirmed) return;

    try {
      setActionId(location.id);
      setError("");

      const res = await apiFetch(
        `/company/locations/${location.id}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        throw new Error(
          (await res.text()) ||
            "Failed to delete location"
        );
      }

      await loadData();

      setNotice(
        "Location deleted successfully."
      );

      window.setTimeout(() => {
        setNotice("");
      }, 3500);
    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to delete location."
      );
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="min-h-full space-y-6">

      {/* HEADER */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            <MapPin size={14} />
            Company Foundation
          </div>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            Locations
          </h1>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Manage physical operating locations,
            facilities and site-level accountability
            across the organization.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          <Plus size={17} />
          Add Location
        </button>
      </div>

      {/* NOTICES */}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          <CheckCircle2 size={16} />
          {notice}
        </div>
      )}

      {/* KPI */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Total Locations
            </span>

            <MapPin
              size={18}
              className="text-slate-400"
            />
          </div>

          <div className="mt-3 text-3xl font-semibold text-slate-950">
            {locations.length}
          </div>

          <p className="mt-1 text-xs text-slate-500">
            Registered operating sites
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Active
            </span>

            <CheckCircle2
              size={18}
              className="text-emerald-500"
            />
          </div>

          <div className="mt-3 text-3xl font-semibold text-slate-950">
            {activeCount}
          </div>

          <p className="mt-1 text-xs text-slate-500">
            Currently operational
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Inactive
            </span>

            <Building2
              size={18}
              className="text-slate-400"
            />
          </div>

          <div className="mt-3 text-3xl font-semibold text-slate-950">
            {inactiveCount}
          </div>

          <p className="mt-1 text-xs text-slate-500">
            Non-operational sites
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Countries
            </span>

            <Globe2
              size={18}
              className="text-slate-400"
            />
          </div>

          <div className="mt-3 text-3xl font-semibold text-slate-950">
            {countryCount}
          </div>

          <p className="mt-1 text-xs text-slate-500">
            Countries represented
          </p>
        </div>

      </div>

      {/* DIRECTORY */}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

        <div className="border-b border-slate-200 px-5 py-4">

          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Location Registry
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Physical sites, facilities and
                location-level contact information.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">

              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  placeholder="Search locations..."
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 sm:w-64"
                />
              </div>

              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value)
                  }
                  className="appearance-none rounded-lg border border-slate-300 bg-white py-2.5 pl-3 pr-9 text-sm text-slate-700 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                >
                  <option value="ALL">
                    All Statuses
                  </option>
                  <option value="ACTIVE">
                    Active
                  </option>
                  <option value="INACTIVE">
                    Inactive
                  </option>
                  <option value="ARCHIVED">
                    Archived
                  </option>
                </select>

                <ChevronDown
                  size={15}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>

              <div className="relative">
                <select
                  value={typeFilter}
                  onChange={(e) =>
                    setTypeFilter(e.target.value)
                  }
                  className="appearance-none rounded-lg border border-slate-300 bg-white py-2.5 pl-3 pr-9 text-sm text-slate-700 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                >
                  <option value="ALL">
                    All Types
                  </option>

                  {LOCATION_TYPES.map(
                    (type) => (
                      <option
                        key={type}
                        value={type}
                      >
                        {type}
                      </option>
                    )
                  )}
                </select>

                <ChevronDown
                  size={15}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>

            </div>
          </div>
        </div>

        {loading ? (
          <div className="px-5 py-16 text-center text-sm text-slate-500">
            Loading locations...
          </div>
        ) : filteredLocations.length === 0 ? (
          <div className="px-5 py-16 text-center">

            <MapPin
              size={30}
              className="mx-auto text-slate-300"
            />

            <div className="mt-3 text-sm font-semibold text-slate-700">
              No locations found
            </div>

            <p className="mt-1 text-xs text-slate-500">
              Create a location or adjust the
              current filters.
            </p>

          </div>
        ) : (
          <div className="overflow-x-auto">

            <table className="w-full min-w-[1100px]">

              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-left">

                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Location
                  </th>

                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Type
                  </th>

                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Geography
                  </th>

                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Contact
                  </th>

                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Status
                  </th>

                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Updated
                  </th>

                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Actions
                  </th>

                </tr>
              </thead>

              <tbody>

                {filteredLocations.map(
                  (location) => (
                    <tr
                      key={location.id}
                      className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60"
                    >

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">

                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                            <MapPin size={17} />
                          </div>

                          <div className="min-w-0">

                            <div className="truncate text-sm font-semibold text-slate-900">
                              {location.name}
                            </div>

                            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">

                              <span className="font-mono">
                                {location.code ||
                                  "NO CODE"}
                              </span>

                            </div>

                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="text-sm text-slate-700">
                          {location.location_type ||
                            "—"}
                        </span>
                      </td>

                      <td className="px-5 py-4">

                        <div className="text-sm text-slate-700">
                          {location.city ||
                            location.country ||
                            "—"}
                        </div>

                        {location.city &&
                          location.country && (
                            <div className="mt-0.5 text-xs text-slate-400">
                              {location.country}
                            </div>
                          )}

                      </td>

                      <td className="px-5 py-4">

                        {location.contact_person ||
                        location.contact_email ||
                        location.contact_phone ? (
                          <div className="flex items-start gap-2">

                            <UserRound
                              size={15}
                              className="mt-0.5 shrink-0 text-slate-400"
                            />

                            <div className="min-w-0">

                              <div className="truncate text-sm text-slate-700">
                                {location.contact_person ||
                                  "Contact"}
                              </div>

                              <div className="max-w-[180px] truncate text-xs text-slate-400">
                                {location.contact_email ||
                                  location.contact_phone ||
                                  "—"}
                              </div>

                            </div>

                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">
                            Unassigned
                          </span>
                        )}

                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(
                            location.status
                          )}`}
                        >
                          {statusLabel(
                            location.status ||
                              "ACTIVE"
                          )}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-500">
                        {formatDate(
                          location.updated_at ||
                            location.created_at
                        )}
                      </td>

                      <td className="px-5 py-4">

                        <div className="flex justify-end gap-1">

                          <button
                            type="button"
                            onClick={() =>
                              openEdit(location)
                            }
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            title="Edit location"
                          >
                            <Edit3 size={16} />
                          </button>

                          <button
                            type="button"
                            disabled={
                              actionId ===
                              location.id
                            }
                            onClick={() =>
                              deleteLocation(
                                location
                              )
                            }
                            className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                            title="Delete location"
                          >
                            <Trash2 size={16} />
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

      </section>

      {/* MODAL */}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]">

          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">

              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  {editingId
                    ? "Edit Location"
                    : "Create Location"}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Define the site's identity,
                  geography and operational contact.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setModalOpen(false)
                }
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>

            </div>

            <div className="space-y-6 px-6 py-6">

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* IDENTITY */}

              <div>

                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Location Identity
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Location Name *
                    </label>

                    <input
                      value={form.name}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      placeholder="e.g. Istanbul Headquarters"
                      className={inputClass()}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Location Code
                    </label>

                    <input
                      value={form.code}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          code: e.target.value,
                        }))
                      }
                      placeholder="e.g. IST-HQ"
                      className={inputClass()}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Location Type
                    </label>

                    <select
                      value={
                        form.location_type
                      }
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          location_type:
                            e.target.value,
                        }))
                      }
                      className={inputClass()}
                    >
                      <option value="">
                        Select location type
                      </option>

                      {LOCATION_TYPES.map(
                        (type) => (
                          <option
                            key={type}
                            value={type}
                          >
                            {type}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Status
                    </label>

                    <select
                      value={form.status}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          status: e.target.value,
                        }))
                      }
                      className={inputClass()}
                    >
                      <option value="ACTIVE">
                        Active
                      </option>

                      <option value="INACTIVE">
                        Inactive
                      </option>

                      <option value="ARCHIVED">
                        Archived
                      </option>
                    </select>
                  </div>

                </div>
              </div>

              {/* GEOGRAPHY */}

              <div>

                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Geographic Information
                </div>

                <div className="space-y-4">

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Address
                    </label>

                    <textarea
                      value={form.address}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          address:
                            e.target.value,
                        }))
                      }
                      rows={3}
                      placeholder="Street address, building, floor or site details"
                      className={inputClass()}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                        City
                      </label>

                      <input
                        value={form.city}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            city: e.target.value,
                          }))
                        }
                        placeholder="Istanbul"
                        className={inputClass()}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                        Country
                      </label>

                      <input
                        value={form.country}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            country:
                              e.target.value,
                          }))
                        }
                        placeholder="Türkiye"
                        className={inputClass()}
                      />
                    </div>

                  </div>

                </div>
              </div>

              {/* CONTACT */}

              <div>

                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Site Contact
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Contact Person
                    </label>

                    <input
                      value={
                        form.contact_person
                      }
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          contact_person:
                            e.target.value,
                        }))
                      }
                      placeholder="Site manager or responsible person"
                      className={inputClass()}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Contact Email
                    </label>

                    <input
                      type="email"
                      value={
                        form.contact_email
                      }
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          contact_email:
                            e.target.value,
                        }))
                      }
                      placeholder="site@example.com"
                      className={inputClass()}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Contact Phone
                    </label>

                    <input
                      value={
                        form.contact_phone
                      }
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          contact_phone:
                            e.target.value,
                        }))
                      }
                      placeholder="+90 ..."
                      className={inputClass()}
                    />
                  </div>

                </div>
              </div>

            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/70 px-6 py-4">

              <button
                type="button"
                onClick={() =>
                  setModalOpen(false)
                }
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={saveLocation}
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Save Changes"
                    : "Create Location"}
              </button>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
