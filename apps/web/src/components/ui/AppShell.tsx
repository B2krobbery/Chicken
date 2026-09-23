"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Bell,
  ChevronRight,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  SUPPLIER: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  BUYER: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  DRIVER: "bg-sky-500/20 text-sky-300 border-sky-500/40",
};

export function AppShell({
  nav,
  activeKey,
  onNavigate,
  breadcrumb,
  title,
  subtitle,
  actions,
  children,
}: {
  nav: NavItem[];
  activeKey: string;
  onNavigate: (key: string) => void;
  breadcrumb?: string[];
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { user, role, kycStatus, logout } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const sidebar = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="h-12 flex items-center gap-2.5 px-4 border-b border-shell-700 shrink-0">
        <div className="w-7 h-7 rounded-md bg-gradient-to-tr from-brand-600 to-amber-500 flex items-center justify-center text-sm lg:text-base font-black text-white shrink-0">
          🍗
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-bold text-slate-50 leading-tight truncate">
            TheChickenMan
          </div>
          <div className="text-[11px] text-slate-400 leading-tight truncate">
            B2B Poultry Platform
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {nav.map((item) => {
          const active = item.key === activeKey;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              aria-label={item.label}
              onClick={() => {
                onNavigate(item.key);
                setMobileNavOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] lg:text-sm font-medium transition text-left ${
                active
                  ? "bg-brand-600/15 text-brand-400 border-l-2 border-brand-500 -ml-px"
                  : "text-slate-400 hover:text-slate-100 hover:bg-shell-800"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge !== undefined && item.badge !== 0 && (
                <span className="text-[11px] lg:text-xs font-bold bg-shell-700 text-slate-200 px-1.5 py-0.5 rounded min-w-[20px] text-center tnum">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-shell-700 p-3 lg:p-4 space-y-1.5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-shell-700 flex items-center justify-center text-[11px] lg:text-xs font-bold text-slate-300 shrink-0">
            {(user?.full_name || "?")
              .split(" ")
              .map((w) => w[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs lg:text-sm font-semibold text-slate-200 truncate flex items-center gap-1.5">
              <span className="truncate">{user?.full_name}</span>
              {role && (
                <span
                  className={`text-[10px] font-bold px-1 py-px rounded border uppercase shrink-0 ${
                    ROLE_COLORS[role] || "bg-slate-700 text-slate-300"
                  }`}
                >
                  {role}
                </span>
              )}
            </div>
            <div className="text-[11px] lg:text-xs text-slate-500 truncate">
              {user?.email}
            </div>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="p-1.5 text-slate-500 hover:text-white hover:bg-shell-800 rounded-md transition"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
        {kycStatus && (
          <div className="text-[11px] lg:text-xs text-slate-500 px-0.5">
            KYC:{" "}
            <span
              className={`font-bold ${
                kycStatus === "APPROVED"
                  ? "text-emerald-400"
                  : kycStatus === "PENDING"
                  ? "text-amber-400"
                  : "text-rose-400"
              }`}
            >
              {kycStatus}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 bg-shell-900 border-r border-shell-700 fixed inset-y-0 z-40">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-shell-900 shadow-xl">
            <button
              onClick={() => setMobileNavOpen(false)}
              className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-white"
              aria-label="Close navigation"
            >
              <X className="w-4 h-4" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 min-w-0 lg:ml-60 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="h-12 lg:h-14 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center gap-3 lg:gap-4 px-3 sm:px-4 lg:px-6">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="lg:hidden p-1.5 -ml-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md"
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Breadcrumb / title */}
          <div className="min-w-0 flex-1">
            {breadcrumb && breadcrumb.length > 0 ? (
              <nav className="flex items-center gap-1 text-xs lg:text-sm text-slate-500 overflow-hidden">
                {breadcrumb.map((c, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && (
                      <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
                    )}
                    <span
                      className={`truncate ${
                        i === breadcrumb.length - 1
                          ? "font-semibold text-slate-900"
                          : ""
                      }`}
                    >
                      {c}
                    </span>
                  </React.Fragment>
                ))}
              </nav>
            ) : title ? (
              <div className="text-sm lg:text-base font-bold text-slate-900 truncate">
                {title}
              </div>
            ) : null}
            {subtitle && (
              <div className="text-[11px] lg:text-xs text-slate-500 truncate hidden sm:block">
                {subtitle}
              </div>
            )}
          </div>

          {/* Actions */}
          {actions}

          {/* Env chip */}
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] lg:text-xs font-bold px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {process.env.NEXT_PUBLIC_API_URL?.includes("localhost")
              ? "DEV"
              : "PROD"}
          </span>

          <button
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
          </button>

          {/* User chip */}
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex items-center gap-2 pl-1 relative"
          >
            <div className="w-6 h-6 rounded-full bg-slate-900 flex items-center justify-center text-[11px] lg:text-xs font-bold text-white">
              {(user?.full_name || "?")
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
            <span className="hidden md:block text-xs lg:text-sm font-semibold text-slate-700 max-w-[140px] xl:max-w-[240px] truncate">
              {user?.full_name}
            </span>
          </button>
          {userMenuOpen && (
            <div className="absolute right-3 top-11 w-52 bg-white border border-slate-200 rounded-md shadow-lg z-50 py-1.5 text-xs lg:text-sm">
              <div className="px-3 lg:px-4 py-2 border-b border-slate-100">
                <div className="font-bold text-slate-900 truncate">
                  {user?.full_name}
                </div>
                <div className="text-slate-500 truncate">{user?.email}</div>
                <div className="mt-1 flex gap-1.5">
                  <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[11px] lg:text-xs font-bold uppercase">
                    {role}
                  </span>
                  {kycStatus && (
                    <StatusBadgeMini status={kycStatus} />
                  )}
                </div>
              </div>
              <button
                onClick={logout}
                className="w-full text-left px-3 lg:px-4 py-2 text-rose-600 hover:bg-rose-50 font-medium flex items-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </button>
            </div>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 p-3 sm:p-4 lg:p-6 xl:p-8 min-w-0">{children}</main>
      </div>
    </div>
  );
}

function StatusBadgeMini({ status }: { status: string }) {
  const c =
    status === "APPROVED"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "PENDING"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-rose-50 text-rose-700 border-rose-200";
  return (
    <span
      className={`px-1.5 py-0.5 rounded border text-[11px] lg:text-xs font-bold uppercase ${c}`}
    >
      {status}
    </span>
  );
}
