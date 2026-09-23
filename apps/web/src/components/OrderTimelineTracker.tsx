"use client";

import React from "react";
import { 
  ShoppingBag, 
  CheckCircle2, 
  Package, 
  Truck, 
  ShieldCheck, 
  XCircle,
  Clock
} from "lucide-react";

export interface OrderTimelineProps {
  status: string;
  driverName?: string | null;
  vehicleNumber?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  compact?: boolean;
}

const STEPS = [
  { key: "PLACED", label: "Placed", desc: "Order booked", icon: ShoppingBag },
  { key: "CONFIRMED", label: "Confirmed", desc: "Supplier accepted", icon: CheckCircle2 },
  { key: "PACKED", label: "Packed", desc: "Cold storage ready", icon: Package },
  { key: "DISPATCHED", label: "Dispatched", desc: "Driver on route", icon: Truck },
  { key: "DELIVERED", label: "Delivered", desc: "POD verified", icon: ShieldCheck },
];

/* Map real backend order statuses onto the 5-step stepper. */
const STATUS_TO_INDEX: Record<string, number> = {
  PENDING: 0,
  CONFIRMED: 1,
  PROCESSING: 2,
  PACKED: 2,
  DISPATCHED: 3,
  DELIVERED: 4,
};

export function OrderTimelineTracker({
  status,
  driverName,
  vehicleNumber,
  compact = false,
}: OrderTimelineProps) {
  const isCancelled = status === "CANCELLED" || status === "REJECTED" || status === "REFUNDED";
  const currentIndex = STATUS_TO_INDEX[status] ?? -1;

  if (isCancelled) {
    return (
      <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs lg:text-sm">
        <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
        <span className="font-bold">Order {status}</span>
        <span className="text-slate-500">— Stock reservation released.</span>
      </div>
    );
  }

  if (compact) {
    const c =
      status === "DELIVERED"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : status === "DISPATCHED"
        ? "bg-sky-50 text-sky-700 border-sky-200"
        : status === "PACKED"
        ? "bg-indigo-50 text-indigo-700 border-indigo-200"
        : status === "PROCESSING"
        ? "bg-blue-50 text-blue-700 border-blue-200"
        : status === "CONFIRMED" || status === "PENDING"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-slate-100 text-slate-700 border-slate-300";
    return (
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] lg:text-xs font-bold uppercase tracking-wide ${c}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          {status}
        </span>
        {driverName && status === "DISPATCHED" && (
          <span className="text-[11px] lg:text-xs text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 font-mono">
            {driverName} · {vehicleNumber || "Cold-Van"}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="py-2 space-y-3">
      {/* 5-Step Horizontal Stepper */}
      <div className="relative flex items-center justify-between">
        {/* Continuous Background Line */}
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-slate-200 -z-0" />

        {/* Active Progress Line */}
        {currentIndex >= 0 && (
          <div
            className="absolute top-4 left-4 h-0.5 bg-emerald-500 transition-all duration-500 -z-0"
            style={{
              width: `${(currentIndex / (STEPS.length - 1)) * 92}%`,
            }}
          />
        )}

        {STEPS.map((step, idx) => {
          const isDone = currentIndex > idx;
          const isCurrent = currentIndex === idx;
          const Icon = step.icon;

          return (
            <div key={step.key} className="flex flex-col items-center text-center z-10">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition shadow-sm ${
                  isDone
                    ? "bg-emerald-600 text-white"
                    : isCurrent
                    ? "bg-brand-600 text-white ring-4 ring-brand-100 animate-pulse"
                    : "bg-white border-2 border-slate-300 text-slate-400"
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="mt-1.5">
                <div
                  className={`text-[11px] lg:text-xs font-bold ${
                    isDone || isCurrent ? "text-slate-900" : "text-slate-400"
                  }`}
                >
                  {step.label}
                </div>
                <div className="text-[10px] lg:text-xs text-slate-500 hidden sm:block">
                  {step.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Driver info card when Dispatched or Delivered */}
      {driverName && (status === "DISPATCHED" || status === "DELIVERED") && (
        <div className="mt-2 p-2.5 bg-sky-50 border border-sky-200 rounded-md flex items-center justify-between text-xs lg:text-sm text-sky-900">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-sky-600 shrink-0" />
            <span>
              <strong>Driver:</strong> {driverName} &nbsp;·&nbsp; <strong>Vehicle:</strong> {vehicleNumber || "Cold-Van"}
            </span>
          </div>
          <span className="text-[11px] lg:text-xs bg-sky-100 text-sky-800 px-2 py-0.5 rounded font-bold uppercase tracking-wide">
            {status === "DELIVERED" ? "Completed" : "In transit"}
          </span>
        </div>
      )}
    </div>
  );
}
