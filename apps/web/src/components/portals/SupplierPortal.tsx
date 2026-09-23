"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { AppShell } from "@/components/ui/AppShell";
import { Sk, SkKpi, SkTableRows } from "@/components/ui/Skeleton";
import { Banner, EmptyState, ErrorState, StatusBadge } from "@/components/ui/States";
import {
  LayoutDashboard,
  Layers,
  Tags,
  Package,
  PlusCircle,
  X,
  FileText,
  ChevronDown,
  ChevronUp,
  Loader2,
  Store,
} from "lucide-react";
import { OrderTimelineTracker } from "@/components/OrderTimelineTracker";
import { GSTTaxInvoiceModal } from "@/components/GSTTaxInvoiceModal";

type ViewKey = "overview" | "inventory" | "listings" | "orders";

export function SupplierPortal() {
  const [view, setView] = useState<ViewKey>("overview");
  const [profile, setProfile] = useState<any>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<any>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Stock-in form
  const [showStockIn, setShowStockIn] = useState(false);
  const [stockInLocationId, setStockInLocationId] = useState("");
  const [stockInProductId, setStockInProductId] = useState("");
  const [stockInBatchId, setStockInBatchId] = useState("");
  const [stockInQty, setStockInQty] = useState(100);

  // Inline price editing
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editPriceVal, setEditPriceVal] = useState<number>(160);
  const [editMoqVal, setEditMoqVal] = useState<number>(20);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, locs, lists, bts, inv, ords] = await Promise.all([
        api.supplier.getProfile(),
        api.supplier.getLocations(),
        api.supplier.getMyListings(),
        api.supplier.getBatches(),
        api.supplier.getInventory(),
        api.buyer.getOrders(), // returns orders for the authenticated supplier
      ]);
      setProfile(p);
      setLocations(locs);
      setListings(lists);
      setBatches(bts);
      setInventory(inv);
      setOrders(ords);
      if (locs.length > 0 && !stockInLocationId) setStockInLocationId(locs[0].id);
      if (lists.length > 0 && !stockInProductId) setStockInProductId(lists[0].product_id);
      if (bts.length > 0 && !stockInBatchId) setStockInBatchId(bts[0].id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (fn: () => Promise<void>) => {
    if (actionBusy) return;
    setActionBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionBusy(false);
    }
  };

  const handleStockIn = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api.supplier.stockIn({
        location_id: stockInLocationId,
        product_id: stockInProductId,
        quantity_kg: Number(stockInQty),
        batch_id: stockInBatchId || undefined,
        notes: "Restock via Portal",
      });
      setMsg(`Stocked in ${stockInQty} kg.`);
      setShowStockIn(false);
      loadData();
    });
  };

  const handlePriceUpdate = (listingId: string) =>
    run(async () => {
      await api.supplier.updatePrice({
        supplier_product_id: listingId,
        price_per_kg: Number(editPriceVal),
        moq_kg: Number(editMoqVal),
      });
      setMsg(`Price updated to ₹${editPriceVal}/kg — new version created.`);
      setEditingPriceId(null);
      loadData();
    });

  const handleAcceptOrder = (orderId: string) =>
    run(async () => {
      await api.supplier.acceptOrder(orderId);
      setMsg("Order accepted — stock allocated.");
      loadData();
    });

  const handleRejectOrder = (orderId: string) => {
    const reason = prompt("Enter reason for rejection:");
    if (!reason) return;
    run(async () => {
      await api.supplier.rejectOrder(orderId, reason);
      setMsg("Order rejected — reservation released.");
      loadData();
    });
  };

  const handleAdvanceStatus = (orderId: string, nextStatus: string) =>
    run(async () => {
      await api.supplier.updateStatus(orderId, nextStatus, `Updated by supplier to ${nextStatus}`);
      setMsg(`Order status → ${nextStatus}`);
      loadData();
    });

  const handleViewInvoice = async (order: any) => {
    try {
      const inv = await api.buyer.getInvoice(order.id);
      setSelectedInvoice(inv);
      setSelectedOrderForInvoice(order);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const pendingOrders = orders.filter((o) => o.status === "PENDING");
  const activeOrders = orders.filter((o) =>
    ["CONFIRMED", "PROCESSING", "PACKED", "DISPATCHED"].includes(o.status)
  );
  const totalAvailable = inventory.reduce(
    (s: number, i: any) => s + (i.quantity_available_kg || 0),
    0
  );

  const nav = [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    { key: "inventory", label: "Inventory", icon: Layers, badge: inventory.length || undefined },
    { key: "listings", label: "Listings & Pricing", icon: Tags, badge: listings.length || undefined },
    { key: "orders", label: "Orders", icon: Package, badge: pendingOrders.length || undefined },
  ];

  const kpis = [
    {
      label: "Available stock",
      value: `${totalAvailable.toLocaleString("en-IN")} kg`,
      sub: `${inventory.length} ledger records`,
    },
    {
      label: "Pending orders",
      value: pendingOrders.length,
      sub: "Awaiting your acceptance",
      warn: pendingOrders.length > 0,
    },
    {
      label: "In fulfilment",
      value: activeOrders.length,
      sub: "Confirmed → dispatched",
    },
    {
      label: "Active SKUs",
      value: listings.length,
      sub: `${locations.length} dispatch location${locations.length === 1 ? "" : "s"}`,
    },
  ];

  const inventoryBody = (
    <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
      <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
        <div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
            Inventory ledger
          </h3>
          <p className="text-[10px] text-slate-500">
            Row-level locked balances — atomic reservation, zero oversell
          </p>
        </div>
        <span className="text-[11px] text-slate-400 tnum">
          {inventory.length} records
        </span>
      </div>
      {inventory.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No inventory yet"
          description="Stock in a production batch to create your first inventory ledger record."
          action={
            <button
              onClick={() => setShowStockIn(true)}
              className="px-3 py-1.5 bg-brand-600 text-white text-xs font-bold rounded-md hover:bg-brand-700 transition"
            >
              Stock in
            </button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-500 uppercase text-[10px] font-bold tracking-wide">
                <th className="px-3 py-2">Product / SKU</th>
                <th className="px-3 py-2">Batch · Expiry</th>
                <th className="px-3 py-2 text-right text-emerald-700">Avail kg</th>
                <th className="px-3 py-2 text-right text-amber-700">Resv kg</th>
                <th className="px-3 py-2 text-right text-blue-700">Alloc kg</th>
                <th className="px-3 py-2 text-right text-sky-700">Disp kg</th>
                <th className="px-3 py-2 text-right text-slate-600">Dlvrd kg</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inventory.map((i) => (
                <tr key={i.id} className="hover:bg-slate-50/50">
                  <td className="px-3 py-2.5">
                    <div className="font-semibold text-slate-900 break-words">
                      {i.product_name}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {i.sku_code}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-mono text-slate-700">
                      {i.batch_number || "—"}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Exp: {i.expiry_date || "N/A"}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right tnum font-bold text-emerald-700">
                    {i.quantity_available_kg.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-right tnum text-amber-700">
                    {i.quantity_reserved_kg.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-right tnum text-blue-700">
                    {i.quantity_allocated_kg.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-right tnum text-sky-700">
                    {i.quantity_dispatched_kg.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-right tnum text-slate-600">
                    {i.quantity_delivered_kg.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const listingsBody = (
    <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
      <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
          SKU listings & versioned pricing
        </h3>
        <span className="text-[11px] text-slate-400">
          Price changes are versioned — history is immutable
        </span>
      </div>
      {listings.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No listings"
          description="Approved KYC is required before SKUs can be listed for sale."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-500 uppercase text-[10px] font-bold tracking-wide">
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Condition</th>
                <th className="px-3 py-2 text-right">Price ₹/kg</th>
                <th className="px-3 py-2 text-right">MOQ kg</th>
                <th className="px-3 py-2">Service PINs</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listings.map((l) => {
                const editing = editingPriceId === l.id;
                return (
                  <tr key={l.id} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2.5 font-semibold text-slate-900 break-words max-w-[200px]">
                      {l.product_name}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={l.condition} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {editing ? (
                        <input
                          type="number"
                          value={editPriceVal}
                          onChange={(e) => setEditPriceVal(Number(e.target.value))}
                          className="w-20 px-1.5 py-1 border border-slate-300 rounded tnum text-xs"
                          aria-label="New price per kg"
                        />
                      ) : (
                        <span className="tnum font-bold text-slate-900">
                          ₹{l.base_price_per_kg.toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {editing ? (
                        <input
                          type="number"
                          value={editMoqVal}
                          onChange={(e) => setEditMoqVal(Number(e.target.value))}
                          className="w-16 px-1.5 py-1 border border-slate-300 rounded tnum text-xs"
                          aria-label="New MOQ in kg"
                        />
                      ) : (
                        <span className="tnum">{l.moq_kg}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 font-mono text-[10px] max-w-[140px] truncate">
                      {l.serviceable_pincodes?.slice(0, 3).join(", ")}
                      {l.serviceable_pincodes?.length > 3 ? "…" : ""}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {editing ? (
                        <span className="space-x-1">
                          <button
                            onClick={() => handlePriceUpdate(l.id)}
                            disabled={actionBusy}
                            className="bg-emerald-600 text-white px-2 py-1 rounded-md text-[11px] font-bold disabled:opacity-40"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingPriceId(null)}
                            className="bg-slate-200 text-slate-700 px-2 py-1 rounded-md text-[11px]"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingPriceId(l.id);
                            setEditPriceVal(l.base_price_per_kg);
                            setEditMoqVal(l.moq_kg);
                          }}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-2.5 py-1 rounded-md text-[11px] transition"
                        >
                          Edit price
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const ordersBody = (
    <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
      <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
          Incoming orders
        </h3>
        <span className="text-[11px] text-slate-400">
          Click a row for the fulfillment timeline
        </span>
      </div>
      {orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No orders yet"
          description="Buyer orders for your listings will appear here for acceptance and fulfilment."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-500 uppercase text-[10px] font-bold tracking-wide">
                <th className="px-3 py-2">Order #</th>
                <th className="px-3 py-2 hidden md:table-cell">Buyer</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => {
                const isExpanded = expandedOrderId === o.id;
                return (
                  <React.Fragment key={o.id}>
                    <tr
                      onClick={() => setExpandedOrderId(isExpanded ? null : o.id)}
                      className="hover:bg-slate-50/70 cursor-pointer select-none"
                    >
                      <td className="px-3 py-2.5 tnum font-bold text-slate-900 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 text-brand-600" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          {o.order_number}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-700 max-w-[180px] truncate hidden md:table-cell">
                        {o.buyer_name}
                      </td>
                      <td className="px-3 py-2.5 text-right tnum font-bold">
                        ₹{o.total_amount?.toLocaleString("en-IN")}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={o.status} pulse={o.status === "PENDING"} />
                      </td>
                      <td
                        className="px-3 py-2.5 text-right space-x-1.5 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {o.status === "PENDING" && (
                          <>
                            <button
                              onClick={() => handleAcceptOrder(o.id)}
                              disabled={actionBusy}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded-md text-[11px] disabled:opacity-40"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleRejectOrder(o.id)}
                              disabled={actionBusy}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold px-2.5 py-1 rounded-md text-[11px] disabled:opacity-40"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {o.status === "CONFIRMED" && (
                          <button
                            onClick={() => handleAdvanceStatus(o.id, "PROCESSING")}
                            disabled={actionBusy}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1 rounded-md text-[11px] disabled:opacity-40"
                          >
                            Start processing
                          </button>
                        )}
                        {o.status === "PROCESSING" && (
                          <button
                            onClick={() => handleAdvanceStatus(o.id, "PACKED")}
                            disabled={actionBusy}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2.5 py-1 rounded-md text-[11px] disabled:opacity-40"
                          >
                            Mark packed
                          </button>
                        )}
                        {!["PENDING", "CANCELLED", "REJECTED"].includes(o.status) && (
                          <button
                            onClick={() => handleViewInvoice(o)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-2.5 py-1 rounded-md text-[11px] inline-flex items-center gap-1"
                          >
                            <FileText className="w-3 h-3 text-emerald-600" />
                            Invoice
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50/60">
                        <td colSpan={5} className="px-3 py-3">
                          <OrderTimelineTracker
                            status={o.status}
                            driverName={o.driver_name}
                            vehicleNumber={o.vehicle_number}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const overviewBody = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="bg-white border border-slate-200 rounded-md p-3"
          >
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
              {k.label}
            </div>
            <div className="text-xl font-bold text-slate-900 tnum mt-1">
              {k.value}
            </div>
            <div
              className={`text-[10px] mt-0.5 ${
                k.warn ? "text-amber-600 font-semibold" : "text-slate-400"
              }`}
            >
              {k.sub}
            </div>
          </div>
        ))}
      </div>
      {ordersBody}
    </div>
  );

  return (
    <AppShell
      nav={nav}
      activeKey={view}
      onNavigate={(k) => setView(k as ViewKey)}
      breadcrumb={["Supplier", view[0].toUpperCase() + view.slice(1)]}
      subtitle={profile?.business_name}
      actions={
        <button
          onClick={() => setShowStockIn(true)}
          className="bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-md flex items-center gap-1.5 transition"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Stock in</span>
        </button>
      }
    >
      <div className="space-y-4 max-w-[1600px] mx-auto">
        {/* KYC header strip */}
        <div className="bg-white border border-slate-200 rounded-md px-3 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px]">
          <span className="font-bold text-slate-900 text-sm">
            {profile?.business_name || "Supplier workspace"}
          </span>
          {profile?.kyc_status && <StatusBadge status={profile.kyc_status} />}
          <span className="text-slate-500">
            FSSAI <span className="font-mono">{profile?.kyc?.fssai_license_number || "N/A"}</span>
          </span>
          <span className="text-slate-500">
            GSTIN <span className="font-mono">{profile?.kyc?.gstin || "N/A"}</span>
          </span>
          <span className="text-slate-500 hidden md:inline">
            Bank <span className="font-mono">{profile?.kyc?.bank_name} ({profile?.kyc?.bank_ifsc})</span>
          </span>
        </div>

        {msg && <Banner message={msg} onDismiss={() => setMsg(null)} />}
        {error && <Banner message={error} onDismiss={() => setError(null)} tone="error" />}

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <SkKpi /><SkKpi /><SkKpi /><SkKpi />
            </div>
            <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
              <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200">
                <Sk className="h-3.5 w-40" />
              </div>
              <SkTableRows rows={6} cols={6} />
            </div>
          </div>
        ) : (
          <>
            {view === "overview" && overviewBody}
            {view === "inventory" && inventoryBody}
            {view === "listings" && listingsBody}
            {view === "orders" && ordersBody}
          </>
        )}
      </div>

      {/* Stock-in modal */}
      {showStockIn && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">
                Stock in — add inventory
              </h3>
              <button
                onClick={() => setShowStockIn(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleStockIn} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Facility / plant
                </label>
                <select
                  value={stockInLocationId}
                  onChange={(e) => setStockInLocationId(e.target.value)}
                  className="w-full px-2 py-2 border border-slate-300 rounded-md"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.city})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Product SKU
                </label>
                <select
                  value={stockInProductId}
                  onChange={(e) => setStockInProductId(e.target.value)}
                  className="w-full px-2 py-2 border border-slate-300 rounded-md"
                >
                  {listings.map((l) => (
                    <option key={l.product_id} value={l.product_id}>
                      {l.product_name} ({l.sku_code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Production batch
                </label>
                <select
                  value={stockInBatchId}
                  onChange={(e) => setStockInBatchId(e.target.value)}
                  className="w-full px-2 py-2 border border-slate-300 rounded-md"
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batch_number} (Exp: {b.expiry_date})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Quantity (kg)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={stockInQty}
                  onChange={(e) => setStockInQty(Number(e.target.value))}
                  className="w-full px-2 py-2 border border-slate-300 rounded-md tnum font-bold"
                  required
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowStockIn(false)}
                  className="px-3 py-2 border border-slate-300 rounded-md text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionBusy}
                  className="px-3 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white font-bold rounded-md flex items-center gap-1.5"
                >
                  {actionBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm stock in
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice modal */}
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
    </AppShell>
  );
}
