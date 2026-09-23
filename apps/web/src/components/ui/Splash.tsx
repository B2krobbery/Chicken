"use client";

import React from "react";

/**
 * Branded entry splash. Shows a real loading stage label — never fake progress.
 */
export function SplashScreen({ stage }: { stage?: string }) {
  return (
    <div className="min-h-screen bg-shell-900 flex flex-col items-center justify-center px-6">
      <div className="brand-pulse w-16 h-16 rounded-xl bg-gradient-to-tr from-brand-600 to-amber-500 flex items-center justify-center text-3xl shadow-xl mb-5">
        🍗
      </div>
      <h1 className="text-lg font-bold text-slate-50 tracking-tight">
        TheChickenMan
      </h1>
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.18em] mt-1">
        B2B Poultry Procurement
      </p>
      <div className="mt-8 w-40">
        <div className="h-1 rounded-full bg-shell-700 overflow-hidden">
          <div className="h-full w-1/2 rounded-full bg-brand-500 animate-pulse" />
        </div>
        <p className="text-center text-xs text-slate-400 mt-3 animate-pulse">
          {stage || "Initializing workspace…"}
        </p>
      </div>
      <p className="absolute bottom-6 text-[10px] text-slate-600">
        Institutional-grade marketplace · GST compliant · Cold-chain verified
      </p>
    </div>
  );
}
