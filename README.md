# TheChickenMan: Institutional B2B Poultry Marketplace

[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg)](https://fastapi.tiangolo.com)
[![Next.js 14](https://img.shields.io/badge/Next.js-14+-black.svg)](https://nextjs.org/)
[![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL-16+-336791.svg)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**TheChickenMan** is an institutional-grade B2B digital marketplace connecting vetted commercial poultry producers/processors (Suppliers) with business buyers (Hotels, Restaurants, QSRs, Caterers, and Retailers). 

The platform standardizes SKU definitions, enforces food safety and tax compliance (FSSAI, GST), manages real-time inventory ledgers with row-level locking concurrency controls, executes transparent landed-price economics, and orchestrates fulfillment and immutable Proof of Delivery (POD).

---

## 1. System Topology & Architecture

```
                       +---------------------------------------+
                       |   Unified Next.js 14 Frontend         |
                       |   (Admin / Supplier / Buyer / Driver) |
                       +-------------------+-------------------+
                                           | HTTP / REST (JWT)
                                           v
                       +---------------------------------------+
                       |         FastAPI Gateway (/api/v1)     |
                       |       Middleware, Auth, Audit Logs    |
                       +-------------------+-------------------+
                                           |
    +-----------------+--------------------+--------------------+-----------------+
    |                 |                    |                    |                 |
    v                 v                    v                    v                 v
[Auth & RBAC]    [KYC Engine]      [Inventory Ledger]     [Order Engine]     [GST Invoices]
(JWT, Passwords) (FSSAI/GST Gate)  (SELECT FOR UPDATE)    (State Machine)    (CGST/SGST/IGST)
    |                 |                    |                    |                 |
    +-----------------+--------------------+--------------------+-----------------+
                                           |
                                           v
                       +---------------------------------------+
                       |          PostgreSQL 16 Database       |
                       |   (32 Normalized Tables + Migrations) |
                       +---------------------------------------+
```

---

## 2. Key Architectural Guarantees

1. **Authenticated Ownership & Multi-Tenant Isolation**: No hardcoded IDs (`SUPPLIER_ID=1`, `BUYER_ID=1`). Every query is strictly isolated to the authenticated user's session token.
2. **Server-Side KYC Gatekeeping**:
   - Suppliers cannot list SKUs or accept orders until mandatory KYC (FSSAI, GSTIN, PAN, Bank Details) is approved by an Admin.
   - Buyers cannot checkout until commercial business verification is approved.
3. **Zero Overselling via Database Row Locks**:
   - Real-time stock reservation employs `SELECT ... FOR UPDATE` row locks inside PostgreSQL transactions.
   - Concurrency stress tests guarantee that simultaneous checkouts cannot oversell batch stock.
4. **Immutable Multi-State Inventory Ledger**:
   - Balances partitioned across: `Available`, `Reserved`, `Allocated`, `Dispatched`, `Delivered`, `Rejected`, `Expired`.
   - Immutable double-entry movement logs (`STOCK_IN`, `RESERVED`, `ALLOCATED`, `DISPATCHED`, `DELIVERED`, `RELEASED`).
5. **Deterministic Order State Machine**:
   - `PENDING` -> `CONFIRMED` -> `PROCESSING` -> `PACKED` -> `DISPATCHED` -> `DELIVERED`.
   - Invalid state jumps are rejected by domain validation.
6. **Payment Provider Abstraction & Webhook Idempotency**:
   - Provider interface with pluggable implementations (`MockPaymentProvider`, Razorpay/Stripe ready).
   - Gateway webhooks enforce signature validation and cryptographic idempotency replay prevention.
7. **Statutory GST Invoicing Engine**:
   - Computes Place of Supply taxation: Intrastate (`CGST 2.5% + SGST 2.5%`), Interstate (`IGST 5.0%`).
   - Generates sequential invoices (`INV-YYYY-XXXXX`) and printable PDFs.
8. **Immutable Proof of Delivery (POD)**:
   - Driver captures OTP verification, digital recipient signature, photo proof, and accepted vs rejected weight.

---

## 3. Seeded Demonstration Credentials

The seed script (`scripts/seed.py`) populates the database with real-world institutional accounts:

| Role | Email | Password | Persona & Status |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@thechickenman.com` | `Password@123` | Platform Superuser (Full Console) |
| **SUPPLIER** | `supplier1@thechickenman.com` | `Password@123` | **Venky's Commercial Poultry Ltd** (Approved KYC, Plant in Bangalore) |
| **SUPPLIER** | `supplier2@thechickenman.com` | `Password@123` | **Suguna Poultry Farms** (Pending KYC for testing) |
| **BUYER** | `buyer1@thechickenman.com` | `Password@123` | **Biryani Blues QSR** (Approved KYC, Kitchen in Indiranagar) |
| **BUYER** | `buyer2@thechickenman.com` | `Password@123` | **ITC Grand Hotel** (Approved KYC, Luxury Hospitality) |
| **BUYER** | `buyer3@thechickenman.com` | `Password@123` | **FreshMart Supermarkets** (Pending KYC for testing) |
| **DRIVER** | `driver@thechickenman.com` | `Password@123` | **Ramesh Kumar** (Delivery Cold-Van KA-01-EQ-5592) |

---

## 4. Quick Start & Local Execution

### Prerequisites
- Python 3.12+ (or 3.14)
- Node.js 18+ (or 20+)
- PostgreSQL 15+ running on port 5432

### 1. Database Setup
```bash
# Create database
psql -U postgres -c "CREATE DATABASE thechickenman;"

# Run migrations
cd backend
source ../.venv/bin/activate
alembic upgrade head

# Seed initial test data
python ../scripts/seed.py
```

### 2. Start Application
```bash
# Starts both Backend (http://localhost:8000) and Frontend (http://localhost:3000)
./scripts/run_dev.sh
```

- **Frontend App**: [http://localhost:3000](http://localhost:3000)
- **API Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **OpenAPI Schema**: [http://localhost:8000/openapi.json](http://localhost:8000/openapi.json)

---

## 5. Automated Verification Suite

Run all automated pytest suites:
```bash
./scripts/run_tests.sh
```

### Test Coverage Highlights:
- `test_end_to_end_mvp_flow.py`: Complete 30-step end-to-end scenario from Admin login to final delivery and KPI reconciliation.
- `test_inventory_concurrency.py`: Multithreaded concurrent order stress test validating row-level locking and zero overselling.
- `test_payments_idempotency.py`: Replay attack and duplicate webhook deduplication tests.
- `test_kyc_workflow.py`: Supplier & Buyer KYC approval, rejection, and unauthorized listing prevention.
- `test_order_state_machine.py`: State transition rules and illegal jump rejections.
- `test_logistics_pod.py`: Driver assignment, transit updates, OTP verification, and POD immutability.
- `test_invoice_generation.py`: GST tax rate computations and invoice number generation.

---

## 6. Project Roadmap Status

### ✅ Phase 0: Foundation (Completed)
- [x] P0-01: Solution architecture (`docs/architecture.md`)
- [x] P0-02: Technology stack (FastAPI, SQLAlchemy, Alembic, PostgreSQL, Next.js 14, Tailwind)
- [x] P0-03: Multi-tenant relational schema (`docs/database-erd.md`)
- [x] P0-04: Role-Based Access Control matrix (`docs/rbac.md`)
- [x] P0-05: Monorepo repository & environments setup
- [x] P0-06: Observability, structured logging & health probes (`/health`, `/ready`)
- [x] P0-07: Compliance matrix for FSSAI, GST, DPDP (`docs/compliance-matrix.md`)
- [x] P0-08: Design system & responsive portal components
- [x] P0-09: OpenAPI 3.1 specification (`docs/api-spec.yaml`)
- [x] P0-10: QA strategy & test plan (`docs/qa-strategy.md`)

### ✅ Phase 1: Production MVP (Completed)
- [x] P1-01: Supplier registration
- [x] P1-02: Supplier KYC (FSSAI, GSTIN, PAN, Bank details)
- [x] P1-03: Supplier approval workflow (Approve/Reject/Suspend)
- [x] P1-04: Supplier locations & serviceable PIN codes
- [x] P1-05: Product master (Whole, Cuts, Boneless; Fresh, Chilled, Frozen)
- [x] P1-06: Supplier SKU listings & MOQ
- [x] P1-07: Batch numbering & shelf-life tracking
- [x] P1-08: Multi-state inventory ledger
- [x] P1-09: Location-level stock visibility
- [x] P1-10: Concurrency-safe inventory reservation (`SELECT ... FOR UPDATE`)
- [x] P1-11: Versioned manual price management
- [x] P1-12: Landed price calculation (Base + 5% GST + Logistics fee)
- [x] P1-13: Buyer registration
- [x] P1-14: Buyer KYC & commercial verification
- [x] P1-15: Multiple buyer delivery locations
- [x] P1-16: Marketplace search & filters (condition, PIN, query)
- [x] P1-17: Product detail page with spec & landed price
- [x] P1-18: Multi-SKU cart with validation
- [x] P1-19: Order creation & snapshot generation
- [x] P1-20: Order state machine & status history
- [x] P1-21: Supplier full & partial acceptance
- [x] P1-22: Buyer order history & tracking
- [x] P1-23: Notification provider abstraction & event logs
- [x] P1-24: Payment gateway abstraction & idempotent webhooks
- [x] P1-25: GST invoice engine (CGST/SGST/IGST) & PDF generation
- [x] P1-26: Admin operations console
- [x] P1-27: Immutable audit logging
- [x] P1-28: Core marketplace dashboard (GMV, kg sold, revenue, orders)
- [x] P1-29: Manual delivery assignment
- [x] P1-30: Proof of Delivery (POD) capture with OTP, signature & weights

### ⏳ Phase 2: Operations & Scale (Planned)
- RFQ & Supplier Quotation Comparison (P2-01 - P2-03)
- Bulk Demand Aggregation (P2-04)
- Logistics Partner Onboarding & GPS Fleet Tracking (P2-07 - P2-10)
- Cold-Chain IoT Telemetry (P2-11 - P2-12)
- Digital Batch Traceability & Quality Checklists (P2-13 - P2-14)
- Supplier Scorecard & Dispute Resolution Centre (P2-15 - P2-17)
- WhatsApp B2B Ordering (P2-24)

### ⏳ Phase 3: Intelligence & Finance (Planned)
- SKU & City Demand Forecasting (P3-01)
- Dynamic Price Recommendations (P3-03)
- Buyer Credit Risk Engine & Lending Partner APIs (P3-07 - P3-09)
- National Control Tower Dashboard (P3-13)

### ⏳ Phase 4: National Network Effects (Planned)
- Digital Reverse Auction Engine (P4-01)
- Forward Volume Contracts (P4-02)
- City Micro-Hub & Cross-Dock Management (P4-03)
- Poultry Price Index & Pan-India Expansion (P4-07)
# Chicken
