# TheChickenMan: System Architecture & Technical Specifications

## 1. Executive Summary
**TheChickenMan** is a mission-critical B2B chicken marketplace connecting verified commercial poultry processors/producers (Suppliers) with business buyers (retailers, hotels, restaurants, QSRs, caterers, institutions). The platform standardizes SKU definition, enforces food safety and tax compliance (FSSAI, GST), manages real-time inventory ledgers with strict concurrency controls, executes transparent landed-price economics, and orchestrates order fulfillment and proof of delivery (POD).

---

## 2. High-Level System Topology

```mermaid
graph TD
    subgraph Client Tier ["Client Applications (apps/web)"]
        AdminApp["Admin Console (Ops & Audit)"]
        SupplierApp["Supplier Portal (KYC, Listings, Batches, Orders)"]
        BuyerApp["Buyer Portal (Catalog, Cart, Orders, Invoices)"]
        DriverApp["Driver Portal (Assigned Jobs, POD Capture)"]
    end

    subgraph API Gateway / Server ["Backend API (backend/app - FastAPI)"]
        Router["FastAPI Router (/api/v1)"]
        AuthMid["JWT & RBAC Middleware"]
        AuditMid["Audit Logging Interceptor"]
        
        subgraph Business Modules
            AuthMod["Auth & Identity"]
            SupplierMod["Supplier Management & KYC"]
            BuyerMod["Buyer Management & KYC"]
            CatMod["SKU Catalogue & Listings"]
            InvMod["Inventory Ledger (Row-lock Concurrency)"]
            PriceMod["Pricing & Landed-Cost Engine"]
            CartMod["Cart & Checkout Engine"]
            OMS["Order Management System"]
            PayMod["Payment Gateway (Provider Pattern)"]
            InvEngine["GST Invoice Engine"]
            LogMod["Logistics & POD Engine"]
            NotifMod["Notification Engine"]
            AdminMod["Admin Operations & Metrics"]
        end
    end

    subgraph Data Tier ["Data & Infrastructure"]
        Postgres[(PostgreSQL 16+ OLTP & Ledger)]
        RedisCache[(Redis Cache & Session)]
        Storage[(S3-compatible Object Storage for Documents & POD)]
    end

    Client Tier --> Router
    Router --> AuthMid
    AuthMid --> AuditMid
    AuditMid --> Business Modules
    Business Modules --> Postgres
    Business Modules --> RedisCache
    Business Modules --> Storage
```

---

## 3. Core Architectural Guarantees

### 3.1 Authenticated Ownership & Data Isolation
- **No Hardcoded Identities**: Every query and modification extracts tenant identity directly from the cryptographically verified JWT session.
- **Supplier Isolation**: Suppliers can only read and mutate their own locations, products, batches, inventory, and orders assigned to them.
- **Buyer Isolation**: Buyers can only view their own delivery locations, cart, orders, and invoices.
- **Admin Supremacy**: Admins possess read/write capabilities across the platform for vetting KYC, setting master products, managing disputes, and inspecting immutable audit logs.

### 3.2 Concurrency-Safe Inventory Ledger
- Standard inventory overwrites (e.g. `UPDATE inventory SET qty = qty - 5`) are vulnerable to race conditions and overselling.
- **Pessimistic Row-Level Locking**: During checkout, the inventory row is locked inside a transactional boundary:
  ```sql
  SELECT * FROM inventory WHERE id = :inventory_id FOR UPDATE;
  ```
- **State Partitioning**: Inventory balances are partitioned into explicit states:
  - `quantity_available_kg`
  - `quantity_reserved_kg`
  - `quantity_allocated_kg`
  - `quantity_dispatched_kg`
  - `quantity_delivered_kg`
  - `quantity_rejected_kg`
  - `quantity_expired_kg`
- **Double-Entry Ledger Movements**: Every change creates an immutable `inventory_movements` record (`STOCK_IN`, `RESERVED`, `RELEASED`, `ALLOCATED`, `DISPATCHED`, `DELIVERED`, `REJECTED`, `EXPIRED`, `ADJUSTMENT`).

### 3.3 Strict Order State Machine
Transitions must follow permitted directed acyclic graphs:
```
           +------------> REJECTED (Supplier/Admin)
           |
PENDING ---+------------> CANCELLED (Buyer before acceptance / Timeout)
   |
   v (Supplier Accepts)
CONFIRMED 
   |
   v (Processing)
PROCESSING
   |
   v (Packed & Batched)
PACKED
   |
   v (Driver Dispatched)
DISPATCHED
   |
   v (POD Captured)
DELIVERED
   |
   v (Dispute / Return)
REFUNDED
```
- Arbitrary jumps (e.g., `PENDING` directly to `DELIVERED`) are strictly rejected by domain validation.
- All state changes persist to `order_status_history` and `audit_logs`.

### 3.4 Payment Provider Abstraction & Idempotency
- **Provider Interface**:
  ```python
  class BasePaymentProvider(ABC):
      async def create_payment_intent(self, order_id, amount, currency, metadata) -> PaymentIntent: ...
      async def verify_payment(self, payment_id, payload) -> PaymentResult: ...
      async def handle_webhook(self, payload, signature) -> WebhookResult: ...
  ```
- **Idempotency Strategy**:
  - Payment requests require an `Idempotency-Key` header.
  - Gateway webhooks record the provider's `event_id` or transaction reference. If an event has already been processed, the system returns HTTP 200 without executing duplicate mutations.

### 3.5 GST Invoicing Engine
- Generates compliant Tax Invoices upon order delivery/confirmation.
- Intrastate transactions (Supplier state == Buyer state) compute `CGST (2.5%) + SGST (2.5%)`.
- Interstate transactions compute `IGST (5.0%)`.
- Raw poultry (fresh/chilled whole bird without branding) vs processed cuts are tax-coded per Indian GST schedules.

### 3.6 Proof of Delivery (POD)
- Upon physical delivery, the driver records:
  - OTP verification (buyer-supplied code)
  - Recipient digital signature
  - Photographic proof of delivery / crate condition
  - Accepted net weight vs rejected weight with specific rejection reasons.
- Completed POD becomes immutable.

---

## 4. Observability & Health Standards
- `GET /health`: Liveness probe (verifies process running).
- `GET /ready`: Readiness probe (verifies PostgreSQL database connection and storage access).
- Structured JSON logging containing `request_id`, `user_id`, `role`, `timestamp`, `latency_ms`.
- Standardized API error responses:
  ```json
  {
    "error": {
      "code": "INSUFFICIENT_STOCK",
      "message": "Requested quantity exceeds available stock.",
      "details": { "requested_kg": 500, "available_kg": 250 },
      "timestamp": "2026-09-19T14:30:00Z"
    }
  }
  ```
