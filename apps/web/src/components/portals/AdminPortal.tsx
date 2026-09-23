"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { AppShell } from "@/components/ui/AppShell";
import { Sk, SkKpi, SkTableRows } from "@/components/ui/Skeleton";
import { Banner, EmptyState, ErrorState, StatusBadge } from "@/components/ui/States";
import {
  LayoutDashboard,
  Store,
  Users,
  ScrollText,
  Truck,
  Scale,
  Package,
  IndianRupee,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

type ViewKey = "overview" | "suppliers" | "buyers" | "drivers" | "audit";

export function AdminPortal() {
  const [view, setView] = useState<ViewKey>("overview");
  const [dashboard, setDashboard] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [buyers, setBuyers] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashData, supps, buys, drivs, logs] = await Promise.all([
        api.admin.getDashboard(),
        api.admin.getSuppliers(),
        api.admin.getBuyers(),
        api.admin.getDrivers(),
        api.admin.getAuditLogs(50),
      ]);
      setDashboard(dashData);
      setSuppliers(supps);
      setBuyers(buys);
      setDrivers(drivs);
      setAuditLogs(logs);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleKYC = async (
    kind: "supplier" | "buyer",
    id: string,
    action: string
  ) => {
    if (actionBusy) return;
    setActionBusy(true);
    setError(null);
    try {
      if (kind === "supplier") {
        await api.admin.actSupplierKYC(id, action, "Admin verified KYC records");
      } else {
        await api.admin.actBuyerKYC(id, action, "Admin verified commercial license");
      }
      setMsg(`${kind === "supplier" ? "Supplier" : "Buyer"} KYC → ${action}D`);
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionBusy(false);
    }
  };

  const pendingSuppliers = suppliers.filter((s) => s.kyc_status === "PENDING");
  const pendingBuyers = buyers.filter((b) => b.kyc_status === "PENDING");

  const nav = [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    {
      key: "suppliers",
      label: "Supplier KYC",
      icon: Store,
      badge: pendingSuppliers.length || undefined,
    },
    {
      key: "buyers",
      label: "Buyer KYC",
      icon: Users,
      badge: pendingBuyers.length || undefined,
    },
    { key: "drivers", label: "Drivers", icon: Truck, badge: drivers.length || undefined },
    { key: "audit", label: "Audit logs", icon: ScrollText },
  ];

  const kpis = dashboard
    ? [
        {
          label: "Gross merch. value",
          value: `₹${dashboard.gmv?.toLocaleString("en-IN")}`,
          sub: "Non-cancelled orders",
          icon: IndianRupee,
        },
        {
          label: "Volume moved",
          value: `${dashboard.total_kg_sold?.toLocaleString("en-IN")} kg`,
          sub: "Delivered / in-flight",
          icon: Scale,
        },
        {
          label: "Total orders",
          value: dashboard.total_orders,
          sub: `${dashboard.completed_orders} delivered · ${dashboard.fulfilment_rate_percent}% rate`,
          icon: Package,
        },
        {
          label: "Network",
          value: `${dashboard.active_suppliers}S / ${dashboard.active_buyers}B`,
          sub: `${dashboard.pending_suppliers + dashboard.pending_buyers} pending KYC`,
          icon: Users,
          warn: dashboard.pending_suppliers + dashboard.pending_buyers > 0,
        },
      ]
    : [];

  const kycTable = (
    kind: "supplier" | "buyer",
    rows: any[],
    cols: string[]
  ) => (
    <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
      <div className="px-3 lg:px-4 py-2.5 lg:py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
        <h3 className="text-xs lg:text-sm font-bold text-slate-800 uppercase tracking-wide">
          {kind === "supplier" ? "Supplier" : "Buyer"} verification queue
        </h3>
        <span className="text-[11px] lg:text-xs text-slate-400">
          {kind === "supplier"
            ? "Only approved suppliers can list SKUs"
            : "Unapproved buyers cannot order"}
        </span>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={kind === "supplier" ? Store : Users}
          title={`No ${kind}s pending review`}
          description={`All ${kind} KYC submissions have been actioned.`}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs lg:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-500 uppercase text-[11px] lg:text-xs font-bold tracking-wide">
                {cols.map((c, i) => (
                  <th
                    key={c}
                    className={`px-3 lg:px-4 py-2 ${i === cols.length - 1 ? "text-right" : ""}`}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="px-3 lg:px-4 py-2.5 lg:py-3">
                    <div className="font-semibold text-slate-900 break-words">
                      {r.business_name}
                    </div>
                    <div className="text-[11px] lg:text-xs text-slate-400">
                      {r.user_email}
                    </div>
                  </td>
                  {kind === "supplier" ? (
                    <>
                      <td className="px-3 lg:px-4 py-2.5 lg:py-3 font-mono text-slate-600">
                        {r.gstin || "Pending"}
                      </td>
                      <td className="px-3 lg:px-4 py-2.5 lg:py-3 font-mono text-slate-600">
                        {r.fssai || "Pending"}
                      </td>
                      <td className="px-3 lg:px-4 py-2.5 lg:py-3 text-slate-600 tnum">
                        {r.locations_count}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 lg:px-4 py-2.5 lg:py-3 text-slate-600">{r.buyer_type}</td>
                      <td className="px-3 lg:px-4 py-2.5 lg:py-3 font-mono text-slate-600">
                        {r.pan || "Pending"}
                      </td>
                      <td className="px-3 lg:px-4 py-2.5 lg:py-3 font-mono text-slate-600">
                        {r.fssai || "Pending"}
                      </td>
                    </>
                  )}
                  <td className="px-3 lg:px-4 py-2.5 lg:py-3">
                    <StatusBadge status={r.kyc_status} pulse={r.kyc_status === "PENDING"} />
                  </td>
                  <td className="px-3 lg:px-4 py-2.5 lg:py-3 text-right whitespace-nowrap space-x-1.5">
                    {r.kyc_status !== "APPROVED" && (
                      <button
                        onClick={() => handleKYC(kind, r.id, "APPROVE")}
                        disabled={actionBusy}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1.5 rounded-md text-[11px] lg:text-xs disabled:opacity-40"
                      >
                        Approve
                      </button>
                    )}
                    {r.kyc_status !== "REJECTED" && (
                      <button
                        onClick={() => handleKYC(kind, r.id, "REJECT")}
                        disabled={actionBusy}
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold px-2.5 py-1.5 rounded-md text-[11px] lg:text-xs disabled:opacity-40"
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
      )}
    </div>
  );

  const overviewBody = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div
              key={k.label}
              className="bg-white border border-slate-200 rounded-md p-3 lg:p-4 flex items-center gap-3 lg:gap-4"
            >
              <div className="p-2 bg-slate-100 text-slate-600 rounded-md shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] lg:text-xs font-bold text-slate-500 uppercase tracking-wide truncate">
                  {k.label}
                </div>
                <div className="text-lg lg:text-2xl font-bold text-slate-900 tnum truncate">
                  {k.value}
                </div>
                <div
                  className={`text-[11px] lg:text-xs truncate ${
                    k.warn ? "text-amber-600 font-semibold" : "text-slate-400"
                  }`}
                >
                  {k.sub}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {pendingSuppliers.length > 0 && (
        <div className="flex items-center gap-2 px-3 lg:px-4 py-2.5 lg:py-3 bg-amber-50 border border-amber-200 rounded-md text-xs lg:text-sm text-amber-800">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>
            <strong>{pendingSuppliers.length}</strong> supplier
            {pendingSuppliers.length > 1 ? "s" : ""} and{" "}
            <strong>{pendingBuyers.length}</strong> buyer
            {pendingBuyers.length === 1 ? "" : "s"} awaiting KYC review.
          </span>
          <button
            onClick={() => setView("suppliers")}
            className="ml-auto font-bold underline"
          >
            Review queue
          </button>
        </div>
      )}
      {kycTable("supplier", suppliers, ["Business", "GSTIN", "FSSAI", "Sites", "Status", "Actions"])}
      {kycTable("buyer", buyers, ["Enterprise", "Type", "PAN", "FSSAI", "Status", "Actions"])}
    </div>
  );

  const driversBody = (
    <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
      <div className="px-3 lg:px-4 py-2.5 lg:py-3 bg-slate-50 border-b border-slate-200">
        <h3 className="text-xs lg:text-sm font-bold text-slate-800 uppercase tracking-wide">
          Delivery fleet
        </h3>
      </div>
      {drivers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No drivers onboarded"
          description="Driver accounts assigned to deliveries will appear here."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs lg:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-500 uppercase text-[11px] lg:text-xs font-bold tracking-wide">
                <th className="px-3 lg:px-4 py-2">Driver</th>
                <th className="px-3 lg:px-4 py-2">Contact</th>
                <th className="px-3 lg:px-4 py-2">License</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {drivers.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/50">
                  <td className="px-3 lg:px-4 py-2.5 lg:py-3 font-semibold text-slate-900">
                    {d.full_name}
                  </td>
                  <td className="px-3 lg:px-4 py-2.5 lg:py-3 text-slate-600">
                    {d.email}
                    <div className="text-[11px] lg:text-xs text-slate-400 font-mono">
                      {d.phone_number}
                    </div>
                  </td>
                  <td className="px-3 lg:px-4 py-2.5 lg:py-3 font-mono text-slate-600">
                    {d.license_number || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const auditBody = (
    <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
      <div className="px-3 lg:px-4 py-2.5 lg:py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
        <div>
          <h3 className="text-xs lg:text-sm font-bold text-slate-800 uppercase tracking-wide">
            Immutable audit log
          </h3>
          <p className="text-[11px] lg:text-xs text-slate-500">
            KYC actions, price versions, stock movements, financial events
          </p>
        </div>
        <span className="text-[11px] lg:text-xs text-slate-400 tnum">
          {auditLogs.length} entries
        </span>
      </div>
      {auditLogs.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No audit entries"
          description="Sensitive actions are logged here immutably."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] lg:text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-500 uppercase text-[11px] lg:text-xs font-bold tracking-wide">
                <th className="px-3 lg:px-4 py-2">Timestamp</th>
                <th className="px-3 lg:px-4 py-2">Action</th>
                <th className="px-3 lg:px-4 py-2">Entity</th>
                <th className="px-3 lg:px-4 py-2">Entity ID</th>
                <th className="px-3 lg:px-4 py-2">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50">
                  <td className="px-3 lg:px-4 py-2 text-slate-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </td>
                  <td className="px-3 lg:px-4 py-2 font-semibold text-purple-700 whitespace-nowrap">
                    {log.action}
                  </td>
                  <td className="px-3 lg:px-4 py-2 text-slate-700">{log.entity_type}</td>
                  <td className="px-3 lg:px-4 py-2 text-slate-400 truncate max-w-[100px]">
                    {String(log.entity_id).slice(0, 8)}…
                  </td>
                  <td className="px-3 lg:px-4 py-2 text-slate-500 truncate max-w-[280px]">
                    {JSON.stringify(log.new_values || log.old_values || {})}
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
        "Admin",
        {
          overview: "Command center",
          suppliers: "Supplier KYC",
          buyers: "Buyer KYC",
          drivers: "Drivers",
          audit: "Audit logs",
        }[view],
      ]}
      subtitle="Compliance & operations console"
      actions={
        <button
          onClick={loadData}
          disabled={loading}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
          aria-label="Refresh data"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      }
    >
      <div className="space-y-4 lg:space-y-6 max-w-[1600px] 2xl:max-w-[1760px] mx-auto">
        {msg && <Banner message={msg} onDismiss={() => setMsg(null)} />}
        {error && <Banner message={error} onDismiss={() => setError(null)} tone="error" />}

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
              <SkKpi /><SkKpi /><SkKpi /><SkKpi />
            </div>
            <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
              <div className="px-3 lg:px-4 py-2.5 lg:py-3 bg-slate-50 border-b border-slate-200">
                <Sk className="h-3.5 w-44" />
              </div>
              <SkTableRows rows={6} cols={6} />
            </div>
          </div>
        ) : dashboard === null && error ? (
          <ErrorState
            title="Couldn't load the admin console"
            description={error}
            onRetry={loadData}
          />
        ) : (
          <>
            {view === "overview" && overviewBody}
            {view === "suppliers" &&
              kycTable("supplier", suppliers, ["Business", "GSTIN", "FSSAI", "Sites", "Status", "Actions"])}
            {view === "buyers" &&
              kycTable("buyer", buyers, ["Enterprise", "Type", "PAN", "FSSAI", "Status", "Actions"])}
            {view === "drivers" && driversBody}
            {view === "audit" && auditBody}
          </>
        )}
      </div>
    </AppShell>
  );
}
