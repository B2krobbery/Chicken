"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { AppShell } from "@/components/ui/AppShell";
import { Sk, SkCard, SkKpi, SkTableRows } from "@/components/ui/Skeleton";
import { Banner, EmptyState, ErrorState, StatusBadge } from "@/components/ui/States";
import {
  ShoppingCart,
  Store,
  FileText,
  X,
  CreditCard,
  Package,
  Search,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { OrderTimelineTracker } from "@/components/OrderTimelineTracker";
import { GSTTaxInvoiceModal } from "@/components/GSTTaxInvoiceModal";

type ViewKey = "marketplace" | "cart" | "orders" | "invoices";

export function BuyerPortal() {
  const [view, setView] = useState<ViewKey>("marketplace");
  const [profile, setProfile] = useState<any>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [cart, setCart] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartBusy, setCartBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [conditionFilter, setConditionFilter] = useState("");
  const [pincodeFilter, setPincodeFilter] = useState("");

  // Per-listing quantity drafts
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, number>>({});

  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [paymentModalOrder, setPaymentModalOrder] = useState<any>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<any>(null);
  const [paying, setPaying] = useState(false);

  const refreshCart = async () => {
    try {
      setCart(await api.buyer.getCart());
    } catch {
      /* banner already covers fatal errors */
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, locs, lists, ords] = await Promise.all([
        api.buyer.getProfile(),
        api.buyer.getLocations(),
        api.buyer.searchListings({
          query: searchQuery || undefined,
          condition: conditionFilter || undefined,
          pincode: pincodeFilter || undefined,
        }),
        api.buyer.getOrders(),
      ]);
      setProfile(p);
      setLocations(locs);
      setListings(lists);
      setOrders(ords);
      setQtyDrafts((d) => {
        const next = { ...d };
        lists.forEach((l: any) => {
          if (next[l.id] === undefined) next[l.id] = l.moq_kg;
        });
        return next;
      });
      if (locs.length > 0 && !selectedLocationId) setSelectedLocationId(locs[0].id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    refreshCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(loadData, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, conditionFilter, pincodeFilter]);

  const handleAddToCart = async (listing: any, qty: number) => {
    if (cartBusy || qty <= 0) return;
    setCartBusy(true);
    try {
      await api.buyer.addToCart({
        supplier_product_id: listing.id,
        supplier_location_id: listing.supplier_location_id || undefined,
        quantity_kg: qty,
      });
      const updatedCart = await api.buyer.getCart();
      setCart(updatedCart);
      setMsg(`Added ${qty} kg of ${listing.product_name} to cart.`);
    } catch (err: any) {
      setMsg(null);
      setError(err.message);
    } finally {
      setCartBusy(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (cartBusy) return;
    setCartBusy(true);
    try {
      await api.buyer.removeCartItem(itemId);
      setCart(await api.buyer.getCart());
    } catch (err: any) {
      try {
        setCart(await api.buyer.getCart());
      } catch {}
      setError(err.message);
    } finally {
      setCartBusy(false);
    }
  };

  const handleCheckout = async () => {
    if (!selectedLocationId) {
      setError("Please select a delivery location");
      return;
    }
    if (cartBusy) return;
    setCartBusy(true);
    setError(null);
    try {
      const freshCart = await api.buyer.getCart();
      setCart(freshCart);
      if (!freshCart.is_valid_for_checkout || freshCart.items.length === 0) {
        setError(
          freshCart.validation_messages?.join(" ") ||
            "Cart is not valid for checkout."
        );
        return;
      }
      const order = await api.buyer.checkout({
        delivery_location_id: selectedLocationId,
        notes: "Urgent commercial requirement",
      });
      setMsg(`Order ${order.order_number} created — inventory reserved.`);
      setPaymentModalOrder(order);
      await refreshCart();
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCartBusy(false);
    }
  };

  const handleProcessPayment = async () => {
    if (!paymentModalOrder || paying) return;
    setPaying(true);
    setError(null);
    try {
      const intent = await api.buyer.createPaymentIntent(paymentModalOrder.id);
      await api.buyer.verifyPayment(
        intent.payment_id,
        `mock_txn_${Date.now()}`
      );
      setMsg(`Payment verified — GST invoice issued for ${paymentModalOrder.order_number}.`);
      setPaymentModalOrder(null);
      loadData();
      setView("orders");
    } catch (err: any) {
      setError(`Payment failed: ${err.message}`);
    } finally {
      setPaying(false);
    }
  };

  const handleViewInvoice = async (order: any) => {
    try {
      const inv = await api.buyer.getInvoice(order.id);
      setSelectedInvoice(inv);
      setSelectedOrderForInvoice(order);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const nav = [
    { key: "marketplace", label: "Marketplace", icon: Store },
    { key: "cart", label: "Cart", icon: ShoppingCart, badge: cart?.items_count || 0 },
    { key: "orders", label: "Orders", icon: Package, badge: orders.filter((o) => !["DELIVERED", "CANCELLED", "REJECTED", "REFUNDED"].includes(o.status)).length || undefined },
    { key: "invoices", label: "Invoices", icon: FileText },
  ];

  const marketplaceBody = loading ? (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SkKpi /><SkKpi /><SkKpi /><SkKpi />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <SkCard key={i} />
        ))}
      </div>
    </div>
  ) : error ? (
    <ErrorState
      title="Couldn't load the marketplace"
      description={error}
      onRetry={loadData}
    />
  ) : (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-md p-2.5 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search broiler, breast, curry cut…"
            className="w-full pl-8 pr-2 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
          />
        </div>
        <select
          value={conditionFilter}
          onChange={(e) => setConditionFilter(e.target.value)}
          className="px-2 py-1.5 border border-slate-300 rounded-md text-xs bg-white"
        >
          <option value="">All conditions</option>
          <option value="Fresh">Fresh</option>
          <option value="Chilled">Chilled</option>
          <option value="Frozen">Frozen</option>
          <option value="Processed">Processed</option>
        </select>
        <input
          value={pincodeFilter}
          onChange={(e) => setPincodeFilter(e.target.value)}
          placeholder="Pincode"
          className="w-24 px-2 py-1.5 border border-slate-300 rounded-md text-xs tnum"
        />
        {(searchQuery || conditionFilter || pincodeFilter) && (
          <button
            onClick={() => {
              setSearchQuery("");
              setConditionFilter("");
              setPincodeFilter("");
            }}
            className="text-xs text-slate-500 hover:text-slate-800 font-medium inline-flex items-center gap-1 px-2 py-1.5"
          >
            <RotateCcw className="w-3 h-3" /> Clear
          </button>
        )}
        <span className="ml-auto text-[11px] text-slate-400 tnum">
          {listings.length} listing{listings.length === 1 ? "" : "s"}
        </span>
      </div>

      {listings.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-md">
          <EmptyState
            icon={Store}
            title="No products match"
            description="Try clearing the filters or checking another pincode. Verified supplier listings will appear here."
            action={
              <button
                onClick={() => {
                  setSearchQuery("");
                  setConditionFilter("");
                  setPincodeFilter("");
                }}
                className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-md hover:bg-slate-800 transition"
              >
                Clear filters
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
          {listings.map((l) => {
            const qty = qtyDrafts[l.id] ?? l.moq_kg;
            const outOfStock = l.total_available_stock_kg < l.moq_kg;
            return (
              <div
                key={l.id}
                className="bg-white rounded-md border border-slate-200 hover:border-slate-300 transition flex flex-col"
              >
                <div className="p-3 flex-1">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                      {l.sku_code}
                    </span>
                    <StatusBadge status={l.condition} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mt-2 leading-snug break-words">
                    {l.product_name}
                  </h3>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {l.supplier_name}
                  </p>
                  <div className="mt-2.5 space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Base</span>
                      <span className="tnum font-semibold text-slate-900">
                        ₹{l.base_price_per_kg.toFixed(2)}/kg
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Landed (incl. 5% GST)</span>
                      <span className="tnum font-bold text-emerald-700">
                        ₹{l.landed_price_per_kg.toFixed(2)}/kg
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                      <span>MOQ {l.moq_kg} kg</span>
                      <span>Avail {l.total_available_stock_kg} kg</span>
                    </div>
                  </div>
                </div>
                <div className="p-2.5 border-t border-slate-100 flex items-center gap-2">
                  <input
                    type="number"
                    min={l.moq_kg}
                    step={1}
                    value={qty}
                    onChange={(e) =>
                      setQtyDrafts((d) => ({
                        ...d,
                        [l.id]: Math.max(0, Number(e.target.value)),
                      }))
                    }
                    aria-label={`Quantity in kg for ${l.product_name}`}
                    className="w-20 px-2 py-1.5 border border-slate-300 rounded-md text-xs tnum font-bold"
                  />
                  <span className="text-[10px] text-slate-400">kg</span>
                  <button
                    onClick={() => handleAddToCart(l, qty)}
                    disabled={outOfStock || cartBusy}
                    className={`flex-1 py-1.5 px-2 rounded-md text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      outOfStock || cartBusy
                        ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                        : "bg-slate-900 hover:bg-slate-800 text-white"
                    }`}
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    {outOfStock ? "Out of stock" : "Add"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const cartBody = (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
      {/* Items */}
      <div className="xl:col-span-2 bg-white border border-slate-200 rounded-md overflow-hidden">
        <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
            Cart line items
          </h3>
          <span className="text-[11px] text-slate-400 tnum">
            {cart?.items?.length || 0} item{cart?.items?.length === 1 ? "" : "s"}
          </span>
        </div>
        {!cart ? (
          <SkTableRows rows={3} cols={4} />
        ) : cart.items.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Your cart is empty"
            description="Browse the marketplace and add SKU quantities to build a procurement order."
            action={
              <button
                onClick={() => setView("marketplace")}
                className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-md hover:bg-slate-800 transition"
              >
                Browse marketplace
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-500 uppercase text-[10px] font-bold tracking-wide">
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2 text-right">Qty (kg)</th>
                  <th className="px-3 py-2 text-right">₹/kg</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cart.items.map((item: any) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-slate-900 break-words max-w-[220px]">
                        {item.product_name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {item.sku_code} · {item.supplier_name}
                      </div>
                      {!item.moq_met && (
                        <div className="text-[10px] text-rose-600 font-semibold mt-0.5">
                          Below MOQ ({item.moq_kg} kg)
                        </div>
                      )}
                      {!item.stock_sufficient && (
                        <div className="text-[10px] text-rose-600 font-semibold">
                          Only {item.available_stock_kg} kg available
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 max-w-[140px] truncate">
                      {item.location_name}
                    </td>
                    <td className="px-3 py-2.5 text-right tnum font-bold">
                      {item.quantity_kg}
                    </td>
                    <td className="px-3 py-2.5 text-right tnum text-slate-600">
                      {item.unit_price_per_kg.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-right tnum font-bold text-slate-900">
                      ₹{item.item_total.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={cartBusy}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-md disabled:opacity-40"
                        aria-label={`Remove ${item.product_name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="bg-white border border-slate-200 rounded-md overflow-hidden xl:sticky xl:top-16">
        <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
            Order summary
          </h3>
        </div>
        <div className="p-3 space-y-2 text-xs">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
            Delivery address
          </label>
          <select
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value)}
            className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-xs"
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} — {loc.address_line1}, {loc.city} {loc.pincode}
              </option>
            ))}
          </select>
          {cart?.items?.length > 0 && (
            <>
              <div className="pt-2 space-y-1.5 border-t border-slate-100">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span className="tnum">₹{cart.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>GST (5%)</span>
                  <span className="tnum">₹{cart.total_tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Cold-chain delivery</span>
                  <span className="tnum">₹{cart.delivery_fee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-slate-900 pt-2 border-t border-slate-200">
                  <span>Grand total</span>
                  <span className="tnum text-emerald-700">
                    ₹{cart.grand_total.toFixed(2)}
                  </span>
                </div>
              </div>
              {cart.validation_messages?.length > 0 && (
                <div className="pt-2 space-y-1">
                  {cart.validation_messages.map((m: string, i: number) => (
                    <div
                      key={i}
                      className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1"
                    >
                      {m}
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={handleCheckout}
                disabled={cartBusy || !cart.is_valid_for_checkout}
                className={`w-full mt-2 py-2.5 rounded-md text-xs font-bold transition flex items-center justify-center gap-2 ${
                  !cartBusy && cart.is_valid_for_checkout
                    ? "bg-brand-600 hover:bg-brand-700 text-white"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                {cartBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {cartBusy ? "Processing…" : "Place Order & Reserve Inventory"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const ordersTable = (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-500 uppercase text-[10px] font-bold tracking-wide">
            <th className="px-3 py-2 whitespace-nowrap">Order #</th>
            <th className="px-3 py-2 hidden md:table-cell">Supplier</th>
            <th className="px-3 py-2 text-right whitespace-nowrap">Total</th>
            <th className="px-3 py-2 whitespace-nowrap">Status</th>
            <th className="px-3 py-2 whitespace-nowrap hidden md:table-cell">Placed</th>
            <th className="px-3 py-2 text-right whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orders.map((o) => {
            const isExpanded = expandedOrderId === o.id;
            return (
              <React.Fragment key={o.id}>
                <tr
                  onClick={() =>
                    setExpandedOrderId(isExpanded ? null : o.id)
                  }
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
                    {o.supplier_name}
                  </td>
                  <td className="px-3 py-2.5 text-right tnum font-bold whitespace-nowrap">
                    ₹{o.total_amount?.toLocaleString("en-IN")}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <StatusBadge status={o.status} pulse={["PENDING","CONFIRMED","PROCESSING","DISPATCHED"].includes(o.status)} />
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap hidden md:table-cell">
                    {new Date(o.created_at).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td
                    className="px-3 py-2.5 text-right space-x-1.5 whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {o.status === "PENDING" && (
                      <button
                        onClick={() => setPaymentModalOrder(o)}
                        className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-2.5 py-1 rounded-md text-[11px]"
                      >
                        Pay now
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
                    <td colSpan={6} className="px-3 py-3">
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
  );

  const ordersBody = (
    <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
      <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
          Order history & tracking
        </h3>
        <span className="text-[11px] text-slate-400 hidden sm:inline">
          Click a row for the fulfillment timeline
        </span>
      </div>
      {orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No orders yet"
          description="Orders you place with verified suppliers will appear here with real-time fulfillment tracking."
          action={
            <button
              onClick={() => setView("marketplace")}
              className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-md hover:bg-slate-800 transition"
            >
              Browse marketplace
            </button>
          }
        />
      ) : (
        ordersTable
      )}
    </div>
  );

  const invoicesBody = (
    <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
      <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
          GST tax invoices
        </h3>
      </div>
      {orders.filter((o) => !["PENDING", "CANCELLED", "REJECTED"].includes(o.status)).length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No invoices yet"
          description="GST-compliant tax invoices are issued automatically after payment verification."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-500 uppercase text-[10px] font-bold tracking-wide">
                <th className="px-3 py-2">Order #</th>
                <th className="px-3 py-2 hidden md:table-cell">Supplier</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders
                .filter((o) => !["PENDING", "CANCELLED", "REJECTED"].includes(o.status))
                .map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2.5 tnum font-bold">{o.order_number}</td>
                    <td className="px-3 py-2.5 text-slate-700 max-w-[200px] truncate hidden md:table-cell">
                      {o.supplier_name}
                    </td>
                    <td className="px-3 py-2.5 text-right tnum font-bold">
                      ₹{o.total_amount?.toLocaleString("en-IN")}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => handleViewInvoice(o)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-2.5 py-1 rounded-md text-[11px] inline-flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3 text-emerald-600" /> View
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <AppShell
      nav={nav}
      activeKey={view}
      onNavigate={(k) => setView(k as ViewKey)}
      breadcrumb={[
        "Workspace",
        view === "marketplace"
          ? "Marketplace"
          : view === "cart"
          ? "Cart"
          : view === "invoices"
          ? "Invoices"
          : "Orders",
      ]}
      subtitle={profile?.business_name}
    >
      <div className="space-y-4 max-w-[1600px] mx-auto">
        {msg && <Banner message={msg} onDismiss={() => setMsg(null)} />}
        {error && (
          <Banner message={error} onDismiss={() => setError(null)} tone="error" />
        )}

        {view === "marketplace" && marketplaceBody}
        {view !== "marketplace" &&
          (loading ? (
            <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
              <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200">
                <Sk className="h-3.5 w-44" />
              </div>
              <SkTableRows rows={5} cols={5} />
            </div>
          ) : (
            <>
              {view === "cart" && cartBody}
              {view === "orders" && ordersBody}
              {view === "invoices" && invoicesBody}
            </>
          ))}
      </div>

      {/* Payment modal */}
      {paymentModalOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl text-xs">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-brand-600" />
                Payment & invoicing
              </h3>
              <button
                onClick={() => setPaymentModalOrder(null)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-slate-50 rounded-md space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Order</span>
                <span className="tnum font-bold">{paymentModalOrder.order_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount due</span>
                <span className="tnum font-bold text-emerald-700 text-sm">
                  ₹{paymentModalOrder.total_amount?.toLocaleString("en-IN")}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 pt-1">
                Stock is reserved for 30 minutes. Verifying payment issues the
                GST invoice immediately. (Mock payment provider)
              </p>
            </div>
            <button
              onClick={handleProcessPayment}
              disabled={paying}
              className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white font-bold rounded-md transition flex items-center justify-center gap-2 text-xs"
            >
              {paying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {paying ? "Verifying payment…" : "Simulate Payment & Verify"}
            </button>
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
