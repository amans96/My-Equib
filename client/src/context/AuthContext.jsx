
import { createContext, useEffect, useState } from "react";
import {
  login as loginApi,
  register as registerApi,
  getAccount,
  logout as logoutApi,
} from "../services/authApi";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  const isAuthenticated = Boolean(token && user);

  // Load the authenticated user's account when the app starts
  useEffect(() => {
    const loadAccount = async () => {
      const storedToken = localStorage.getItem("token");

      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const response = await getAccount();

        const account = response.user || response.data?.user || response;

        setUser(account);
        setToken(storedToken);
        localStorage.setItem("user", JSON.stringify(account));
      } catch (error) {
        console.error("Failed to load account:", error);

        localStorage.removeItem("token");
        localStorage.removeItem("user");

        setUser(null);
        setToken(null);
      } finally {
        setLoading(false);
      }
    };

    loadAccount();
  }, []);

  const login = async (credentials) => {
    const response = await loginApi(credentials);

    const receivedToken =
      response.token ||
      response.accessToken ||
      response.data?.token ||
      response.data?.accessToken;

    const receivedUser =
      response.user ||
      response.data?.user;

    if (!receivedToken) {
      throw new Error("Login succeeded but no authentication token was returned.");
    }

    localStorage.setItem("token", receivedToken);

    setToken(receivedToken);

    if (receivedUser) {
      localStorage.setItem("user", JSON.stringify(receivedUser));
      setUser(receivedUser);
    } else {
      // If login doesn't return the user, fetch it from the account endpoint.
      const accountResponse = await getAccount();

      const account =
        accountResponse.user ||
        accountResponse.data?.user ||
        accountResponse;

      localStorage.setItem("user", JSON.stringify(account));
      setUser(account);
    }

    return response;
  };

  const register = async (userData) => {
    return registerApi(userData);
  };

  const logout = () => {
    logoutApi();

    setUser(null);
    setToken(null);
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

