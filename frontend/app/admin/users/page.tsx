"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Check,
  ChevronDown,
  CircleAlert,
  KeyRound,
  Lock,
  Plus,
  Search,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from "lucide-react";

import {
  activatePlatformUser,
  createPlatformUser,
  deactivatePlatformUser,
  fetchAdminUserRoles,
  fetchAdminUserTenants,
  fetchPlatformUser,
  fetchPlatformUsers,
  lockPlatformUser,
  resetPlatformUserPassword,
  unlockPlatformUser,
  updatePlatformUser,
  updatePlatformUserRoles,
  type PlatformRole,
  type PlatformTenant,
  type PlatformUser,
} from "../../../services/admin";

type StatusFilter = "all" | "active" | "inactive" | "locked";
type SecurityFilter = "all" | "mfa_on" | "mfa_off";

type CreateForm = {
  tenant_id: string;
  email: string;
  full_name: string;
  phone: string;
  language: string;
  timezone: string;
  role_ids: number[];
  password: string;
  must_change_password: boolean;
  mfa_enabled: boolean;
  is_active: boolean;
};

type EditForm = {
  tenant_id: string;
  email: string;
  full_name: string;
  phone: string;
  language: string;
  timezone: string;
  must_change_password: boolean;
  mfa_enabled: boolean;
  is_active: boolean;
};

function formatDate(value?: string | null) {
  if (!value) return "Never";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function initials(user: PlatformUser) {
  const source = user.full_name?.trim() || user.email;

  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function SelectField({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-9 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      >
        {children}
      </select>

      <ChevronDown
        size={15}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
    </div>
  );
}

function StatusBadge({
  active,
  locked,
}: {
  active: boolean;
  locked: boolean;
}) {
  if (locked) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
        <Lock size={12} />
        Locked
      </span>
    );
  }

  if (active) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        <Check size={12} />
        Active
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
      Inactive
    </span>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-500">{detail}</p>
        </div>

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
          {icon}
        </div>
      </div>
    </div>
  );
}

function Modal({
  title,
  eyebrow,
  description,
  onClose,
  children,
  footer,
}: {
  title: string;
  eyebrow: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              {eyebrow}
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[72vh] overflow-y-auto px-6 py-6">
          {children}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          {footer}
        </div>
      </div>
    </div>
  );
}

const emptyCreateForm: CreateForm = {
  tenant_id: "",
  email: "",
  full_name: "",
  phone: "",
  language: "en",
  timezone: "UTC",
  role_ids: [],
  password: "",
  must_change_password: true,
  mfa_enabled: false,
  is_active: true,
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [tenants, setTenants] = useState<PlatformTenant[]>([]);
  const [roles, setRoles] = useState<PlatformRole[]>([]);

  const [selectedUser, setSelectedUser] =
    useState<PlatformUser | null>(null);

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  function validateEmail(value: string): string | null {
  const email = value.trim().toLowerCase();

  if (!email) {
    return "Email is required.";
  }

  const parts = email.split("@");

  if (parts.length !== 2) {
    return "Invalid email address.";
  }

  const [localPart, domain] = parts;

  if (!localPart || !domain) {
    return "Invalid email address.";
  }

  if (
    localPart.length > 64 ||
    domain.length > 253 ||
    domain.startsWith(".") ||
    domain.endsWith(".") ||
    domain.includes("..")
  ) {
    return "Invalid email address.";
  }

  if (domain.endsWith(".local")) {
    const internalDomain = domain.slice(0, -".local".length);

    if (
      internalDomain.length > 0 &&
      internalDomain.includes(".")
    ) {
      return null;
    }

    return "Invalid email address.";
  }

  const standardEmailPattern =
    /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;

  if (!standardEmailPattern.test(email)) {
    return "Invalid email address.";
  }

  return null;
}
function validatePasswordStrength(password: string): string | null {
  if (password.length < 12) {
    return "Password must contain at least 12 characters.";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter.";
  }

  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter.";
  }

  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number.";
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must contain at least one special character.";
  }

  return null;
}
const [error, setError] = useState<string | null>(null);
  const [createEmailError, setCreateEmailError] =
    useState<string | null>(null);
  const [editEmailError, setEditEmailError] =
    useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [tenantFilter, setTenantFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");
  const [securityFilter, setSecurityFilter] =
    useState<SecurityFilter>("all");

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  const [createForm, setCreateForm] =
    useState<CreateForm>(emptyCreateForm);

  const [editForm, setEditForm] = useState<EditForm>({
    tenant_id: "",
    email: "",
    full_name: "",
    phone: "",
    language: "en",
    timezone: "UTC",
    must_change_password: false,
    mfa_enabled: false,
    is_active: true,
  });

  const [editedRoleIds, setEditedRoleIds] = useState<number[]>([]);
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordError, setResetPasswordError] =
    useState<string | null>(null);
  const [resetMustChange, setResetMustChange] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const [userResponse, tenantResponse, roleResponse] =
        await Promise.all([
          fetchPlatformUsers({
            page: 1,
            page_size: 200,
          }),
          fetchAdminUserTenants(),
          fetchAdminUserRoles(),
        ]);

      setUsers(userResponse.items);
      setTenants(tenantResponse);
      setRoles(roleResponse);

      setSelectedUser((current) => {
        if (!userResponse.items.length) return null;

        if (!current) return userResponse.items[0];

        return (
          userResponse.items.find(
            (user) => user.id === current.id
          ) || userResponse.items[0]
        );
      });
    } catch (err) {

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load identity data."
      );
    } finally {
      setLoading(false);
    }
  }

  async function refreshSelectedUser(userId: number) {
    const detail = await fetchPlatformUser(userId);

    setUsers((current) =>
      current.map((user) =>
        user.id === detail.id ? detail : user
      )
    );

    setSelectedUser(detail);
  }

  useEffect(() => {
    load();
  }, []);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !term ||
        [
          user.email,
          user.full_name,
          user.tenant.name,
          user.tenant.code,
          ...user.roles.map((role) => role.name),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term);

      const matchesTenant =
        tenantFilter === "all" ||
        String(user.tenant.id) === tenantFilter;

      const matchesRole =
        roleFilter === "all" ||
        user.roles.some(
          (role) => String(role.id) === roleFilter
        );

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && user.is_active) ||
        (statusFilter === "inactive" && !user.is_active) ||
        (statusFilter === "locked" && user.is_locked);

      const matchesSecurity =
        securityFilter === "all" ||
        (securityFilter === "mfa_on" && user.mfa_enabled) ||
        (securityFilter === "mfa_off" && !user.mfa_enabled);

      return (
        matchesSearch &&
        matchesTenant &&
        matchesRole &&
        matchesStatus &&
        matchesSecurity
      );
    });
  }, [
    users,
    search,
    tenantFilter,
    roleFilter,
    statusFilter,
    securityFilter,
  ]);

  const activeCount = users.filter(
    (user) => user.is_active
  ).length;

  const lockedCount = users.filter(
    (user) => user.is_locked
  ).length;

  const mfaCount = users.filter(
    (user) => user.mfa_enabled
  ).length;

  const mfaCoverage = users.length
    ? Math.round((mfaCount / users.length) * 100)
    : 0;

  function openCreateModal() {
    setError(null);
    setNotice(null);
    setCreateEmailError(null);
    setCreateForm({
      ...emptyCreateForm,
      tenant_id:
        tenantFilter !== "all" ? tenantFilter : "",
    });
    setShowCreate(true);
  }

  function openEditModal() {
    if (!selectedUser) return;

    setError(null);
    setNotice(null);
    setEditEmailError(null);

    setEditForm({
      tenant_id: String(selectedUser.tenant.id),
      email: selectedUser.email,
      full_name: selectedUser.full_name || "",
      phone: selectedUser.phone || "",
      language: selectedUser.language || "en",
      timezone: selectedUser.timezone || "UTC",
      must_change_password:
        selectedUser.must_change_password,
      mfa_enabled: selectedUser.mfa_enabled,
      is_active: selectedUser.is_active,
    });

    setShowEdit(true);
  }

  function openRolesModal() {
    if (!selectedUser) return;

    setError(null);
    setNotice(null);
    setEditedRoleIds(
      selectedUser.roles.map((role) => role.id)
    );
    setShowRoles(true);
  }

  function openResetPasswordModal() {
    if (!selectedUser) return;

    setError(null);
    setNotice(null);
    setResetPassword("");
    setResetPasswordError(null);
    setResetMustChange(true);
    setShowResetPassword(true);
  }

  async function handleCreateIdentity() {
    if (!createForm.tenant_id) {
      setError("Tenant is required.");
      return;
    }

    if (!createForm.full_name.trim()) {
      setError("Full name is required.");
      return;
    }

    if (!createForm.email.trim()) {
      setError("Email is required.");
      return;
    }

    const emailError = validateEmail(createForm.email);

    if (emailError) {
      setCreateEmailError(emailError);
      return;
    }

    if (createForm.password.trim()) {
      const passwordError = validatePasswordStrength(
        createForm.password.trim()
      );

      if (passwordError) {
        setError(passwordError);
        return;
      }
    }

    setActionLoading(true);
    setError(null);

    try {
      const created = await createPlatformUser({
        tenant_id: Number(createForm.tenant_id),
        email: createForm.email.trim(),
        full_name: createForm.full_name.trim(),
        phone: createForm.phone.trim() || null,
        language: createForm.language,
        timezone: createForm.timezone,
        role_ids: createForm.role_ids,
        password: createForm.password.trim() || undefined,
        must_change_password:
          createForm.must_change_password,
        mfa_enabled: createForm.mfa_enabled,
        is_active: createForm.is_active,
      });

      await load();

      setSelectedUser(created);
      setShowCreate(false);

      if (created.temporary_password) {
        setNotice(
          `Identity created successfully. Temporary password: ${created.temporary_password}`
        );
      } else {
        setNotice("Identity created successfully.");
      }

      setCreateForm(emptyCreateForm);
    } catch (err) {

      setError(
        err instanceof Error
          ? err.message
          : "Failed to create identity."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUpdateIdentity() {
    if (!selectedUser) return;

    if (!editForm.tenant_id) {
      setError("Tenant is required.");
      return;
    }

    if (!editForm.email.trim()) {
      setError("Email is required.");
      return;
    }

    const emailError = validateEmail(editForm.email);

    if (emailError) {
      setEditEmailError(emailError);
      return;
    }
setActionLoading(true);
    setError(null);

    try {
      const updated = await updatePlatformUser(
        selectedUser.id,
        {
          tenant_id: Number(editForm.tenant_id),
          email: editForm.email.trim(),
          full_name: editForm.full_name.trim(),
          phone: editForm.phone.trim() || null,
          language: editForm.language,
          timezone: editForm.timezone,
          must_change_password:
            editForm.must_change_password,
          mfa_enabled: editForm.mfa_enabled,
          is_active: editForm.is_active,
        }
      );

      setUsers((current) =>
        current.map((user) =>
          user.id === updated.id ? updated : user
        )
      );

      setSelectedUser(updated);
      setShowEdit(false);
      setNotice("Identity updated successfully.");
    } catch (err) {

      setError(
        err instanceof Error
          ? err.message
          : "Failed to update identity."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUpdateRoles() {
    if (!selectedUser) return;
setActionLoading(true);
    setError(null);

    try {
      const updated = await updatePlatformUserRoles(
        selectedUser.id,
        editedRoleIds
      );

      setUsers((current) =>
        current.map((user) =>
          user.id === updated.id ? updated : user
        )
      );

      setSelectedUser(updated);
      setShowRoles(false);
      setNotice("Roles updated successfully.");
    } catch (err) {

      setError(
        err instanceof Error
          ? err.message
          : "Failed to update roles."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleToggleLock() {
    if (!selectedUser) return;

    if (createForm.password.trim()) {
      const passwordError = validatePasswordStrength(
        createForm.password.trim()
      );

      if (passwordError) {
        setError(passwordError);
        return;
      }
    }

    setActionLoading(true);
    setError(null);

    try {
      if (selectedUser.is_locked) {
        await unlockPlatformUser(selectedUser.id);
        setNotice("Account unlocked successfully.");
      } else {
        await lockPlatformUser(selectedUser.id);
        setNotice("Account locked successfully.");
      }

      await refreshSelectedUser(selectedUser.id);
    } catch (err) {

      setError(
        err instanceof Error
          ? err.message
          : "Failed to update account lock state."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleToggleActive() {
    if (!selectedUser) return;

    if (createForm.password.trim()) {
      const passwordError = validatePasswordStrength(
        createForm.password.trim()
      );

      if (passwordError) {
        setError(passwordError);
        return;
      }
    }

    setActionLoading(true);
    setError(null);

    try {
      if (selectedUser.is_active) {
        await deactivatePlatformUser(selectedUser.id);
        setNotice("Identity deactivated successfully.");
      } else {
        await activatePlatformUser(selectedUser.id);
        setNotice("Identity activated successfully.");
      }

      await refreshSelectedUser(selectedUser.id);
    } catch (err) {

      setError(
        err instanceof Error
          ? err.message
          : "Failed to update account status."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!selectedUser) return;

    const passwordError = validatePasswordStrength(
      resetPassword
    );

    if (passwordError) {
      setResetPasswordError(passwordError);
      return;
    }


    setActionLoading(true);
    setResetPasswordError(null);

    try {
      await resetPlatformUserPassword(
        selectedUser.id,
        {
          new_password: resetPassword,
          must_change_password: resetMustChange,
        }
      );

      await refreshSelectedUser(selectedUser.id);
      setShowResetPassword(false);
      setNotice("Password reset successfully.");
    } catch (err) {

      setResetPasswordError(
        err instanceof Error
          ? err.message
          : "Failed to reset password."
      );
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fa] px-8 py-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="h-8 w-72 animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-4 w-96 animate-pulse rounded bg-slate-200" />

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-28 animate-pulse rounded-xl bg-white shadow-sm ring-1 ring-slate-200"
              />
            ))}
          </div>

          <div className="mt-6 h-[500px] animate-pulse rounded-xl bg-white shadow-sm ring-1 ring-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-slate-900">
      <div className="mx-auto max-w-[1600px] px-6 py-7 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              <ShieldCheck size={15} />
              Administration
              <span className="text-slate-300">/</span>
              Identity & Access
            </div>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Identity & Access
            </h1>

            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Platform-wide identity administration across all tenants.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 md:flex">
              <Activity size={14} />
              Platform scope
            </div>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
            >
              <Plus size={15} />
              Create Identity
            </button>
          </div>
        </header>

        {error && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <CircleAlert size={17} className="mt-0.5 shrink-0" />
            <div className="flex-1 break-words">{error}</div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {notice && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <Check size={17} className="mt-0.5 shrink-0" />
            <div className="flex-1 break-words">{notice}</div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-emerald-500 hover:text-emerald-700"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<Users size={17} />}
            label="Total identities"
            value={users.length}
            detail="Across all platform tenants"
          />

          <MetricCard
            icon={<Check size={17} />}
            label="Active"
            value={activeCount}
            detail={`${users.length ? Math.round((activeCount / users.length) * 100) : 0}% of identities`}
          />

          <MetricCard
            icon={<Lock size={17} />}
            label="Locked"
            value={lockedCount}
            detail="Accounts requiring intervention"
          />

          <MetricCard
            icon={<ShieldCheck size={17} />}
            label="MFA coverage"
            value={`${mfaCoverage}%`}
            detail={`${mfaCount} identities protected`}
          />
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search identities, tenants or roles..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:w-[620px] xl:grid-cols-4">
              <SelectField
                value={tenantFilter}
                onChange={setTenantFilter}
              >
                <option value="all">All tenants</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.code} · {tenant.name}
                  </option>
                ))}
              </SelectField>

              <SelectField
                value={roleFilter}
                onChange={setRoleFilter}
              >
                <option value="all">All roles</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </SelectField>

              <SelectField
                value={statusFilter}
                onChange={(value) =>
                  setStatusFilter(value as StatusFilter)
                }
              >
                <option value="all">All status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="locked">Locked</option>
              </SelectField>

              <SelectField
                value={securityFilter}
                onChange={(value) =>
                  setSecurityFilter(value as SecurityFilter)
                }
              >
                <option value="all">All security</option>
                <option value="mfa_on">MFA enabled</option>
                <option value="mfa_off">MFA disabled</option>
              </SelectField>
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 text-xs text-slate-500">
            <span>
              Showing {filteredUsers.length} of {users.length} identities
            </span>
            <span>Platform scope</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-5 py-3 font-medium">Identity</th>
                  <th className="px-5 py-3 font-medium">Tenant</th>
                  <th className="px-5 py-3 font-medium">Roles</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">MFA</th>
                  <th className="px-5 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-14 text-center text-sm text-slate-500"
                    >
                      No identities match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      className={`cursor-pointer transition hover:bg-slate-50 ${
                        selectedUser?.id === user.id
                          ? "bg-slate-50"
                          : ""
                      }`}
                      onClick={() => {
                        setSelectedUser(user);
                        setDetailLoading(true);

                        fetchPlatformUser(user.id)
                          .then(setSelectedUser)
                          .catch((err) =>
                            setError(
                              err instanceof Error
                                ? err.message
                                : "Failed to load identity."
                            )
                          )
                          .finally(() => setDetailLoading(false));
                      }}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-semibold text-white">
                            {initials(user)}
                          </div>

                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900">
                              {user.full_name || user.email}
                            </div>
                            <div className="mt-0.5 truncate text-xs text-slate-500">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="text-sm font-medium text-slate-700">
                          {user.tenant.name}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-400">
                          {user.tenant.code}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex max-w-[300px] flex-wrap gap-1.5">
                          {user.roles.length ? (
                            user.roles.map((role) => (
                              <span
                                key={role.id}
                                className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600"
                              >
                                {role.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">
                              No roles
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge
                          active={user.is_active}
                          locked={user.is_locked}
                        />
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`text-xs font-medium ${
                            user.mfa_enabled
                              ? "text-emerald-600"
                              : "text-slate-400"
                          }`}
                        >
                          {user.mfa_enabled
                            ? "Enabled"
                            : "Disabled"}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedUser(user);
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {selectedUser && (
          <aside className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white">
                    {initials(selectedUser)}
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">
                      Identity detail
                    </div>
                    <h2 className="mt-1 text-xl font-semibold text-slate-950">
                      {selectedUser.full_name || selectedUser.email}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {selectedUser.email}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <StatusBadge
                    active={selectedUser.is_active}
                    locked={selectedUser.is_locked}
                  />

                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                      selectedUser.mfa_enabled
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-50 text-slate-500"
                    }`}
                  >
                    {selectedUser.mfa_enabled
                      ? "MFA enabled"
                      : "MFA disabled"}
                  </span>
                </div>
              </div>
            </div>

            {detailLoading ? (
              <div className="p-8 text-sm text-slate-500">
                Loading identity details...
              </div>
            ) : (
              <div className="grid gap-5 p-6 xl:grid-cols-3">
                <div className="rounded-xl border border-slate-200">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <div className="text-sm font-semibold text-slate-900">
                      Identity
                    </div>
                  </div>

                  <dl className="space-y-4 p-4">
                    <div>
                      <dt className="text-xs text-slate-400">
                        Full name
                      </dt>
                      <dd className="mt-1 text-sm font-medium text-slate-700">
                        {selectedUser.full_name || "—"}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs text-slate-400">
                        Email
                      </dt>
                      <dd className="mt-1 break-all text-sm font-medium text-slate-700">
                        {selectedUser.email}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs text-slate-400">
                        Tenant
                      </dt>
                      <dd className="mt-1 text-sm font-medium text-slate-700">
                        {selectedUser.tenant.name}
                      </dd>
                      <dd className="text-xs text-slate-400">
                        {selectedUser.tenant.code}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs text-slate-400">
                        Created
                      </dt>
                      <dd className="mt-1 text-sm font-medium text-slate-700">
                        {formatDate(selectedUser.created_at)}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-xl border border-slate-200">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <div className="text-sm font-semibold text-slate-900">
                      Security
                    </div>
                  </div>

                  <dl className="space-y-4 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-sm text-slate-600">
                        Account status
                      </dt>
                      <dd className="text-sm font-medium text-slate-700">
                        {selectedUser.is_active
                          ? "Active"
                          : "Inactive"}
                      </dd>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-sm text-slate-600">
                        Account lock
                      </dt>
                      <dd className="text-sm font-medium text-slate-700">
                        {selectedUser.is_locked
                          ? "Locked"
                          : "Unlocked"}
                      </dd>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-sm text-slate-600">
                        MFA
                      </dt>
                      <dd className="text-sm font-medium text-slate-700">
                        {selectedUser.mfa_enabled
                          ? "Enabled"
                          : "Disabled"}
                      </dd>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-sm text-slate-600">
                        Password policy
                      </dt>
                      <dd className="text-sm font-medium text-slate-700">
                        {selectedUser.must_change_password
                          ? "Change required"
                          : "Compliant"}
                      </dd>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-sm text-slate-600">
                        Last sign-in
                      </dt>
                      <dd className="text-right text-xs font-medium text-slate-500">
                        {formatDate(selectedUser.last_login_at)}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-xl border border-slate-200">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <div className="text-sm font-semibold text-slate-900">
                      Roles
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 p-4">
                    {selectedUser.roles.length ? (
                      selectedUser.roles.map((role) => (
                        <span
                          key={role.id}
                          className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600"
                        >
                          {role.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">
                        No roles assigned
                      </span>
                    )}
                  </div>

                  <div className="border-t border-slate-100 p-4">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={openEditModal}
                        disabled={actionLoading}
                        className="h-10 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Edit identity
                      </button>

                      <button
                        type="button"
                        onClick={openRolesModal}
                        disabled={actionLoading}
                        className="h-10 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Manage roles
                      </button>

                      <button
                        type="button"
                        onClick={openResetPasswordModal}
                        disabled={actionLoading}
                        className="h-10 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Reset password
                      </button>

                      <button
                        type="button"
                        onClick={handleToggleLock}
                        disabled={actionLoading}
                        className="h-10 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {selectedUser.is_locked
                          ? "Unlock account"
                          : "Lock account"}
                      </button>

                      <button
                        type="button"
                        onClick={handleToggleActive}
                        disabled={actionLoading}
                        className="col-span-2 h-10 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {selectedUser.is_active
                          ? "Deactivate identity"
                          : "Activate identity"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {showCreate && (
        <Modal
          title="Create Identity"
          eyebrow="Platform Administration"
          description="Create a platform identity and assign it to a tenant."
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                disabled={actionLoading}
                className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleCreateIdentity}
                disabled={actionLoading}
                className="h-10 rounded-lg bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {actionLoading ? "Creating..." : "Create identity"}
              </button>
            </>
          }
        >
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="mb-1.5 block text-xs font-medium text-slate-600">
                  Tenant *
                </span>
                <SelectField
                  value={createForm.tenant_id}
                  onChange={(value) =>
                    setCreateForm((current) => ({
                      ...current,
                      tenant_id: value,
                    }))
                  }
                >
                  <option value="">Select tenant</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.code} · {tenant.name}
                    </option>
                  ))}
                </SelectField>
              </label>

              <label>
                <span className="mb-1.5 block text-xs font-medium text-slate-600">
                  Full name *
                </span>
                <input
                  value={createForm.full_name}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      full_name: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  placeholder="Jane Doe"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="mb-1.5 block text-xs font-medium text-slate-600">
                  Email *
                </span>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(event) => {
                    setCreateForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }));
                    setCreateEmailError(null);
                  }}
                  className={`h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2 ${
                    createEmailError
                      ? "border-red-300 focus:border-red-400 focus:ring-red-50"
                      : "border-slate-200 focus:border-slate-400 focus:ring-slate-100"
                  }`}
                  placeholder="jane.doe@example.com"
                />
                {createEmailError && (
                  <div className="mt-1.5 text-xs text-red-600">
                    {createEmailError}
                  </div>
                )}
              </label>

              <label>
                <span className="mb-1.5 block text-xs font-medium text-slate-600">
                  Phone
                </span>
                <input
                  value={createForm.phone}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                  placeholder="+90..."
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="mb-1.5 block text-xs font-medium text-slate-600">
                  Language
                </span>
                <input
                  value={createForm.language}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      language: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                />
              </label>

              <label>
                <span className="mb-1.5 block text-xs font-medium text-slate-600">
                  Timezone
                </span>
                <input
                  value={createForm.timezone}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      timezone: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                />
              </label>
            </div>

            <label>
              <span className="mb-2 block text-xs font-medium text-slate-600">
                Initial roles
              </span>

              <div className="grid gap-2 sm:grid-cols-2">
                {roles.map((role) => {
                  const checked = createForm.role_ids.includes(
                    role.id
                  );

                  return (
                    <label
                      key={role.id}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-3 transition ${
                        checked
                          ? "border-slate-400 bg-slate-50"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <span className="text-sm font-medium text-slate-700">
                        {role.name}
                      </span>

                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          setCreateForm((current) => ({
                            ...current,
                            role_ids: event.target.checked
                              ? [
                                  ...current.role_ids,
                                  role.id,
                                ]
                              : current.role_ids.filter(
                                  (id) => id !== role.id
                                ),
                          }));
                        }}
                      />
                    </label>
                  );
                })}
              </div>
            </label>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-800">
                Account security
              </div>

              <div className="mt-4 space-y-3">
                <label className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-slate-700">
                      Temporary password
                    </div>
                    <div className="text-xs text-slate-400">
                      Leave empty to generate one automatically.
                    </div>
                  </div>

                  <input
                    type="password"
                    value={createForm.password}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    placeholder="Optional"
                    className="h-10 w-56 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
                  />
                </label>

                <label className="flex items-center justify-between gap-4 border-t border-slate-200 pt-3">
                  <div>
                    <div className="text-sm font-medium text-slate-700">
                      Require password change
                    </div>
                    <div className="text-xs text-slate-400">
                      Force change at next sign-in.
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={createForm.must_change_password}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        must_change_password:
                          event.target.checked,
                      }))
                    }
                  />
                </label>

                <label className="flex items-center justify-between gap-4 border-t border-slate-200 pt-3">
                  <div>
                    <div className="text-sm font-medium text-slate-700">
                      Multi-factor authentication
                    </div>
                    <div className="text-xs text-slate-400">
                      Enable MFA requirement for the identity.
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={createForm.mfa_enabled}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        mfa_enabled: event.target.checked,
                      }))
                    }
                  />
                </label>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {showEdit && selectedUser && (
        <Modal
          title="Edit Identity"
          eyebrow="Identity Administration"
          description={`Update ${selectedUser.email}.`}
          onClose={() => setShowEdit(false)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setShowEdit(false)}
                disabled={actionLoading}
                className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleUpdateIdentity}
                disabled={actionLoading}
                className="h-10 rounded-lg bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {actionLoading ? "Saving..." : "Save changes"}
              </button>
            </>
          }
        >
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="mb-1.5 block text-xs font-medium text-slate-600">
                  Tenant *
                </span>
                <SelectField
                  value={editForm.tenant_id}
                  onChange={(value) =>
                    setEditForm((current) => ({
                      ...current,
                      tenant_id: value,
                    }))
                  }
                >
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.code} · {tenant.name}
                    </option>
                  ))}
                </SelectField>
              </label>

              <label>
                <span className="mb-1.5 block text-xs font-medium text-slate-600">
                  Full name
                </span>
                <input
                  value={editForm.full_name}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      full_name: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                />
              </label>
            </div>

            <label>
              <span className="mb-1.5 block text-xs font-medium text-slate-600">
                Email
              </span>
              <input
                type="email"
                value={editForm.email}
                onChange={(event) => {
                  setEditForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }));
                  setEditEmailError(null);
                }}
                className={`h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2 ${
                  editEmailError
                    ? "border-red-300 focus:border-red-400 focus:ring-red-50"
                    : "border-slate-200 focus:border-slate-400 focus:ring-slate-100"
                }`}
              />
              {editEmailError && (
                <div className="mt-1.5 text-xs text-red-600">
                  {editEmailError}
                </div>
              )}
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="mb-1.5 block text-xs font-medium text-slate-600">
                  Phone
                </span>
                <input
                  value={editForm.phone}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                />
              </label>

              <label>
                <span className="mb-1.5 block text-xs font-medium text-slate-600">
                  Language
                </span>
                <input
                  value={editForm.language}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      language: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                />
              </label>
            </div>

            <label>
              <span className="mb-1.5 block text-xs font-medium text-slate-600">
                Timezone
              </span>
              <input
                value={editForm.timezone}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    timezone: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
              />
            </label>

            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">
                  Active account
                </span>
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      is_active: event.target.checked,
                    }))
                  }
                />
              </label>

              <label className="flex items-center justify-between border-t border-slate-200 pt-3">
                <span className="text-sm font-medium text-slate-700">
                  MFA enabled
                </span>
                <input
                  type="checkbox"
                  checked={editForm.mfa_enabled}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      mfa_enabled: event.target.checked,
                    }))
                  }
                />
              </label>

              <label className="flex items-center justify-between border-t border-slate-200 pt-3">
                <span className="text-sm font-medium text-slate-700">
                  Require password change
                </span>
                <input
                  type="checkbox"
                  checked={editForm.must_change_password}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      must_change_password:
                        event.target.checked,
                    }))
                  }
                />
              </label>
            </div>
          </div>
        </Modal>
      )}

      {showRoles && selectedUser && (
        <Modal
          title="Manage Roles"
          eyebrow="Authorization Administration"
          description={`Update role assignments for ${selectedUser.email}.`}
          onClose={() => setShowRoles(false)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setShowRoles(false)}
                disabled={actionLoading}
                className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleUpdateRoles}
                disabled={actionLoading}
                className="h-10 rounded-lg bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {actionLoading ? "Saving..." : "Save roles"}
              </button>
            </>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {roles.map((role) => {
              const assigned = editedRoleIds.includes(role.id);

              return (
                <label
                  key={role.id}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition ${
                    assigned
                      ? "border-slate-400 bg-slate-50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-800">
                      {role.name}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      Role ID {role.id}
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={assigned}
                    onChange={(event) =>
                      setEditedRoleIds((current) =>
                        event.target.checked
                          ? current.includes(role.id)
                            ? current
                            : [...current, role.id]
                          : current.filter(
                              (id) => id !== role.id
                            )
                      )
                    }
                  />
                </label>
              );
            })}
          </div>
        </Modal>
      )}

      {showResetPassword && selectedUser && (
        <Modal
          title="Reset password"
          eyebrow="Security Administration"
          description={`Reset credentials for ${selectedUser.email}.`}
          onClose={() => setShowResetPassword(false)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setShowResetPassword(false)}
                disabled={actionLoading}
                className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleResetPassword}
                disabled={actionLoading}
                className="h-10 rounded-lg bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {actionLoading ? "Resetting..." : "Reset password"}
              </button>
            </>
          }
        >
          <div className="space-y-5">
            <label>
              <span className="mb-1.5 block text-xs font-medium text-slate-600">
                New password
              </span>
              <input
                type="password"
                value={resetPassword}
                onChange={(event) => {
                  setResetPassword(event.target.value);
                  setResetPasswordError(null);
                }}
                placeholder="Minimum 12 characters"
                className={`h-11 w-full rounded-lg border px-3 text-sm outline-none focus:border-slate-400 ${
                  resetPasswordError
                    ? "border-red-300"
                    : "border-slate-200"
                }`}
              />

              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="mb-2 text-xs font-medium text-slate-600">
                  Password requirements
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className={
                    resetPassword.length >= 12
                      ? "text-emerald-600"
                      : "text-slate-400"
                  }>
                    {resetPassword.length >= 12 ? "✓" : "○"} At least 12 characters
                  </div>

                  <div className={
                    /[A-Z]/.test(resetPassword)
                      ? "text-emerald-600"
                      : "text-slate-400"
                  }>
                    {/[A-Z]/.test(resetPassword) ? "✓" : "○"} One uppercase letter
                  </div>

                  <div className={
                    /[a-z]/.test(resetPassword)
                      ? "text-emerald-600"
                      : "text-slate-400"
                  }>
                    {/[a-z]/.test(resetPassword) ? "✓" : "○"} One lowercase letter
                  </div>

                  <div className={
                    /[0-9]/.test(resetPassword)
                      ? "text-emerald-600"
                      : "text-slate-400"
                  }>
                    {/[0-9]/.test(resetPassword) ? "✓" : "○"} One number
                  </div>

                  <div className={
                    /[^A-Za-z0-9]/.test(resetPassword)
                      ? "text-emerald-600"
                      : "text-slate-400"
                  }>
                    {/[^A-Za-z0-9]/.test(resetPassword) ? "✓" : "○"} One special character
                  </div>
                </div>
              </div>

              {resetPasswordError && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  {resetPasswordError}
                </div>
              )}
            </label>

            <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div>
                <div className="text-sm font-medium text-slate-700">
                  Require password change
                </div>
                <div className="mt-0.5 text-xs text-slate-400">
                  Force the user to change the password at next sign-in.
                </div>
              </div>

              <input
                type="checkbox"
                checked={resetMustChange}
                onChange={(event) =>
                  setResetMustChange(event.target.checked)
                }
              />
            </label>

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              The new password will be applied immediately.
            </div>
          </div>
        </Modal>
      )}

      {notice && (
        <div className="fixed bottom-6 right-6 z-[90] max-w-md rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-xl">
          <div className="flex items-start gap-3">
            <Check
              size={17}
              className="mt-0.5 shrink-0 text-emerald-600"
            />
            <div className="text-sm text-slate-700">{notice}</div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-slate-400 hover:text-slate-700"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
