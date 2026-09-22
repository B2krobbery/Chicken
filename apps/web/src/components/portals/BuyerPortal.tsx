"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { 
  Search, 
  ShoppingCart, 
  CheckCircle, 
  AlertCircle, 
  CreditCard, 
  FileText, 
  Clock, 
  MapPin, 
  Truck, 
  X,
  Package,
  Layers
} from "lucide-react";

export function BuyerPortal() {
  const [profile, setProfile] = useState<any>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [cart, setCart] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [conditionFilter, setConditionFilter] = useState("");
  const [pincodeFilter, setPincodeFilter] = useState("");

  // Modals & Panels
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [paymentModalOrder, setPaymentModalOrder] = useState<any>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [p, locs, lists, c, ords] = await Promise.all([
        api.buyer.getProfile(),
        api.buyer.getLocations(),
        api.buyer.searchListings({
          query: searchQuery || undefined,
          condition: conditionFilter || undefined,
          pincode: pincodeFilter || undefined,
        }),
        api.buyer.getCart(),
        api.buyer.getOrders(),
      ]);
      setProfile(p);
      setLocations(locs);
      setListings(lists);
      setCart(c);
      setOrders(ords);
      if (locs.length > 0 && !selectedLocationId) {
        setSelectedLocationId(locs[0].id);
      }
    } catch (err: any) {
      setMsg(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchQuery, conditionFilter, pincodeFilter]);

  const handleAddToCart = async (listing: any, qty: number) => {
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
      alert(err.message);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      await api.buyer.removeCartItem(itemId);
      const updatedCart = await api.buyer.getCart();
      setCart(updatedCart);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCheckout = async () => {
    if (!selectedLocationId) {
      alert("Please select a delivery location");
      return;
    }
    try {
      const order = await api.buyer.checkout({
        delivery_location_id: selectedLocationId,
        notes: "Urgent commercial requirement",
      });
      setMsg(`Order ${order.order_number} created! Inventory reserved.`);
      setShowCartDrawer(false);
      setPaymentModalOrder(order);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleProcessPayment = async () => {
    if (!paymentModalOrder) return;
    try {
      // 1. Create Payment Intent
      const intent = await api.buyer.createPaymentIntent(paymentModalOrder.id);
      // 2. Simulate Payment Verification
      const verified = await api.buyer.verifyPayment(intent.payment_id, `mock_txn_${Date.now()}`);
      setMsg(`Payment of ₹${paymentModalOrder.total_amount} verified! Invoice ${verified.invoice_number} generated.`);
      setPaymentModalOrder(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleViewInvoice = async (orderId: string) => {
    try {
      const inv = await api.buyer.getInvoice(orderId);
      setSelectedInvoice(inv);
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading && !profile) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <Clock className="w-5 h-5 animate-spin mr-2" />
        Loading Institutional Buyer Marketplace...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Buyer Welcome & KYC Banner */}
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
            Buyer Type: <span className="font-semibold text-slate-700">{profile?.buyer_type}</span> | 
            PAN: <span className="font-mono">{profile?.kyc?.pan || "N/A"}</span> | 
            FSSAI: <span className="font-mono">{profile?.kyc?.fssai_license_number || "N/A"}</span>
          </p>
        </div>

        <button
          onClick={() => setShowCartDrawer(true)}
          className="relative bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-2 shadow transition"
        >
          <ShoppingCart className="w-4 h-4" />
          View Cart ({cart?.items_count || 0})
          {cart?.items_count > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
              {cart.items_count}
            </span>
          )}
        </button>
      </div>

      {msg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center justify-between">
          <span>{msg}</span>
          <button onClick={() => setMsg(null)} className="text-xs font-bold text-emerald-900">Dismiss</button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search whole broiler, boneless breast, curry cut, supplier name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs"
          />
        </div>

        <select
          value={conditionFilter}
          onChange={(e) => setConditionFilter(e.target.value)}
          className="p-2 border border-slate-300 rounded-lg text-xs"
        >
          <option value="">All Conditions (Fresh / Chilled / Frozen)</option>
          <option value="FRESH">Fresh</option>
          <option value="CHILLED">Chilled</option>
          <option value="FROZEN">Frozen (IQF)</option>
        </select>

        <input
          type="text"
          placeholder="Filter by PIN (e.g. 560038)"
          value={pincodeFilter}
          onChange={(e) => setPincodeFilter(e.target.value)}
          className="p-2 border border-slate-300 rounded-lg text-xs w-44"
        />
      </div>

      {/* Product Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {listings.map((l) => (
          <div key={l.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between hover:border-slate-300 transition">
            <div>
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                  {l.sku_code}
                </span>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {l.condition}
                </span>
              </div>

              <h3 className="text-base font-bold text-slate-900 mt-2">{l.product_name}</h3>
              <p className="text-xs text-slate-500 mt-0.5">Supplier: {l.supplier_name}</p>

              {/* Price & Landed Economics */}
              <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Base Price:</span>
                  <span className="font-bold text-slate-900 font-mono">₹{l.base_price_per_kg.toFixed(2)}/kg</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Est. Landed (Inc. 5% GST):</span>
                  <span className="font-bold text-emerald-700 font-mono">₹{l.landed_price_per_kg.toFixed(2)}/kg</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-200">
                  <span>MOQ: {l.moq_kg} kg</span>
                  <span>Available: {l.total_available_stock_kg} kg</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                onClick={() => handleAddToCart(l, l.moq_kg)}
                disabled={l.total_available_stock_kg < l.moq_kg}
                className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  l.total_available_stock_kg >= l.moq_kg
                    ? "bg-slate-900 hover:bg-slate-800 text-white"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                {l.total_available_stock_kg >= l.moq_kg ? `Add MOQ (${l.moq_kg} kg)` : "Out of Stock"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Cart Drawer */}
      {showCartDrawer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex justify-end z-50">
          <div className="bg-white w-full max-w-md h-full p-6 flex flex-col justify-between shadow-2xl overflow-y-auto">
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-emerald-600" />
                  Your Institutional Cart
                </h3>
                <button onClick={() => setShowCartDrawer(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {cart?.items?.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">Your cart is currently empty.</div>
              ) : (
                <div className="divide-y divide-slate-100 space-y-3">
                  {cart?.items?.map((item: any) => (
                    <div key={item.id} className="pt-3 flex justify-between items-start text-xs">
                      <div>
                        <div className="font-bold text-slate-900">{item.product_name}</div>
                        <div className="text-slate-500 font-mono">
                          {item.quantity_kg} kg @ ₹{item.unit_price_per_kg}/kg
                        </div>
                        {!item.moq_met && (
                          <div className="text-rose-600 font-medium text-[10px]">
                            Below MOQ ({item.moq_kg} kg)
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-slate-900">₹{item.item_total.toFixed(2)}</div>
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-[11px] text-rose-500 hover:underline mt-1"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Delivery Location Selector */}
              {cart?.items?.length > 0 && (
                <div className="pt-4 border-t border-slate-200">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Select Delivery Receiving Address:
                  </label>
                  <select
                    value={selectedLocationId}
                    onChange={(e) => setSelectedLocationId(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} - {loc.address_line1}, {loc.city} ({loc.pincode})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Cart Summary & Checkout */}
            {cart?.items?.length > 0 && (
              <div className="border-t border-slate-200 pt-4 space-y-2 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal:</span>
                  <span className="font-mono">₹{cart.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>GST (CGST+SGST 5%):</span>
                  <span className="font-mono">₹{cart.total_tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Standard Cold-Chain Delivery:</span>
                  <span className="font-mono">₹{cart.delivery_fee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-slate-900 pt-2 border-t">
                  <span>Grand Total:</span>
                  <span className="font-mono text-emerald-700">₹{cart.grand_total.toFixed(2)}</span>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={!cart.is_valid_for_checkout}
                  className={`w-full py-3 rounded-lg font-bold text-xs shadow mt-2 transition ${
                    cart.is_valid_for_checkout
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                      : "bg-slate-300 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  Place Order & Reserve Inventory
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Processing Modal */}
      {paymentModalOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl text-xs">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-purple-600" />
                Payment Gateway & Invoicing
              </h3>
              <button onClick={() => setPaymentModalOrder(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Order Number:</span>
                <span className="font-mono font-bold text-slate-800">{paymentModalOrder.order_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount to Settle:</span>
                <span className="font-mono font-bold text-emerald-700 text-sm">
                  ₹{paymentModalOrder.total_amount?.toLocaleString()}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 pt-1">
                Stock is reserved for 30 minutes. Verifying payment issues immediate GST invoice.
              </div>
            </div>

            <button
              onClick={handleProcessPayment}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition shadow"
            >
              Simulate Instant Online Payment & Verify
            </button>
          </div>
        </div>
      )}

      {/* Invoice Viewer Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                Tax Invoice ({selectedInvoice.invoice_number})
              </h3>
              <button onClick={() => setSelectedInvoice(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 p-4 bg-slate-50 rounded-lg">
              <div className="flex justify-between">
                <span className="text-slate-500">Supplier:</span>
                <span className="font-bold">{selectedInvoice.supplier_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Buyer:</span>
                <span className="font-bold">{selectedInvoice.buyer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span>{selectedInvoice.invoice_date}</span>
              </div>
              <div className="border-t pt-2 flex justify-between">
                <span>Subtotal:</span>
                <span className="font-mono">₹{selectedInvoice.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Tax (CGST+SGST / IGST):</span>
                <span className="font-mono">₹{selectedInvoice.total_tax.toFixed(2)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold text-sm">
                <span>Grand Total:</span>
                <span className="font-mono text-emerald-700">₹{selectedInvoice.grand_total.toFixed(2)}</span>
              </div>
            </div>

            <div className="text-right">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 bg-slate-900 text-white font-bold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order History & Tracking */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <h3 className="font-bold text-slate-800 text-sm">My Order History & Invoices</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 uppercase font-semibold">
                <th className="p-3">Order Number</th>
                <th className="p-3">Supplier</th>
                <th className="p-3">Total (INR)</th>
                <th className="p-3">Payment</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50/50">
                  <td className="p-3 font-mono font-bold text-slate-900">{o.order_number}</td>
                  <td className="p-3 font-medium text-slate-800">{o.supplier_name}</td>
                  <td className="p-3 font-mono font-bold text-slate-900">₹{o.total_amount?.toLocaleString()}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      o.payment_status === "SUCCESS" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}>
                      {o.payment_status}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800">
                      {o.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => handleViewInvoice(o.id)}
                      className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-2.5 py-1 rounded transition"
                    >
                      View Tax Invoice
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
