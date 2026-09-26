"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "@/lib/api";

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone_number: string;
  roles: string[];
  supplier_id?: string;
  buyer_id?: string;
  kyc_status?: string;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  phone_number: string;
  role: "BUYER" | "SUPPLIER";
  business_name?: string;
  buyer_type?: string;
}

export type BootStage = "connect" | "session" | "profile" | "done";

interface AuthContextType {
  user: User | null;
  token: string | null;
  role: string | null;
  kycStatus: string | null;
  loading: boolean;
  bootStage: BootStage;
  sessionNotice: string | null;
  login: (email: string, password: string) => Promise<any>;
  register: (data: RegisterData) => Promise<any>;
  logout: () => void;
  switchUser: (role: "ADMIN" | "SUPPLIER" | "BUYER" | "DRIVER") => Promise<void>;
  refreshUser: () => Promise<void>;
  clearSessionNotice: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  // Only show the boot splash when a saved session exists to verify —
  // a fresh visit goes straight to the login screen.
  const [loading, setLoading] = useState(
    () => typeof window !== "undefined" && !!localStorage.getItem("token")
  );
  const [bootStage, setBootStage] = useState<BootStage>("connect");

  const fetchCurrentUser = async () => {
    setBootStage("session");
    try {
      const data = await api.auth.getMe();
      setBootStage("profile");
      setUser(data);
    } catch {
      setUser(null);
      localStorage.removeItem("token");
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    if (savedToken) {
      setToken(savedToken);
      fetchCurrentUser();
    }

    const handleUnauthorized = () => {
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
      setLoading(false);
      setSessionNotice("Your session has expired. Please sign in again.");
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, []);

  const login = async (email: string, password: string) => {
    setBootStage("connect");
    setLoading(true);
    setSessionNotice(null);
    try {
      const res = await api.auth.login({ email, password });
      localStorage.setItem("token", res.access_token);
      setToken(res.access_token);
      await fetchCurrentUser();
      return res;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const register = async (data: RegisterData) => {
    setBootStage("connect");
    setLoading(true);
    setSessionNotice(null);
    try {
      const res = await api.auth.register(data);
      localStorage.setItem("token", res.access_token);
      setToken(res.access_token);
      await fetchCurrentUser();
      return res;
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setSessionNotice(null);
  };

  const switchUser = async (targetRole: "ADMIN" | "SUPPLIER" | "BUYER" | "DRIVER") => {
    const creds = {
      ADMIN: { email: "admin@thechickenman.com", password: "Password@123" },
      SUPPLIER: { email: "supplier1@thechickenman.com", password: "Password@123" },
      BUYER: { email: "buyer1@thechickenman.com", password: "Password@123" },
      DRIVER: { email: "driver@thechickenman.com", password: "Password@123" },
    };

    setLoading(true);
    try {
      await login(creds[targetRole].email, creds[targetRole].password);
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    if (token) {
      await fetchCurrentUser();
    }
  };

  const currentRole = user?.roles?.[0] || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role: currentRole,
        kycStatus: user?.kyc_status || null,
        loading,
        bootStage,
        sessionNotice,
        login,
        register,
        logout,
        switchUser,
        refreshUser,
        clearSessionNotice: () => setSessionNotice(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
