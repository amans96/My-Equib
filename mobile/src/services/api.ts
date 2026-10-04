
import { getToken } from "./storage";

const API_URL = "http://localhost:5000/api";

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();

  const isFormData = options.body instanceof FormData;

  const headers = new Headers(options.headers);

  // JSON requests need Content-Type.
  // FormData must NOT manually set Content-Type because
  // fetch needs to add the multipart boundary automatically.
  if (!isFormData) {
    headers.set("Content-Type", "application/json");
  } else {
    headers.delete("Content-Type");
  }

  // Attach token when available.
  // Login/register requests do not have a token yet,
  // so they are still allowed to continue.
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
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
