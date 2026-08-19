const API_BASE = process.env.NEXT_PUBLIC_API_URL;

if (!API_BASE) {
  throw new Error("NEXT_PUBLIC_API_URL is not configured");
}

export async function apiFetch(
  path: string,
  options: RequestInit = {}
) {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token") ||
        localStorage.getItem("token")
      : null;

  const safePath = path.startsWith("/")
    ? path
    : `/${path}`;

  // Company Home historically requested legacy KPI/trend endpoints.
  // Keep those client contracts while routing strategic reads through
  // the canonical tenant-safe KPI endpoints.
  const requestPath =
    safePath === "/matrix/kpi"
      ? "/kpi/summary"
      : safePath === "/dashboard/trends"
        ? "/kpi/trends"
        : safePath;

  const headers: HeadersInit = {};

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  const res = await fetch(
    `${API_BASE}${requestPath}`,
    {
      ...options,
      headers,
    }
  );

  if (!res.ok) {
    if (res.status === 401) {
      console.warn("Session expired — redirecting to login");

      if (typeof window !== "undefined") {
        localStorage.removeItem("access_token");
        localStorage.removeItem("token");
        window.location.href = "/login";
      }

      throw new Error("Session expired");
    }

    if (res.status === 404) {
      const text = await res.text();
      throw new Error(`NOT FOUND: ${text}`);
    }

    const text = await res.text();
    throw new Error(`API ERROR ${res.status}: ${text}`);
  }

  return res;
}
