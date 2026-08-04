const API_BASE = "http://localhost:8000";

let redirecting = false;

export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = localStorage.getItem("access_token");

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  // Session expired / invalid token
  if (res.status === 401) {
    // Remove local tokens
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");

    // Remove cookie if one exists
    document.cookie =
      "access_token=; Max-Age=0; path=/; SameSite=Lax";

    // Prevent multiple redirects
    if (!redirecting) {
      redirecting = true;
      window.location.replace("/login");
    }

    throw new Error("Session expired");
  }

  return res;
}