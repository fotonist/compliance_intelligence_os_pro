export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

let redirecting = false;

export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token")
      : null;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");

      document.cookie =
        "access_token=; Max-Age=0; path=/; SameSite=Lax";

      if (!redirecting) {
        redirecting = true;
        window.location.replace("/login");
      }
    }

    throw new Error("Session expired");
  }

  return res;
}
export async function getComplianceMatrix() {
  const res = await apiFetch("/matrix");

  if (!res.ok) {
    throw new Error("Failed to load compliance matrix");
  }

  return res.json();
}
