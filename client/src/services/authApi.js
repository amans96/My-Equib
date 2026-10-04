
import api from "./api";

/**
 * Register a new user
 */
export const register = async (userData) => {
  const response = await api.post("/auth/register", userData);
  return response.data;
};

/**
 * Login user
 */
export const login = async (credentials) => {
  const response = await api.post("/auth/login", credentials);
  return response.data;
};

/**
 * Get currently authenticated user's account
 */
export const getAccount = async () => {
  const response = await api.get("/auth/account");
  return response.data;
};

/**
 * Logout
 *
 * Authentication is JWT-based, so there may not be
 * a backend logout endpoint. Removing the token is
 * enough on the client side.
 */
export const logout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

