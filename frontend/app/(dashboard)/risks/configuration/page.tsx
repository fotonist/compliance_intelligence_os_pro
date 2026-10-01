"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Gauge,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type RiskAppetiteProfile = {
  id: number;
  name: string;
  description?: string | null;
  is_default: boolean;
  default_threshold: number;
};

type Criticality =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

type ProcessRiskAppetite = {
  process_id: number;
  process_name: string;
  threshold: number;
  threshold_override?: number | null;
  criticality?: Criticality | null;
  inherited: boolean;
};

type DraftMap = Record<number, string>;
type CriticalityDraftMap = Record<number, string>;

function getToken() {
  if (typeof window === "undefined") return "";
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

function parseError(body: unknown, fallback: string) {
  if (
    body &&
    typeof body === "object" &&
    "detail" in body &&
    typeof (body as { detail?: unknown }).detail === "string"
  ) {
    return (body as { detail: string }).detail;
  }

  return fallback;
}

export default function RiskConfigurationPage() {
  const router = useRouter();

  const [profile, setProfile] =
    useState<RiskAppetiteProfile | null>(null);

  const [processes, setProcesses] = useState<ProcessRiskAppetite[]>([]);
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [criticalityDrafts, setCriticalityDrafts] =
    useState<CriticalityDraftMap>({});

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [busyProcessId, setBusyProcessId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [profileRes, processRes] = await Promise.all([
        fetch(`${API_BASE}/risk-appetite/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }),
        fetch(`${API_BASE}/risk-appetite/processes`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }),
      ]);

      if (!profileRes.ok) {
        const body = await profileRes.json().catch(() => null);
        throw new Error(
          parseError(body, "Failed to load tenant risk appetite.")
        );
      }

      if (!processRes.ok) {
        const body = await processRes.json().catch(() => null);
        throw new Error(
          parseError(body, "Failed to load process risk appetite.")
        );
      }

      const profileData =
        (await profileRes.json()) as RiskAppetiteProfile;

      const processData =
        (await processRes.json()) as ProcessRiskAppetite[];

      setProfile(profileData);
      setProcesses(Array.isArray(processData) ? processData : []);

      const nextDrafts: DraftMap = {};
      const nextCriticalityDrafts: CriticalityDraftMap = {};

      for (const item of Array.isArray(processData) ? processData : []) {
        nextDrafts[item.process_id] =
          item.threshold_override == null
            ? ""
            : String(item.threshold_override);

        nextCriticalityDrafts[item.process_id] =
          item.criticality ?? "";
      }

      setDrafts(nextDrafts);
      setCriticalityDrafts(nextCriticalityDrafts);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load risk configuration."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredProcesses = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return processes;

    return processes.filter((item) =>
      item.process_name.toLowerCase().includes(query)
    );
  }, [processes, search]);

  const overrideCount = useMemo(
    () => processes.filter((item) => !item.inherited).length,
    [processes]
  );

  const inheritedCount = processes.length - overrideCount;

  const saveProfile = async () => {
    if (!profile) return;

    if (
      !Number.isFinite(profile.default_threshold) ||
      profile.default_threshold < 1
    ) {
      setError("Default threshold must be greater than zero.");
      return;
    }

    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    setSavingProfile(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`${API_BASE}/risk-appetite/profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: profile.name,
          description: profile.description || null,
          default_threshold: profile.default_threshold,
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          parseError(body, "Failed to save tenant risk appetite.")
        );
      }

      setProfile(body as RiskAppetiteProfile);
      setMessage("Tenant risk appetite saved.");

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save tenant risk appetite."
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const saveProcess = async (processId: number) => {
    const raw = drafts[processId] ?? "";
    const trimmed = raw.trim();

    let thresholdOverride: number | null = null;

    if (trimmed !== "") {
      const parsed = Number(trimmed);

      if (!Number.isInteger(parsed) || parsed < 1) {
        setError("Process threshold must be a positive integer.");
        return;
      }

      thresholdOverride = parsed;
    }

    const criticality =
      criticalityDrafts[processId] || null;

    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    setBusyProcessId(processId);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(
        `${API_BASE}/risk-appetite/processes/${processId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            threshold_override: thresholdOverride,
            criticality,
          }),
        }
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          parseError(body, "Failed to save process threshold.")
        );
      }

      const updated = body as ProcessRiskAppetite;

      setProcesses((current) =>
        current.map((item) =>
          item.process_id === processId ? updated : item
        )
      );

      setDrafts((current) => ({
        ...current,
        [processId]:
          updated.threshold_override == null
            ? ""
            : String(updated.threshold_override),
      }));

      setCriticalityDrafts((current) => ({
        ...current,
        [processId]: updated.criticality ?? "",
      }));

      setMessage("Process risk configuration saved.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save process threshold."
      );
    } finally {
      setBusyProcessId(null);
    }
  };

  const resetProcess = async (processId: number) => {
    setDrafts((current) => ({
      ...current,
      [processId]: "",
    }));

    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    setBusyProcessId(processId);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(
        `${API_BASE}/risk-appetite/processes/${processId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            threshold_override: null,
            criticality:
              criticalityDrafts[processId] || null,
          }),
        }
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          parseError(body, "Failed to reset process threshold.")
        );
      }

      const updated = body as ProcessRiskAppetite;

      setProcesses((current) =>
        current.map((item) =>
          item.process_id === processId ? updated : item
        )
      );

      setDrafts((current) => ({
        ...current,
        [processId]: "",
      }));

      setCriticalityDrafts((current) => ({
        ...current,
        [processId]: updated.criticality ?? "",
      }));

      setMessage(
        "Threshold returned to tenant default."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to reset process threshold."
      );
    } finally {
      setBusyProcessId(null);
    }
  };

  return (
    <div className="min-h-full bg-[#f6f8fc] px-6 py-7 lg:px-10">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              <ShieldCheck size={14} />
              Risk Management
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              Risk Configuration
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Define the tenant risk appetite and apply process-specific
              threshold overrides without changing the underlying risk score.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle size={17} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Default Threshold"
            value={profile ? String(profile.default_threshold) : "-"}
            helper="Tenant baseline"
            icon={<Gauge size={18} />}
          />

          <MetricCard
            label="Processes"
            value={String(processes.length)}
            helper="Tenant process scope"
            icon={<Building2 size={18} />}
          />

          <MetricCard
            label="Overrides"
            value={String(overrideCount)}
            helper="Process-specific thresholds"
            icon={<SlidersHorizontal size={18} />}
          />

          <MetricCard
            label="Inherited"
            value={String(inheritedCount)}
            helper="Using tenant default"
            icon={<ShieldCheck size={18} />}
          />
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-base font-semibold text-slate-950">
              Tenant Risk Appetite
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              This threshold is inherited by processes without an explicit
              override.
            </p>
          </div>

          {loading ? (
            <div className="px-6 py-10 text-sm text-slate-500">
              Loading risk configuration...
            </div>
          ) : profile ? (
            <div className="grid gap-5 px-6 py-6 lg:grid-cols-[1fr_1fr_220px_auto] lg:items-end">
              <Field label="Profile Name">
                <input
                  value={profile.name}
                  onChange={(event) =>
                    setProfile({
                      ...profile,
                      name: event.target.value,
                    })
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                />
              </Field>

              <Field label="Description">
                <input
                  value={profile.description || ""}
                  onChange={(event) =>
                    setProfile({
                      ...profile,
                      description: event.target.value,
                    })
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                />
              </Field>

              <Field label="Default Threshold">
                <input
                  type="number"
                  min={1}
                  value={profile.default_threshold}
                  onChange={(event) =>
                    setProfile({
                      ...profile,
                      default_threshold: Number(event.target.value),
                    })
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-slate-400"
                />
              </Field>

              <button
                type="button"
                onClick={() => void saveProfile()}
                disabled={savingProfile}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <Save size={15} />
                {savingProfile ? "Saving..." : "Save Profile"}
              </button>
            </div>
          ) : null}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Process Risk Appetite
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Classify process criticality and override the tenant threshold
                only where a different tolerance is required.
              </p>
            </div>

            <div className="relative w-full lg:w-80">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search processes..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-slate-400"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Process
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Criticality
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Effective Threshold
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Override
                  </th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {!loading &&
                  filteredProcesses.map((item) => (
                    <tr
                      key={item.process_id}
                      className="border-b border-slate-100 last:border-b-0"
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">
                          {item.process_name}
                        </div>

                        <div className="mt-1 text-xs text-slate-400">
                          Process #{item.process_id}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <select
                          value={
                            criticalityDrafts[item.process_id] ?? ""
                          }
                          onChange={(event) =>
                            setCriticalityDrafts((current) => ({
                              ...current,
                              [item.process_id]: event.target.value,
                            }))
                          }
                          className="h-9 min-w-32 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-slate-400"
                        >
                          <option value="">Not Set</option>
                          <option value="LOW">Low</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HIGH">High</option>
                          <option value="CRITICAL">Critical</option>
                        </select>
                      </td>

                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-slate-900">
                          {item.threshold}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        {item.inherited ? (
                          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                            Tenant Default
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                            Process Override
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <input
                          type="number"
                          min={1}
                          value={drafts[item.process_id] ?? ""}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [item.process_id]: event.target.value,
                            }))
                          }
                          placeholder={
                            profile
                              ? `Default: ${profile.default_threshold}`
                              : "Default"
                          }
                          className="h-9 w-36 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-400"
                        />
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            title="Reset to tenant default"
                            onClick={() =>
                              void resetProcess(item.process_id)
                            }
                            disabled={
                              busyProcessId === item.process_id ||
                              item.inherited
                            }
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                          >
                            <RotateCcw size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void saveProcess(item.process_id)
                            }
                            disabled={busyProcessId === item.process_id}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                          >
                            <Save size={14} />
                            {busyProcessId === item.process_id
                              ? "Saving..."
                              : "Save"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                {!loading && filteredProcesses.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-sm text-slate-500"
                    >
                      No processes found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm leading-6 text-slate-500">
          Process criticality is classification metadata. Threshold overrides
          define appetite and tolerance boundaries. Neither changes the
          calculated inherent or residual risk score.
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {label}
          </div>

          <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            {value}
          </div>

          <div className="mt-1 text-xs text-slate-400">{helper}</div>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
          {icon}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
