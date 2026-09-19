"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { 
  TrendingUp, 
  Package, 
  Scale, 
  Users, 
  DollarSign, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  ShieldAlert,
  Truck,
  FileText,
  Clock
} from "lucide-react";

export function AdminPortal() {
  const [dashboard, setDashboard] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [buyers, setBuyers] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "suppliers" | "buyers" | "audit">("overview");
  const [msg, setMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashData, supps, buys, drivs, logs] = await Promise.all([
        api.admin.getDashboard(),
        api.admin.getSuppliers(),
        api.admin.getBuyers(),
        api.admin.getDrivers(),
        api.admin.getAuditLogs(30),
      ]);
      setDashboard(dashData);
      setSuppliers(supps);
      setBuyers(buys);
      setDrivers(drivs);
      setAuditLogs(logs);
    } catch (err: any) {
      setMsg(`Error loading data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSupplierKYC = async (id: string, action: string) => {
    try {
      await api.admin.actSupplierKYC(id, action, "Admin verified KYC records");
      setMsg(`Supplier KYC status updated to ${action}D`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBuyerKYC = async (id: string, action: string) => {
    try {
      await api.admin.actBuyerKYC(id, action, "Admin verified commercial license");
      setMsg(`Buyer KYC status updated to ${action}D`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <Clock className="w-5 h-5 animate-spin mr-2" />
        Loading Admin Operations Console...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Marketplace Command Center
            <span className="text-xs bg-purple-100 text-purple-800 font-semibold px-2 py-0.5 rounded-full border border-purple-200">
              Admin
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time compliance, KYC onboarding approval queues, and transactional metrics.
          </p>
        </div>
        <button
          onClick={loadData}
          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-3 py-1.5 rounded-lg transition"
        >
          Refresh Data
        </button>
      </div>

      {msg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center justify-between">
          <span>{msg}</span>
          <button onClick={() => setMsg(null)} className="text-xs font-bold text-emerald-900">Dismiss</button>
        </div>
      )}

      {/* KPI Cards */}
      {dashboard && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-brand-50 text-brand-600 rounded-lg">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Gross Merch. Value (GMV)</div>
              <div className="text-2xl font-bold text-slate-900">₹{dashboard.gmv?.toLocaleString()}</div>
              <div className="text-xs text-emerald-600 mt-0.5">Real-time non-cancelled orders</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Volume Sold</div>
              <div className="text-2xl font-bold text-slate-900">{dashboard.total_kg_sold?.toLocaleString()} kg</div>
              <div className="text-xs text-slate-500 mt-0.5">Commercial poultry delivered/active</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Orders</div>
              <div className="text-2xl font-bold text-slate-900">{dashboard.total_orders}</div>
              <div className="text-xs text-slate-500 mt-0.5">{dashboard.completed_orders} Completed ({dashboard.fulfilment_rate_percent}%)</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Network</div>
              <div className="text-2xl font-bold text-slate-900">
                {dashboard.active_suppliers} <span className="text-sm font-normal text-slate-400">Suppliers</span> / {dashboard.active_buyers} <span className="text-sm font-normal text-slate-400">Buyers</span>
              </div>
              <div className="text-xs text-amber-600 mt-0.5">
                {dashboard.pending_suppliers + dashboard.pending_buyers} Pending KYC
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-4 text-sm font-medium">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-3 px-1 border-b-2 transition ${
            activeTab === "overview"
              ? "border-purple-600 text-purple-700 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Overview & Quick Actions
        </button>
        <button
          onClick={() => setActiveTab("suppliers")}
          className={`pb-3 px-1 border-b-2 transition flex items-center gap-2 ${
            activeTab === "suppliers"
              ? "border-purple-600 text-purple-700 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Supplier KYC Queue
          {dashboard?.pending_suppliers > 0 && (
            <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.2 rounded-full font-bold">
              {dashboard.pending_suppliers}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("buyers")}
          className={`pb-3 px-1 border-b-2 transition flex items-center gap-2 ${
            activeTab === "buyers"
              ? "border-purple-600 text-purple-700 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Buyer KYC Queue
          {dashboard?.pending_buyers > 0 && (
            <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.2 rounded-full font-bold">
              {dashboard.pending_buyers}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("audit")}
          className={`pb-3 px-1 border-b-2 transition ${
            activeTab === "audit"
              ? "border-purple-600 text-purple-700 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Audit Logs
        </button>
      </div>

      {/* Suppliers Table */}
      {(activeTab === "suppliers" || activeTab === "overview") && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              Commercial Supplier Verification
            </h3>
            <span className="text-xs text-slate-500">Only approved suppliers can list SKUs and accept orders</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase font-semibold">
                  <th className="p-3">Business Name</th>
                  <th className="p-3">GSTIN</th>
                  <th className="p-3">FSSAI License</th>
                  <th className="p-3">Facilities</th>
                  <th className="p-3">KYC Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50">
                    <td className="p-3 font-semibold text-slate-900">
                      {s.business_name}
                      <div className="text-[11px] text-slate-500 font-normal">{s.user_email}</div>
                    </td>
                    <td className="p-3 font-mono">{s.gstin || "Pending"}</td>
                    <td className="p-3 font-mono">{s.fssai || "Pending"}</td>
                    <td className="p-3">{s.locations_count} Location(s)</td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          s.kyc_status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : s.kyc_status === "PENDING"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {s.kyc_status}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      {s.kyc_status !== "APPROVED" && (
                        <button
                          onClick={() => handleSupplierKYC(s.id, "APPROVE")}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-2.5 py-1 rounded transition text-xs shadow-xs"
                        >
                          Approve
                        </button>
                      )}
                      {s.kyc_status !== "REJECTED" && (
                        <button
                          onClick={() => handleSupplierKYC(s.id, "REJECT")}
                          className="bg-slate-200 hover:bg-rose-100 hover:text-rose-800 text-slate-700 font-medium px-2.5 py-1 rounded transition text-xs"
                        >
                          Reject
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Buyers Table */}
      {(activeTab === "buyers" || activeTab === "overview") && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              Buyer KYC & Commercial Onboarding
            </h3>
            <span className="text-xs text-slate-500">Unapproved buyers are prevented from placing orders</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase font-semibold">
                  <th className="p-3">Buyer Enterprise</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">PAN</th>
                  <th className="p-3">FSSAI</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {buyers.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/50">
                    <td className="p-3 font-semibold text-slate-900">
                      {b.business_name}
                      <div className="text-[11px] text-slate-500 font-normal">{b.user_email}</div>
                    </td>
                    <td className="p-3 font-medium text-slate-700">{b.buyer_type}</td>
                    <td className="p-3 font-mono">{b.pan || "Pending"}</td>
                    <td className="p-3 font-mono">{b.fssai || "Pending"}</td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          b.kyc_status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : b.kyc_status === "PENDING"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {b.kyc_status}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      {b.kyc_status !== "APPROVED" && (
                        <button
                          onClick={() => handleBuyerKYC(b.id, "APPROVE")}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-2.5 py-1 rounded transition text-xs shadow-xs"
                        >
                          Approve
                        </button>
                      )}
                      {b.kyc_status !== "REJECTED" && (
                        <button
                          onClick={() => handleBuyerKYC(b.id, "REJECT")}
                          className="bg-slate-200 hover:bg-rose-100 hover:text-rose-800 text-slate-700 font-medium px-2.5 py-1 rounded transition text-xs"
                        >
                          Reject
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Log Table */}
      {activeTab === "audit" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <h3 className="font-bold text-slate-800 text-sm">Immutable Audit Logs</h3>
            <p className="text-xs text-slate-500">Every sensitive KYC change, price update, stock movement, and financial transaction is cryptographically logged.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase font-semibold">
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Entity Type</th>
                  <th className="p-3">Entity ID</th>
                  <th className="p-3">Details / Snapshot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3 font-semibold text-purple-700">{log.action}</td>
                    <td className="p-3 text-slate-700">{log.entity_type}</td>
                    <td className="p-3 text-slate-500 truncate max-w-[120px]">{log.entity_id}</td>
                    <td className="p-3 text-slate-600 truncate max-w-[300px]">
                      {JSON.stringify(log.new_values || log.old_values || {})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
