"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { 
  Store, 
  Layers, 
  PlusCircle, 
  Check, 
  X, 
  
  AlertTriangle, 
  CheckCircle2, 
  FileSpreadsheet,
  PackageCheck,
  FileText,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { OrderTimelineTracker } from "@/components/OrderTimelineTracker";
import { GSTTaxInvoiceModal } from "@/components/GSTTaxInvoiceModal";

export function SupplierPortal() {
  const [profile, setProfile] = useState<any>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  // Invoices & Order Timeline
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<any>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Forms
  const [showStockIn, setShowStockIn] = useState(false);
  const [stockInLocationId, setStockInLocationId] = useState("");
  const [stockInProductId, setStockInProductId] = useState("");
  const [stockInBatchId, setStockInBatchId] = useState("");
  const [stockInQty, setStockInQty] = useState(100);

  // Price Edit
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editPriceVal, setEditPriceVal] = useState<number>(160);
  const [editMoqVal, setEditMoqVal] = useState<number>(20);

  const loadData = async () => {
    setLoading(true);
    try {
      const [p, locs, lists, bts, inv, ords] = await Promise.all([
        api.supplier.getProfile(),
        api.supplier.getLocations(),
        api.supplier.getMyListings(),
        api.supplier.getBatches(),
        api.supplier.getInventory(),
        api.buyer.getOrders(), // returns orders filtered by authenticated supplier session
      ]);
      setProfile(p);
      setLocations(locs);
      setListings(lists);
      setBatches(bts);
      setInventory(inv);
      setOrders(ords);

      if (locs.length > 0) setStockInLocationId(locs[0].id);
      if (lists.length > 0) setStockInProductId(lists[0].product_id);
      if (bts.length > 0) setStockInBatchId(bts[0].id);
    } catch (err: any) {
      setMsg(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.supplier.stockIn({
        location_id: stockInLocationId,
        product_id: stockInProductId,
        quantity_kg: Number(stockInQty),
        batch_id: stockInBatchId || undefined,
        notes: "Restock via Portal"
      });
      setMsg(`Successfully stocked in ${stockInQty} kg.`);
      setShowStockIn(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePriceUpdate = async (listingId: string) => {
    try {
      await api.supplier.updatePrice({
        supplier_product_id: listingId,
        price_per_kg: Number(editPriceVal),
        moq_kg: Number(editMoqVal)
      });
      setMsg(`Price updated to ₹${editPriceVal}/kg. Version incremented.`);
      setEditingPriceId(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAcceptOrder = async (orderId: string) => {
    try {
      await api.supplier.acceptOrder(orderId);
      setMsg("Order accepted and allocated!");
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    const reason = prompt("Enter reason for rejection:");
    if (!reason) return;
    try {
      await api.supplier.rejectOrder(orderId, reason);
      setMsg("Order rejected and stock released.");
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAdvanceStatus = async (orderId: string, nextStatus: string) => {
    try {
      await api.supplier.updateStatus(orderId, nextStatus, `Updated by supplier to ${nextStatus}`);
      setMsg(`Order status changed to ${nextStatus}`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleViewInvoice = async (order: any) => {
    try {
      const inv = await api.buyer.getInvoice(order.id);
      setSelectedInvoice(inv);
      setSelectedOrderForInvoice(order);
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-8 bg-slate-200 rounded w-48"></div>
              <div className="h-5 bg-slate-200 rounded-full w-24"></div>
            </div>
            <div className="h-4 bg-slate-200 rounded w-72"></div>
          </div>
          <div className="h-10 bg-slate-200 rounded-lg w-40"></div>
        </div>
        
        {/* Table Skeleton 1 */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between">
            <div className="h-5 bg-slate-200 rounded w-64"></div>
            <div className="h-5 bg-slate-200 rounded w-20"></div>
          </div>
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex justify-between">
                <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                <div className="h-4 bg-slate-200 rounded w-1/6"></div>
                <div className="h-4 bg-slate-200 rounded w-1/6"></div>
                <div className="h-4 bg-slate-200 rounded w-1/6"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Table Skeleton 2 */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <div className="h-5 bg-slate-200 rounded w-48"></div>
          </div>
          <div className="p-4 space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="flex justify-between">
                <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                <div className="h-4 bg-slate-200 rounded w-1/5"></div>
                <div className="h-4 bg-slate-200 rounded w-1/6"></div>
                <div className="h-4 bg-slate-200 rounded w-1/6"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Profile Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{profile?.business_name}</h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                profile?.kyc_status === "APPROVED"
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : "bg-amber-100 text-amber-800 border border-amber-300"
              }`}
            >
              KYC: {profile?.kyc_status}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            FSSAI: <span className="font-mono">{profile?.kyc?.fssai_license_number || "N/A"}</span> | 
            GSTIN: <span className="font-mono">{profile?.kyc?.gstin || "N/A"}</span> | 
            Bank: <span className="font-mono">{profile?.kyc?.bank_name} ({profile?.kyc?.bank_ifsc})</span>
          </p>
        </div>

        <button
          onClick={() => setShowStockIn(true)}
          className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 shadow transition"
        >
          <PlusCircle className="w-4 h-4" />
          Stock In Inventory
        </button>
      </div>

      {msg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center justify-between">
          <span>{msg}</span>
          <button onClick={() => setMsg(null)} className="text-xs font-bold text-emerald-900">Dismiss</button>
        </div>
      )}

      {/* Stock In Modal */}
      {showStockIn && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base">Add Poultry Stock (Stock In)</h3>
              <button onClick={() => setShowStockIn(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleStockIn} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Facility / Plant</label>
                <select
                  value={stockInLocationId}
                  onChange={(e) => setStockInLocationId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.name} ({loc.city})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Product SKU</label>
                <select
                  value={stockInProductId}
                  onChange={(e) => setStockInProductId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                >
                  {listings.map((l) => (
                    <option key={l.product_id} value={l.product_id}>{l.product_name} ({l.sku_code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Production Batch</label>
                <select
                  value={stockInBatchId}
                  onChange={(e) => setStockInBatchId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batch_number} (Exp: {b.expiry_date})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Quantity (Kilograms)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={stockInQty}
                  onChange={(e) => setStockInQty(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded-lg font-bold"
                  required
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowStockIn(false)}
                  className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg"
                >
                  Confirm Stock In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Real-time Inventory Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Real-Time Inventory Balances (Multi-State Ledger)</h3>
            <p className="text-xs text-slate-500">Atomic reservation guarantees zero overselling under concurrent load</p>
          </div>
          <span className="text-xs font-mono bg-slate-200 px-2 py-1 rounded">
            {inventory.length} Stock Records
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 uppercase font-semibold">
                <th className="p-3">Product / SKU</th>
                <th className="p-3">Batch & Expiry</th>
                <th className="p-3 text-right text-emerald-700 font-bold">Available (kg)</th>
                <th className="p-3 text-right text-amber-700">Reserved (kg)</th>
                <th className="p-3 text-right text-blue-700">Allocated (kg)</th>
                <th className="p-3 text-right text-purple-700">Dispatched (kg)</th>
                <th className="p-3 text-right text-slate-700">Delivered (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inventory.map((i) => (
                <tr key={i.id} className="hover:bg-slate-50/50">
                  <td className="p-3 font-semibold text-slate-900">
                    {i.product_name}
                    <div className="text-[11px] text-slate-500 font-mono">{i.sku_code}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-mono">{i.batch_number || "No Batch"}</div>
                    <div className="text-[10px] text-slate-500">Exp: {i.expiry_date || "N/A"}</div>
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-emerald-600 text-sm">
                    {i.quantity_available_kg.toFixed(2)}
                  </td>
                  <td className="p-3 text-right font-mono text-amber-600">
                    {i.quantity_reserved_kg.toFixed(2)}
                  </td>
                  <td className="p-3 text-right font-mono text-blue-600">
                    {i.quantity_allocated_kg.toFixed(2)}
                  </td>
                  <td className="p-3 text-right font-mono text-purple-600">
                    {i.quantity_dispatched_kg.toFixed(2)}
                  </td>
                  <td className="p-3 text-right font-mono text-slate-600">
                    {i.quantity_delivered_kg.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Listings & Pricing Management */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <h3 className="font-bold text-slate-800 text-sm">Active SKU Listings & Versioned Pricing</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 uppercase font-semibold">
                <th className="p-3">Product SKU</th>
                <th className="p-3">Condition</th>
                <th className="p-3">Current Price/kg</th>
                <th className="p-3">MOQ (kg)</th>
                <th className="p-3">Service PINs</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listings.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/50">
                  <td className="p-3 font-semibold text-slate-900">{l.product_name}</td>
                  <td className="p-3 font-medium text-slate-600">{l.condition}</td>
                  <td className="p-3 font-mono font-bold text-slate-900">
                    {editingPriceId === l.id ? (
                      <input
                        type="number"
                        value={editPriceVal}
                        onChange={(e) => setEditPriceVal(Number(e.target.value))}
                        className="w-20 p-1 border rounded"
                      />
                    ) : (
                      `₹${l.base_price_per_kg.toFixed(2)}`
                    )}
                  </td>
                  <td className="p-3 font-mono">
                    {editingPriceId === l.id ? (
                      <input
                        type="number"
                        value={editMoqVal}
                        onChange={(e) => setEditMoqVal(Number(e.target.value))}
                        className="w-16 p-1 border rounded"
                      />
                    ) : (
                      `${l.moq_kg} kg`
                    )}
                  </td>
                  <td className="p-3 text-slate-500">{l.serviceable_pincodes?.slice(0, 3).join(", ")}...</td>
                  <td className="p-3 text-right">
                    {editingPriceId === l.id ? (
                      <div className="space-x-1">
                        <button
                          onClick={() => handlePriceUpdate(l.id)}
                          className="bg-emerald-600 text-white px-2 py-1 rounded text-xs"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingPriceId(null)}
                          className="bg-slate-200 px-2 py-1 rounded text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingPriceId(l.id);
                          setEditPriceVal(l.base_price_per_kg);
                          setEditMoqVal(l.moq_kg);
                        }}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium px-2.5 py-1 rounded transition text-xs"
                      >
                        Edit Price
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Modal */}
      {selectedInvoice && (
        <GSTTaxInvoiceModal
          invoice={selectedInvoice}
          orderId={selectedOrderForInvoice?.id || selectedInvoice.order_id}
          onClose={() => {
            setSelectedInvoice(null);
            setSelectedOrderForInvoice(null);
          }}
        />
      )}

      {/* Incoming Orders Management */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Fulfillment & Order Acceptance</h3>
            <p className="text-[11px] text-slate-500">Real-time order workflow, cold-chain status transitions, and GST invoices.</p>
          </div>
          <span className="text-xs text-slate-400 font-medium">Click order row to expand timeline</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 uppercase font-semibold">
                <th className="p-3">Order Number</th>
                <th className="p-3">Buyer Enterprise</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Status & Tracking</th>
                <th className="p-3 text-right">Order Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => {
                const isExpanded = expandedOrderId === o.id;
                return (
                  <React.Fragment key={o.id}>
                    <tr 
                      onClick={() => setExpandedOrderId(isExpanded ? null : o.id)}
                      className="hover:bg-slate-50/70 transition cursor-pointer select-none"
                    >
                      <td className="p-3 font-mono font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          )}
                          <span>{o.order_number}</span>
                        </div>
                      </td>
                      <td className="p-3 font-medium text-slate-800">{o.buyer_name}</td>
                      <td className="p-3 font-mono font-bold text-slate-900">₹{o.total_amount?.toLocaleString()}</td>
                      <td className="p-3">
                        <OrderTimelineTracker 
                          status={o.status} 
                          compact 
                          driverName={o.driver_name} 
                          vehicleNumber={o.vehicle_number} 
                        />
                      </td>
                      <td className="p-3 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                        {o.status === "PENDING" && (
                          <>
                            <button
                              onClick={() => handleAcceptOrder(o.id)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-2.5 py-1 rounded transition text-xs shadow-xs"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleRejectOrder(o.id)}
                              className="bg-rose-100 hover:bg-rose-200 text-rose-800 font-medium px-2.5 py-1 rounded transition text-xs"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {o.status === "CONFIRMED" && (
                          <button
                            onClick={() => handleAdvanceStatus(o.id, "PROCESSING")}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-2.5 py-1 rounded transition text-xs shadow-xs"
                          >
                            Start Processing
                          </button>
                        )}
                        {o.status === "PROCESSING" && (
                          <button
                            onClick={() => handleAdvanceStatus(o.id, "PACKED")}
                            className="bg-purple-600 hover:bg-purple-500 text-white font-medium px-2.5 py-1 rounded transition text-xs shadow-xs"
                          >
                            Mark Packed
                          </button>
                        )}
                        {o.status !== "PENDING" && (
                          <button
                            onClick={() => handleViewInvoice(o)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium px-2.5 py-1 rounded transition text-xs inline-flex items-center gap-1 border border-slate-200"
                          >
                            <FileText className="w-3.5 h-3.5 text-emerald-600" />
                            Invoice
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50/80 border-b border-slate-200">
                        <td colSpan={5} className="p-4 sm:p-5">
                          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 border-b border-slate-100 pb-2">
                              <div>
                                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                                  <span>Fulfillment Progression Stepper</span>
                                  <span className="font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded text-[11px]">
                                    {o.order_number}
                                  </span>
                                </h4>
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Order Placed: {new Date(o.created_at).toLocaleString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                              </div>
                            </div>
                            <OrderTimelineTracker
                              status={o.status}
                              driverName={o.driver_name}
                              vehicleNumber={o.vehicle_number}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
