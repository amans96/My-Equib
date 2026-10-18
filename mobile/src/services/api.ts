import { getToken } from "./storage";

const API_URL = "http://10.12.25.65:5000/api";

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const isFormData =
    typeof FormData !== "undefined" &&
    options.body instanceof FormData;

  const headers = new Headers(options.headers);

  // Let fetch set the multipart boundary for receipt uploads.
  if (isFormData) {
    headers.delete("Content-Type");
  } else if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Do not attach an old token to login or registration.
  const isPublicAuthRoute =
    endpoint === "/auth/login" ||
    endpoint === "/auth/register";

  if (!isPublicAuthRoute) {
    const token = await getToken();

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type");

  const data = contentType?.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof data === "object" &&
        data !== null &&
        "message" in data
        ? String(data.message)
        : typeof data === "string" && data
          ? data
          : "Something went wrong";

    throw new Error(message);
  }

  return data as T;
}

export const api = {
  get: async <T = any>(endpoint: string, options: RequestInit = {}): Promise<{ data: T }> => {
    const data = await apiRequest<T>(endpoint, { ...options, method: "GET" });
    return { data };
  },
  post: async <T = any>(endpoint: string, body?: any, options: RequestInit = {}): Promise<{ data: T }> => {
    const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
    const data = await apiRequest<T>(endpoint, {
      ...options,
      method: "POST",
      body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { data };
  },
  patch: async <T = any>(endpoint: string, body?: any, options: RequestInit = {}): Promise<{ data: T }> => {
    const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
    const data = await apiRequest<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { data };
  },
  delete: async <T = any>(endpoint: string, options: RequestInit = {}): Promise<{ data: T }> => {
    const data = await apiRequest<T>(endpoint, { ...options, method: "DELETE" });
    return { data };
  },
};