"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { 
  Truck, 
  MapPin, 
  Phone, 
  CheckCircle2, 
  Clock, 
  Camera, 
  FileSignature, 
  Key, 
  X,
  Scale
} from "lucide-react";

export function DriverPortal() {
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDelivery, setSelectedDelivery] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // POD Form fields
  const [otpCode, setOtpCode] = useState("1234");
  const [recipientName, setRecipientName] = useState("Executive Chef Kitchen Receiving");
  const [acceptedWeight, setAcceptedWeight] = useState<number>(0);
  const [rejectedWeight, setRejectedWeight] = useState<number>(0);
  const [rejectionReason, setRejectionReason] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.driver.getDeliveries();
      setDeliveries(data);
    } catch (err: any) {
      setMsg(`Error: ${err.message}`);
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
    if (!selectedDelivery) return;

    try {
      await api.driver.capturePOD(selectedDelivery.delivery_id, {
        pod_type: "OTP",
        otp_code: otpCode,
        recipient_name: recipientName,
        signature_url: "data:image/svg+xml;utf8,<svg>sig</svg>",
        photo_url: "https://mock-storage.thechickenman.com/pod/crate1.jpg",
        quantity_accepted_kg: Number(acceptedWeight),
        quantity_rejected_kg: Number(rejectedWeight || 0),
        rejection_reason: rejectionReason || undefined,
      });

      setMsg(`Proof of Delivery recorded for Order ${selectedDelivery.order_number}! Status: DELIVERED.`);
      setSelectedDelivery(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 flex justify-between items-center">
          <div className="h-6 bg-slate-200 rounded w-48"></div>
          <div className="h-4 bg-slate-200 rounded w-24"></div>
        </div>
        
        {/* Deliveries List Skeleton */}
        <div className="space-y-4">
          <div className="h-5 bg-slate-200 rounded w-40"></div>
          {[1, 2].map(i => (
            <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
              <div className="flex justify-between">
                <div className="h-5 bg-slate-200 rounded w-1/4"></div>
                <div className="h-6 bg-slate-200 rounded-full w-24"></div>
              </div>
              <div className="h-4 bg-slate-200 rounded w-2/4"></div>
              <div className="h-10 bg-slate-200 rounded-lg w-full mt-4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Truck className="w-6 h-6 text-blue-600" />
            Driver & Fulfillment Dispatch
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Pick up from verified supplier plants and capture immutable Proof of Delivery (POD) at recipient facilities.
          </p>
        </div>
        <button
          onClick={loadData}
          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-3 py-1.5 rounded-lg transition"
        >
          Refresh Jobs
        </button>
      </div>

      {msg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center justify-between">
          <span>{msg}</span>
          <button onClick={() => setMsg(null)} className="text-xs font-bold text-emerald-900">Dismiss</button>
        </div>
      )}

      {/* Deliveries List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {deliveries.length === 0 ? (
          <div className="col-span-2 text-center py-12 text-slate-400 text-sm bg-white rounded-xl border">
            No delivery runs currently assigned to this driver.
          </div>
        ) : (
          deliveries.map((d) => (
            <div
              key={d.delivery_id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 hover:border-slate-300 transition"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-mono font-bold text-sm text-slate-900">{d.order_number}</span>
                  <div className="text-xs text-slate-500">Vehicle: {d.vehicle_number || "Cold-Van 01"}</div>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    d.status === "DELIVERED"
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-blue-100 text-blue-800 border border-blue-300"
                  }`}
                >
                  {d.status}
                </span>
              </div>

              {/* Addresses */}
              <div className="space-y-2 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="font-semibold text-slate-700 flex items-center gap-1.5 mb-0.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-600" />
                    Pickup (Supplier Plant)
                  </div>
                  <div className="text-slate-600">{d.pickup_address}</div>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="font-semibold text-slate-700 flex items-center gap-1.5 mb-0.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    Drop-off (Buyer Kitchen)
                  </div>
                  <div className="text-slate-600">{d.delivery_address}</div>
                  <div className="text-slate-500 mt-1 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Contact: {d.buyer_phone}
                  </div>
                </div>
              </div>

              {/* Consignment Weight */}
              <div className="flex justify-between items-center text-xs p-2 bg-blue-50/50 rounded-lg border border-blue-100">
                <span className="text-slate-600 font-medium flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5 text-blue-600" /> Total Net Weight:
                </span>
                <span className="font-mono font-bold text-slate-900">{d.total_weight_kg} kg</span>
              </div>

              {/* Action */}
              {d.status !== "DELIVERED" ? (
                <button
                  onClick={() => handleOpenPOD(d)}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition shadow"
                >
                  Capture Proof of Delivery (POD)
                </button>
              ) : (
                <div className="text-center py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Delivered & Handover Completed
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* POD Modal */}
      {selectedDelivery && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl text-xs">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <FileSignature className="w-5 h-5 text-blue-600" />
                Capture Proof of Delivery (POD)
              </h3>
              <button onClick={() => setSelectedDelivery(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCompletePOD} className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Buyer Verification OTP
                </label>
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold tracking-widest text-center text-sm"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Recipient Authorized Name
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Accepted Net Qty (kg)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={acceptedWeight}
                    onChange={(e) => setAcceptedWeight(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded-lg font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Rejected Qty (kg)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={rejectedWeight}
                    onChange={(e) => setRejectedWeight(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded-lg font-bold text-rose-600"
                  />
                </div>
              </div>

              {rejectedWeight > 0 && (
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Rejection Reason
                  </label>
                  <input
                    type="text"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g., Temperature spike or torn crate"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
              )}

              <div className="p-2.5 bg-slate-50 border rounded-lg text-[11px] text-slate-500">
                Submitting records an immutable audit record and confirms order completion.
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDelivery(null)}
                  className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow"
                >
                  Complete Delivery & Record POD
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
