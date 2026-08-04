const BACKEND_URL =
  typeof window === "undefined"
    ? "http://backend:8000"
    : "http://localhost:8000";

function authHeaders() {
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