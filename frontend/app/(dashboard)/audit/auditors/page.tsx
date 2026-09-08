"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileBarChart,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";

import { apiFetch } from "../../../lib/api";

type AnyRecord = Record<string, any>;

type UserRow = {
  id?: number;
  email?: string | null;
  full_name?: string | null;
  name?: string | null;
  username?: string | null;
  role?: string | null;
  roles?: any[];
  is_active?: boolean | null;
  active?: boolean | null;
  status?: string | null;
  tenant_id?: number | null;
  department?: string | null;
  job_title?: string | null;
};

type RoleRow = {
  id?: number;
  name?: string | null;
  code?: string | null;
  description?: string | null;
  users_count?: number | null;
  user_count?: number | null;
};

type AuditPlan = {
  id?: number;
  reference?: string | null;
  name?: string | null;
  status?: string | null;
  audit_type?: string | null;
  process_id?: number | null;
  lead_auditor_id?: number | null;
  planned_start?: string | null;
  planned_end?: string | null;
};

type Finding = {
  id?: number;
  audit_plan_id?: number | null;
  severity?: string | null;
  status?: string | null;
  assigned_owner_id?: number | null;
  owner_id?: number | null;
  created_at?: string | null;
  due_date?: string | null;
};

type AuditLog = {
  id?: number;
  actor_id?: number | null;
  actor_role?: string | null;
  user_email?: string | null;
  action?: string | null;
  entity_type?: string | null;
  entity_id?: number | null;
  created_at?: string | null;
  timestamp?: string | null;
};

type AuditorRecord = {
  user: UserRow;
  roles: string[];
  leadPlans: AuditPlan[];
  findingCount: number;
  openFindingCount: number;
  criticalFindingCount: number;
  overdueFindingCount: number;
  activityCount: number;
};

function arrayValue(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function normalize(value: any): string {
  return String(value ?? "").trim().toUpperCase();
}

function userName(user?: UserRow | null): string {
  if (!user) return "Unknown user";
  return (
    user.full_name ||
    user.name ||
    user.username ||
    user.email ||
    `User #${user.id}`
  );
}

function roleNames(user?: UserRow | null): string[] {
  if (!user) return [];

  const roles: string[] = [];

  if (user.role) roles.push(String(user.role));

  if (Array.isArray(user.roles)) {
    user.roles.forEach((role) => {
      if (typeof role === "string") {
        roles.push(role);
      } else if (role?.name) {
        roles.push(String(role.name));
      } else if (role?.code) {
        roles.push(String(role.code));
      }
    });
  }

  return Array.from(new Set(roles));
}

function isActiveUser(user: UserRow): boolean {
  if (typeof user.is_active === "boolean") return user.is_active;
  if (typeof user.active === "boolean") return user.active;

  const status = normalize(user.status);

  if (["INACTIVE", "DISABLED", "DEACTIVATED", "LOCKED"].includes(status)) {
    return false;
  }

  return true;
}

function isOpenFinding(finding: Finding): boolean {
  return normalize(finding.status) !== "CLOSED";
}

function isOverdueFinding(finding: Finding): boolean {
  if (!finding.due_date || !isOpenFinding(finding)) return false;

  const date = new Date(finding.due_date);

  if (Number.isNaN(date.getTime())) return false;

  return date.getTime() < Date.now();
}

function isAuditor(user: UserRow): boolean {
  const roles = roleNames(user).map(normalize);

  return roles.some((role) =>
    [
      "INTERNAL_AUDITOR",
      "LEAD_AUDITOR",
      "AUDITOR",
      "AUDIT_MANAGER",
      "INTERNAL AUDITOR",
      "LEAD AUDITOR",
    ].includes(role),
  );
}

function formatDate(value?: string | null): string {
  if (!value) return "N/A";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "N/A";

  return date.toLocaleDateString();
}

function KpiCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="min-h-[122px] border-r border-slate-200 bg-white px-5 py-5 last:border-r-0">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {icon}
        {label}
      </div>

      <div className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </div>

      {detail ? (
        <div className="mt-1 text-xs text-slate-500">{detail}</div>
      ) : null}
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="border-b border-slate-200 px-5 py-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-600">
        {eyebrow}
      </div>

      <div className="mt-1 text-base font-semibold text-slate-950">
        {title}
      </div>

      <div className="mt-1 text-xs text-slate-500">{description}</div>
    </div>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={
        active
          ? "inline-flex border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-emerald-700"
          : "inline-flex border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-500"
      }
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function RolePill({ value }: { value: string }) {
  return (
    <span className="inline-flex border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.06em] text-slate-600">
      {value}
    </span>
  );
}

export default function AuditorManagementPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [plans, setPlans] = useState<AuditPlan[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);

  const [selectedAuditorId, setSelectedAuditorId] = useState<number | null>(
    null,
  );

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [
        usersResponse,
        rolesResponse,
        plansResponse,
        findingsResponse,
        logsResponse,
      ] = await Promise.all([
        apiFetch("/users/?page=1&page_size=100"),
        apiFetch("/roles"),
        apiFetch("/audit/plans"),
        apiFetch("/audit/findings"),
        apiFetch("/audit/logs"),
      ]);

      if (!usersResponse.ok) {
        throw new Error(await usersResponse.text());
      }

      const userRows = arrayValue(
        await usersResponse.json(),
      ) as UserRow[];

      setUsers(userRows);

      if (rolesResponse.ok) {
        setRoles(
          arrayValue(await rolesResponse.json()) as RoleRow[],
        );
      } else {
        setRoles([]);
      }

      if (plansResponse.ok) {
        setPlans(
          arrayValue(await plansResponse.json()) as AuditPlan[],
        );
      } else {
        setPlans([]);
      }

      if (findingsResponse.ok) {
        setFindings(
          arrayValue(await findingsResponse.json()) as Finding[],
        );
      } else {
        setFindings([]);
      }

      if (logsResponse.ok) {
        setLogs(
          arrayValue(await logsResponse.json()) as AuditLog[],
        );
      } else {
        setLogs([]);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load auditor management data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const auditors = useMemo(() => {
    return users.filter(isAuditor);
  }, [users]);

  const auditorRecords = useMemo<AuditorRecord[]>(() => {
    return auditors.map((user) => {
      const userId = Number(user.id);

      const leadPlans = plans.filter(
        (plan) => Number(plan.lead_auditor_id) === userId,
      );

      const auditorFindings = findings.filter(
        (finding) =>
          Number(finding.assigned_owner_id || finding.owner_id) === userId,
      );

      const auditorLogs = logs.filter(
        (log) => Number(log.actor_id) === userId,
      );

      return {
        user,
        roles: roleNames(user),
        leadPlans,
        findingCount: auditorFindings.length,
        openFindingCount: auditorFindings.filter(isOpenFinding).length,
        criticalFindingCount: auditorFindings.filter(
          (finding) => normalize(finding.severity) === "CRITICAL",
        ).length,
        overdueFindingCount:
          auditorFindings.filter(isOverdueFinding).length,
        activityCount: auditorLogs.length,
      };
    });
  }, [auditors, plans, findings, logs]);

  const filteredAuditors = useMemo(() => {
    const query = search.trim().toLowerCase();

    return auditorRecords.filter((record) => {
      const matchesSearch =
        !query ||
        [
          userName(record.user),
          record.user.email,
          record.user.department,
          record.user.job_title,
          ...record.roles,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesRole =
        roleFilter === "ALL" ||
        record.roles.some(
          (role) => normalize(role) === normalize(roleFilter),
        );

      const active = isActiveUser(record.user);

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && active) ||
        (statusFilter === "INACTIVE" && !active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [auditorRecords, search, roleFilter, statusFilter]);

  const selectedAuditor = useMemo(() => {
    if (!selectedAuditorId) return null;

    return (
      auditorRecords.find(
        (record) => Number(record.user.id) === selectedAuditorId,
      ) || null
    );
  }, [auditorRecords, selectedAuditorId]);

  const activeAuditors = useMemo(
    () =>
      auditors.filter(isActiveUser).length,
    [auditors],
  );

  const leadAuditors = useMemo(
    () =>
      auditors.filter((user) =>
        roleNames(user).some(
          (role) =>
            ["LEAD_AUDITOR", "LEAD AUDITOR"].includes(normalize(role)),
        ),
      ).length,
    [auditors],
  );

  const activeEngagements = useMemo(
    () =>
      plans.filter((plan) =>
        ["IN_PROGRESS", "DRAFT"].includes(normalize(plan.status)),
      ).length,
    [plans],
  );

  const assignedEngagements = useMemo(
    () =>
      plans.filter(
        (plan) =>
          plan.lead_auditor_id != null &&
          Number(plan.lead_auditor_id) > 0,
      ).length,
    [plans],
  );

  const workload = useMemo(() => {
    return [...auditorRecords]
      .sort((a, b) => {
        if (b.leadPlans.length !== a.leadPlans.length) {
          return b.leadPlans.length - a.leadPlans.length;
        }

        return b.openFindingCount - a.openFindingCount;
      })
      .slice(0, 8);
  }, [auditorRecords]);

  const roleDistribution = useMemo(() => {
    const map = new Map<string, number>();

    auditors.forEach((user) => {
      roleNames(user).forEach((role) => {
        map.set(role, (map.get(role) || 0) + 1);
      });
    });

    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [auditors]);

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-[1680px] space-y-6 px-6 py-6 xl:px-8">
        <header className="border-b border-slate-200 pb-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">
                <UserCheck size={15} />
                Internal Audit / Auditor Management
              </div>

              <h1 className="mt-3 text-[28px] font-semibold tracking-tight text-slate-950">
                Auditor Management
              </h1>

              <p className="mt-1 max-w-4xl text-sm text-slate-500">
                Govern the audit team through role visibility, engagement
                ownership, workload, finding exposure, and audit activity.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/audit/planning"
                className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ClipboardCheck size={15} />
                Audit Planning
              </Link>

              <button
                type="button"
                onClick={() => void loadData()}
                disabled={loading}
                className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw
                  size={15}
                  className={loading ? "animate-spin" : ""}
                />
                Refresh
              </button>
            </div>
          </div>
        </header>

        {error ? (
          <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-px border border-slate-200 bg-slate-200 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={<Users size={15} />}
            label="Auditors"
            value={String(auditors.length)}
            detail={`${activeAuditors} active auditors`}
          />

          <KpiCard
            icon={<ShieldCheck size={15} />}
            label="Lead Auditors"
            value={String(leadAuditors)}
            detail="Users carrying lead auditor role"
          />

          <KpiCard
            icon={<ClipboardCheck size={15} />}
            label="Assigned Engagements"
            value={String(assignedEngagements)}
            detail={`${activeEngagements} active or draft engagements`}
          />

          <KpiCard
            icon={<AlertTriangle size={15} />}
            label="Open Finding Exposure"
            value={String(
              auditorRecords.reduce(
                (sum, record) => sum + record.openFindingCount,
                0,
              ),
            )}
            detail="Open findings assigned to auditors"
          />
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="border border-slate-200 bg-white xl:col-span-2">
            <SectionHeader
              eyebrow="Team Composition"
              title="Auditor Role Distribution"
              description="Role visibility is derived from the existing tenant user and RBAC model."
            />

            <div className="space-y-4 p-5">
              {roleDistribution.length === 0 ? (
                <div className="border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                  No auditor roles are currently available.
                </div>
              ) : (
                roleDistribution.map(([role, count]) => {
                  const percentage =
                    auditors.length > 0
                      ? Math.round((count / auditors.length) * 100)
                      : 0;

                  return (
                    <div key={role}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">
                          {role}
                        </span>
                        <span className="font-semibold text-slate-950">
                          {count}
                        </span>
                      </div>

                      <div className="mt-2 h-2 bg-slate-100">
                        <div
                          className="h-full bg-slate-900"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="border border-slate-200 bg-white">
            <SectionHeader
              eyebrow="Audit Capacity"
              title="Lead Auditor Workload"
              description="Current engagement ownership based on audit plan assignments."
            />

            <div className="divide-y divide-slate-100">
              {workload.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-slate-500">
                  No audit workload data available.
                </div>
              ) : (
                workload.map((record) => (
                  <button
                    key={record.user.id}
                    type="button"
                    onClick={() =>
                      setSelectedAuditorId(Number(record.user.id))
                    }
                    className="block w-full px-5 py-4 text-left hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-slate-950">
                          {userName(record.user)}
                        </div>

                        <div className="mt-1 text-[10px] text-slate-400">
                          {record.roles.join(" / ") || "No role metadata"}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-lg font-semibold text-slate-950">
                          {record.leadPlans.length}
                        </div>
                        <div className="text-[9px] uppercase tracking-[0.1em] text-slate-400">
                          engagements
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="border border-slate-200 bg-white">
          <SectionHeader
            eyebrow="Auditor Register"
            title="Audit Team"
            description="Tenant-scoped auditor roster with engagement and finding exposure."
          />

          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 xl:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search auditor, email, department or role"
                className="h-10 w-full border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-slate-500"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className="h-10 min-w-[190px] border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none"
            >
              <option value="ALL">All auditor roles</option>
              {Array.from(
                new Set(auditors.flatMap((user) => roleNames(user))),
              ).map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-10 min-w-[150px] border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none"
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Auditor
                  </th>

                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Roles
                  </th>

                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Status
                  </th>

                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Engagements
                  </th>

                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Open Findings
                  </th>

                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Critical
                  </th>

                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Overdue
                  </th>

                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Activity
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredAuditors.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-sm text-slate-500"
                    >
                      No auditor records match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredAuditors.map((record) => (
                    <tr
                      key={record.user.id}
                      onClick={() =>
                        setSelectedAuditorId(Number(record.user.id))
                      }
                      className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-4 py-4">
                        <div className="text-xs font-semibold text-slate-950">
                          {userName(record.user)}
                        </div>

                        <div className="mt-1 text-[11px] text-slate-500">
                          {record.user.email || "No email"}
                        </div>

                        <div className="mt-1 text-[10px] text-slate-400">
                          {record.user.department ||
                            record.user.job_title ||
                            "No organizational metadata"}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex max-w-[280px] flex-wrap gap-1">
                          {record.roles.length > 0 ? (
                            record.roles.map((role) => (
                              <RolePill key={role} value={role} />
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">
                              No role
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <StatusPill active={isActiveUser(record.user)} />
                      </td>

                      <td className="px-4 py-4">
                        <div className="text-sm font-semibold text-slate-950">
                          {record.leadPlans.length}
                        </div>
                        <div className="mt-1 text-[10px] text-slate-400">
                          lead assignments
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="text-sm font-semibold text-slate-950">
                          {record.openFindingCount}
                        </div>
                        <div className="mt-1 text-[10px] text-slate-400">
                          of {record.findingCount} total
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <span className="text-sm font-semibold text-red-700">
                          {record.criticalFindingCount}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <span className="text-sm font-semibold text-amber-700">
                          {record.overdueFindingCount}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <span className="text-sm font-semibold text-slate-700">
                          {record.activityCount}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {selectedAuditor ? (
          <section className="border border-slate-200 bg-white">
            <SectionHeader
              eyebrow="Auditor Detail"
              title={userName(selectedAuditor.user)}
              description="Engagement ownership, finding exposure, and audit activity for the selected auditor."
            />

            <div className="grid grid-cols-1 gap-px bg-slate-200 md:grid-cols-4">
              <div className="bg-white p-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Account
                </div>

                <div className="mt-3 text-sm font-semibold text-slate-950">
                  {selectedAuditor.user.email || "No email"}
                </div>

                <div className="mt-2">
                  <StatusPill
                    active={isActiveUser(selectedAuditor.user)}
                  />
                </div>
              </div>

              <div className="bg-white p-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Roles
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {selectedAuditor.roles.map((role) => (
                    <RolePill key={role} value={role} />
                  ))}
                </div>
              </div>

              <div className="bg-white p-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Findings
                </div>

                <div className="mt-3 text-2xl font-semibold text-slate-950">
                  {selectedAuditor.findingCount}
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  {selectedAuditor.openFindingCount} open
                </div>
              </div>

              <div className="bg-white p-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Activity
                </div>

                <div className="mt-3 text-2xl font-semibold text-slate-950">
                  {selectedAuditor.activityCount}
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  persisted audit events
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 p-5 xl:grid-cols-2">
              <div className="border border-slate-200">
                <div className="border-b border-slate-200 px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Engagement Ownership
                  </div>

                  <div className="mt-1 text-sm font-semibold text-slate-950">
                    Lead Audit Assignments
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {selectedAuditor.leadPlans.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-slate-500">
                      No audit engagements are assigned as lead auditor.
                    </div>
                  ) : (
                    selectedAuditor.leadPlans.map((plan) => (
                      <Link
                        key={plan.id}
                        href={`/audit/planning?plan_id=${plan.id}`}
                        className="block px-4 py-4 hover:bg-slate-50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-semibold text-slate-950">
                              {plan.reference ||
                                `Audit #${plan.id}`}
                            </div>

                            <div className="mt-1 text-xs text-slate-600">
                              {plan.name || "Unnamed engagement"}
                            </div>

                            <div className="mt-2 text-[10px] text-slate-400">
                              {formatDate(plan.planned_start)} -{" "}
                              {formatDate(plan.planned_end)}
                            </div>
                          </div>

                          <span className="border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-semibold uppercase text-slate-600">
                            {plan.status || "N/A"}
                          </span>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>

              <div className="border border-slate-200">
                <div className="border-b border-slate-200 px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Exposure
                  </div>

                  <div className="mt-1 text-sm font-semibold text-slate-950">
                    Auditor Finding Profile
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-px bg-slate-200">
                  <div className="bg-white p-4">
                    <div className="text-[9px] uppercase tracking-[0.12em] text-slate-400">
                      Open
                    </div>

                    <div className="mt-3 text-2xl font-semibold text-slate-950">
                      {selectedAuditor.openFindingCount}
                    </div>
                  </div>

                  <div className="bg-white p-4">
                    <div className="text-[9px] uppercase tracking-[0.12em] text-slate-400">
                      Critical
                    </div>

                    <div className="mt-3 text-2xl font-semibold text-red-700">
                      {selectedAuditor.criticalFindingCount}
                    </div>
                  </div>

                  <div className="bg-white p-4">
                    <div className="text-[9px] uppercase tracking-[0.12em] text-slate-400">
                      Overdue
                    </div>

                    <div className="mt-3 text-2xl font-semibold text-amber-700">
                      {selectedAuditor.overdueFindingCount}
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href="/audit/findings"
                      className="inline-flex items-center gap-2 border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <AlertTriangle size={13} />
                      Findings
                    </Link>

                    <Link
                      href="/audit/execution"
                      className="inline-flex items-center gap-2 border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Activity size={13} />
                      Execution
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="border border-slate-200 bg-white">
          <SectionHeader
            eyebrow="Governance Navigation"
            title="Audit Operating Model"
            description="Move from auditor governance into the operational audit lifecycle."
          />

          <div className="grid grid-cols-1 gap-px bg-slate-200 md:grid-cols-2 xl:grid-cols-5">
            <Link
              href="/audit/planning"
              className="bg-white p-5 hover:bg-slate-50"
            >
              <ClipboardCheck size={18} className="text-slate-500" />
              <div className="mt-3 text-sm font-semibold text-slate-950">
                Planning
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Engagement ownership and scope
              </div>
            </Link>

            <Link
              href="/audit/execution"
              className="bg-white p-5 hover:bg-slate-50"
            >
              <Activity size={18} className="text-slate-500" />
              <div className="mt-3 text-sm font-semibold text-slate-950">
                Execution
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Control testing and conclusions
              </div>
            </Link>

            <Link
              href="/audit/findings"
              className="bg-white p-5 hover:bg-slate-50"
            >
              <AlertTriangle size={18} className="text-slate-500" />
              <div className="mt-3 text-sm font-semibold text-slate-950">
                Findings
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Nonconformity lifecycle
              </div>
            </Link>

            <Link
              href="/audit/analytics"
              className="bg-white p-5 hover:bg-slate-50"
            >
              <BarChart3 size={18} className="text-slate-500" />
              <div className="mt-3 text-sm font-semibold text-slate-950">
                Analytics
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Audit intelligence
              </div>
            </Link>

            <Link
              href="/audit/report"
              className="bg-white p-5 hover:bg-slate-50"
            >
              <FileBarChart size={18} className="text-slate-500" />
              <div className="mt-3 text-sm font-semibold text-slate-950">
                Report
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Executive audit reporting
              </div>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
