from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.cart import Cart, CartItem
from app.models.buyer import Buyer
from app.models.catalogue import SupplierProduct
from app.models.supplier import SupplierLocation, Supplier
from app.models.inventory import Inventory
from app.auth.deps import get_current_buyer

router = APIRouter(prefix="/cart", tags=["Cart & Checkout Pre-validation"])

class AddCartItemRequest(BaseModel):
    supplier_product_id: str
    supplier_location_id: Optional[str] = None
    quantity_kg: float = Field(..., gt=0)

@router.get("")
def get_cart(
    buyer: Buyer = Depends(get_current_buyer),
    db: Session = Depends(get_db)
):
    cart = db.query(Cart).filter(Cart.buyer_id == buyer.id).first()
    if not cart:
        cart = Cart(buyer_id=buyer.id)
        db.add(cart)
        db.commit()
        db.refresh(cart)

    items_data = []
    subtotal = Decimal("0.00")
    total_tax = Decimal("0.00")
    is_valid_for_checkout = True
    validation_messages = []

    for item in cart.items:
        sp = item.supplier_product
        loc = item.supplier_location
        qty = item.quantity_kg

        # Check MOQ
        moq_met = qty >= sp.moq_kg
        if not moq_met:
            is_valid_for_checkout = False
            validation_messages.append(f"{sp.product.name}: Quantity ({qty}kg) is below supplier MOQ ({sp.moq_kg}kg).")

        # Check real-time stock
        inv_records = db.query(Inventory).filter(
            Inventory.supplier_id == sp.supplier_id,
            Inventory.supplier_location_id == loc.id,
            Inventory.product_id == sp.product_id
        ).all()
        available_stock = sum((i.quantity_available_kg for i in inv_records), Decimal("0.00"))
        stock_sufficient = available_stock >= qty
        if not stock_sufficient:
            is_valid_for_checkout = False
            validation_messages.append(f"{sp.product.name}: Requested {qty}kg exceeds available stock ({available_stock}kg).")

        # Check supplier status
        if sp.supplier.kyc_status != "APPROVED":
            is_valid_for_checkout = False
            validation_messages.append(f"{sp.product.name}: Supplier KYC is not currently active.")

        unit_price = sp.base_price_per_kg
        item_subtotal = qty * unit_price
        tax_rate = Decimal("5.00")  # 5% GST
        item_tax = round(item_subtotal * (tax_rate / Decimal("100.00")), 2)
        item_total = item_subtotal + item_tax

        subtotal += item_subtotal
        total_tax += item_tax

        items_data.append({
            "id": str(item.id),
            "supplier_product_id": str(sp.id),
            "product_id": str(sp.product_id),
            "product_name": sp.product.name,
            "sku_code": sp.product.sku_code,
            "condition": sp.product.condition,
            "supplier_id": str(sp.supplier_id),
            "supplier_name": sp.supplier.business_name,
            "supplier_location_id": str(loc.id),
            "location_name": loc.name,
            "quantity_kg": float(qty),
            "unit_price_per_kg": float(unit_price),
            "item_subtotal": float(item_subtotal),
            "tax_amount": float(item_tax),
            "item_total": float(item_total),
            "moq_kg": float(sp.moq_kg),
            "moq_met": moq_met,
            "available_stock_kg": float(available_stock),
            "stock_sufficient": stock_sufficient
        })

    delivery_fee = Decimal("150.00") if len(items_data) > 0 else Decimal("0.00")
    grand_total = subtotal + total_tax + delivery_fee

    return {
        "cart_id": str(cart.id),
        "items_count": len(items_data),
        "items": items_data,
        "subtotal": float(subtotal),
        "total_tax": float(total_tax),
        "delivery_fee": float(delivery_fee),
        "grand_total": float(grand_total),
        "is_valid_for_checkout": is_valid_for_checkout and len(items_data) > 0,
        "validation_messages": validation_messages
    }

@router.post("/items", status_code=status.HTTP_200_OK)
def add_item_to_cart(
    req: AddCartItemRequest,
    buyer: Buyer = Depends(get_current_buyer),
    db: Session = Depends(get_db)
):
    cart = db.query(Cart).filter(Cart.buyer_id == buyer.id).first()
    if not cart:
        cart = Cart(buyer_id=buyer.id)
        db.add(cart)
        db.flush()

    sp = db.query(SupplierProduct).filter(SupplierProduct.id == req.supplier_product_id).first()
    if not sp or not sp.is_available:
        raise HTTPException(status_code=404, detail="Product listing not available")

    loc = None
    if req.supplier_location_id:
        loc = db.query(SupplierLocation).filter(
            SupplierLocation.id == req.supplier_location_id,
            SupplierLocation.supplier_id == sp.supplier_id
        ).first()
    if not loc:
        loc = db.query(SupplierLocation).filter(
            SupplierLocation.supplier_id == sp.supplier_id,
            SupplierLocation.is_active == True
        ).first()
    if not loc:
        raise HTTPException(status_code=404, detail="No active supplier location found for dispatch")

    # If cart already has an item for this listing & location, update qty
    item = db.query(CartItem).filter(
        CartItem.cart_id == cart.id,
        CartItem.supplier_product_id == sp.id,
        CartItem.supplier_location_id == loc.id
    ).first()

    qty = Decimal(str(req.quantity_kg))
    if item:
        item.quantity_kg += qty
    else:
        item = CartItem(
            cart_id=cart.id,
            supplier_product_id=sp.id,
            supplier_location_id=loc.id,
            quantity_kg=qty
        )
        db.add(item)

    db.commit()
    return {"message": "Item added to cart", "cart_id": str(cart.id)}

@router.delete("/items/{item_id}")
def remove_cart_item(
    item_id: str,
    buyer: Buyer = Depends(get_current_buyer),
    db: Session = Depends(get_db)
):
    cart = db.query(Cart).filter(Cart.buyer_id == buyer.id).first()
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")

    item = db.query(CartItem).filter(CartItem.id == item_id, CartItem.cart_id == cart.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found in cart")

    db.delete(item)
    db.commit()
    return {"message": "Item removed from cart"}

@router.delete("")
def clear_cart(
    buyer: Buyer = Depends(get_current_buyer),
    db: Session = Depends(get_db)
):
    cart = db.query(Cart).filter(Cart.buyer_id == buyer.id).first()
    if cart:
        db.query(CartItem).filter(CartItem.cart_id == cart.id).delete()
        db.commit()
    return {"message": "Cart cleared"}
