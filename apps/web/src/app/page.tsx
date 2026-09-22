"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { AdminPortal } from "@/components/portals/AdminPortal";
import { SupplierPortal } from "@/components/portals/SupplierPortal";
import { BuyerPortal } from "@/components/portals/BuyerPortal";
import { DriverPortal } from "@/components/portals/DriverPortal";
import { ShieldCheck, Store, UserCheck, Truck, Lock } from "lucide-react";

export default function HomePage() {
  const { user, role, loading, switchUser, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginErr, setLoginErr] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <div className="relative flex items-center justify-center w-20 h-20 mb-6">
          <div className="absolute inset-0 border-4 border-brand-100 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-brand-600 rounded-full border-t-transparent animate-spin"></div>
          <span className="text-2xl">🍗</span>
        </div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight mb-2">TheChickenMan</h2>
        <p className="text-sm font-medium text-slate-500 animate-pulse">Securing session...</p>
      </div>
    );
  }

  // If user is authenticated, render the corresponding role portal
  if (user && role) {
    switch (role) {
      case "ADMIN":
        return <AdminPortal />;
      case "SUPPLIER":
        return <SupplierPortal />;
      case "BUYER":
        return <BuyerPortal />;
      case "DRIVER":
        return <DriverPortal />;
      default:
        return <BuyerPortal />;
    }
  }

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErr(null);
    try {
      await login(email, password);
    } catch (err: any) {
      setLoginErr(err.message);
    }
  };

  // Not logged in -> Landing screen with 1-click role demos
  return (
    <div className="max-w-4xl mx-auto py-12 space-y-10">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-100 text-brand-800 text-xs font-bold uppercase tracking-wider">
          🍗 TheChickenMan MVP Portal
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
          India's B2B Poultry Trading & Fulfillment Platform
        </h1>
        <p className="text-base text-slate-600 max-w-2xl mx-auto">
          Connecting verified poultry processors with commercial buyers. Complete with FSSAI/GST KYC verification, multi-state inventory ledgers, and proof-of-delivery dispatch.
        </p>
      </div>

      {/* Demo 1-Click Role Access Cards */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider text-center">
          Instant Demo Access (Select Persona to Explore)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => switchUser("ADMIN")}
            className="p-5 bg-white border border-slate-200 hover:border-purple-400 hover:shadow-md rounded-xl text-left transition group"
          >
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg w-fit group-hover:scale-110 transition">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="mt-3 font-bold text-slate-900 text-sm">Admin Console</div>
            <div className="text-xs text-slate-500 mt-1">
              KYC approval queues, GMV analytics, master catalogue & audit logs.
            </div>
          </button>

          <button
            onClick={() => switchUser("SUPPLIER")}
            className="p-5 bg-white border border-slate-200 hover:border-amber-400 hover:shadow-md rounded-xl text-left transition group"
          >
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg w-fit group-hover:scale-110 transition">
              <Store className="w-6 h-6" />
            </div>
            <div className="mt-3 font-bold text-slate-900 text-sm">Supplier (Venky's)</div>
            <div className="text-xs text-slate-500 mt-1">
              KYC status, batch stock-in, inventory ledger, order acceptance.
            </div>
          </button>

          <button
            onClick={() => switchUser("BUYER")}
            className="p-5 bg-white border border-slate-200 hover:border-emerald-400 hover:shadow-md rounded-xl text-left transition group"
          >
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg w-fit group-hover:scale-110 transition">
              <UserCheck className="w-6 h-6" />
            </div>
            <div className="mt-3 font-bold text-slate-900 text-sm">Buyer (Biryani Blues)</div>
            <div className="text-xs text-slate-500 mt-1">
              Marketplace discovery, multi-SKU cart, checkout, payment, invoices.
            </div>
          </button>

          <button
            onClick={() => switchUser("DRIVER")}
            className="p-5 bg-white border border-slate-200 hover:border-blue-400 hover:shadow-md rounded-xl text-left transition group"
          >
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg w-fit group-hover:scale-110 transition">
              <Truck className="w-6 h-6" />
            </div>
            <div className="mt-3 font-bold text-slate-900 text-sm">Driver (Ramesh)</div>
            <div className="text-xs text-slate-500 mt-1">
              Assigned delivery jobs, route addresses, OTP & signature POD capture.
            </div>
          </button>
        </div>
      </div>

      {/* Manual Login Form */}
      <div className="max-w-md mx-auto bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 text-xs">
        <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
          <Lock className="w-4 h-4 text-slate-500" />
          Or Sign In with Custom Credentials
        </div>

        {loginErr && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
            {loginErr}
          </div>
        )}

        <form onSubmit={handleCustomLogin} className="space-y-3">
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. admin@thechickenman.com"
              className="w-full p-2.5 border rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full p-2.5 border rounded-lg"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-lg transition shadow"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
