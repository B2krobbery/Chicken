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
  - `src/components/portals/`: Contains role-specific UI (AdminPortal, SupplierPortal, BuyerPortal, DriverPortal). Each portal is a single-page dashboard that renders inside the shared `AppShell` and switches between named views via internal state (no router).
  - `src/components/ui/`: Shared design-system primitives — `AppShell` (dark-slate sidebar + topbar, role-aware nav, breadcrumbs, env chip, user menu), `Skeleton` (`Sk`, `SkText`, `SkTableRows`, `SkCard`, `SkKpi`), `States` (`StatusBadge`, `EmptyState`, `ErrorState`, `Banner`), `Splash` (branded entry screen).
  - `src/components/OrderTimelineTracker.tsx`, `GSTTaxInvoiceModal.tsx`: Shared order/invoice components.
  - `src/lib/api.ts`: API wrapper for communicating with the backend.
- `/.stitch/designs/`: Downloaded Stitch design artifacts (screenshots, design tokens).
- `/backend/`: FastAPI Python backend application.
  - `app/`: Core application modules categorized by domain (admin, auth, buyers, carts, catalogue, inventory, invoices, logistics, models, notifications, orders, payments, pricing, suppliers).
  - `app/models/`: SQLAlchemy database models.
  - `migrations/`: Alembic database migration scripts.
  - `tests/`: Pytest suite covering E2E flows and unit tests.
- `/scripts/`: Shell and Python scripts for running the dev server, running tests, and seeding the database.
- `/docs/`: Project documentation, including the `IMPLEMENTATION_STATUS.md` matrix.

## Tech stack
- **Frontend**: Next.js 14, React 18, Tailwind CSS, Lucide Icons, Inter (UI) + JetBrains Mono (tabular numerals — `.tnum` class for prices/quantities/order numbers).

## Frontend design system ("ChickenMan Ops")
- **Source**: Google Stitch project `7677945534075423788`, design system "ChickenMan Ops" (LIGHT, ROUND_FOUR, custom color `#ea580c`, Inter + JetBrains Mono). Generated artifacts live in `/.stitch/designs/`.
- **Shell surfaces**: deep slate — `shell-900 #0f172a` sidebar, `shell-800 #1e293b` elevated, `shell-700 #334155` dividers; `slate-50` text, `slate-400` muted.
- **Canvas**: `slate-50` page, white surfaces, `slate-200` borders, `slate-900` primary text.
- **Accent**: `brand-600 #ea580c` (hover `brand-700`) for primary actions only; sidebar active item uses `brand-600/15` bg + `brand-400` text.
- **Status semantics** (`StatusBadge`): PENDING/CONFIRMED amber, PROCESSING blue, PACKED indigo, DISPATCHED/IN_TRANSIT sky, DELIVERED/APPROVED/SUCCESS emerald, CANCELLED/REJECTED/FAILED rose, REFUNDED slate.
- **Density**: compact tables (36–40px rows, `px-3 py-2` cells, `text-xs`), `space-y-4` section rhythm, `text-[10px]/[11px]` metadata, no oversized cards/headers.
- **Typography**: `text-sm` titles, `text-xs` body/table, `text-[10px]–[11px]` captions; numerals always `.tnum`.
- **Radius**: `rounded-md` for cards/buttons, `rounded-full` for badges.

## Loading / empty / error system
- **Splash**: `SplashScreen` with brand pulse + a real stage label (never fake progress).
- **Skeletons**: `.skeleton` shimmer class in `globals.css` (respects `prefers-reduced-motion`); every major view has a matching skeleton (`SkKpi`, `SkCard`, `SkTableRows`) that preserves final layout — views gate on `loading`/null-data, never flash EmptyState while loading.
- **Empty states**: `EmptyState` — icon + title + explanation + real action (no invented actions).
- **Error states**: `ErrorState` (full + `compact` banner variant) and `Banner` (success/error toasts). API failures surface honestly with retry where a loader exists.

## Responsive strategy
- Sidebar `lg:` fixed (w-60); below `lg` it collapses to a hamburger-drawer overlay.
- Grids: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4` for marketplace; `grid-cols-2 lg:grid-cols-4` for KPIs.
- Tables live in `overflow-x-auto` wrappers and hide non-essential columns on small screens (`hidden md:table-cell`) so nothing overflows the viewport at 320px.
- Driver/POD touch targets are `min-h-[44px]`.
- Content column is fluid with `max-w-[1600px]`; verified at 320, 390, 768, 1280, 1440, 1920.
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
- `DB_POOL_SIZE` / `DB_MAX_OVERFLOW`: SQLAlchemy pool sizing (defaults 20/10 for local; set to `2`/`0` on Vercel serverless). **On Vercel the engine uses `NullPool` automatically** (`VERCEL` env detected in `app/core/database.py`) so these are ignored there — each request opens/closes a fresh pooler connection; see "Supavisor pool exhaustion" in Known issues.
- `PAYMENT_PROVIDER`: Configures payment gateway (currently `MOCK`).
- `NOTIFICATION_PROVIDER`: Configures notifications (currently `MOCK`).
- `NEXT_PUBLIC_API_URL`: (Frontend) Configures the backend API endpoint. Production value: `https://chicken-api-mauve.vercel.app/api/v1`.
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: (Frontend) Optional Google Cloud OAuth 2.0 Client ID for Google Identity Services / One Tap. Can also be set in browser settings via the UI connect modal.
- `GOOGLE_CLIENT_ID`: (Backend) Optional Google Cloud OAuth 2.0 Client ID for token audience verification.

## API architecture
- **Base Path**: `/api/v1`
- **Authentication**: JWT Bearer Tokens passed in the `Authorization` header. Public self-registration (`POST /api/v1/auth/register`) is strictly scoped to `BUYER` and `SUPPLIER` personas; `ADMIN` and `DRIVER` accounts are provisioned via database seed or operations. Password hashing uses standard bcrypt. Emails and phone numbers are normalized (whitespace-trimmed and case-insensitive).
- **Google OAuth SSO**: `POST /api/v1/auth/google` accepts Google ID token credentials from Google Identity Services. The backend validates token authenticity with Google's tokeninfo API, auto-provisions new users with their chosen commercial role (`BUYER` or `SUPPLIER`), initializes business profiles and buyer carts, emits immutable audit records (`USER_REGISTER_GOOGLE` or `USER_LOGIN_GOOGLE`), and returns session JWT tokens.
- **Session Lifecycle**: Frontend `api.ts` listens for `401 Unauthorized` responses and reactively purges expired tokens while notifying `AuthContext` to transition to the login view with an informative banner.
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
- **Supavisor pool exhaustion (mitigated by NullPool)**: Vercel warm instances used to hold pooled connections open; under session-mode pooling each held a server-side slot until the free-tier pool filled and every DB-backed endpoint returned 500 (`/health` stayed green). Fixed by using `NullPool` on Vercel. **Requires a `chicken-api` redeploy to take effect.** Manual recovery if it recurs: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename='chicken_app' AND state='idle';` via Supabase SQL.
- **Intermittent 500/CORS on cold starts**: under burst load some serverless invocations fail before the app runs (browser may report them as CORS blocks). Usually transient — retry. UI surfaces these honestly via error banners.
- **API latency**: DB-backed calls from the Vercel function take ~3–4s (pooler connect latency per request with NullPool). Frontend fires them in parallel.
- **Ephemeral file storage on Vercel**: invoice PDFs and uploads are written under `/tmp/uploads` inside the serverless function; they do not persist across instances. Regeneration works, but durable object storage (e.g. Supabase Storage/S3) is needed for production.
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
