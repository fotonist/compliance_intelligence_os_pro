const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function authHeaders() {
  if (typeof window === "undefined") {
    return {
      "Content-Type": "application/json",
    };
  }

  const token = localStorage.getItem("access_token");

  return {
    Authorization: token ? `Bearer ${token}` : "",
    "Content-Type": "application/json",
  };
}

export async function fetchUsers() {
  const res = await fetch(`${BACKEND_URL}/users`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    throw new Error(`Failed to load users (${res.status})`);
  }

  return res.json();
}

export async function updateUserRoles(
  userId: number,
  roleId: number
) {
  const res = await fetch(
    `${BACKEND_URL}/roles/assign/${userId}/${roleId}`,
    {
      method: "POST",
      headers: authHeaders(),
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to update roles (${res.status})`);
  }

  return res.json();
}