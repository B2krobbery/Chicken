"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { AdminPortal } from "@/components/portals/AdminPortal";
import { SupplierPortal } from "@/components/portals/SupplierPortal";
import { BuyerPortal } from "@/components/portals/BuyerPortal";
import { DriverPortal } from "@/components/portals/DriverPortal";
import { SplashScreen } from "@/components/ui/Splash";
import {
  ShieldCheck,
  Store,
  UserCheck,
  Truck,
  Lock,
  Loader2,
} from "lucide-react";

const DEMO_ROLES = [
  {
    role: "ADMIN" as const,
    label: "Admin Console",
    desc: "KYC approval queues, GMV analytics, audit logs",
    icon: ShieldCheck,
    accent: "border-purple-300 hover:border-purple-500",
    iconBg: "bg-purple-500/15 text-purple-400",
    who: "admin@thechickenman.com",
  },
  {
    role: "SUPPLIER" as const,
    label: "Supplier",
    desc: "Batch stock-in, inventory ledger, order acceptance",
    icon: Store,
    accent: "border-amber-300 hover:border-amber-500",
    iconBg: "bg-amber-500/15 text-amber-400",
    who: "supplier1@thechickenman.com",
  },
  {
    role: "BUYER" as const,
    label: "Buyer",
    desc: "Marketplace, multi-SKU cart, checkout, invoices",
    icon: UserCheck,
    accent: "border-emerald-300 hover:border-emerald-500",
    iconBg: "bg-emerald-500/15 text-emerald-400",
    who: "buyer1@thechickenman.com",
  },
  {
    role: "DRIVER" as const,
    label: "Driver",
    desc: "Delivery runs, OTP & signature POD capture",
    icon: Truck,
    accent: "border-sky-300 hover:border-sky-500",
    iconBg: "bg-sky-500/15 text-sky-400",
    who: "driver@thechickenman.com",
  },
];

export default function HomePage() {
  const { user, role, loading, switchUser, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState<string | null>(null);

  if (loading) {
    return <SplashScreen stage="Checking your session…" />;
  }

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
    setSigningIn("custom");
    try {
      await login(email, password);
    } catch (err: any) {
      setLoginErr(err.message);
    } finally {
      setSigningIn(null);
    }
  };

  const handleDemo = async (r: (typeof DEMO_ROLES)[number]) => {
    setLoginErr(null);
    setSigningIn(r.role);
    try {
      await switchUser(r.role);
    } catch (err: any) {
      setLoginErr(err.message);
    } finally {
      setSigningIn(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Brand panel */}
      <div className="bg-shell-900 lg:w-[42%] lg:min-h-screen flex flex-col justify-between px-6 sm:px-10 py-8 lg:py-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-gradient-to-tr from-brand-600 to-amber-500 flex items-center justify-center text-lg">
            🍗
          </div>
          <div>
            <div className="text-sm font-bold text-slate-50">TheChickenMan</div>
            <div className="text-[10px] text-slate-400 uppercase tracking-[0.15em]">
              B2B Poultry Platform
            </div>
          </div>
        </div>

        <div className="py-10 lg:py-0">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-50 tracking-tight leading-tight">
            Institutional poultry procurement,
            <span className="text-brand-400"> end to end.</span>
          </h1>
          <p className="text-sm text-slate-400 mt-4 max-w-md leading-relaxed">
            Verified FSSAI/GST suppliers, real-time multi-state inventory
            ledgers, GST-compliant invoicing, and OTP-verified cold-chain
            delivery — one platform.
          </p>
          <div className="mt-6 grid grid-cols-3 gap-3 max-w-md">
            {[
              ["4", "Portal roles"],
              ["5%", "GST invoicing"],
              ["POD", "Cold-chain proof"],
            ].map(([v, l]) => (
              <div
                key={l}
                className="border border-shell-700 rounded-md px-3 py-2.5"
              >
                <div className="text-lg font-bold text-slate-100 tnum">{v}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wide">
                  {l}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-[10px] text-slate-600 hidden lg:block">
          Mocked payments & notifications · Production data via Supabase
        </div>
      </div>

      {/* Auth panel */}
      <div className="flex-1 flex items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-xl space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Access the platform
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Pick a demo persona or sign in with workspace credentials.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {DEMO_ROLES.map((r) => {
              const Icon = r.icon;
              const busy = signingIn === r.role;
              return (
                <button
                  key={r.role}
                  onClick={() => handleDemo(r)}
                  disabled={signingIn !== null}
                  className={`p-4 bg-shell-900 border border-shell-700 rounded-lg text-left transition group disabled:opacity-60 ${r.accent}`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`p-2 rounded-md w-fit ${r.iconBg} group-hover:scale-105 transition`}
                    >
                      {busy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {busy ? "Signing in…" : "Demo"}
                    </span>
                  </div>
                  <div className="mt-2.5 font-bold text-slate-100 text-sm">
                    {r.label}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    {r.desc}
                  </div>
                  <div className="text-[10px] text-slate-600 mt-1.5 font-mono truncate">
                    {r.who}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Credential form */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              Sign in with credentials
            </div>
            {loginErr && (
              <div className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-md text-xs">
                {loginErr}
              </div>
            )}
            <form onSubmit={handleCustomLogin} className="space-y-3">
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase tracking-wide"
                >
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@thechickenman.com"
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="login-password"
                  className="block text-[11px] font-semibold text-slate-600 mb-1 uppercase tracking-wide"
                >
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={signingIn !== null}
                className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white text-sm font-bold rounded-md transition flex items-center justify-center gap-2"
              >
                {signingIn === "custom" && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                Sign in
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
