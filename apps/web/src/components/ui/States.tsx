"use client";

import React from "react";
import {
  AlertTriangle,
  Inbox,
  RefreshCw,
  WifiOff,
  type LucideIcon,
} from "lucide-react";

/* ── Status badge (Stitch procurement semantics) ─────────────────────────── */

const STATUS_STYLES: Record<string, string> = {
  PENDING: "text-amber-700 bg-amber-50 border-amber-200",
  CONFIRMED: "text-amber-700 bg-amber-50 border-amber-200",
  PROCESSING: "text-blue-700 bg-blue-50 border-blue-200",
  PACKED: "text-indigo-700 bg-indigo-50 border-indigo-200",
  DISPATCHED: "text-sky-700 bg-sky-50 border-sky-200",
  IN_TRANSIT: "text-sky-700 bg-sky-50 border-sky-200",
  DELIVERED: "text-emerald-700 bg-emerald-50 border-emerald-200",
  APPROVED: "text-emerald-700 bg-emerald-50 border-emerald-200",
  SUCCESS: "text-emerald-700 bg-emerald-50 border-emerald-200",
  CANCELLED: "text-rose-700 bg-rose-50 border-rose-200",
  REJECTED: "text-rose-700 bg-rose-50 border-rose-200",
  REFUNDED: "text-slate-700 bg-slate-100 border-slate-300",
  FAILED: "text-rose-700 bg-rose-50 border-rose-200",
};

export function StatusBadge({
  status,
  pulse = false,
  className = "",
}: {
  status: string;
  pulse?: boolean;
  className?: string;
}) {
  const styles =
    STATUS_STYLES[status] || "text-slate-700 bg-slate-100 border-slate-300";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-bold uppercase tracking-wide whitespace-nowrap ${styles} ${className}`}
    >
      {pulse && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      )}
      {status.replace(/_/g, " ")}
    </span>
  );
}

/* ── Empty state ─────────────────────────────────────────────────────────── */

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className = "",
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center px-6 py-10 ${className}`}
    >
      <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-slate-400" />
      </div>
      <div className="text-sm font-bold text-slate-800">{title}</div>
      {description && (
        <p className="text-xs text-slate-500 mt-1 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ── Error state (contextual, with recovery) ─────────────────────────────── */

export function ErrorState({
  title = "Something went wrong",
  description = "The request could not be completed.",
  onRetry,
  retryLabel = "Retry",
  compact = false,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-rose-50 border border-rose-200 rounded-md text-xs">
        <span className="flex items-center gap-2 text-rose-800">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {title}
        </span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="font-bold text-rose-700 hover:text-rose-900 inline-flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> {retryLabel}
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-12">
      <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center mb-3">
        <WifiOff className="w-5 h-5 text-rose-500" />
      </div>
      <div className="text-sm font-bold text-slate-900">{title}</div>
      <p className="text-xs text-slate-500 mt-1 max-w-sm">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-md transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> {retryLabel}
        </button>
      )}
    </div>
  );
}

/* ── Toast / banner ──────────────────────────────────────────────────────── */

export function Banner({
  message,
  onDismiss,
  tone = "success",
}: {
  message: string;
  onDismiss: () => void;
  tone?: "success" | "error" | "info";
}) {
  const tones = {
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
    error: "bg-rose-50 border-rose-200 text-rose-800",
    info: "bg-blue-50 border-blue-200 text-blue-800",
  };
  return (
    <div
      className={`flex items-center justify-between gap-3 px-3 py-2.5 border rounded-md text-xs font-medium ${tones[tone]}`}
      role="status"
    >
      <span>{message}</span>
      <button
        onClick={onDismiss}
        className="font-bold opacity-70 hover:opacity-100 shrink-0"
      >
        Dismiss
      </button>
    </div>
  );
}
