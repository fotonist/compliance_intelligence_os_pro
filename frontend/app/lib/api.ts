import { DEMO_MODE } from "./demo";
import { mockApiFetch } from "./mock-api";


const API_BASE =
  typeof window === "undefined"
    ? "http://backend:8000"
    : "http://localhost:8000";


export async function apiFetch(
  path: string,
  options: RequestInit = {}
) {

  // =============================
  // DEMO MODE
  // =============================

  if (DEMO_MODE) {

    const mockResponse = await mockApiFetch(path);

    if (mockResponse) {
      return mockResponse;
    }

  }


  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("access_token") ||
        localStorage.getItem("token")
      : null;


  const safePath = path.startsWith("/")
    ? path
    : `/${path}`;


  const headers: HeadersInit = {};


  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }


  if (token) {
    headers["Authorization"] =
      `Bearer ${token}`;
  }


  if (options.headers) {
    Object.assign(headers, options.headers);
  }


  const res = await fetch(
    `${API_BASE}${safePath}`,
    {
      ...options,
      headers,
    }
  );


  if (!res.ok) {


    if (res.status === 401) {

      console.warn(
        "Session expired — redirecting to login"
      );


      if (typeof window !== "undefined") {

        localStorage.removeItem(
          "access_token"
        );

        localStorage.removeItem(
          "token"
        );

        window.location.href = "/login";
      }


      throw new Error(
        "Session expired"
      );
    }



    if (res.status === 404) {

      const text = await res.text();

      throw new Error(
        `NOT FOUND: ${text}`
      );

    }



    const text = await res.text();


    throw new Error(
      `API ERROR ${res.status}: ${text}`
    );

  }


  return res;

}