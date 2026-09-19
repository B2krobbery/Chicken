from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.catalogue import SupplierProduct, Price
from app.models.supplier import Supplier
from app.auth.deps import get_current_supplier, require_approved_supplier
from app.audit.service import log_audit_event

router = APIRouter(prefix="/pricing", tags=["Pricing & Price Versioning"])

class PriceUpdateRequest(BaseModel):
    supplier_product_id: str
    price_per_kg: float = Field(..., gt=0)
    moq_kg: Optional[float] = Field(None, gt=0)
    buyer_segment: Optional[str] = "ALL"  # ALL, RETAILER, HORECA, INSTITUTIONAL

@router.post("", status_code=status.HTTP_200_OK)
def update_price(
    req: PriceUpdateRequest,
    request: Request,
    supplier: Supplier = Depends(require_approved_supplier),
    db: Session = Depends(get_db)
):
    listing = db.query(SupplierProduct).filter(
        SupplierProduct.id == req.supplier_product_id,
        SupplierProduct.supplier_id == supplier.id
    ).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Supplier product listing not found")

    # Get latest version number
    latest_price = db.query(Price).filter(
        Price.supplier_product_id == listing.id
    ).order_by(Price.version.desc()).first()
    
    new_version = (latest_price.version + 1) if latest_price else 1
    new_price_val = Decimal(str(req.price_per_kg))
    new_moq_val = Decimal(str(req.moq_kg)) if req.moq_kg else listing.moq_kg

    old_price_val = float(listing.base_price_per_kg)

    # Update current listing base price
    listing.base_price_per_kg = new_price_val
    if req.moq_kg:
        listing.moq_kg = new_moq_val

    # Create immutable new price version
    price_entry = Price(
        supplier_product_id=listing.id,
        price_per_kg=new_price_val,
        moq_kg=new_moq_val,
        buyer_segment=req.buyer_segment or "ALL",
        version=new_version,
        created_by=supplier.user_id
    )
    db.add(price_entry)

    log_audit_event(
        db=db,
        action="PRICE_CHANGE",
        entity_type="PRICE",
        entity_id=str(listing.id),
        actor_id=supplier.user_id,
        old_values={"price_per_kg": old_price_val},
        new_values={"price_per_kg": float(new_price_val), "version": new_version},
        ip_address=request.client.host if request.client else None
    )

    db.commit()
    db.refresh(price_entry)

    return {
        "message": "Price updated successfully",
        "supplier_product_id": str(listing.id),
        "new_price_per_kg": float(new_price_val),
        "version": new_version,
        "effective_from": price_entry.effective_from.isoformat()
    }

@router.get("/history/{listing_id}")
def get_price_history(
    listing_id: str,
    supplier: Supplier = Depends(get_current_supplier),
    db: Session = Depends(get_db)
):
    listing = db.query(SupplierProduct).filter(
        SupplierProduct.id == listing_id,
        SupplierProduct.supplier_id == supplier.id
    ).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    prices = db.query(Price).filter(Price.supplier_product_id == listing.id).order_by(Price.version.desc()).all()
    return [
        {
            "id": str(p.id),
            "version": p.version,
            "price_per_kg": float(p.price_per_kg),
            "moq_kg": float(p.moq_kg),
            "buyer_segment": p.buyer_segment,
            "effective_from": p.effective_from.isoformat(),
            "effective_to": p.effective_to.isoformat() if p.effective_to else None
        }
        for p in prices
    ]
