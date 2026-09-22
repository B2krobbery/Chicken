from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.models.catalogue import Product, SupplierProduct, Price
from app.models.supplier import Supplier, SupplierLocation
from app.models.inventory import Inventory
from app.models.user import User
from app.auth.deps import get_current_user, require_roles, get_current_supplier, require_approved_supplier

router = APIRouter(prefix="/catalogue", tags=["Catalogue & Marketplace Discovery"])

class MasterProductCreate(BaseModel):
    sku_code: str
    name: str
    product_type: str  # WHOLE, CUTS, BONELESS
    condition: str     # FRESH, CHILLED, FROZEN
    grade: str = "GRADE_A"
    standard_pack_size_kg: float = 1.00
    description: Optional[str] = None

class SupplierListingCreate(BaseModel):
    product_id: str
    supplier_sku_code: Optional[str] = None
    base_price_per_kg: float = Field(..., gt=0)
    moq_kg: float = Field(10.00, gt=0)
    lead_time_hours: int = 24
    pack_size_kg: float = 1.00
    serviceable_pincodes: List[str] = []

@router.get("/products")
def list_master_products(db: Session = Depends(get_db)):
    products = db.query(Product).filter(Product.is_active == True).all()
    return [
        {
            "id": str(p.id),
            "sku_code": p.sku_code,
            "name": p.name,
            "product_type": p.product_type,
            "condition": p.condition,
            "grade": p.grade,
            "standard_pack_size_kg": float(p.standard_pack_size_kg),
            "description": p.description
        }
        for p in products
    ]

@router.post("/products", status_code=status.HTTP_201_CREATED)
def create_master_product(
    req: MasterProductCreate,
    current_user: User = Depends(require_roles(["ADMIN"])),
    db: Session = Depends(get_db)
):
    existing = db.query(Product).filter(Product.sku_code == req.sku_code.upper()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Product with this SKU code already exists")

    product = Product(
        sku_code=req.sku_code.upper(),
        name=req.name,
        product_type=req.product_type.upper(),
        condition=req.condition.upper(),
        grade=req.grade.upper(),
        standard_pack_size_kg=Decimal(str(req.standard_pack_size_kg)),
        description=req.description,
        is_active=True
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return {
        "id": str(product.id),
        "sku_code": product.sku_code,
        "name": product.name
    }

@router.get("/my-listings")
def list_my_listings(
    supplier: Supplier = Depends(get_current_supplier),
    db: Session = Depends(get_db)
):
    listings = db.query(SupplierProduct).filter(SupplierProduct.supplier_id == supplier.id).all()
    return [
        {
            "id": str(l.id),
            "product_id": str(l.product_id),
            "product_name": l.product.name,
            "sku_code": l.product.sku_code,
            "condition": l.product.condition,
            "base_price_per_kg": float(l.base_price_per_kg),
            "moq_kg": float(l.moq_kg),
            "lead_time_hours": l.lead_time_hours,
            "pack_size_kg": float(l.pack_size_kg),
            "is_available": l.is_available,
            "serviceable_pincodes": l.serviceable_pincodes
        }
        for l in listings
    ]

@router.post("/listings", status_code=status.HTTP_201_CREATED)
def create_supplier_listing(
    req: SupplierListingCreate,
    supplier: Supplier = Depends(require_approved_supplier),
    db: Session = Depends(get_db)
):
    product = db.query(Product).filter(Product.id == req.product_id, Product.is_active == True).first()
    if not product:
        raise HTTPException(status_code=404, detail="Master Product SKU not found")

    existing = db.query(SupplierProduct).filter(
        SupplierProduct.supplier_id == supplier.id,
        SupplierProduct.product_id == product.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Supplier already has a listing for this product SKU")

    listing = SupplierProduct(
        supplier_id=supplier.id,
        product_id=product.id,
        supplier_sku_code=req.supplier_sku_code,
        base_price_per_kg=Decimal(str(req.base_price_per_kg)),
        moq_kg=Decimal(str(req.moq_kg)),
        lead_time_hours=req.lead_time_hours,
        pack_size_kg=Decimal(str(req.pack_size_kg)),
        is_available=True,
        serviceable_pincodes=req.serviceable_pincodes
    )
    db.add(listing)
    db.flush()

    # Create initial versioned price
    initial_price = Price(
        supplier_product_id=listing.id,
        price_per_kg=listing.base_price_per_kg,
        moq_kg=listing.moq_kg,
        buyer_segment="ALL",
        version=1,
        created_by=supplier.user_id
    )
    db.add(initial_price)
    db.commit()
    db.refresh(listing)

    return {
        "id": str(listing.id),
        "product_id": str(product.id),
        "sku_code": product.sku_code,
        "base_price_per_kg": float(listing.base_price_per_kg),
        "moq_kg": float(listing.moq_kg)
    }

@router.get("/listings")
def search_listings(
    query: Optional[str] = None,
    condition: Optional[str] = None,
    pincode: Optional[str] = None,
    supplier_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    # Only show listings from APPROVED suppliers
    q = db.query(SupplierProduct).join(Supplier).join(Product).filter(
        Supplier.kyc_status == "APPROVED",
        Supplier.status == "ACTIVE",
        SupplierProduct.is_available == True,
        Product.is_active == True
    )

    if query:
        search = f"%{query}%"
        q = q.filter(or_(Product.name.ilike(search), Product.sku_code.ilike(search), Supplier.business_name.ilike(search)))
    
    if condition:
        q = q.filter(Product.condition == condition.upper())

    if supplier_id:
        q = q.filter(SupplierProduct.supplier_id == supplier_id)

    listings = q.all()
    results = []
    for l in listings:
        if pincode and l.serviceable_pincodes and (pincode not in l.serviceable_pincodes):
            continue

        # Calculate total available inventory for this product across supplier's locations
        inv_records = db.query(Inventory).filter(
            Inventory.supplier_id == l.supplier_id,
            Inventory.product_id == l.product_id
        ).all()
        total_available = sum(float(i.quantity_available_kg) for i in inv_records)

        # Landed economics estimate for 1 unit (pack size)
        base_price = float(l.base_price_per_kg)
        tax_rate = 5.0  # standard 5% GST on processed poultry
        tax_amount = round(base_price * (tax_rate / 100.0), 2)
        delivery_estimate_per_kg = 5.00  # typical logistics buffer
        landed_price_per_kg = round(base_price + tax_amount + delivery_estimate_per_kg, 2)

        # Get supplier's primary active location
        loc = db.query(SupplierLocation).filter(
            SupplierLocation.supplier_id == l.supplier_id,
            SupplierLocation.is_active == True
        ).first()

        results.append({
            "id": str(l.id),
            "supplier_id": str(l.supplier_id),
            "supplier_location_id": str(loc.id) if loc else None,
            "supplier_name": l.supplier.business_name,
            "product_id": str(l.product_id),
            "product_name": l.product.name,
            "sku_code": l.product.sku_code,
            "product_type": l.product.product_type,
            "condition": l.product.condition,
            "grade": l.product.grade,
            "base_price_per_kg": base_price,
            "tax_rate_percent": tax_rate,
            "landed_price_per_kg": landed_price_per_kg,
            "moq_kg": float(l.moq_kg),
            "lead_time_hours": l.lead_time_hours,
            "pack_size_kg": float(l.pack_size_kg),
            "total_available_stock_kg": total_available,
            "serviceable_pincodes": l.serviceable_pincodes
        })

    return results

@router.get("/listings/{listing_id}")
def get_listing_detail(listing_id: str, db: Session = Depends(get_db)):
    l = db.query(SupplierProduct).filter(SupplierProduct.id == listing_id).first()
    if not l:
        raise HTTPException(status_code=404, detail="Product listing not found")

    inv_records = db.query(Inventory).filter(
        Inventory.supplier_id == l.supplier_id,
        Inventory.product_id == l.product_id
    ).all()
    total_available = sum(float(i.quantity_available_kg) for i in inv_records)

    base_price = float(l.base_price_per_kg)
    tax_rate = 5.0
    tax_amount = round(base_price * 0.05, 2)
    delivery_estimate_per_kg = 5.00
    landed_price_per_kg = round(base_price + tax_amount + delivery_estimate_per_kg, 2)

    return {
        "id": str(l.id),
        "supplier_id": str(l.supplier_id),
        "supplier_name": l.supplier.business_name,
        "product_id": str(l.product_id),
        "product_name": l.product.name,
        "sku_code": l.product.sku_code,
        "product_type": l.product.product_type,
        "condition": l.product.condition,
        "grade": l.product.grade,
        "description": l.product.description,
        "base_price_per_kg": base_price,
        "tax_rate_percent": tax_rate,
        "delivery_estimate_per_kg": delivery_estimate_per_kg,
        "landed_price_per_kg": landed_price_per_kg,
        "moq_kg": float(l.moq_kg),
        "lead_time_hours": l.lead_time_hours,
        "pack_size_kg": float(l.pack_size_kg),
        "total_available_stock_kg": total_available,
        "serviceable_pincodes": l.serviceable_pincodes
    }
