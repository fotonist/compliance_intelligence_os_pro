const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://compliance-intelligence-os-pro-2.onrender.com";

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

export async function fetchUsers() {
  const res = await fetch(`${BACKEND_URL}/users`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load users");
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

export async function fetchAuditLogs(params?: {
  entity_type?: string;
  actor_id?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.entity_type) qs.append("entity_type", params.entity_type);
  if (params?.actor_id) qs.append("actor_id", String(params.actor_id));

  const res = await fetch(
    `${BACKEND_URL}/admin/audit-logs?${qs.toString()}`,
    { headers: authHeaders() }
  );
  if (!res.ok) throw new Error("Failed to load audit logs");
  return res.json();
}

export async function fetchRoles() {
  const res = await fetch(`${BACKEND_URL}/roles`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    throw new Error("Failed to load roles");
  }

  return res.json();
}

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
  const res = await fetch(`${BACKEND_URL}/company/license/requests`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    throw new Error("Failed to load license requests");
  }

  return (await res.json()) as PremiumModuleRequest[];
}

export async function approveLicenseRequest(requestId: number) {
  const res = await fetch(
    `${BACKEND_URL}/company/license/requests/${requestId}/approve`,
    {
      method: "PATCH",
      headers: authHeaders(),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || "Failed to approve license request");
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
    throw new Error(detail || "Failed to reject license request");
  }

  return res.json();
}
