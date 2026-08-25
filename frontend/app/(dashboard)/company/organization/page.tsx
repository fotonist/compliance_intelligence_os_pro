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
}: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  textarea?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">
        {label}
      </label>

      {textarea ? (
        <textarea
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
          rows={4}
        />
      ) : (
        <input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
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

  async function load() {
    setLoading(true);

    const res = await apiFetch("/organizations");

    if (res.ok) {
      const data = await res.json();

      if (Array.isArray(data) && data.length > 0) {
        setOrganization(data[0]);
      }
    }

    setLoading(false);
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
    setSaving(true);

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
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <div className="text-sm text-slate-500">
        Loading organization...
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Organization
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Manage organizational identity and corporate foundation information.
        </p>
      </div>


      <Section
        title="Organization Information"
        subtitle="Legal and operational identity."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <Field
            label="Organization Name"
            value={organization.name}
            onChange={(v) =>
              update("name", v)
            }
          />

          <Field
            label="Legal Name"
            value={organization.legal_name}
            onChange={(v) =>
              update("legal_name", v)
            }
          />

          <Field
            label="Industry"
            value={organization.industry}
            onChange={(v) =>
              update("industry", v)
            }
          />

          <Field
            label="Company Size"
            value={organization.company_size}
            onChange={(v) =>
              update("company_size", v)
            }
          />

          <Field
            label="Employee Count"
            value={organization.employee_count}
            onChange={(v) =>
              update(
                "employee_count",
                Number(v)
              )
            }
          />

        </div>
      </Section>


      <Section
        title="Corporate Identity"
        subtitle="Mission and vision statements."
      >

        <Field
          label="Mission"
          value={organization.mission}
          onChange={(v) =>
            update("mission", v)
          }
          textarea
        />

        <Field
          label="Vision"
          value={organization.vision}
          onChange={(v) =>
            update("vision", v)
          }
          textarea
        />

      </Section>


      <Section
        title="Scope Statement"
      >

        <Field
          label="Scope Statement"
          value={organization.scope_statement}
          onChange={(v) =>
            update(
              "scope_statement",
              v
            )
          }
          textarea
        />

      </Section>


      <div>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving
            ? "Saving..."
            : "Save Organization"}
        </button>
      </div>

    </div>
  );
}
