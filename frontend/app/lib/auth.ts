
import { jwtDecode } from "jwt-decode";
export interface TokenPayload {
  sub: string;
  role: string;
  user_id: number;
  exp: number;
}

/**
 * Returns access token from localStorage
 */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

/**
 * Decodes JWT token payload
 */
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
  return decodeToken()?.role ?? null;
}

export function getUserId(): number | null {
  return decodeToken()?.user_id ?? null;
}

export function isLoggedIn(): boolean {
  const decoded = decodeToken();
  if (!decoded) return false;
  return decoded.exp * 1000 > Date.now();
}

/**
 * Centralized authenticated fetch helper
 * Used across admin & protected endpoints
 */
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

