// frontend/app/(dashboard)/company/profile/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";


type CompanyProfile = {
  company_name: string;
  legal_name: string;
  tax_id: string;
  registration_no: string;
  industry: string;
  employee_count: number | null;
  headquarters_address: string;
  website: string;

  internal_issues: string;
  external_issues: string;
  strategic_objectives: string;

  policy_summary: string;
  leadership_representative: string;
  compliance_officer: string;

  scope_description: string;
  included_locations: string[];
  excluded_activities: string;
};

const EMPTY: CompanyProfile = {
  company_name: "",
  legal_name: "",
  tax_id: "",
  registration_no: "",
  industry: "",
  employee_count: null,
  headquarters_address: "",
  website: "",

  internal_issues: "",
  external_issues: "",
  strategic_objectives: "",

  policy_summary: "",
  leadership_representative: "",
  compliance_officer: "",

  scope_description: "",
  included_locations: [],
  excluded_activities: "",
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
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
      <div>
        <div className="text-lg font-semibold text-slate-100">{title}</div>
        {subtitle ? (
          <div className="text-sm text-slate-400">{subtitle}</div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-slate-400 mb-1">{children}</div>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-600 ${
        props.className || ""
      }`}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-600 ${
        props.className || ""
      }`}
    />
  );
}

function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "ghost";
}) {
  const cls =
    variant === "primary"
      ? "bg-emerald-600 hover:bg-emerald-500 text-white"
      : variant === "secondary"
      ? "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700"
      : "bg-transparent hover:bg-slate-800/60 text-slate-200 border border-slate-800";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg text-sm transition disabled:opacity-50 disabled:cursor-not-allowed ${cls}`}
    >
      {children}
    </button>
  );
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
    // minimal guard: company name or legal name
    return (
      (data.company_name || "").trim().length > 0 ||
      (data.legal_name || "").trim().length > 0
    );
  }, [data.company_name, data.legal_name]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiFetch("/company/profile", { method: "GET" });
      if (res.ok) {
        const json = await res.json();
        setData({
          ...EMPTY,
          ...(json || {}),
          included_locations: Array.isArray(json?.included_locations)
            ? json.included_locations
            : [],
          employee_count:
            json?.employee_count === null || json?.employee_count === undefined
              ? null
              : Number(json.employee_count),
        });
        setEditMode(false);
      } else {
        // if not configured yet, just keep empty
        setEditMode(true);
      }
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
      const res = await apiFetch("/company/profile", {
        method: "PUT",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const t = await safeText(res);
        throw new Error(t || `Save failed (${res.status})`);
      }
      setNotice("Saved.");
      setEditMode(false);
    } catch (e: any) {
      setError(e?.message || "Save failed.");
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
        const t = await safeText(res);
        throw new Error(t || `Publish failed (${res.status})`);
      }
      setNotice("Published.");
    } catch (e: any) {
      setError(e?.message || "Publish failed.");
    } finally {
      setPublishing(false);
    }
  }

  function set<K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function addLocation() {
    const v = prompt("Add location (e.g., Istanbul HQ, Ankara Office):");
    if (!v) return;
    const val = v.trim();
    if (!val) return;
    setData((p) => ({
      ...p,
      included_locations: Array.from(new Set([...(p.included_locations || []), val])),
    }));
  }

  function removeLocation(loc: string) {
    setData((p) => ({
      ...p,
      included_locations: (p.included_locations || []).filter((x) => x !== loc),
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold">Company Profile</div>
          <div className="text-sm text-slate-400">
            Organization context, scope and leadership (A Layer)
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => setEditMode((v) => !v)}
            disabled={loading || saving || publishing}
          >
            {editMode ? "Cancel Edit" : "Edit"}
          </Button>
          <Button
            variant="secondary"
            onClick={save}
            disabled={loading || saving || publishing || !editMode || !canSave}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button
            onClick={publish}
            disabled={loading || saving || publishing}
          >
            {publishing ? "Publishing..." : "Publish"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-300">
          Loading...
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

      <Section title="Basic Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Company Name</Label>
            <Input
              value={data.company_name}
              onChange={(e) => set("company_name", e.target.value)}
              disabled={!editMode}
              placeholder="Compliance Automation Inc."
            />
          </div>

          <div>
            <Label>Legal Name</Label>
            <Input
              value={data.legal_name}
              onChange={(e) => set("legal_name", e.target.value)}
              disabled={!editMode}
              placeholder="Compliance Automation Yazılım A.Ş."
            />
          </div>

          <div>
            <Label>Tax ID</Label>
            <Input
              value={data.tax_id}
              onChange={(e) => set("tax_id", e.target.value)}
              disabled={!editMode}
              placeholder="1234567890"
            />
          </div>

          <div>
            <Label>Registration No</Label>
            <Input
              value={data.registration_no}
              onChange={(e) => set("registration_no", e.target.value)}
              disabled={!editMode}
              placeholder="MERSIS / Trade Registry"
            />
          </div>

          <div>
            <Label>Industry</Label>
            <Input
              value={data.industry}
              onChange={(e) => set("industry", e.target.value)}
              disabled={!editMode}
              placeholder="ERP / GRC / SaaS"
            />
          </div>

          <div>
            <Label>Employee Count</Label>
            <Input
              type="number"
              value={data.employee_count ?? ""}
              onChange={(e) =>
                set(
                  "employee_count",
                  e.target.value === "" ? null : Number(e.target.value)
                )
              }
              disabled={!editMode}
              placeholder="e.g., 25"
            />
          </div>

          <div className="md:col-span-2">
            <Label>Headquarters Address</Label>
            <Textarea
              rows={3}
              value={data.headquarters_address}
              onChange={(e) => set("headquarters_address", e.target.value)}
              disabled={!editMode}
              placeholder="Address..."
            />
          </div>

          <div className="md:col-span-2">
            <Label>Website</Label>
            <Input
              value={data.website}
              onChange={(e) => set("website", e.target.value)}
              disabled={!editMode}
              placeholder="https://..."
            />
          </div>
        </div>
      </Section>

      <Section
        title="Context of the Organization"
        subtitle="ISO 9001 / ISO 27001: internal & external issues, objectives"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div>
            <Label>Internal Issues</Label>
            <Textarea
              rows={8}
              value={data.internal_issues}
              onChange={(e) => set("internal_issues", e.target.value)}
              disabled={!editMode}
              placeholder="Org structure, culture, resources, tech stack..."
            />
          </div>
          <div>
            <Label>External Issues</Label>
            <Textarea
              rows={8}
              value={data.external_issues}
              onChange={(e) => set("external_issues", e.target.value)}
              disabled={!editMode}
              placeholder="Regulations, market trends, partners, threats..."
            />
          </div>
          <div>
            <Label>Strategic Objectives</Label>
            <Textarea
              rows={8}
              value={data.strategic_objectives}
              onChange={(e) => set("strategic_objectives", e.target.value)}
              disabled={!editMode}
              placeholder="Objectives, OKRs, growth, product roadmap..."
            />
          </div>
        </div>
      </Section>

      <Section
        title="Management Commitment"
        subtitle="Policy summary & key roles"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="lg:col-span-2">
            <Label>Policy Summary</Label>
            <Textarea
              rows={6}
              value={data.policy_summary}
              onChange={(e) => set("policy_summary", e.target.value)}
              disabled={!editMode}
              placeholder="Management commitment, customer focus, continual improvement..."
            />
          </div>

          <div>
            <Label>Leadership Representative</Label>
            <Input
              value={data.leadership_representative}
              onChange={(e) => set("leadership_representative", e.target.value)}
              disabled={!editMode}
              placeholder="Name / Role"
            />
          </div>

          <div>
            <Label>Compliance Officer</Label>
            <Input
              value={data.compliance_officer}
              onChange={(e) => set("compliance_officer", e.target.value)}
              disabled={!editMode}
              placeholder="Name / Role"
            />
          </div>
        </div>
      </Section>

      <Section title="System Scope" subtitle="Scope and boundaries">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="lg:col-span-2">
            <Label>Scope Description</Label>
            <Textarea
              rows={5}
              value={data.scope_description}
              onChange={(e) => set("scope_description", e.target.value)}
              disabled={!editMode}
              placeholder="Scope statement..."
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Included Locations</Label>
              <Button
                variant="ghost"
                onClick={addLocation}
                disabled={!editMode}
              >
                + Add
              </Button>
            </div>

            <div className="space-y-2">
              {(data.included_locations || []).length === 0 ? (
                <div className="text-sm text-slate-500">
                  No locations added.
                </div>
              ) : (
                data.included_locations.map((loc) => (
                  <div
                    key={loc}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                  >
                    <div className="text-sm text-slate-200">{loc}</div>
                    {editMode ? (
                      <button
                        onClick={() => removeLocation(loc)}
                        className="text-xs text-red-300 hover:text-red-200"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <Label>Excluded Activities</Label>
            <Textarea
              rows={8}
              value={data.excluded_activities}
              onChange={(e) => set("excluded_activities", e.target.value)}
              disabled={!editMode}
              placeholder="Any exclusions and justification..."
            />
          </div>
        </div>
      </Section>
    </div>
  );
}

async function safeText(res: Response) {
  try {
    const t = await res.text();
    return (t || "").slice(0, 400);
  } catch {
    return "";
  }
}
