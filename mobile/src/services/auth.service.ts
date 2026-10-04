import { apiRequest } from "./api";

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  profileImage: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    token: string;
  };
}

export async function login(
  phone: string,
  password: string
): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      phone,
      password,
    }),
  });
}

export async function register(data: {
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  password: string;
}): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getMe(token: string) {
  return apiRequest<{
    success: boolean;
    data: User;
  }>("/auth/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}