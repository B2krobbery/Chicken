# ChickenMan Agent Guide

## Project overview
TheChickenMan is an institutional-grade B2B digital marketplace connecting vetted commercial poultry producers/processors (Suppliers) with business buyers (Hotels, Restaurants, QSRs, Caterers, and Retailers). It provides a standardized SKU catalogue, enforces KYC and food safety compliance, manages real-time multi-location inventory ledgers, and handles complete transaction lifecycles including payments, GST invoicing, and proof-of-delivery (POD) logistics.

## Architecture
- **Frontend**: A unified Next.js 14 application serving portals for Admins, Suppliers, Buyers, and Drivers. Uses client-side state and interacts with backend APIs.
- **Backend**: A modular FastAPI monolith acting as the API gateway and core business engine. It handles authentication (JWT), role-based access control, transaction state machines, and business logic. In production it runs in a dedicated Vercel project (`chicken-api`, `framework: fastapi`, root directory `backend/`) as a serverless Python deployment; locally it runs via `uvicorn`.
- **Database**: PostgreSQL accessed via SQLAlchemy ORM. Production DB is hosted on Supabase (`Chicken` project, Postgres 17, `ap-northeast-1`); the backend connects through the Supavisor **session-mode pooler** (`aws-0-ap-northeast-1.pooler.supabase.com:5432`) as role `chicken_app`. The database is highly normalized and uses row-level locking (`SELECT FOR UPDATE`) to prevent inventory overselling.
- **Integrations (Mocked)**: Payments and Notifications are currently abstracted and implemented using Mock providers (`MockPaymentProvider`, `MockNotificationProvider`).

## Repository structure
- `/apps/web/`: Next.js 14 frontend application (React, Tailwind CSS).
  - `src/components/portals/`: Contains role-specific UI (AdminPortal, SupplierPortal, BuyerPortal, DriverPortal).
  - `src/lib/api.ts`: API wrapper for communicating with the backend.
- `/backend/`: FastAPI Python backend application.
  - `app/`: Core application modules categorized by domain (admin, auth, buyers, carts, catalogue, inventory, invoices, logistics, models, notifications, orders, payments, pricing, suppliers).
  - `app/models/`: SQLAlchemy database models.
  - `migrations/`: Alembic database migration scripts.
  - `tests/`: Pytest suite covering E2E flows and unit tests.
- `/scripts/`: Shell and Python scripts for running the dev server, running tests, and seeding the database.
- `/docs/`: Project documentation, including the `IMPLEMENTATION_STATUS.md` matrix.

## Tech stack
- **Frontend**: Next.js 14, React 18, Tailwind CSS, Lucide Icons.
- **Backend**: Python 3.12+, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic, Passlib (bcrypt), python-jose (JWT), reportlab (PDF generation).
- **Database**: PostgreSQL (psycopg2-binary).
- **Deployment**: Vercel (Frontend + FastAPI serverless API), Supabase (hosted Postgres).

## Local development

**1. Install Backend Dependencies & Database**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run migrations (Requires running PostgreSQL instance)
alembic upgrade head

# Seed initial test data
python ../scripts/seed.py
```

**2. Install Frontend Dependencies**
```bash
cd apps/web
npm install
```

**3. Run Application**
```bash
# Starts both Backend (http://localhost:8000) and Frontend (http://localhost:3000)
./scripts/run_dev.sh
```

**4. Testing & Linting**
```bash
# Run pytest suite
./scripts/run_tests.sh

# Lint frontend
cd apps/web && npm run lint
```

## Environment variables
The following environment variables are required. See `.env.example` in the root directory for reference. **NEVER commit sensitive credentials to the repository.**

- `DATABASE_URL`: PostgreSQL connection string (e.g. `postgresql://user@localhost:5432/dbname`)
- `TEST_DATABASE_URL`: PostgreSQL connection string for tests.
- `SECRET_KEY`: Secure key for JWT signing.
- `ALGORITHM`: JWT algorithm (e.g., `HS256`).
- `ACCESS_TOKEN_EXPIRE_MINUTES`: JWT expiry.
- `ENVIRONMENT`: e.g. `development` or `production`.
- `LOG_LEVEL`: Logging verbosity.
- `PORT` & `HOST`: Backend server binding.
- `STORAGE_LOCAL_PATH`: Local path for storing generated PDFs and uploads (`/tmp/uploads` on Vercel — function filesystems are read-only outside `/tmp`; files are ephemeral).
- `DB_POOL_SIZE` / `DB_MAX_OVERFLOW`: SQLAlchemy pool sizing (defaults 20/10 for local; set to `2`/`0` on Vercel serverless).
- `PAYMENT_PROVIDER`: Configures payment gateway (currently `MOCK`).
- `NOTIFICATION_PROVIDER`: Configures notifications (currently `MOCK`).
- `NEXT_PUBLIC_API_URL`: (Frontend) Configures the backend API endpoint. Production value: `https://chicken-api-mauve.vercel.app/api/v1`.

## API architecture
- **Base Path**: `/api/v1`
- **Authentication**: JWT Bearer Tokens passed in the `Authorization` header.
- **Idempotency**: Critical endpoints (like `/payments/intent`) enforce idempotency using an `Idempotency-Key` header.
- **Webhooks**: Payment webhooks enforce signature validation (`X-Signature`) and payload deduplication.
- **Error Handling**: Standard HTTP status codes (400 for validation, 401/403 for auth, 404 for not found). Structured JSON error responses.

## Database
- **Technology**: PostgreSQL 16
- **Important Models**: 
  - `User`, `Role`, `UserRole` (RBAC)
  - `Supplier`, `SupplierKYC`, `Buyer`, `BuyerKYC` (Profiles & KYC)
  - `Product`, `SupplierProduct`, `Price` (Catalogue & Pricing with versioning)
  - `Inventory`, `InventoryBatch`, `InventoryMovement` (Stock Ledger)
  - `Order`, `OrderItem`, `Cart`, `CartItem` (Transaction Engine)
  - `Payment`, `PaymentTransaction`, `Invoice` (Financials)
  - `Delivery`, `ProofOfDelivery` (Logistics)
  - `AuditLog`, `Notification` (Observability & Communication)
- **Migrations**: Managed via Alembic (`backend/alembic.ini`).

## Business rules
- **KYC Gating**: Suppliers cannot list SKUs or accept orders until KYC (FSSAI, GSTIN, PAN) is Admin-approved. Buyers cannot place orders until their KYC is approved.
- **Inventory Reservation**: Concurrent stock reservation prevents overselling using PostgreSQL `SELECT ... FOR UPDATE` row-level locks during checkout.
- **Order State Transitions**: Strict linear transitions (`PENDING` -> `CONFIRMED` -> `PROCESSING` -> `PACKED` -> `DISPATCHED` -> `DELIVERED`). Invalid jumps are rejected.
- **Pricing Calculation**: Price changes are versioned and immutable. The system never overwrites historical prices.
- **GST Logic**: Tax computed dynamically based on Place of Supply. Intrastate: CGST (2.5%) + SGST (2.5%). Interstate: IGST (5.0%).
- **Payment Idempotency**: Payment intents and webhook handlers track transactions and enforce idempotency to prevent duplicate charges.
- **Audit Requirements**: All sensitive entity changes (KYC approval, Price change, POD capture) emit an immutable `AuditLog` record.
- **POD Requirements**: Final delivery requires capturing OTP verification, weight accepted/rejected, and recipient signature/photo.

## Deployment
- **Frontend URL**: `https://chicken-kappa-six.vercel.app/` (Vercel project `chicken`, git-linked to `marvelpokemaster/Chicken` `main`; pushes auto-deploy).
- **Frontend**: Next.js app built from `apps/web` via root `vercel.json`.
- **Backend**: Separate Vercel project `chicken-api` (`framework: fastapi`, root directory `backend/`) at `https://chicken-api-mauve.vercel.app`, deployed via `gitSource` deployments from `marvelpokemaster/Chicken` `main`. It is NOT git-linked — after backend changes, trigger a new deployment (Vercel API `create_deployment` or link the repo in the dashboard). Railway deploy files (`backend/railway.toml`, `Procfile`, `Dockerfile`) still exist as an alternative but are unused.
- **Database**: Supabase Postgres via session-mode pooler; connect as role `chicken_app` (least-privilege, created 2026-09-23) — not the `postgres` superuser.
- **Vercel protection**: frontend `ssoProtection` = `all_except_custom_domains` (assigned domains public, deployment URLs need Vercel login); `chicken-api` has SSO protection disabled.
- **Stale URL**: `https://chicken-b2k1.vercel.app/` belongs to an older deployment outside this project and is SSO-locked — do not use or reference it.

## Current implementation status
Review the complete requirement breakdown here:
[Implementation Status](docs/IMPLEMENTATION_STATUS.md)

## Known issues
- **Ephemeral file storage on Vercel**: invoice PDFs and uploads are written under `/tmp/uploads` inside the serverless function; they do not persist across instances. Regeneration works, but durable object storage (e.g. Supabase Storage/S3) is needed for production.
- **Serverless cold starts**: the first request to an idle API function may take a few seconds.
- **Mocked Integrations**: Payments and Notifications use mock providers. A real gateway (e.g., Razorpay, AWS SES) needs to be integrated for production use.

## Testing checklist
When verifying changes, ensure the following steps are taken:
1. Run `alembic upgrade head` to apply any schema changes.
2. Execute the full pytest suite (`./scripts/run_tests.sh`) to ensure no regressions in inventory locking or state machines.
3. Start the dev server (`./scripts/run_dev.sh`) and manually test the flow using the specific role portal affected (e.g. SupplierPortal).
4. Verify that any new business actions generate a corresponding `AuditLog`.

## Agent workflow
Before changing code:
1. Read `AGENTS.md`
2. Read relevant implementation docs (`docs/IMPLEMENTATION_STATUS.md`)
3. Inspect existing code
4. Check deployment impact
5. Make minimal targeted changes
6. Run appropriate tests
7. Update documentation
8. Verify git diff/status

**CRITICAL RULE:** Any agent making a material architectural, API, database, deployment, business-rule, or feature change MUST update `AGENTS.md` and/or `docs/IMPLEMENTATION_STATUS.md` in the same change.
- If architecture changes -> update architecture section
- If API changes -> update API documentation
- If DB schema changes -> update DB section
- If deployment changes -> update deployment section
- If feature status changes -> update IMPLEMENTATION_STATUS.md
- If a bug is discovered -> update known issues
- If commands change -> update local development instructions
