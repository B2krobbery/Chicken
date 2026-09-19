# TheChickenMan: Role-Based Access Control (RBAC) Matrix

## 1. Role Definitions
The platform recognizes four primary authenticated roles:
1. **ADMIN**: Superuser operating marketplace compliance, onboarding verifications, catalog standards, dispute interventions, and system configuration.
2. **SUPPLIER**: Commercial poultry producer/processor. Controls own facilities, product listings, batch production records, stock movements, and incoming order fulfillment.
3. **BUYER**: Commercial purchaser (Retailers, HORECA, Institutions). Discovers products, manages delivery points, places orders, makes payments, and receives invoices.
4. **DRIVER**: Logistics personnel. Views assigned transport orders, performs pickups, and executes deliveries with proof of delivery (POD).

---

## 2. Granular Permissions Matrix

| Module | Action | ADMIN | SUPPLIER | BUYER | DRIVER |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Auth** | Register Account | Yes | Yes | Yes | Admin Only |
| | Login / Refresh JWT | Yes | Yes | Yes | Yes |
| | Manage Own Profile | Yes | Yes | Yes | Yes |
| **Users** | View All Users | Yes | No | No | No |
| | Assign Roles | Yes | No | No | No |
| **Suppliers** | Submit Supplier Profile & KYC | No | Own Only | No | No |
| | Upload Business Documents | No | Own Only | No | No |
| | Manage Locations & PIN Codes | No | Own Only | No | No |
| | Approve / Reject / Suspend KYC | Yes | No | No | No |
| | View Supplier Directory | Yes | No | Filtered | No |
| **Buyers** | Submit Buyer Profile & KYC | No | No | Own Only | No |
| | Manage Delivery Locations | No | No | Own Only | No |
| | Approve / Reject / Suspend KYC | Yes | No | No | No |
| **Catalogue** | Create / Update Master SKUs | Yes | No | No | No |
| | Create Supplier SKU Listing | No | Own Only | No | No |
| | Search & Browse Active Listings | Yes | Yes | Yes | No |
| | View Product Detail & Landed Price | Yes | Yes | Yes | No |
| **Inventory** | Create Production Batch | No | Own Only | No | No |
| | Add Stock (STOCK_IN) | No | Own Only | No | No |
| | View Real-Time Stock | Yes | Own Only | Aggregated | No |
| | Reserve Stock (Checkout) | System | System | Automated | No |
| | Stock Adjustments | Yes | Own Only | No | No |
| **Pricing** | Set Supplier SKU Base Price | Yes | Own Only | No | No |
| | View Historical Price Versions | Yes | Own Only | Active Only | No |
| **Cart & Orders** | Add / Remove Cart Items | No | No | Own Only | No |
| | Checkout & Create Order | No | No | Own Only | No |
| | Accept / Reject / Partial Accept | Yes | Assigned Only | No | No |
| | Cancel Order | Yes | No | Own (Pending) | No |
| | Transition Status (Pack/Dispatch) | Yes | Assigned Only | No | No |
| | View Order Details | Yes | Assigned Only | Own Only | Assigned Only |
| **Payments** | Initiate Payment Intent | No | No | Own Only | No |
| | Verify Payment / Webhook | System | No | No | No |
| | Process Refund | Yes | No | No | No |
| **Invoices** | Generate GST Invoice | System | System | System | No |
| | View / Download Tax Invoice | Yes | Assigned Only | Own Only | No |
| **Logistics** | Assign Driver & Vehicle | Yes | No | No | No |
| | Update Transport Status | Yes | No | No | Assigned Only |
| | Capture Proof of Delivery (POD) | Yes | No | No | Assigned Only |
| **Audit & Dash**| View Aggregated Marketplace KPIs | Yes | No | No | No |
| | Query Immutable Audit Logs | Yes | No | No | No |

---

## 3. Server-Side Enforcement Rules
1. **Never Trust Frontend Claims**: Role claims sent in request bodies are ignored. The authenticated user context is derived exclusively from the verified JWT payload.
2. **Mandatory KYC Gating**:
   - `require_approved_supplier`: Middleware checking `supplier.kyc_status == 'APPROVED'`. Rejects listing creation and order fulfillment if not approved.
   - `require_approved_buyer`: Middleware checking `buyer.kyc_status == 'APPROVED'`. Rejects checkout and order placement if not approved.
3. **Data Ownership Scoping**: All SQL queries for tenant-scoped operations enforce `WHERE supplier_id = :authenticated_supplier_id` or `WHERE buyer_id = :authenticated_buyer_id`.
