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

interface AuthContextType {
  user: User | null;
  token: string | null;
  role: string | null;
  kycStatus: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<any>;
  logout: () => void;
  switchUser: (role: "ADMIN" | "SUPPLIER" | "BUYER" | "DRIVER") => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = async () => {
    try {
      const data = await api.auth.getMe();
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
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.auth.login({ email, password });
    localStorage.setItem("token", res.access_token);
    setToken(res.access_token);
    await fetchCurrentUser();
    return res;
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
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
        login,
        logout,
        switchUser,
        refreshUser,
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
