const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export async function apiRequest(
  endpoint: string,
  options: RequestInit = {},
  token?: string | null
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const activeToken = token || (typeof window !== "undefined" ? localStorage.getItem("token") : null);
  if (activeToken) {
    headers["Authorization"] = `Bearer ${activeToken}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    if (
      res.status === 401 &&
      typeof window !== "undefined" &&
      !endpoint.includes("/auth/login") &&
      !endpoint.includes("/auth/register")
    ) {
      window.dispatchEvent(new CustomEvent("auth:unauthorized", { detail: { endpoint } }));
    }

    let errorDetail = `Request failed with status ${res.status}`;
    const text = await res.text();
    if (text) {
      try {
        const errJson = JSON.parse(text);
        errorDetail = errJson.detail || errJson.error?.message || JSON.stringify(errJson);
      } catch {
        errorDetail = text;
      }
    }
    throw new Error(errorDetail);
  }

  return res.json();
}

export const api = {
  auth: {
    login: (credentials: any) =>
      apiRequest("/auth/login", { method: "POST", body: JSON.stringify(credentials) }),
    register: (data: any) =>
      apiRequest("/auth/register", { method: "POST", body: JSON.stringify(data) }),
    getMe: () => apiRequest("/auth/me"),
  },
  admin: {
    getDashboard: () => apiRequest("/admin/dashboard"),
    getSuppliers: (status?: string) =>
      apiRequest(`/admin/suppliers${status ? `?status_filter=${status}` : ""}`),
    actSupplierKYC: (id: string, action: string, reason?: string) =>
      apiRequest(`/admin/suppliers/${id}/kyc-action`, {
        method: "POST",
        body: JSON.stringify({ action, reason }),
      }),
    getBuyers: (status?: string) =>
      apiRequest(`/admin/buyers${status ? `?status_filter=${status}` : ""}`),
    actBuyerKYC: (id: string, action: string, reason?: string) =>
      apiRequest(`/admin/buyers/${id}/kyc-action`, {
        method: "POST",
        body: JSON.stringify({ action, reason }),
      }),
    getDrivers: () => apiRequest("/admin/drivers"),
    getAuditLogs: (limit = 50) => apiRequest(`/admin/audit-logs?limit=${limit}`),
    assignDelivery: (orderId: string, driverUserId: string, vehicleNo?: string) =>
      apiRequest("/logistics/assign", {
        method: "POST",
        body: JSON.stringify({
          order_id: orderId,
          driver_user_id: driverUserId,
          vehicle_number: vehicleNo,
        }),
      }),
  },
  supplier: {
    getProfile: () => apiRequest("/suppliers/profile"),
    submitKYC: (data: any) =>
      apiRequest("/suppliers/kyc", { method: "POST", body: JSON.stringify(data) }),
    getLocations: () => apiRequest("/suppliers/locations"),
    createLocation: (data: any) =>
      apiRequest("/suppliers/locations", { method: "POST", body: JSON.stringify(data) }),
    getMyListings: () => apiRequest("/catalogue/my-listings"),
    createListing: (data: any) =>
      apiRequest("/catalogue/listings", { method: "POST", body: JSON.stringify(data) }),
    updatePrice: (data: any) =>
      apiRequest("/pricing", { method: "POST", body: JSON.stringify(data) }),
    getBatches: () => apiRequest("/inventory/batches"),
    createBatch: (data: any) =>
      apiRequest("/inventory/batches", { method: "POST", body: JSON.stringify(data) }),
    stockIn: (data: any) =>
      apiRequest("/inventory/stock-in", { method: "POST", body: JSON.stringify(data) }),
    getInventory: () => apiRequest("/inventory"),
    getMovements: () => apiRequest("/inventory/movements"),
    acceptOrder: (orderId: string, acceptedItems?: any) =>
      apiRequest(`/orders/${orderId}/accept`, {
        method: "POST",
        body: JSON.stringify({ accepted_items: acceptedItems }),
      }),
    rejectOrder: (orderId: string, reason: string) =>
      apiRequest(`/orders/${orderId}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    updateStatus: (orderId: string, status: string, reason?: string) =>
      apiRequest(`/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, reason }),
      }),
  },
  buyer: {
    getProfile: () => apiRequest("/buyers/profile"),
    submitKYC: (data: any) =>
      apiRequest("/buyers/kyc", { method: "POST", body: JSON.stringify(data) }),
    getLocations: () => apiRequest("/buyers/locations"),
    createLocation: (data: any) =>
      apiRequest("/buyers/locations", { method: "POST", body: JSON.stringify(data) }),
    searchListings: (params: { query?: string; condition?: string; pincode?: string }) => {
      const q = new URLSearchParams();
      if (params.query) q.append("query", params.query);
      if (params.condition) q.append("condition", params.condition);
      if (params.pincode) q.append("pincode", params.pincode);
      return apiRequest(`/catalogue/listings?${q.toString()}`);
    },
    getListingDetail: (id: string) => apiRequest(`/catalogue/listings/${id}`),
    getCart: () => apiRequest("/cart"),
    addToCart: (data: { supplier_product_id: string; supplier_location_id?: string; quantity_kg: number }) =>
      apiRequest("/cart/items", { method: "POST", body: JSON.stringify(data) }),
    removeCartItem: (id: string) =>
      apiRequest(`/cart/items/${id}`, { method: "DELETE" }),
    checkout: (data: { delivery_location_id: string; notes?: string }) =>
      apiRequest("/orders", { method: "POST", body: JSON.stringify(data) }),
    getOrders: () => apiRequest("/orders"),
    getOrderDetail: (id: string) => apiRequest(`/orders/${id}`),
    createPaymentIntent: (orderId: string) =>
      apiRequest(
        "/payments/intent",
        {
          method: "POST",
          headers: { "Idempotency-Key": `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}` },
          body: JSON.stringify({ order_id: orderId }),
        }
      ),
    verifyPayment: (paymentId: string, txId: string) =>
      apiRequest("/payments/verify", {
        method: "POST",
        body: JSON.stringify({
          payment_id: paymentId,
          provider_transaction_id: txId,
          status: "SUCCESS",
        }),
      }),
    getInvoice: (orderId: string) => apiRequest(`/invoices/${orderId}`),
    downloadInvoicePdf: async (orderId: string, invoiceNumber?: string) => {
      const activeToken = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch(`${API_BASE}/invoices/${orderId}/pdf`, {
        headers: {
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
      });
      if (!res.ok) {
        let errText = "Failed to download PDF";
        try {
          const errJson = await res.json();
          errText = errJson.detail || errText;
        } catch {
          // ignore
        }
        throw new Error(errText);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoiceNumber || "Tax-Invoice"}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    },
  },
  invoices: {
    getInvoice: (orderId: string) => apiRequest(`/invoices/${orderId}`),
    downloadInvoicePdf: async (orderId: string, invoiceNumber?: string) => {
      const activeToken = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch(`${API_BASE}/invoices/${orderId}/pdf`, {
        headers: {
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
      });
      if (!res.ok) {
        let errText = "Failed to download PDF";
        try {
          const errJson = await res.json();
          errText = errJson.detail || errText;
        } catch {
          // ignore
        }
        throw new Error(errText);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoiceNumber || "Tax-Invoice"}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    },
  },
  driver: {
    getDeliveries: () => apiRequest("/logistics/driver/deliveries"),
    capturePOD: (deliveryId: string, data: any) =>
      apiRequest(`/logistics/deliveries/${deliveryId}/pod`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
};
