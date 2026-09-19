import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine, get_db, Base
from app.core.exceptions import AppException, app_exception_handler
from app.models.user import Role

# Import all routers
from app.auth.router import router as auth_router
from app.suppliers.router import router as suppliers_router
from app.buyers.router import router as buyers_router
from app.catalogue.router import router as catalogue_router
from app.inventory.router import router as inventory_router
from app.pricing.router import router as pricing_router
from app.carts.router import router as carts_router
from app.orders.router import router as orders_router
from app.payments.router import router as payments_router
from app.invoices.router import router as invoices_router
from app.logistics.router import router as logistics_router
from app.admin.router import router as admin_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure storage paths exist
    os.makedirs(settings.STORAGE_LOCAL_PATH, exist_ok=True)
    os.makedirs(os.path.join(settings.STORAGE_LOCAL_PATH, "invoices"), exist_ok=True)
    os.makedirs(os.path.join(settings.STORAGE_LOCAL_PATH, "documents"), exist_ok=True)

    # Initialize default roles in database if not present
    with Session(engine) as db:
        roles_to_seed = ["ADMIN", "SUPPLIER", "BUYER", "DRIVER"]
        for r_name in roles_to_seed:
            existing = db.query(Role).filter(Role.name == r_name).first()
            if not existing:
                db.add(Role(name=r_name, description=f"{r_name} role"))
        db.commit()

    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="TheChickenMan B2B Chicken Platform API Gateway",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows Next.js frontend on any port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom Exception Handler
app.add_exception_handler(AppException, app_exception_handler)

# Liveness Probe
@app.get("/health", tags=["Observability"])
def health_check():
    return {
        "status": "healthy",
        "service": "thechickenman-backend",
        "environment": settings.ENVIRONMENT
    }

# Readiness Probe
@app.get("/ready", tags=["Observability"])
def readiness_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "ready",
            "database": "connected",
            "storage": "accessible"
        }
    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "not_ready", "error": str(e)}
        )

# Mount API Routers under /api/v1
api_v1 = FastAPI()
api_v1.include_router(auth_router)
api_v1.include_router(suppliers_router)
api_v1.include_router(buyers_router)
api_v1.include_router(catalogue_router)
api_v1.include_router(inventory_router)
api_v1.include_router(pricing_router)
api_v1.include_router(carts_router)
api_v1.include_router(orders_router)
api_v1.include_router(payments_router)
api_v1.include_router(invoices_router)
api_v1.include_router(logistics_router)
api_v1.include_router(admin_router)

app.mount("/api/v1", api_v1)
