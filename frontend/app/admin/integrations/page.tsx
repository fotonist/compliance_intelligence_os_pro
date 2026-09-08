"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Cloud,
  ExternalLink,
  Eye,
  EyeOff,
  Link2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plug,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { apiFetch } from "../../lib/api";

type Provider = "jira" | "clickup";

type Integration = {
  id: number;
  provider: Provider;
  base_url?: string | null;
  jira_email?: string | null;
  project_key?: string | null;
  issue_type?: string | null;
  team_id?: string | null;
  space_id?: string | null;
  folder_id?: string | null;
  list_id?: string | null;
  is_active: boolean;
  has_api_token: boolean;
  created_at: string;
  updated_at: string;
};

type TestResult = {
  provider: Provider;
  success: boolean;
  message: string;
};

type FormState = {
  base_url: string;
  jira_email: string;
  api_token: string;
  project_key: string;
  issue_type: string;
  team_id: string;
  space_id: string;
  folder_id: string;
  list_id: string;
};

const PROVIDERS: {
  key: Provider;
  name: string;
  description: string;
  category: string;
}[] = [
  {
    key: "jira",
    name: "Jira",
    description: "Connect compliance tasks with Jira issues and project workflows.",
    category: "Project Management",
  },
  {
    key: "clickup",
    name: "ClickUp",
    description: "Push compliance tasks into ClickUp lists for operational execution.",
    category: "Work Management",
  },
];

const EMPTY_FORM: FormState = {
  base_url: "",
  jira_email: "",
  api_token: "",
  project_key: "",
  issue_type: "Task",
  team_id: "",
  space_id: "",
  folder_id: "",
  list_id: "",
};

function providerName(provider: Provider) {
  return provider === "jira" ? "Jira" : "ClickUp";
}

function getStatus(integration?: Integration) {
  if (!integration) {
    return {
      label: "Not Configured",
      tone: "neutral",
    };
  }

  if (!integration.is_active) {
    return {
      label: "Disabled",
      tone: "neutral",
    };
  }

  if (!integration.has_api_token) {
    return {
      label: "Attention",
      tone: "warning",
    };
  }

  return {
    label: "Connected",
    tone: "success",
  };
}

function statusClass(tone: string) {
  if (tone === "success") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (tone === "warning") {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  return "bg-slate-50 text-slate-600 border-slate-200";
}

function formatDate(value?: string | null) {
  if (!value) return "Never";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitialForm(provider: Provider, integration?: Integration): FormState {
  if (!integration) {
    return {
      ...EMPTY_FORM,
      issue_type: provider === "jira" ? "Task" : "",
    };
  }

  return {
    base_url: integration.base_url || "",
    jira_email: integration.jira_email || "",
    api_token: "",
    project_key: integration.project_key || "",
    issue_type: integration.issue_type || "Task",
    team_id: integration.team_id || "",
    space_id: integration.space_id || "",
    folder_id: integration.folder_id || "",
    list_id: integration.list_id || "",
  };
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [testingProvider, setTestingProvider] = useState<Provider | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [showToken, setShowToken] = useState(false);

  const [deleteProvider, setDeleteProvider] = useState<Provider | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [menuProvider, setMenuProvider] = useState<Provider | null>(null);

  async function loadIntegrations(showRefresh = false) {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const res = await apiFetch("/admin/integrations");
      const data = await res.json();

      if (!Array.isArray(data)) {
        throw new Error("Invalid integration response");
      }

      setIntegrations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load integrations");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadIntegrations();
  }, []);

  const integrationMap = useMemo(() => {
    return new Map(integrations.map((item) => [item.provider, item]));
  }, [integrations]);

  const configuredCount = integrations.length;

  const connectedCount = integrations.filter(
    (item) => item.is_active && item.has_api_token
  ).length;

  const attentionCount = integrations.filter(
    (item) => !item.has_api_token || !item.is_active
  ).length;

  function openConfigure(provider: Provider) {
    const integration = integrationMap.get(provider);

    setSelectedProvider(provider);
    setForm(getInitialForm(provider, integration));
    setShowToken(false);
    setMenuProvider(null);
  }

  function closeConfigure() {
    if (saving) return;

    setSelectedProvider(null);
    setForm(EMPTY_FORM);
    setShowToken(false);
  }

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveIntegration() {
    if (!selectedProvider) return;

    try {
      setSaving(true);
      setError("");

      const existing = integrationMap.get(selectedProvider);

      let payload: Record<string, unknown>;

      if (selectedProvider === "jira") {
        payload = {
          provider: "jira",
          base_url: form.base_url.trim(),
          jira_email: form.jira_email.trim(),
          project_key: form.project_key.trim(),
          issue_type: form.issue_type.trim() || "Task",
        };

        if (!existing || form.api_token.trim()) {
          payload.api_token = form.api_token.trim();
        }
      } else {
        payload = {
          provider: "clickup",
          team_id: form.team_id.trim() || null,
          space_id: form.space_id.trim() || null,
          folder_id: form.folder_id.trim() || null,
          list_id: form.list_id.trim() || null,
        };

        if (!existing || form.api_token.trim()) {
          payload.api_token = form.api_token.trim();
        }
      }

      if (selectedProvider === "jira") {
        if (
          !form.base_url.trim() ||
          !form.jira_email.trim() ||
          !form.project_key.trim() ||
          (!existing && !form.api_token.trim())
        ) {
          throw new Error("Complete all required Jira fields");
        }
      }

      if (selectedProvider === "clickup") {
        if (!existing && !form.api_token.trim()) {
          throw new Error("API token is required for ClickUp");
        }
      }

      const res = await apiFetch(
        existing
          ? `/admin/integrations/${selectedProvider}`
          : "/admin/integrations",
        {
          method: existing ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        }
      );

      await res.json();
      await loadIntegrations(true);
      closeConfigure();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save integration");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection(provider: Provider) {
    try {
      setTestingProvider(provider);
      setMenuProvider(null);

      const res = await apiFetch(`/admin/integrations/${provider}/test`, {
        method: "POST",
      });
      const result: TestResult = await res.json();

      setTestResults((current) => ({
        ...current,
        [provider]: result,
      }));
    } catch (err) {
      setTestResults((current) => ({
        ...current,
        [provider]: {
          provider,
          success: false,
          message:
            err instanceof Error ? err.message : "Connection test failed",
        },
      }));
    } finally {
      setTestingProvider(null);
    }
  }

  async function toggleIntegration(integration: Integration) {
    try {
      setMenuProvider(null);

      await apiFetch(`/admin/integrations/${integration.provider}`, {
        method: "PATCH",
        body: JSON.stringify({
          is_active: !integration.is_active,
        }),
      });

      await loadIntegrations(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update integration");
    }
  }

  async function confirmDelete() {
    if (!deleteProvider) return;

    try {
      setDeleting(true);
      setError("");

      await apiFetch(`/admin/integrations/${deleteProvider}`, {
        method: "DELETE",
      });

      setDeleteProvider(null);
      await loadIntegrations(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete integration");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-[1600px] px-6 py-7">
        <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500">
              <span>Administration</span>
              <ChevronRight size={13} />
              <span className="text-slate-700">Integrations</span>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              Integrations
            </h1>

            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Manage external work-management connections and compliance task synchronization.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadIntegrations(true)}
              disabled={refreshing}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={14}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh
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
              className="text-red-500 hover:text-red-700"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="mb-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={<Plug size={17} />}
            label="Configured"
            value={configuredCount}
            description="Provider configurations"
          />
          <KpiCard
            icon={<CheckCircle2 size={17} />}
            label="Connected"
            value={connectedCount}
            description="Active authenticated connections"
          />
          <KpiCard
            icon={<AlertCircle size={17} />}
            label="Attention"
            value={attentionCount}
            description="Disabled or incomplete"
          />
          <KpiCard
            icon={<Cloud size={17} />}
            label="Supported Providers"
            value={PROVIDERS.length}
            description="Available integrations"
          />
        </div>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Provider Connections
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Configure authentication and destination settings for each provider.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck size={14} />
              Credentials are never displayed after configuration
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 size={17} className="animate-spin" />
                Loading integrations...
              </div>
            </div>
          ) : (
            <div className="grid gap-4 p-5 xl:grid-cols-2">
              {PROVIDERS.map((provider) => {
                const integration = integrationMap.get(provider.key);
                const status = getStatus(integration);
                const testResult = testResults[provider.key];

                return (
                  <ProviderCard
                    key={provider.key}
                    provider={provider}
                    integration={integration}
                    status={status}
                    testResult={testResult}
                    testing={testingProvider === provider.key}
                    menuOpen={menuProvider === provider.key}
                    onMenu={() =>
                      setMenuProvider((current) =>
                        current === provider.key ? null : provider.key
                      )
                    }
                    onConfigure={() => openConfigure(provider.key)}
                    onTest={() => testConnection(provider.key)}
                    onToggle={() => integration && toggleIntegration(integration)}
                    onDelete={() => {
                      setMenuProvider(null);
                      setDeleteProvider(provider.key);
                    }}
                  />
                );
              })}
            </div>
          )}
        </section>

        <div className="mt-5 flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm">
          <CircleHelp size={15} className="mt-0.5 shrink-0 text-slate-400" />
          <p>
            Integrations provide outbound task synchronization. Configuration does not
            create historical sync records; task-level external links are maintained
            by the synchronization service.
          </p>
        </div>
      </div>

      {selectedProvider && (
        <ConfigureModal
          provider={selectedProvider}
          existing={integrationMap.get(selectedProvider)}
          form={form}
          saving={saving}
          showToken={showToken}
          onShowToken={() => setShowToken((current) => !current)}
          onChange={updateField}
          onClose={closeConfigure}
          onSave={saveIntegration}
        />
      )}

      {deleteProvider && (
        <DeleteModal
          provider={deleteProvider}
          deleting={deleting}
          onCancel={() => !deleting && setDeleteProvider(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          {icon}
        </div>
      </div>

      <div className="text-2xl font-semibold tracking-tight text-slate-950">
        {value}
      </div>

      <div className="mt-1 text-sm font-medium text-slate-700">{label}</div>
      <div className="mt-0.5 text-xs text-slate-400">{description}</div>
    </div>
  );
}

function ProviderCard({
  provider,
  integration,
  status,
  testResult,
  testing,
  menuOpen,
  onMenu,
  onConfigure,
  onTest,
  onToggle,
  onDelete,
}: {
  provider: (typeof PROVIDERS)[number];
  integration?: Integration;
  status: { label: string; tone: string };
  testResult?: TestResult;
  testing: boolean;
  menuOpen: boolean;
  onMenu: () => void;
  onConfigure: () => void;
  onTest: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="relative rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
            {provider.key === "jira" ? (
              <span className="text-sm font-bold text-slate-700">J</span>
            ) : (
              <span className="text-sm font-bold text-slate-700">C</span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                {provider.name}
              </h3>

              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClass(
                  status.tone
                )}`}
              >
                {status.label}
              </span>
            </div>

            <p className="mt-1 text-xs text-slate-500">{provider.category}</p>
          </div>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={onMenu}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label={`${provider.name} actions`}
          >
            <MoreHorizontal size={17} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
              <button
                type="button"
                onClick={onConfigure}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Pencil size={14} />
                Configure
              </button>

              {integration && (
                <button
                  type="button"
                  onClick={onToggle}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Zap size={14} />
                  {integration.is_active ? "Disable" : "Enable"}
                </button>
              )}

              {integration && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 min-h-[40px] text-sm leading-5 text-slate-600">
        {provider.description}
      </p>

      <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
        {provider.key === "jira" ? (
          <>
            <InfoRow
              label="Base URL"
              value={integration?.base_url || "Not configured"}
            />
            <InfoRow
              label="Project"
              value={integration?.project_key || "Not configured"}
            />
            <InfoRow
              label="Account"
              value={integration?.jira_email || "Not configured"}
            />
            <InfoRow
              label="Issue Type"
              value={integration?.issue_type || "Task"}
            />
          </>
        ) : (
          <>
            <InfoRow
              label="Team"
              value={integration?.team_id || "Not configured"}
            />
            <InfoRow
              label="Space"
              value={integration?.space_id || "Not configured"}
            />
            <InfoRow
              label="Folder"
              value={integration?.folder_id || "Not configured"}
            />
            <InfoRow
              label="List"
              value={integration?.list_id || "Not configured"}
            />
          </>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Link2 size={13} />
          {integration
            ? `Updated ${formatDate(integration.updated_at)}`
            : "No configuration"}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTest}
            disabled={!integration || testing}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {testing ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <ClipboardCheck size={13} />
            )}
            Test
          </button>

          <button
            type="button"
            onClick={onConfigure}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800"
          >
            {integration ? (
              <>
                <Settings2 size={13} />
                Configure
              </>
            ) : (
              <>
                <Plus size={13} />
                Configure
              </>
            )}
          </button>
        </div>
      </div>

      {testResult && (
        <div
          className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
            testResult.success
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {testResult.success ? (
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
          ) : (
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
          )}
          <span>{testResult.message}</span>
        </div>
      )}
    </article>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div
        className="mt-1 truncate text-xs font-medium text-slate-700"
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function ConfigureModal({
  provider,
  existing,
  form,
  saving,
  showToken,
  onShowToken,
  onChange,
  onClose,
  onSave,
}: {
  provider: Provider;
  existing?: Integration;
  form: FormState;
  saving: boolean;
  showToken: boolean;
  onShowToken: () => void;
  onChange: (field: keyof FormState, value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                <Plug size={16} className="text-slate-700" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-950">
                  {existing ? "Configure" : "Connect"} {providerName(provider)}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {existing
                    ? "Update the connection settings below."
                    : "Enter the credentials and destination settings."}
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X size={17} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
          {provider === "jira" ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Base URL"
                required
                placeholder="https://company.atlassian.net"
                value={form.base_url}
                onChange={(value) => onChange("base_url", value)}
                className="sm:col-span-2"
              />

              <Field
                label="Account Email"
                required
                type="email"
                placeholder="account@company.com"
                value={form.jira_email}
                onChange={(value) => onChange("jira_email", value)}
              />

              <Field
                label="Project Key"
                required
                placeholder="COM"
                value={form.project_key}
                onChange={(value) => onChange("project_key", value)}
              />

              <SecretField
                label={existing ? "API Token (leave blank to keep current)" : "API Token"}
                required={!existing}
                value={form.api_token}
                show={showToken}
                onToggle={onShowToken}
                onChange={(value) => onChange("api_token", value)}
                className="sm:col-span-2"
              />

              <Field
                label="Issue Type"
                placeholder="Task"
                value={form.issue_type}
                onChange={(value) => onChange("issue_type", value)}
              />
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              <SecretField
                label={existing ? "API Token (leave blank to keep current)" : "API Token"}
                required={!existing}
                value={form.api_token}
                show={showToken}
                onToggle={onShowToken}
                onChange={(value) => onChange("api_token", value)}
                className="sm:col-span-2"
              />

              <Field
                label="Team ID"
                placeholder="Optional"
                value={form.team_id}
                onChange={(value) => onChange("team_id", value)}
              />

              <Field
                label="Space ID"
                placeholder="Optional"
                value={form.space_id}
                onChange={(value) => onChange("space_id", value)}
              />

              <Field
                label="Folder ID"
                placeholder="Optional"
                value={form.folder_id}
                onChange={(value) => onChange("folder_id", value)}
              />

              <Field
                label="List ID"
                placeholder="Optional"
                value={form.list_id}
                onChange={(value) => onChange("list_id", value)}
              />
            </div>
          )}

          <div className="mt-6 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-slate-500" />
            <span>
              Authentication credentials are stored securely and are not returned
              by the integration API after configuration.
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {existing ? "Save Changes" : "Connect"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-medium text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      />
    </label>
  );
}

function SecretField({
  label,
  value,
  show,
  required,
  onToggle,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  show: boolean;
  required?: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-medium text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>

      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Enter token"
          autoComplete="new-password"
          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
        />

        <button
          type="button"
          onClick={onToggle}
          className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-slate-400 hover:text-slate-700"
          aria-label={show ? "Hide token" : "Show token"}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </label>
  );
}

function DeleteModal({
  provider,
  deleting,
  onCancel,
  onConfirm,
}: {
  provider: Provider;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <Trash2 size={18} />
          </div>

          <h2 className="mt-4 text-base font-semibold text-slate-950">
            Delete {providerName(provider)} integration?
          </h2>

          <p className="mt-2 text-sm leading-5 text-slate-500">
            This removes the integration configuration. Existing task external
            links are not deleted by this action.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting && <Loader2 size={14} className="animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
