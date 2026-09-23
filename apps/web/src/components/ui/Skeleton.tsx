"use client";

import React from "react";

/** Basic shimmering block that matches the skeleton spec in the design system. */
export function Sk({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function SkText({ className = "" }: { className?: string }) {
  return <Sk className={`h-3.5 ${className}`} />;
}

/** Dense table-row skeleton matching 36-40px row heights. */
export function SkTableRows({
  rows = 5,
  cols = 5,
  widths,
}: {
  rows?: number;
  cols?: number;
  widths?: string[];
}) {
  return (
    <div className="divide-y divide-slate-100" aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-3 py-2.5">
          {Array.from({ length: cols }).map((_, c) => (
            <SkText key={c} className={widths?.[c] || "flex-1"} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-white rounded-md border border-slate-200 p-3 space-y-2.5 ${className}`}
      aria-hidden="true"
    >
      <div className="flex justify-between items-start">
        <Sk className="h-5 w-20" />
        <Sk className="h-4 w-14 rounded-full" />
      </div>
      <SkText className="w-3/4" />
      <SkText className="w-1/2" />
      <div className="pt-2 border-t border-slate-100 flex justify-between">
        <Sk className="h-3 w-24" />
        <Sk className="h-7 w-24" />
      </div>
    </div>
  );
}

export function SkKpi() {
  return (
    <div className="bg-white rounded-md border border-slate-200 p-3 flex items-center gap-3" aria-hidden="true">
      <Sk className="w-9 h-9 rounded-md shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <Sk className="h-2.5 w-full max-w-[5rem]" />
        <Sk className="h-5 w-full max-w-[6rem]" />
      </div>
    </div>
  );
}
