const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://compliance-intelligence-os-pro-2.onrender.com";

export class AdminApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(
    message: string,
    status: number,
    code: string
  ) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.code = code;
  }
}

function getAdminErrorMessage(
  status: number,
  detail: unknown,
  fallback: string
): { code: string; message: string } {
  const detailText =
    typeof detail === "string"
      ? detail
      : "";

  const normalized = detailText.toLowerCase();

  const validationItems = Array.isArray(detail)
    ? detail
    : [];

  const validationText = validationItems
    .map((item) => {
      if (
        typeof item === "object" &&
        item !== null &&
        "msg" in item
      ) {
        return String(
          (item as { msg?: unknown }).msg ?? ""
        );
      }

      return String(item ?? "");
    })
    .join(" ")
    .toLowerCase();

  const combined =
    `${normalized} ${validationText}`.trim();

  // -------------------------------------------------------
  // Authentication / authorization
  // -------------------------------------------------------

  if (status === 401) {
    return {
      code: "UNAUTHORIZED",
      message:
        "Your session has expired. Please sign in again.",
    };
  }

  if (status === 403) {
    return {
      code: "FORBIDDEN",
      message:
        "You do not have permission to perform this action.",
    };
  }

  // -------------------------------------------------------
  // Resource errors
  // -------------------------------------------------------

  if (status === 404) {
    return {
      code: "NOT_FOUND",
      message:
        "The requested resource could not be found.",
    };
  }

  // -------------------------------------------------------
  // Duplicate / conflict
  // -------------------------------------------------------

  if (
    status === 409 &&
    combined.includes("email already exists")
  ) {
    return {
      code: "EMAIL_ALREADY_EXISTS",
      message:
        "This email address is already registered. Please use a different email address.",
    };
  }

  if (status === 409) {
    return {
      code: "CONFLICT",
      message:
        "This action conflicts with existing data. Please review the information and try again.",
    };
  }

  // -------------------------------------------------------
  // Password policy
  // -------------------------------------------------------

  if (
    combined.includes("password") &&
    (
      combined.includes("12 characters") ||
      combined.includes("uppercase") ||
      combined.includes("lowercase") ||
      combined.includes("number") ||
      combined.includes("special character")
    )
  ) {
    return {
      code: "PASSWORD_POLICY",
      message:
        "The password does not meet the security requirements. Use at least 12 characters, including uppercase and lowercase letters, a number, and a special character.",
    };
  }

  // -------------------------------------------------------
  // Email validation
  // -------------------------------------------------------

  if (
    combined.includes("email") &&
    (
      combined.includes("invalid") ||
      combined.includes("valid email") ||
      combined.includes("email address")
    )
  ) {
    return {
      code: "INVALID_EMAIL",
      message:
        "Please enter a valid email address.",
    };
  }

  // -------------------------------------------------------
  // Tenant / role
  // -------------------------------------------------------

  if (
    combined.includes("tenant") &&
    combined.includes("not found")
  ) {
    return {
      code: "TENANT_NOT_FOUND",
      message:
        "The selected tenant could not be found. Please select a valid tenant.",
    };
  }

  if (
    combined.includes("role") &&
    combined.includes("not found")
  ) {
    return {
      code: "ROLE_NOT_FOUND",
      message:
        "One or more selected roles could not be found. Please review the role selection.",
    };
  }

  // -------------------------------------------------------
  // Validation
  // -------------------------------------------------------

  if (status === 422) {
    return {
      code: "VALIDATION_ERROR",
      message:
        "Some of the information provided is invalid. Please review the form and try again.",
    };
  }

  // -------------------------------------------------------
  // Business / client errors
  // -------------------------------------------------------

  if (status === 400) {
    return {
      code: "BAD_REQUEST",
      message:
        "The request could not be completed. Please review the information and try again.",
    };
  }

  // -------------------------------------------------------
  // Server
  // -------------------------------------------------------

  if (status >= 500) {
    return {
      code: "SERVER_ERROR",
      message:
        "Something went wrong on the server. Please try again later.",
    };
  }

  return {
    code: "REQUEST_FAILED",
    message: fallback,
  };
}

async function handleAdminResponse<T>(
  res: Response,
  fallback: string
): Promise<T> {
  if (res.ok) {
    return (await res.json()) as T;
  }

  let detail: unknown = null;

  try {
    const body = await res.json();
    detail =
      typeof body === "object" &&
      body !== null &&
      "detail" in body
        ? (body as { detail?: unknown }).detail
        : null;
  } catch {
    try {
      detail = await res.text();
    } catch {
      detail = null;
    }
  }

  const error = getAdminErrorMessage(
    res.status,
    detail,
    fallback
  );

  throw new AdminApiError(
    error.message,
    res.status,
    error.code
  );
}
function authHeaders() {
  if (typeof window === "undefined") {
    return {
      "Content-Type": "application/json",
    };
  }

  const token =
    localStorage.getItem("access_token") ??
    sessionStorage.getItem("access_token");

  if (!token) {
    throw new Error("No access token found.");
  }

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// =========================================================
// USERS
// =========================================================

export async function fetchUsers() {
  const res = await fetch(`${BACKEND_URL}/users`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    throw new Error("Failed to load users");
  }

  return res.json();
}

export async function updateUserRoles(
  userId: number,
  roleIds: number[]
) {
  const res = await fetch(
    `${BACKEND_URL}/users/${userId}/roles`,
    {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({
        role_ids: roleIds,
      }),
    }
  );

  if (!res.ok) {
    throw new Error("Failed to update roles");
  }

  return res.json();
}

// =========================================================
// AUDIT
// =========================================================

export async function fetchAuditLogs(params?: {
  entity_type?: string;
  actor_id?: number;
}) {
  const qs = new URLSearchParams();

  if (params?.entity_type) {
    qs.append("entity_type", params.entity_type);
  }

  if (params?.actor_id) {
    qs.append("actor_id", String(params.actor_id));
  }

  const res = await fetch(
    `${BACKEND_URL}/admin/audit-logs?${qs.toString()}`,
    {
      headers: authHeaders(),
    }
  );

  if (!res.ok) {
    throw new Error("Failed to load audit logs");
  }

  return res.json();
}

// =========================================================
// ROLES
// =========================================================

export type RoleManagement = {
  id: number;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  user_count: number;
  permission_count: number;
};

export type Role = {
  id: number;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type RoleStatistics = {
  total_roles: number;
  active_roles: number;
  inactive_roles: number;
  assigned_users: number;
  role_assignments: number;
  total_permissions: number;
};

export type Permission = {
  id: number;
  code: string;
  description: string;
};

export async function fetchRoles(params?: {
  keyword?: string;
  is_active?: boolean;
}): Promise<RoleManagement[]> {
  const qs = new URLSearchParams();

  if (params?.keyword) {
    qs.append("keyword", params.keyword);
  }

  if (params?.is_active !== undefined) {
    qs.append("is_active", String(params.is_active));
  }

  const query = qs.toString();

  const res = await fetch(
    `${BACKEND_URL}/roles/${query ? `?${query}` : ""}`,
    {
      headers: authHeaders(),
    }
  );

  if (!res.ok) {
    throw new Error("Failed to load roles");
  }

  return res.json();
}

export async function fetchRoleStatistics(): Promise<RoleStatistics> {
  const res = await fetch(
    `${BACKEND_URL}/roles/statistics`,
    {
      headers: authHeaders(),
    }
  );

  if (!res.ok) {
    throw new Error("Failed to load role statistics");
  }

  return res.json();
}

export async function fetchRole(
  roleId: number
): Promise<RoleManagement> {
  const res = await fetch(
    `${BACKEND_URL}/roles/${roleId}`,
    {
      headers: authHeaders(),
    }
  );

  if (!res.ok) {
    throw new Error("Failed to load role");
  }

  return res.json();
}

export async function createRole(payload: {
  name: string;
  description?: string | null;
  is_active: boolean;
}): Promise<Role> {
  const res = await fetch(
    `${BACKEND_URL}/roles/`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || "Failed to create role");
  }

  return res.json();
}

export async function updateRole(
  roleId: number,
  payload: {
    name?: string;
    description?: string | null;
    is_active?: boolean;
  }
): Promise<Role> {
  const res = await fetch(
    `${BACKEND_URL}/roles/${roleId}`,
    {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || "Failed to update role");
  }

  return res.json();
}

export async function deactivateRole(
  roleId: number
) {
  const res = await fetch(
    `${BACKEND_URL}/roles/${roleId}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || "Failed to deactivate role");
  }

  return res.json();
}

export async function fetchRoleUsers(
  roleId: number
) {
  const res = await fetch(
    `${BACKEND_URL}/roles/${roleId}/users`,
    {
      headers: authHeaders(),
    }
  );

  if (!res.ok) {
    throw new Error("Failed to load role users");
  }

  return res.json();
}

export async function fetchRolePermissions(
  roleId: number
): Promise<Permission[]> {
  const res = await fetch(
    `${BACKEND_URL}/roles/${roleId}/permissions`,
    {
      headers: authHeaders(),
    }
  );

  if (!res.ok) {
    throw new Error("Failed to load role permissions");
  }

  return res.json();
}

export async function fetchAvailablePermissions(
  roleId: number
): Promise<Permission[]> {
  const res = await fetch(
    `${BACKEND_URL}/roles/${roleId}/permissions/available`,
    {
      headers: authHeaders(),
    }
  );

  if (!res.ok) {
    throw new Error("Failed to load available permissions");
  }

  return res.json();
}

export async function updateRolePermissions(
  roleId: number,
  permissionIds: number[]
) {
  const res = await fetch(
    `${BACKEND_URL}/roles/${roleId}/permissions`,
    {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({
        permission_ids: permissionIds,
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      detail || "Failed to update role permissions"
    );
  }

  return res.json();
}

export async function cloneRole(
  roleId: number,
  newRoleName: string
): Promise<Role> {
  const qs = new URLSearchParams({
    new_role_name: newRoleName,
  });

  const res = await fetch(
    `${BACKEND_URL}/roles/${roleId}/clone?${qs.toString()}`,
    {
      method: "POST",
      headers: authHeaders(),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || "Failed to clone role");
  }

  return res.json();
}

// =========================================================
// LICENSE REQUESTS
// =========================================================

export type PremiumModuleRequest = {
  id: number;
  tenant_id: number;
  requested_by: number;
  module_code: string;
  module_name: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  requested_at: string;
  reviewed_by?: number | null;
  reviewed_at?: string | null;
  review_note?: string | null;
};

export async function fetchLicenseRequests() {
  const res = await fetch(
    `${BACKEND_URL}/company/license/requests`,
    {
      headers: authHeaders(),
    }
  );

  if (!res.ok) {
    throw new Error("Failed to load license requests");
  }

  return (await res.json()) as PremiumModuleRequest[];
}

export async function approveLicenseRequest(
  requestId: number
) {
  const res = await fetch(
    `${BACKEND_URL}/company/license/requests/${requestId}/approve`,
    {
      method: "PATCH",
      headers: authHeaders(),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      detail || "Failed to approve license request"
    );
  }

  return res.json();
}

export async function rejectLicenseRequest(
  requestId: number,
  reviewNote?: string
) {
  const res = await fetch(
    `${BACKEND_URL}/company/license/requests/${requestId}/reject`,
    {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({
        review_note: reviewNote || null,
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      detail || "Failed to reject license request"
    );
  }

  return res.json();
}

 // =========================================================
// TENANTS
// =========================================================

export type AdminTenant = {
  id: number;
  code: string;
  name: string;
  status: "active" | "suspended" | string;
  created_at?: string | null;
  user_count: number;
};

export async function fetchTenants(): Promise<AdminTenant[]> {
  const res = await fetch(
    `${BACKEND_URL}/admin/tenants`,
    {
      headers: authHeaders(),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || "Failed to load tenants");
  }

  return res.json();
}

export async function fetchTenant(
  tenantId: number
): Promise<AdminTenant> {
  const res = await fetch(
    `${BACKEND_URL}/admin/tenants/${tenantId}`,
    {
      headers: authHeaders(),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || "Failed to load tenant");
  }

  return res.json();
}

export async function createTenant(payload: {
  code: string;
  name: string;
  status?: "active" | "suspended";
}): Promise<AdminTenant> {
  const res = await fetch(
    `${BACKEND_URL}/admin/tenants`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        code: payload.code,
        name: payload.name,
        status: payload.status ?? "active",
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || "Failed to create tenant");
  }

  return res.json();
}

export async function updateTenant(
  tenantId: number,
  payload: {
    name?: string;
    status?: "active" | "suspended";
  }
): Promise<AdminTenant> {
  const res = await fetch(
    `${BACKEND_URL}/admin/tenants/${tenantId}`,
    {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || "Failed to update tenant");
  }

  return res.json();
}

// =========================================================
// PLATFORM USER MANAGEMENT
// =========================================================

export type PlatformTenant = {
  id: number;
  code: string;
  name: string;
  status: string;
};

export type PlatformRole = {
  id: number;
  name: string;
};

export type PlatformUser = {
  id: number;
  email: string;
  full_name?: string | null;
  phone?: string | null;
  language?: string | null;
  timezone?: string | null;

  is_active: boolean;
  is_locked: boolean;
  mfa_enabled: boolean;
  must_change_password: boolean;

  last_login_at?: string | null;
  password_last_changed?: string | null;
  created_at?: string | null;
  updated_at?: string | null;

  tenant: PlatformTenant;
  roles: PlatformRole[];
};

export type PlatformUserListResponse = {
  items: PlatformUser[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export async function fetchPlatformUsers(params?: {
  tenant_id?: number;
  role_id?: number;
  is_active?: boolean;
  is_locked?: boolean;
  mfa_enabled?: boolean;
  keyword?: string;
  page?: number;
  page_size?: number;
}): Promise<PlatformUserListResponse> {
  const qs = new URLSearchParams();

  if (params?.tenant_id !== undefined) {
    qs.append("tenant_id", String(params.tenant_id));
  }

  if (params?.role_id !== undefined) {
    qs.append("role_id", String(params.role_id));
  }

  if (params?.is_active !== undefined) {
    qs.append("is_active", String(params.is_active));
  }

  if (params?.is_locked !== undefined) {
    qs.append("is_locked", String(params.is_locked));
  }

  if (params?.mfa_enabled !== undefined) {
    qs.append("mfa_enabled", String(params.mfa_enabled));
  }

  if (params?.keyword?.trim()) {
    qs.append("keyword", params.keyword.trim());
  }

  if (params?.page !== undefined) {
    qs.append("page", String(params.page));
  }

  if (params?.page_size !== undefined) {
    qs.append("page_size", String(params.page_size));
  }

  const query = qs.toString();

  const res = await fetch(
    `${BACKEND_URL}/admin/users${query ? `?${query}` : ""}`,
    {
      headers: authHeaders(),
    }
  );
  return handleAdminResponse<PlatformUserListResponse>(
    res,
    "Unable to load platform users."
  );
}

export async function fetchPlatformUser(
  userId: number
): Promise<PlatformUser> {
  const res = await fetch(
    `${BACKEND_URL}/admin/users/${userId}`,
    {
      headers: authHeaders(),
    }
  );
  return handleAdminResponse<PlatformUser>(
    res,
    "Unable to load platform user."
  );
}

export async function fetchAdminUserTenants(): Promise<
  PlatformTenant[]
> {
  const res = await fetch(
    `${BACKEND_URL}/admin/users/lookup/tenants`,
    {
      headers: authHeaders(),
    }
  );
  return handleAdminResponse<PlatformTenant[]>(
    res,
    "Unable to load user management tenants."
  );
}

export async function fetchAdminUserRoles(): Promise<
  PlatformRole[]
> {
  const res = await fetch(
    `${BACKEND_URL}/admin/users/lookup/roles`,
    {
      headers: authHeaders(),
    }
  );
  return handleAdminResponse<PlatformRole[]>(
    res,
    "Unable to load user management roles."
  );
}

export type PlatformUserCreatePayload = {
  tenant_id: number;
  email: string;
  full_name: string;
  phone?: string | null;
  language?: string;
  timezone?: string;
  role_ids?: number[];
  password?: string;
  must_change_password?: boolean;
  mfa_enabled?: boolean;
  is_active?: boolean;
};

export type PlatformUserUpdatePayload = {
  tenant_id?: number;
  email?: string;
  full_name?: string;
  phone?: string | null;
  language?: string;
  timezone?: string;
  is_active?: boolean;
  mfa_enabled?: boolean;
  must_change_password?: boolean;
};

export type PlatformPasswordResetPayload = {
  new_password: string;
  must_change_password?: boolean;
};

export async function createPlatformUser(
  payload: PlatformUserCreatePayload
): Promise<PlatformUser & {
  temporary_password?: string | null;
}> {
  const res = await fetch(
    `${BACKEND_URL}/admin/users`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    }
  );

  return handleAdminResponse<PlatformUser & { temporary_password?: string | null }>(
    res,
    "Unable to create platform identity."
  );
}

export async function updatePlatformUser(
  userId: number,
  payload: PlatformUserUpdatePayload
): Promise<PlatformUser> {
  const res = await fetch(
    `${BACKEND_URL}/admin/users/${userId}`,
    {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    }
  );
  return handleAdminResponse<PlatformUser>(
    res,
    "Unable to update platform identity."
  );
}

export async function updatePlatformUserRoles(
  userId: number,
  roleIds: number[]
): Promise<PlatformUser> {
  const res = await fetch(
    `${BACKEND_URL}/admin/users/${userId}/roles`,
    {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({
        role_ids: roleIds,
      }),
    }
  );
  return handleAdminResponse<PlatformUser>(
    res,
    "Unable to update user roles."
  );
}

export async function lockPlatformUser(
  userId: number
): Promise<PlatformUser> {
  const res = await fetch(
    `${BACKEND_URL}/admin/users/${userId}/lock`,
    {
      method: "PATCH",
      headers: authHeaders(),
    }
  );
  return handleAdminResponse<PlatformUser>(
    res,
    "Unable to lock user account."
  );
}

export async function unlockPlatformUser(
  userId: number
): Promise<PlatformUser> {
  const res = await fetch(
    `${BACKEND_URL}/admin/users/${userId}/unlock`,
    {
      method: "PATCH",
      headers: authHeaders(),
    }
  );
  return handleAdminResponse<PlatformUser>(
    res,
    "Unable to unlock user account."
  );
}

export async function resetPlatformUserPassword(
  userId: number,
  payload: PlatformPasswordResetPayload
): Promise<PlatformUser> {
  const res = await fetch(
    `${BACKEND_URL}/admin/users/${userId}/reset-password`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    }
  );
  return handleAdminResponse<PlatformUser>(
    res,
    "Unable to reset user password."
  );
}

export async function activatePlatformUser(
  userId: number
): Promise<PlatformUser> {
  const res = await fetch(
    `${BACKEND_URL}/admin/users/${userId}/activate`,
    {
      method: "PATCH",
      headers: authHeaders(),
    }
  );
  return handleAdminResponse<PlatformUser>(
    res,
    "Unable to activate user."
  );
}

export async function deactivatePlatformUser(
  userId: number
): Promise<PlatformUser> {
  const res = await fetch(
    `${BACKEND_URL}/admin/users/${userId}/deactivate`,
    {
      method: "PATCH",
      headers: authHeaders(),
    }
  );
  return handleAdminResponse<PlatformUser>(
    res,
    "Unable to deactivate user."
  );
}
