import { jwtDecode } from "jwt-decode";

export interface TokenPayload {
  sub: string;
  role?: string;
  roles?: string[];
  user_id: number;
  exp: number;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export function decodeToken(): TokenPayload | null {
  const token = getToken();
  if (!token) return null;

  try {
    return jwtDecode<TokenPayload>(token);
  } catch {
    return null;
  }
}

export function getUserRole(): string | null {
  const decoded = decodeToken();
  if (!decoded) return null;

  if (decoded.roles?.length) {
    const superAdmin = decoded.roles.find((role) => {
      const normalized = role.trim().toLowerCase().replace(/[-\s]+/g, "_");
      return normalized === "super_admin" || normalized === "superadmin";
    });

    if (superAdmin) return superAdmin;
    return decoded.roles[0] ?? null;
  }

  return decoded.role ?? null;
}

export function isSuperAdmin(): boolean {
  const role = getUserRole();
  if (!role) return false;

  const normalized = role.trim().toLowerCase().replace(/[-\s]+/g, "_");
  return normalized === "super_admin" || normalized === "superadmin";
}

export function getUserId(): number | null {
  return decodeToken()?.user_id ?? null;
}

export function isLoggedIn(): boolean {
  const decoded = decodeToken();
  if (!decoded) return false;
  return decoded.exp * 1000 > Date.now();
}

export async function authFetch(
  input: RequestInfo,
  init: RequestInit = {}
) {
  const token = getToken();

  return fetch(input, {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
    },
  });
}

export function logout() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("access_token");
    window.location.href = "/login";
  }
}
