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
  { key: "CREATED", label: "Placed", desc: "Order booked", icon: ShoppingBag },
  { key: "CONFIRMED", label: "Confirmed", desc: "Supplier accepted", icon: CheckCircle2 },
  { key: "PACKED", label: "Packed", desc: "Cold storage ready", icon: Package },
  { key: "DISPATCHED", label: "Dispatched", desc: "Driver on route", icon: Truck },
  { key: "DELIVERED", label: "Delivered", desc: "POD verified", icon: ShieldCheck },
];

const STATUS_ORDER = ["CREATED", "CONFIRMED", "PACKED", "DISPATCHED", "DELIVERED"];

export function OrderTimelineTracker({
  status,
  driverName,
  vehicleNumber,
  compact = false,
}: OrderTimelineProps) {
  const isCancelled = status === "CANCELLED" || status === "REJECTED";
  const currentIndex = STATUS_ORDER.indexOf(status);

  if (isCancelled) {
    return (
      <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
        <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
        <span className="font-bold">Order {status}</span>
        <span className="text-slate-500">— Stock reservation released.</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
            status === "DELIVERED"
              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
              : status === "DISPATCHED"
              ? "bg-purple-100 text-purple-800 border border-purple-300"
              : status === "PACKED"
              ? "bg-amber-100 text-amber-800 border border-amber-300"
              : status === "CONFIRMED"
              ? "bg-blue-100 text-blue-800 border border-blue-300"
              : "bg-slate-100 text-slate-700 border border-slate-300"
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          {status}
        </span>
        {driverName && status === "DISPATCHED" && (
          <span className="text-[10px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
            🚚 {driverName} ({vehicleNumber || "KA-01-EA-1234"})
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
                  className={`text-[11px] font-bold ${
                    isDone || isCurrent ? "text-slate-900" : "text-slate-400"
                  }`}
                >
                  {step.label}
                </div>
                <div className="text-[9px] text-slate-500 hidden sm:block">
                  {step.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Driver info card when Dispatched or Delivered */}
      {driverName && (status === "DISPATCHED" || status === "DELIVERED") && (
        <div className="mt-2 p-2.5 bg-purple-50/80 border border-purple-200 rounded-lg flex items-center justify-between text-xs text-purple-900">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-purple-600 shrink-0" />
            <span>
              <strong>Driver:</strong> {driverName} &nbsp;|&nbsp; <strong>Vehicle:</strong> {vehicleNumber || "KA-01-EA-1234"}
            </span>
          </div>
          <span className="text-[10px] bg-purple-200 text-purple-800 px-2 py-0.5 rounded font-semibold">
            {status === "DELIVERED" ? "Completed" : "In Transit"}
          </span>
        </div>
      )}
    </div>
  );
}
