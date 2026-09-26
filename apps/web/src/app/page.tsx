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
  Building2,
  UserPlus,
  LogIn,
  AlertCircle,
  X,
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
  const {
    user,
    role,
    loading,
    bootStage,
    sessionNotice,
    switchUser,
    login,
    register,
    clearSessionNotice,
  } = useAuth();

  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  // Login form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Register form state
  const [regRole, setRegRole] = useState<"BUYER" | "SUPPLIER">("BUYER");
  const [regBusinessName, setRegBusinessName] = useState("");
  const [regFullName, setRegFullName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("+91");
  const [regPassword, setRegPassword] = useState("");
  const [regBuyerType, setRegBuyerType] = useState("RESTAURANT");

  const [authErr, setAuthErr] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null);

  if (loading) {
    const stageIndex =
      bootStage === "connect" ? 0 : bootStage === "session" ? 1 : 2;
    return (
      <SplashScreen
        steps={[
          {
            label: "Connecting to ChickenMan API",
            state: stageIndex > 0 ? "done" : "active",
          },
          {
            label: "Verifying your session",
            state: stageIndex > 1 ? "done" : stageIndex === 1 ? "active" : "pending",
          },
          {
            label: "Loading your workspace",
            state: stageIndex > 1 ? "active" : "pending",
          },
        ]}
      />
    );
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
    setAuthErr(null);
    setIsSubmitting("login");
    try {
      await login(email, password);
    } catch (err: any) {
      setAuthErr(err.message);
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErr(null);
    setIsSubmitting("register");

    if (regPassword.length < 8) {
      setAuthErr("Password must be at least 8 characters");
      setIsSubmitting(null);
      return;
    }

    try {
      await register({
        email: regEmail,
        password: regPassword,
        full_name: regFullName,
        phone_number: regPhone,
        role: regRole,
        business_name: regBusinessName,
        buyer_type: regRole === "BUYER" ? regBuyerType : undefined,
      });
    } catch (err: any) {
      setAuthErr(err.message);
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleDemo = async (r: (typeof DEMO_ROLES)[number]) => {
    setAuthErr(null);
    setIsSubmitting(r.role);
    try {
      await switchUser(r.role);
    } catch (err: any) {
      setAuthErr(err.message);
    } finally {
      setIsSubmitting(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Brand panel */}
      <div className="bg-shell-900 lg:w-[42%] lg:min-h-screen flex flex-col justify-between px-6 sm:px-10 py-8 lg:py-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-gradient-to-tr from-brand-600 to-amber-500 flex items-center justify-center text-lg lg:text-2xl">
            🍗
          </div>
          <div>
            <div className="text-sm lg:text-base font-bold text-slate-50">TheChickenMan</div>
            <div className="text-[11px] lg:text-xs text-slate-400 uppercase tracking-[0.15em]">
              B2B Poultry Platform
            </div>
          </div>
        </div>

        <div className="py-10 lg:py-0">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-50 tracking-tight leading-tight">
            Institutional poultry procurement,
            <span className="text-brand-400"> end to end.</span>
          </h1>
          <p className="text-sm lg:text-base text-slate-400 mt-4 max-w-md leading-relaxed">
            Verified FSSAI/GST suppliers, real-time multi-state inventory
            ledgers, GST-compliant invoicing, and OTP-verified cold-chain
            delivery — one platform.
          </p>
          <div className="mt-6 grid grid-cols-3 gap-3 lg:gap-4 max-w-md">
            {[
              ["4", "Portal roles"],
              ["5%", "GST invoicing"],
              ["POD", "Cold-chain proof"],
            ].map(([v, l]) => (
              <div
                key={l}
                className="border border-shell-700 rounded-md px-3 lg:px-4 py-2.5 lg:py-3"
              >
                <div className="text-lg lg:text-2xl font-bold text-slate-100 tnum">{v}</div>
                <div className="text-[11px] lg:text-xs text-slate-500 uppercase tracking-wide">
                  {l}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-[11px] lg:text-xs text-slate-600 hidden lg:block">
          Enterprise RBAC · Supabase PostgreSQL · GST Compliant
        </div>
      </div>

      {/* Auth panel */}
      <div className="flex-1 flex items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-xl space-y-5">
          {sessionNotice && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-xs sm:text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{sessionNotice}</span>
              </div>
              <button
                onClick={clearSessionNotice}
                className="p-1 hover:bg-amber-100 rounded text-amber-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div>
            <h2 className="text-lg lg:text-2xl font-bold text-slate-900 tracking-tight">
              Access the platform
            </h2>
            <p className="text-xs lg:text-sm text-slate-500 mt-1">
              Sign in with your credentials, create a new verified account, or test via demo personas.
            </p>
          </div>

          {/* Segmented Auth Mode Switcher */}
          <div className="grid grid-cols-2 p-1 bg-slate-200/80 rounded-lg text-xs sm:text-sm font-semibold">
            <button
              onClick={() => {
                setAuthMode("login");
                setAuthErr(null);
              }}
              className={`py-2 rounded-md transition flex items-center justify-center gap-1.5 ${
                authMode === "login"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </button>
            <button
              onClick={() => {
                setAuthMode("register");
                setAuthErr(null);
              }}
              className={`py-2 rounded-md transition flex items-center justify-center gap-1.5 ${
                authMode === "register"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Create Account</span>
            </button>
          </div>

          {authErr && (
            <div className="px-3 lg:px-4 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-md text-xs lg:text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{authErr}</span>
            </div>
          )}

          {authMode === "login" ? (
            <div className="space-y-5">
              {/* Quick Demo Personas */}
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Quick Demo Evaluation
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                  {DEMO_ROLES.map((r) => {
                    const Icon = r.icon;
                    const busy = isSubmitting === r.role;
                    return (
                      <button
                        key={r.role}
                        onClick={() => handleDemo(r)}
                        disabled={isSubmitting !== null}
                        className={`p-3.5 sm:p-4 bg-shell-900 border border-shell-700 rounded-lg text-left transition group disabled:opacity-60 ${r.accent}`}
                      >
                        <div className="flex items-center justify-between">
                          <div
                            className={`p-1.5 sm:p-2 rounded-md w-fit ${r.iconBg} group-hover:scale-105 transition`}
                          >
                            {busy ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Icon className="w-4 h-4" />
                            )}
                          </div>
                          <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            {busy ? "Signing in…" : "Demo"}
                          </span>
                        </div>
                        <div className="mt-2 font-bold text-slate-100 text-xs sm:text-sm">
                          {r.label}
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 leading-snug">
                          {r.desc}
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-slate-600 mt-1 font-mono truncate">
                          {r.who}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Credential form */}
              <div className="bg-white border border-slate-200 rounded-lg p-5 lg:p-6 space-y-3 lg:space-y-4">
                <div className="text-xs lg:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  Sign in with credentials
                </div>
                <form onSubmit={handleCustomLogin} className="space-y-3">
                  <div>
                    <label
                      htmlFor="login-email"
                      className="block text-[11px] lg:text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide"
                    >
                      Email
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@thechickenman.com"
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-md text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="login-password"
                      className="block text-[11px] lg:text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide"
                    >
                      Password
                    </label>
                    <input
                      id="login-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-md text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting !== null}
                    className="w-full py-2.5 lg:py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white text-sm lg:text-base font-bold rounded-md transition flex items-center justify-center gap-2"
                  >
                    {isSubmitting === "login" && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                    Sign in
                  </button>
                </form>
              </div>
            </div>
          ) : (
            /* Registration Form */
            <div className="bg-white border border-slate-200 rounded-lg p-5 lg:p-6 space-y-4">
              <div>
                <div className="text-xs lg:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-brand-600" />
                  Create Commercial Account
                </div>
                <p className="text-[11px] lg:text-xs text-slate-500 mt-0.5">
                  Register as an institutional buyer or vetted poultry supplier.
                </p>
              </div>

              {/* Role selection toggle */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRegRole("BUYER")}
                  className={`p-3 rounded-lg border text-left transition ${
                    regRole === "BUYER"
                      ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500"
                      : "border-slate-200 hover:border-slate-300 bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <UserCheck
                      className={`w-4 h-4 ${
                        regRole === "BUYER" ? "text-emerald-600" : "text-slate-400"
                      }`}
                    />
                    <span className="text-xs sm:text-sm font-bold text-slate-900">
                      Buyer
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 mt-1">
                    Hotels, Restaurants, QSRs & Caterers
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setRegRole("SUPPLIER")}
                  className={`p-3 rounded-lg border text-left transition ${
                    regRole === "SUPPLIER"
                      ? "border-amber-500 bg-amber-500/5 ring-1 ring-amber-500"
                      : "border-slate-200 hover:border-slate-300 bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Store
                      className={`w-4 h-4 ${
                        regRole === "SUPPLIER" ? "text-amber-600" : "text-slate-400"
                      }`}
                    />
                    <span className="text-xs sm:text-sm font-bold text-slate-900">
                      Supplier
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 mt-1">
                    Commercial Producers & Processors
                  </p>
                </button>
              </div>

              <form onSubmit={handleRegister} className="space-y-3">
                <div>
                  <label className="block text-[11px] lg:text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                    Business / Trade Name
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-2.5 top-3" />
                    <input
                      type="text"
                      value={regBusinessName}
                      onChange={(e) => setRegBusinessName(e.target.value)}
                      placeholder={
                        regRole === "BUYER"
                          ? "e.g. Royal Bengal Caterers & Kitchens"
                          : "e.g. Highline Poultry Hatcheries Ltd"
                      }
                      className="w-full pl-9 pr-2.5 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
                      required
                    />
                  </div>
                </div>

                {regRole === "BUYER" && (
                  <div>
                    <label className="block text-[11px] lg:text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                      Business Classification
                    </label>
                    <select
                      value={regBuyerType}
                      onChange={(e) => setRegBuyerType(e.target.value)}
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
                    >
                      <option value="RESTAURANT">Restaurant / Fine Dining</option>
                      <option value="HOTEL">Hotel & Hospitality</option>
                      <option value="QSR">Quick Service Restaurant (QSR)</option>
                      <option value="CATERER">Institutional / Event Caterer</option>
                      <option value="RETAIL">Butchery / Retail Outlet</option>
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] lg:text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                      Contact Full Name
                    </label>
                    <input
                      type="text"
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      placeholder="e.g. Vikramaditya Sen"
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] lg:text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="+919876543210"
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] lg:text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                      Business Email
                    </label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="procurement@business.com"
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] lg:text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                      Password (min 8 chars)
                    </label>
                    <input
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
                      required
                      minLength={8}
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting !== null}
                    className="w-full py-2.5 lg:py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white text-sm lg:text-base font-bold rounded-md transition flex items-center justify-center gap-2 shadow-sm"
                  >
                    {isSubmitting === "register" && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                    Complete Registration & Enter
                  </button>
                </div>

                <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                  Upon creation, your KYC compliance status will initiate as PENDING. You can immediately access catalogues and submit FSSAI/GST details.
                </p>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
