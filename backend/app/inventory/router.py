from datetime import date
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.inventory import Inventory, InventoryBatch, InventoryMovement
from app.models.supplier import Supplier, SupplierLocation
from app.models.catalogue import Product
from app.auth.deps import get_current_supplier, require_approved_supplier
from app.inventory.service import create_batch, add_stock

router = APIRouter(prefix="/inventory", tags=["Inventory Ledger & Batches"])

class BatchCreateRequest(BaseModel):
    batch_number: str
    production_date: date
    expiry_date: date
    storage_condition: str = "CHILLED"  # FRESH, CHILLED, FROZEN

class StockInRequest(BaseModel):
    location_id: str
    product_id: str
    quantity_kg: float = Field(..., gt=0)
    batch_id: Optional[str] = None
    notes: Optional[str] = "Manual Stock In"

@router.post("/batches", status_code=status.HTTP_201_CREATED)
def create_inventory_batch(
    req: BatchCreateRequest,
    supplier: Supplier = Depends(require_approved_supplier),
    db: Session = Depends(get_db)
):
    if req.expiry_date <= req.production_date:
        raise HTTPException(status_code=400, detail="Expiry date must be after production date")

    existing = db.query(InventoryBatch).filter(
        InventoryBatch.supplier_id == supplier.id,
        InventoryBatch.batch_number == req.batch_number
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Batch number already exists for this supplier")

    batch = create_batch(
        db=db,
        supplier_id=supplier.id,
        batch_number=req.batch_number,
        production_date=req.production_date,
        expiry_date=req.expiry_date,
        storage_condition=req.storage_condition
    )
    db.commit()
    db.refresh(batch)

    return {
        "id": str(batch.id),
        "batch_number": batch.batch_number,
        "production_date": batch.production_date.isoformat(),
        "expiry_date": batch.expiry_date.isoformat(),
        "storage_condition": batch.storage_condition
    }

@router.get("/batches")
def list_batches(
    supplier: Supplier = Depends(get_current_supplier),
    db: Session = Depends(get_db)
):
    batches = db.query(InventoryBatch).filter(InventoryBatch.supplier_id == supplier.id).order_by(InventoryBatch.created_at.desc()).all()
    return [
        {
            "id": str(b.id),
            "batch_number": b.batch_number,
            "production_date": b.production_date.isoformat(),
            "expiry_date": b.expiry_date.isoformat(),
            "storage_condition": b.storage_condition
        }
        for b in batches
    ]

@router.post("/stock-in", status_code=status.HTTP_201_CREATED)
def perform_stock_in(
    req: StockInRequest,
    supplier: Supplier = Depends(require_approved_supplier),
    db: Session = Depends(get_db)
):
    location = db.query(SupplierLocation).filter(
        SupplierLocation.id == req.location_id,
        SupplierLocation.supplier_id == supplier.id
    ).first()
    if not location:
        raise HTTPException(status_code=404, detail="Supplier location not found")

    product = db.query(Product).filter(Product.id == req.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if req.batch_id:
        batch = db.query(InventoryBatch).filter(
            InventoryBatch.id == req.batch_id,
            InventoryBatch.supplier_id == supplier.id
        ).first()
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")

    inv = add_stock(
        db=db,
        supplier_id=supplier.id,
        location_id=location.id,
        product_id=product.id,
        quantity_kg=Decimal(str(req.quantity_kg)),
        batch_id=req.batch_id,
        actor_id=supplier.user_id,
        notes=req.notes
    )
    db.commit()
    db.refresh(inv)

    return {
        "id": str(inv.id),
        "product_name": product.name,
        "location_name": location.name,
        "quantity_available_kg": float(inv.quantity_available_kg),
        "quantity_reserved_kg": float(inv.quantity_reserved_kg),
        "quantity_allocated_kg": float(inv.quantity_allocated_kg),
        "quantity_dispatched_kg": float(inv.quantity_dispatched_kg),
        "quantity_delivered_kg": float(inv.quantity_delivered_kg)
    }

@router.get("")
def list_inventory(
    supplier: Supplier = Depends(get_current_supplier),
    db: Session = Depends(get_db)
):
    records = db.query(Inventory).filter(Inventory.supplier_id == supplier.id).all()
    return [
        {
            "id": str(r.id),
            "location_id": str(r.supplier_location_id),
            "location_name": r.location.name if r.location else None,
            "product_id": str(r.product_id),
            "product_name": r.product.name if r.product else None,
            "sku_code": r.product.sku_code if r.product else None,
            "batch_id": str(r.batch_id) if r.batch_id else None,
            "batch_number": r.batch.batch_number if r.batch else None,
            "expiry_date": r.batch.expiry_date.isoformat() if r.batch else None,
            "quantity_available_kg": float(r.quantity_available_kg),
            "quantity_reserved_kg": float(r.quantity_reserved_kg),
            "quantity_allocated_kg": float(r.quantity_allocated_kg),
            "quantity_dispatched_kg": float(r.quantity_dispatched_kg),
            "quantity_delivered_kg": float(r.quantity_delivered_kg),
            "updated_at": r.updated_at.isoformat()
        }
        for r in records
    ]

@router.get("/movements")
def list_inventory_movements(
    supplier: Supplier = Depends(get_current_supplier),
    db: Session = Depends(get_db)
):
    movements = db.query(InventoryMovement).join(Inventory).filter(
        Inventory.supplier_id == supplier.id
    ).order_by(InventoryMovement.created_at.desc()).limit(100).all()

    return [
        {
            "id": str(m.id),
            "inventory_id": str(m.inventory_id),
            "movement_type": m.movement_type,
            "quantity_kg": float(m.quantity_kg),
            "reference_order_id": str(m.reference_order_id) if m.reference_order_id else None,
            "notes": m.notes,
            "created_at": m.created_at.isoformat()
        }
        for m in movements
    ]
