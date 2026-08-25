const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://compliance-intelligence-os-pro-2.onrender.com";

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
