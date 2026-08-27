const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://compliance-intelligence-os-pro-2.onrender.com";

function authHeaders() {
  if (typeof window === "undefined") {
    return { "Content-Type": "application/json" };
  }

  const token =
    localStorage.getItem("access_token") ??
    sessionStorage.getItem("access_token");

  if (!token) throw new Error("No access token found.");

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `Request failed: ${res.status}`);
  }

  return res.json();
}

export type PlatformUserRole = {
  id: number;
  name: string;
};

export type PlatformUser = {
  id: number;
  tenant_id: number;
  tenant_code: string | null;
  tenant_name: string | null;
  tenant_status: string | null;
  email: string;
  full_name: string | null;
  phone: string | null;
  language: string | null;
  timezone: string | null;
  is_active: boolean;
  is_locked: boolean;
  failed_login_attempts: number;
  must_change_password: boolean;
  mfa_enabled: boolean;
  last_login_at: string | null;
  password_last_changed: string | null;
  created_at: string | null;
  updated_at: string | null;
  roles: PlatformUserRole[];
};

export type CreatePlatformUserPayload = {
  tenant_id: number;
  email: string;
  full_name?: string | null;
  password: string;
  phone?: string | null;
  language?: string;
  timezone?: string;
  is_active?: boolean;
  is_locked?: boolean;
  must_change_password?: boolean;
  mfa_enabled?: boolean;
  role_ids?: number[];
};

export async function fetchPlatformUsers(params?: {
  tenant_id?: number | null;
  keyword?: string;
  role_id?: number | null;
  is_active?: boolean;
  is_locked?: boolean;
  limit?: number;
}): Promise<PlatformUser[]> {
  const qs = new URLSearchParams();
  if (params?.tenant_id) qs.set("tenant_id", String(params.tenant_id));
  if (params?.keyword?.trim()) qs.set("keyword", params.keyword.trim());
  if (params?.role_id) qs.set("role_id", String(params.role_id));
  if (params?.is_active !== undefined) qs.set("is_active", String(params.is_active));
  if (params?.is_locked !== undefined) qs.set("is_locked", String(params.is_locked));
  if (params?.limit) qs.set("limit", String(params.limit));

  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request<PlatformUser[]>(`/admin/users${suffix}`);
}

export async function fetchPlatformUser(userId: number) {
  return request<PlatformUser>(`/admin/users/${userId}`);
}

export async function createPlatformUser(payload: CreatePlatformUserPayload) {
  return request<PlatformUser>("/admin/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updatePlatformUser(
  userId: number,
  payload: Partial<Omit<CreatePlatformUserPayload, "tenant_id" | "email" | "password" | "role_ids">>
) {
  return request<PlatformUser>(`/admin/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function updatePlatformUserRoles(userId: number, roleIds: number[]) {
  return request<PlatformUser>(`/admin/users/${userId}/roles`, {
    method: "PUT",
    body: JSON.stringify({ role_ids: roleIds }),
  });
}

export async function resetPlatformUserPassword(
  userId: number,
  password: string,
  mustChangePassword = true
) {
  return request<{ detail: string }>(`/admin/users/${userId}/reset-password`, {
    method: "POST",
    body: JSON.stringify({ password, must_change_password: mustChangePassword }),
  });
}

export async function activatePlatformUser(userId: number) {
  return request<{ detail: string }>(`/admin/users/${userId}/activate`, { method: "POST" });
}

export async function deactivatePlatformUser(userId: number) {
  return request<{ detail: string }>(`/admin/users/${userId}/deactivate`, { method: "POST" });
}

export async function lockPlatformUser(userId: number) {
  return request<{ detail: string }>(`/admin/users/${userId}/lock`, { method: "POST" });
}

export async function unlockPlatformUser(userId: number) {
  return request<{ detail: string }>(`/admin/users/${userId}/unlock`, { method: "POST" });
}
