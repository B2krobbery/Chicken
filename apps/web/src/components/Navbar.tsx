"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { ShieldCheck, Truck, Store, UserCheck, LogOut, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

export function Navbar() {
  const { user, role, kycStatus, logout, switchUser } = useAuth();

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Platform Name */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-brand-600 to-amber-500 flex items-center justify-center font-black text-xl text-white shadow">
              🍗
            </div>
            <div>
              <div className="font-bold text-lg leading-tight tracking-tight flex items-center gap-2">
                TheChickenMan
                <span className="text-[10px] bg-brand-600/30 text-brand-400 font-semibold px-1.5 py-0.5 rounded border border-brand-500/40">
                  B2B MVP
                </span>
              </div>
              <div className="text-xs text-slate-400">Institutional Poultry Trading Platform</div>
            </div>
          </div>

          {/* Quick Role Switcher (Crucial for Reviewer & Testing) */}
          <div className="hidden md:flex items-center bg-slate-800/80 p-1 rounded-lg border border-slate-700/60 text-xs">
            <span className="px-2 text-slate-400 font-medium">Switch Role:</span>
            <button
              onClick={() => switchUser("ADMIN")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
                role === "ADMIN"
                  ? "bg-purple-600 text-white shadow"
                  : "text-slate-300 hover:text-white hover:bg-slate-700/50"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Admin
            </button>
            <button
              onClick={() => switchUser("SUPPLIER")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
                role === "SUPPLIER"
                  ? "bg-amber-600 text-white shadow"
                  : "text-slate-300 hover:text-white hover:bg-slate-700/50"
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              Supplier (Venky's)
            </button>
            <button
              onClick={() => switchUser("BUYER")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
                role === "BUYER"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-300 hover:text-white hover:bg-slate-700/50"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Buyer (Biryani Blues)
            </button>
            <button
              onClick={() => switchUser("DRIVER")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
                role === "DRIVER"
                  ? "bg-blue-600 text-white shadow"
                  : "text-slate-300 hover:text-white hover:bg-slate-700/50"
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              Driver (Ramesh)
            </button>
          </div>

          {/* User Status / Account Info */}
          <div className="flex items-center space-x-3">
            {user ? (
              <div className="flex items-center space-x-3">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-slate-200">{user.full_name}</div>
                  <div className="flex items-center justify-end gap-1.5 text-[11px] text-slate-400">
                    <span className="font-mono uppercase text-slate-300">{role}</span>
                    {kycStatus && (
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium ${
                          kycStatus === "APPROVED"
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                            : kycStatus === "PENDING"
                            ? "bg-amber-950 text-amber-300 border border-amber-800"
                            : "bg-rose-950 text-rose-300 border border-rose-800"
                        }`}
                      >
                        {kycStatus === "APPROVED" && <CheckCircle2 className="w-2.5 h-2.5" />}
                        {kycStatus === "PENDING" && <Clock className="w-2.5 h-2.5" />}
                        {kycStatus}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={logout}
                  title="Sign Out"
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => switchUser("ADMIN")}
                className="bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow"
              >
                Sign In (Demo)
              </button>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
