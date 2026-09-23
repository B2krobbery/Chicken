"use client";

import React from "react";
import { Check, Loader2 } from "lucide-react";

export interface SplashStep {
  label: string;
  state: "done" | "active" | "pending";
}

/**
 * Branded entry splash driven by REAL milestones — the bar only advances
 * when a boot stage actually completes. Never fabricates progress.
 */
export function SplashScreen({ steps }: { steps: SplashStep[] }) {
  const done = steps.filter((s) => s.state === "done").length;
  const progress = (done / steps.length) * 100;
  const active = steps.find((s) => s.state === "active");

  return (
    <div className="min-h-screen bg-shell-900 flex flex-col items-center justify-center px-6">
      <div className="brand-pulse w-16 h-16 rounded-xl bg-gradient-to-tr from-brand-600 to-amber-500 flex items-center justify-center text-3xl shadow-xl mb-5">
        🍗
      </div>
      <h1 className="text-lg lg:text-2xl font-bold text-slate-50 tracking-tight">
        TheChickenMan
      </h1>
      <p className="text-[11px] lg:text-xs font-semibold text-slate-400 uppercase tracking-[0.18em] mt-1">
        B2B Poultry Procurement
      </p>

      <div className="mt-9 w-56 sm:w-64">
        <div className="h-1 rounded-full bg-shell-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-brand-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-center text-xs lg:text-sm text-slate-400 mt-3 min-h-[1rem]">
          {active?.label || ""}
        </p>

        <div className="mt-4 space-y-1.5">
          {steps.map((s, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 text-xs lg:text-sm transition-colors duration-300 ${
                s.state === "done"
                  ? "text-slate-500"
                  : s.state === "active"
                  ? "text-slate-200"
                  : "text-slate-600"
              }`}
            >
              {s.state === "done" ? (
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              ) : s.state === "active" ? (
                <Loader2 className="w-3.5 h-3.5 text-brand-400 animate-spin shrink-0" />
              ) : (
                <span className="w-3.5 h-3.5 rounded-full border border-shell-700 shrink-0" />
              )}
              <span className="truncate">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="absolute bottom-6 text-[11px] lg:text-xs text-slate-600">
        Institutional-grade marketplace · GST compliant · Cold-chain verified
      </p>
    </div>
  );
}
