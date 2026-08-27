"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/api";

type Organization = {
  id?: number;
  name: string;
  legal_name?: string | null;
  industry?: string | null;
  company_size?: string | null;
  employee_count?: number | null;
  description?: string | null;
  mission?: string | null;
  vision?: string | null;
  scope_statement?: string | null;
  status?: string | null;
};

const EMPTY: Organization = {
  name: "",
  legal_name: "",
  industry: "",
  company_size: "",
  employee_count: null,
  description: "",
  mission: "",
  vision: "",
  scope_statement: "",
  status: "ACTIVE",
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
        <h2 className="text-lg font-semibold text-slate-900">
          {title}
        </h2>

        {subtitle && (
          <p className="mt-1 text-sm text-slate-500">
            {subtitle}
          </p>
        )}
      </div>

      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  textarea = false,
  disabled = false,
}: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  textarea?: boolean;
  disabled?: boolean;
}) {
  const baseClass =
    "w-full rounded-lg border px-3 py-2 text-sm text-slate-900 transition";

  const stateClass = disabled
    ? "border-slate-200 bg-slate-50 text-slate-700 cursor-default"
    : "border-slate-300 bg-white focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200";

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">
        {label}
      </label>

      {textarea ? (
        <textarea
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`${baseClass} ${stateClass}`}
          rows={4}
        />
      ) : (
        <input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`${baseClass} ${stateClass}`}
        />
      )}
    </div>
  );
}

export default function OrganizationPage() {
  const [organization, setOrganization] =
    useState<Organization>(EMPTY);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Existing organization opens in VIEW mode.
  // If no organization exists, page opens in CREATE mode.
  const [editing, setEditing] = useState(false);

  async function load() {
    setLoading(true);

    try {
      const res = await apiFetch("/organizations");

      if (res.ok) {
        const data = await res.json();

        if (Array.isArray(data) && data.length > 0) {
          setOrganization(data[0]);

          // Existing record = view mode.
          setEditing(false);
        } else {
          // No organization yet = create mode.
          setOrganization(EMPTY);
          setEditing(true);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function update(
    key: keyof Organization,
    value: any
  ) {
    setOrganization((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function save() {
    if (!organization.name.trim()) {
      return;
    }

    setSaving(true);

    try {
      const method = organization.id
        ? "PUT"
        : "POST";

      const url = organization.id
        ? `/organizations/${organization.id}`
        : "/organizations";

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(organization),
      });

      if (res.ok) {
        await load();
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="text-sm text-slate-500">
        Loading organization...
      </div>
    );
  }

  const hasOrganization = Boolean(organization.id);

  return (
    <div className="space-y-6">

      {/* HEADER */}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Organization
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage organizational identity and corporate foundation information.
          </p>
        </div>

        {hasOrganization && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Edit Organization
          </button>
        )}
      </div>


      {/* ORGANIZATION INFORMATION */}

      <Section
        title="Organization Information"
        subtitle="Legal and operational identity."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

          <Field
            label="Organization Name"
            value={organization.name}
            disabled={!editing}
            onChange={(v) =>
              update("name", v)
            }
          />

          <Field
            label="Legal Name"
            value={organization.legal_name}
            disabled={!editing}
            onChange={(v) =>
              update("legal_name", v)
            }
          />

          <Field
            label="Industry"
            value={organization.industry}
            disabled={!editing}
            onChange={(v) =>
              update("industry", v)
            }
          />

          <Field
            label="Company Size"
            value={organization.company_size}
            disabled={!editing}
            onChange={(v) =>
              update("company_size", v)
            }
          />

          <Field
            label="Employee Count"
            value={organization.employee_count}
            disabled={!editing}
            onChange={(v) =>
              update(
                "employee_count",
                v === "" ? null : Number(v)
              )
            }
          />

        </div>
      </Section>


      {/* CORPORATE IDENTITY */}

      <Section
        title="Corporate Identity"
        subtitle="Mission and vision statements."
      >

        <Field
          label="Mission"
          value={organization.mission}
          disabled={!editing}
          onChange={(v) =>
            update("mission", v)
          }
          textarea
        />

        <Field
          label="Vision"
          value={organization.vision}
          disabled={!editing}
          onChange={(v) =>
            update("vision", v)
          }
          textarea
        />

      </Section>


      {/* SCOPE */}

      <Section
        title="Scope Statement"
        subtitle="Organizational scope and management system boundaries."
      >

        <Field
          label="Scope Statement"
          value={organization.scope_statement}
          disabled={!editing}
          onChange={(v) =>
            update(
              "scope_statement",
              v
            )
          }
          textarea
        />

      </Section>


      {/* ACTIONS */}

      {editing && (
        <div className="flex items-center gap-3">

          <button
            type="button"
            onClick={save}
            disabled={saving || !organization.name.trim()}
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? hasOrganization
                ? "Updating..."
                : "Saving..."
              : hasOrganization
                ? "Update Organization"
                : "Save Organization"}
          </button>

          {hasOrganization && (
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                load();
              }}
              disabled={saving}
              className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
          )}

        </div>
      )}

    </div>
  );
}
