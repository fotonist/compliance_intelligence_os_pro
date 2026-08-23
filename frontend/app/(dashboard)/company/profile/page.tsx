"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/api";

type CompanyProfile = {
  legal_name: string;
  trade_name: string;
  tax_id: string;
  registration_no: string;
  industry: string;
  employee_count: number | null;
  headquarters_address: string;
  website: string;

  internal_issues: string;
  external_issues: string;
  strategic_objectives: string;

  scope_description: string;
  excluded_activities: string;

  status: string;
};

const EMPTY: CompanyProfile = {
  legal_name: "",
  trade_name: "",
  tax_id: "",
  registration_no: "",
  industry: "",
  employee_count: null,
  headquarters_address: "",
  website: "",

  internal_issues: "",
  external_issues: "",
  strategic_objectives: "",

  scope_description: "",
  excluded_activities: "",

  status: "draft",
};

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>

        {subtitle ? (
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        ) : null}
      </div>

      {children}
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-xs font-medium text-slate-500">
      {children}
    </label>
  );
}

function Input({
  className = "",
  value,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      value={value ?? ""}
      className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-slate-600 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    />
  );
}

function Textarea({
  className = "",
  value,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      value={value ?? ""}
      className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-slate-600 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    />
  );
}

function Button({
  children,
  onClick,
  disabled = false,
  variant = "primary",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  type?: "button" | "submit";
}) {
  const styles =
    variant === "primary"
      ? "border border-emerald-700 bg-emerald-700 text-white shadow-sm hover:bg-emerald-800 hover:border-emerald-800"
      : variant === "secondary"
      ? "border border-emerald-700 bg-white text-emerald-700 shadow-sm hover:bg-emerald-50"
      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = (status || "draft").toLowerCase();

  const isPublished = normalized === "published";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
        isPublished
          ? "border-emerald-700/50 bg-emerald-950/40 text-emerald-300"
          : "border-amber-700/50 bg-amber-950/30 text-amber-300"
      }`}
    >
      {isPublished ? "Published" : "Draft"}
    </span>
  );
}

function normalizeProfile(json: any): CompanyProfile {
  return {
    legal_name: json?.legal_name ?? "",
    trade_name: json?.trade_name ?? "",
    tax_id: json?.tax_id ?? "",
    registration_no: json?.registration_no ?? "",
    industry: json?.industry ?? "",

    employee_count:
      json?.employee_count === null ||
      json?.employee_count === undefined ||
      json?.employee_count === ""
        ? null
        : Number(json.employee_count),

    headquarters_address: json?.headquarters_address ?? "",
    website: json?.website ?? "",

    internal_issues: json?.internal_issues ?? "",
    external_issues: json?.external_issues ?? "",
    strategic_objectives: json?.strategic_objectives ?? "",

    scope_description: json?.scope_description ?? "",
    excluded_activities: json?.excluded_activities ?? "",

    status: json?.status ?? "draft",
  };
}

export default function CompanyProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [editMode, setEditMode] = useState(true);
  const [data, setData] = useState<CompanyProfile>(EMPTY);

  const canSave = useMemo(() => {
    return data.legal_name.trim().length > 0;
  }, [data.legal_name]);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const res = await apiFetch("/company/profile", {
        method: "GET",
      });

      if (!res.ok) {
        const text = await safeText(res);

        if (res.status === 404) {
          setData(EMPTY);
          setEditMode(true);
          return;
        }

        throw new Error(
          text || `Failed to load company profile (${res.status})`
        );
      }

      const json = await res.json();

      if (!json || Object.keys(json).length === 0) {
        setData(EMPTY);
        setEditMode(true);
        return;
      }

      const normalized = normalizeProfile(json);

      setData(normalized);
      setEditMode(normalized.status !== "published");
    } catch (e: any) {
      setError(e?.message || "Failed to load company profile.");
      setEditMode(true);
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!canSave) return;

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const payload = {
        legal_name: data.legal_name.trim(),
        trade_name: data.trade_name.trim(),
        tax_id: data.tax_id.trim(),
        registration_no: data.registration_no.trim(),
        industry: data.industry.trim(),
        employee_count: data.employee_count,
        headquarters_address: data.headquarters_address.trim(),
        website: data.website.trim(),

        internal_issues: data.internal_issues.trim(),
        external_issues: data.external_issues.trim(),
        strategic_objectives: data.strategic_objectives.trim(),

        scope_description: data.scope_description.trim(),
        excluded_activities: data.excluded_activities.trim(),
      };

      const res = await apiFetch("/company/profile", {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await safeText(res);
        throw new Error(text || `Save failed (${res.status})`);
      }

      setData((prev) => ({
        ...prev,
        status: "draft",
      }));

      setNotice("Company profile saved successfully.");
      setEditMode(false);
    } catch (e: any) {
      setError(e?.message || "Failed to save company profile.");
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setPublishing(true);
    setError(null);
    setNotice(null);

    try {
      const res = await apiFetch("/company/profile/publish", {
        method: "POST",
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const text = await safeText(res);
        throw new Error(text || `Publish failed (${res.status})`);
      }

      setData((prev) => ({
        ...prev,
        status: "published",
      }));

      setNotice("Company profile published successfully.");
      setEditMode(false);
    } catch (e: any) {
      setError(e?.message || "Failed to publish company profile.");
    } finally {
      setPublishing(false);
    }
  }

  function updateField<K extends keyof CompanyProfile>(
    key: K,
    value: CompanyProfile[K]
  ) {
    setData((prev) => ({
      ...prev,
      [key]: value,
    }));

    if (notice) {
      setNotice(null);
    }
  }

  function cancelEdit() {
    loadProfile();
  }

  const busy = loading || saving || publishing;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">
              Company Profile
            </h1>

            {!loading ? <StatusBadge status={data.status} /> : null}
          </div>

          <p className="mt-1 text-sm text-slate-500">
            Organization identity, context and system scope
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!editMode ? (
            <Button
              variant="ghost"
              onClick={() => {
                setError(null);
                setNotice(null);
                setEditMode(true);
              }}
              disabled={busy}
            >
              Edit
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={cancelEdit}
              disabled={busy}
            >
              Cancel
            </Button>
          )}

          <Button
            variant="secondary"
            onClick={save}
            disabled={busy || !editMode || !canSave}
          >
            {saving ? "Saving..." : "Save"}
          </Button>

          <Button
            onClick={publish}
            disabled={busy || !data.legal_name.trim()}
          >
            {publishing ? "Publishing..." : "Publish"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          Loading company profile...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-700/40 bg-red-950/40 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/30 p-4 text-sm text-emerald-200">
          {notice}
        </div>
      ) : null}

      {!loading ? (
        <>
          <Section
            title="Basic Information"
            subtitle="Legal identity and primary organization information"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label>Legal Name *</Label>
                <Input
                  value={data.legal_name}
                  onChange={(e) =>
                    updateField("legal_name", e.target.value)
                  }
                  disabled={!editMode}
                  placeholder="Compliance Automation Yazılım A.Ş."
                />
              </div>

              <div>
                <Label>Trade Name</Label>
                <Input
                  value={data.trade_name}
                  onChange={(e) =>
                    updateField("trade_name", e.target.value)
                  }
                  disabled={!editMode}
                  placeholder="Compliance Intelligence OS"
                />
              </div>

              <div>
                <Label>Tax ID</Label>
                <Input
                  value={data.tax_id}
                  onChange={(e) =>
                    updateField("tax_id", e.target.value)
                  }
                  disabled={!editMode}
                  placeholder="Tax identification number"
                />
              </div>

              <div>
                <Label>Registration No</Label>
                <Input
                  value={data.registration_no}
                  onChange={(e) =>
                    updateField("registration_no", e.target.value)
                  }
                  disabled={!editMode}
                  placeholder="Trade registry / MERSIS number"
                />
              </div>

              <div>
                <Label>Industry</Label>
                <Input
                  value={data.industry}
                  onChange={(e) =>
                    updateField("industry", e.target.value)
                  }
                  disabled={!editMode}
                  placeholder="Industry / sector"
                />
              </div>

              <div>
                <Label>Employee Count</Label>
                <Input
                  type="number"
                  min={0}
                  value={data.employee_count ?? ""}
                  onChange={(e) =>
                    updateField(
                      "employee_count",
                      e.target.value === ""
                        ? null
                        : Number(e.target.value)
                    )
                  }
                  disabled={!editMode}
                  placeholder="e.g. 250"
                />
              </div>

              <div className="md:col-span-2">
                <Label>Headquarters Address</Label>
                <Textarea
                  rows={3}
                  value={data.headquarters_address}
                  onChange={(e) =>
                    updateField(
                      "headquarters_address",
                      e.target.value
                    )
                  }
                  disabled={!editMode}
                  placeholder="Headquarters address"
                />
              </div>

              <div className="md:col-span-2">
                <Label>Website</Label>
                <Input
                  type="url"
                  value={data.website}
                  onChange={(e) =>
                    updateField("website", e.target.value)
                  }
                  disabled={!editMode}
                  placeholder="https://example.com"
                />
              </div>
            </div>
          </Section>

          <Section
            title="Context of the Organization"
            subtitle="Organizational context used by compliance and management system processes"
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div>
                <Label>Internal Issues</Label>
                <Textarea
                  rows={9}
                  value={data.internal_issues}
                  onChange={(e) =>
                    updateField("internal_issues", e.target.value)
                  }
                  disabled={!editMode}
                  placeholder="Organizational structure, resources, culture, capabilities, technology..."
                />
              </div>

              <div>
                <Label>External Issues</Label>
                <Textarea
                  rows={9}
                  value={data.external_issues}
                  onChange={(e) =>
                    updateField("external_issues", e.target.value)
                  }
                  disabled={!editMode}
                  placeholder="Regulatory, market, technological, environmental and stakeholder factors..."
                />
              </div>

              <div>
                <Label>Strategic Objectives</Label>
                <Textarea
                  rows={9}
                  value={data.strategic_objectives}
                  onChange={(e) =>
                    updateField(
                      "strategic_objectives",
                      e.target.value
                    )
                  }
                  disabled={!editMode}
                  placeholder="Strategic priorities, business objectives, growth and improvement objectives..."
                />
              </div>
            </div>
          </Section>

          <Section
            title="System Scope"
            subtitle="Scope and boundaries of the management system"
          >
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label>Scope Description</Label>
                <Textarea
                  rows={6}
                  value={data.scope_description}
                  onChange={(e) =>
                    updateField(
                      "scope_description",
                      e.target.value
                    )
                  }
                  disabled={!editMode}
                  placeholder="Describe the organizational, functional and operational scope..."
                />
              </div>

              <div>
                <Label>Excluded Activities</Label>
                <Textarea
                  rows={6}
                  value={data.excluded_activities}
                  onChange={(e) =>
                    updateField(
                      "excluded_activities",
                      e.target.value
                    )
                  }
                  disabled={!editMode}
                  placeholder="Activities excluded from the scope and the corresponding justification..."
                />
              </div>
            </div>
          </Section>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-2 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
              <span>
                Company Profile is the organizational context layer used by
                the compliance architecture.
              </span>

              <span className="text-xs text-slate-500">
                Status: {data.status || "draft"}
              </span>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

async function safeText(res: Response) {
  try {
    const text = await res.text();
    return (text || "").slice(0, 500);
  } catch {
    return "";
  }
}



