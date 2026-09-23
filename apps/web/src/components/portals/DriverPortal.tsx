"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { AppShell } from "@/components/ui/AppShell";
import { Sk, SkCard } from "@/components/ui/Skeleton";
import { Banner, EmptyState, ErrorState, StatusBadge } from "@/components/ui/States";
import {
  Truck,
  MapPin,
  Phone,
  CheckCircle2,
  FileSignature,
  X,
  Scale,
  RefreshCw,
  Loader2,
} from "lucide-react";

type ViewKey = "deliveries";

export function DriverPortal() {
  const [view, setView] = useState<ViewKey>("deliveries");
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  // POD form
  const [otpCode, setOtpCode] = useState("1234");
  const [recipientName, setRecipientName] = useState("Executive Chef Kitchen Receiving");
  const [acceptedWeight, setAcceptedWeight] = useState<number>(0);
  const [rejectedWeight, setRejectedWeight] = useState<number>(0);
  const [rejectionReason, setRejectionReason] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      setDeliveries(await api.driver.getDeliveries());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenPOD = (d: any) => {
    setSelectedDelivery(d);
    setAcceptedWeight(d.total_weight_kg);
    setRejectedWeight(0);
    setRejectionReason("");
  };

  const handleCompletePOD = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDelivery || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.driver.capturePOD(selectedDelivery.delivery_id, {
        delivery_id: selectedDelivery.delivery_id,
        pod_type: "OTP",
        otp_code: otpCode,
        recipient_name: recipientName,
        signature_url: "data:image/svg+xml;utf8,<svg>sig</svg>",
        photo_url: "https://mock-storage.thechickenman.com/pod/crate1.jpg",
        quantity_accepted_kg: Number(acceptedWeight),
        quantity_rejected_kg: Number(rejectedWeight || 0),
        rejection_reason: rejectionReason || undefined,
      });
      setMsg(`POD recorded — ${selectedDelivery.order_number} is DELIVERED.`);
      setSelectedDelivery(null);
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const active = deliveries.filter((d) => d.status !== "DELIVERED");
  const done = deliveries.filter((d) => d.status === "DELIVERED");

  const nav = [
    { key: "deliveries", label: "Deliveries", icon: Truck, badge: active.length || undefined },
  ];

  return (
    <AppShell
      nav={nav}
      activeKey={view}
      onNavigate={() => {}}
      breadcrumb={["Driver", "Delivery runs"]}
      subtitle="Cold-chain dispatch & POD"
      actions={
        <button
          onClick={loadData}
          disabled={loading}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
          aria-label="Refresh jobs"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      }
    >
      <div className="space-y-4 max-w-5xl mx-auto">
        {msg && <Banner message={msg} onDismiss={() => setMsg(null)} />}
        {error && <Banner message={error} onDismiss={() => setError(null)} tone="error" />}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SkCard /><SkCard /><SkCard />
          </div>
        ) : error && deliveries.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-md">
            <ErrorState
              title="Couldn't load delivery jobs"
              description={error}
              onRetry={loadData}
            />
          </div>
        ) : deliveries.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-md">
            <EmptyState
              icon={Truck}
              title="No delivery runs assigned"
              description="When an admin assigns a packed order to you, it will appear here with pickup and drop-off details."
              action={
                <button
                  onClick={loadData}
                  className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-md hover:bg-slate-800 transition"
                >
                  Check again
                </button>
              }
            />
          </div>
        ) : (
          <>
            {/* KPI strip */}
            <div className="grid grid-cols-3 gap-3">
              {[
                ["Assigned", deliveries.length],
                ["In progress", active.length],
                ["Delivered", done.length],
              ].map(([l, v]) => (
                <div
                  key={l}
                  className="bg-white border border-slate-200 rounded-md p-3"
                >
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    {l}
                  </div>
                  <div className="text-xl font-bold text-slate-900 tnum">{v}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {deliveries.map((d) => (
                <div
                  key={d.delivery_id}
                  className="bg-white rounded-md border border-slate-200 p-4 space-y-3"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <span className="tnum font-bold text-sm text-slate-900">
                        {d.order_number}
                      </span>
                      <div className="text-[11px] text-slate-500">
                        Vehicle: {d.vehicle_number || "Cold-Van 01"}
                      </div>
                    </div>
                    <StatusBadge status={d.status} />
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 bg-amber-50/60 rounded-md border border-amber-100">
                      <div className="font-bold text-slate-700 flex items-center gap-1.5 mb-0.5 text-[10px] uppercase tracking-wide">
                        <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        Pickup — supplier plant
                      </div>
                      <div className="text-slate-600 break-words">
                        {d.pickup_address}
                      </div>
                    </div>
                    <div className="p-2.5 bg-emerald-50/60 rounded-md border border-emerald-100">
                      <div className="font-bold text-slate-700 flex items-center gap-1.5 mb-0.5 text-[10px] uppercase tracking-wide">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        Drop-off — buyer kitchen
                      </div>
                      <div className="text-slate-600 break-words">
                        {d.delivery_address}
                      </div>
                      <div className="text-slate-500 mt-1 flex items-center gap-1">
                        <Phone className="w-3 h-3 shrink-0" /> {d.buyer_phone}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs px-2.5 py-2 bg-slate-50 rounded-md border border-slate-100">
                    <span className="text-slate-600 font-medium flex items-center gap-1">
                      <Scale className="w-3.5 h-3.5 text-slate-500" /> Net weight
                    </span>
                    <span className="tnum font-bold text-slate-900">
                      {d.total_weight_kg} kg
                    </span>
                  </div>

                  {d.status !== "DELIVERED" ? (
                    <button
                      onClick={() => handleOpenPOD(d)}
                      className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-md transition flex items-center justify-center gap-1.5 min-h-[44px]"
                    >
                      <FileSignature className="w-4 h-4" />
                      Capture proof of delivery
                    </button>
                  ) : (
                    <div className="text-center py-2.5 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-md border border-emerald-200 flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Delivered — handover complete
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* POD modal */}
      {selectedDelivery && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FileSignature className="w-4 h-4 text-sky-600" />
                Proof of delivery — {selectedDelivery.order_number}
              </h3>
              <button
                onClick={() => setSelectedDelivery(null)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCompletePOD} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Buyer verification OTP
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="w-full px-3 py-3 border border-slate-300 rounded-md tnum font-bold tracking-[0.4em] text-center text-base min-h-[44px]"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Authorized recipient
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full px-2.5 py-2.5 border border-slate-300 rounded-md min-h-[44px]"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Accepted (kg)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={acceptedWeight}
                    onChange={(e) => setAcceptedWeight(Number(e.target.value))}
                    className="w-full px-2.5 py-2.5 border border-slate-300 rounded-md tnum font-bold min-h-[44px]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Rejected (kg)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={rejectedWeight}
                    onChange={(e) => setRejectedWeight(Number(e.target.value))}
                    className="w-full px-2.5 py-2.5 border border-slate-300 rounded-md tnum font-bold text-rose-600 min-h-[44px]"
                  />
                </div>
              </div>
              {rejectedWeight > 0 && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                    Rejection reason
                  </label>
                  <input
                    type="text"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g., temperature spike, torn crate"
                    className="w-full px-2.5 py-2.5 border border-slate-300 rounded-md"
                    required
                  />
                </div>
              )}
              <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-md text-[10px] text-slate-500">
                Submitting records an immutable audit entry and completes the
                order lifecycle.
              </div>
              <div className="pt-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDelivery(null)}
                  className="px-3 py-2.5 border border-slate-300 rounded-md text-slate-600 hover:bg-slate-50 min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white font-bold rounded-md flex items-center gap-1.5 min-h-[44px]"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Complete delivery
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
