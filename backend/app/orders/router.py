from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.order import Order
from app.models.buyer import Buyer
from app.models.supplier import Supplier
from app.models.user import User
from app.auth.deps import get_current_user, get_current_buyer, get_current_supplier
from app.orders.service import (
    create_order_from_cart,
    transition_order_status,
    supplier_accept_order
)

router = APIRouter(prefix="/orders", tags=["Order Management System (OMS)"])

class OrderCheckoutRequest(BaseModel):
    delivery_location_id: str
    delivery_slot_start: Optional[datetime] = None
    delivery_slot_end: Optional[datetime] = None
    payment_terms: Optional[str] = "ADVANCE"
    notes: Optional[str] = None

class PartialAcceptItem(BaseModel):
    item_id: str
    accepted_quantity_kg: float

class OrderAcceptRequest(BaseModel):
    accepted_items: Optional[List[PartialAcceptItem]] = None

class OrderRejectRequest(BaseModel):
    reason: str

class OrderStatusUpdateRequest(BaseModel):
    status: str
    reason: Optional[str] = None

@router.post("", status_code=status.HTTP_201_CREATED)
def checkout_cart(
    req: OrderCheckoutRequest,
    buyer: Buyer = Depends(get_current_buyer),
    db: Session = Depends(get_db)
):
    order = create_order_from_cart(
        db=db,
        buyer=buyer,
        delivery_location_id=req.delivery_location_id,
        delivery_slot_start=req.delivery_slot_start,
        delivery_slot_end=req.delivery_slot_end,
        payment_terms=req.payment_terms or "ADVANCE",
        notes=req.notes
    )
    return {
        "id": str(order.id),
        "order_number": order.order_number,
        "status": order.status,
        "subtotal_amount": float(order.subtotal_amount),
        "tax_amount": float(order.tax_amount),
        "delivery_fee": float(order.delivery_fee),
        "total_amount": float(order.total_amount),
        "created_at": order.created_at.isoformat()
    }

@router.get("")
def list_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    roles = [r.name for r in current_user.roles]
    q = db.query(Order)

    if "ADMIN" in roles:
        pass
    elif "SUPPLIER" in roles:
        if not current_user.supplier:
            return []
        q = q.filter(Order.supplier_id == current_user.supplier.id)
    elif "BUYER" in roles:
        if not current_user.buyer:
            return []
        q = q.filter(Order.buyer_id == current_user.buyer.id)
    elif "DRIVER" in roles:
        # Driver sees orders assigned to them
        q = q.join(Order.delivery).filter(Order.delivery.has(driver_user_id=current_user.id))
    else:
        return []

    orders = q.order_by(Order.created_at.desc()).all()
    return [
        {
            "id": str(o.id),
            "order_number": o.order_number,
            "status": o.status,
            "buyer_name": o.buyer.business_name if o.buyer else None,
            "supplier_name": o.supplier.business_name if o.supplier else None,
            "total_amount": float(o.total_amount),
            "payment_status": o.payment.status if o.payment else "PENDING",
            "driver_name": o.delivery.driver.full_name if (o.delivery and o.delivery.driver) else None,
            "vehicle_number": o.delivery.vehicle_number if o.delivery else None,
            "created_at": o.created_at.isoformat()
        }
        for o in orders
    ]

@router.get("/{order_id}")
def get_order_details(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    roles = [r.name for r in current_user.roles]
    # Verify authorization
    if "ADMIN" not in roles:
        if "BUYER" in roles and (not current_user.buyer or order.buyer_id != current_user.buyer.id):
            raise HTTPException(status_code=403, detail="Not authorized to view this order")
        if "SUPPLIER" in roles and (not current_user.supplier or order.supplier_id != current_user.supplier.id):
            raise HTTPException(status_code=403, detail="Not authorized to view this order")

    items = [
        {
            "id": str(i.id),
            "product_name": i.product.name,
            "sku_code": i.product.sku_code,
            "condition": i.product.condition,
            "quantity_kg": float(i.quantity_kg),
            "unit_price_per_kg": float(i.unit_price_per_kg),
            "tax_rate_percent": float(i.tax_rate_percent),
            "tax_amount": float(i.tax_amount),
            "total_price": float(i.total_price)
        }
        for i in order.items
    ]

    history = [
        {
            "previous_status": h.previous_status,
            "new_status": h.new_status,
            "reason": h.reason,
            "timestamp": h.created_at.isoformat()
        }
        for h in order.status_history
    ]

    return {
        "id": str(order.id),
        "order_number": order.order_number,
        "status": order.status,
        "buyer_id": str(order.buyer_id),
        "buyer_name": order.buyer.business_name,
        "supplier_id": str(order.supplier_id),
        "supplier_name": order.supplier.business_name,
        "delivery_address": f"{order.delivery_location.name}, {order.delivery_location.address_line1}, {order.delivery_location.city} - {order.delivery_location.pincode}",
        "subtotal_amount": float(order.subtotal_amount),
        "tax_amount": float(order.tax_amount),
        "delivery_fee": float(order.delivery_fee),
        "total_amount": float(order.total_amount),
        "payment_status": order.payment.status if order.payment else "PENDING",
        "items": items,
        "status_history": history,
        "has_invoice": order.invoice is not None,
        "invoice_id": str(order.invoice.id) if order.invoice else None,
        "created_at": order.created_at.isoformat()
    }

@router.post("/{order_id}/accept")
def accept_order(
    order_id: str,
    req: OrderAcceptRequest,
    supplier: Supplier = Depends(get_current_supplier),
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(Order.id == order_id, Order.supplier_id == supplier.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found for this supplier")

    accepted_items_dict = [i.model_dump() for i in req.accepted_items] if req.accepted_items else None

    updated_order = supplier_accept_order(
        db=db,
        order=order,
        supplier_user_id=supplier.user_id,
        accepted_items=accepted_items_dict
    )
    return {
        "message": "Order confirmed successfully",
        "order_id": str(updated_order.id),
        "order_number": updated_order.order_number,
        "status": updated_order.status,
        "total_amount": float(updated_order.total_amount)
    }

@router.post("/{order_id}/reject")
def reject_order(
    order_id: str,
    req: OrderRejectRequest,
    supplier: Supplier = Depends(get_current_supplier),
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(Order.id == order_id, Order.supplier_id == supplier.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found for this supplier")

    updated_order = transition_order_status(
        db=db,
        order=order,
        new_status="REJECTED",
        user_id=supplier.user_id,
        reason=req.reason
    )
    return {
        "message": "Order rejected and inventory released",
        "order_id": str(updated_order.id),
        "status": updated_order.status
    }

@router.patch("/{order_id}/status")
def update_status(
    order_id: str,
    req: OrderStatusUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    updated_order = transition_order_status(
        db=db,
        order=order,
        new_status=req.status,
        user_id=current_user.id,
        reason=req.reason
    )
    return {
        "message": f"Order status updated to {updated_order.status}",
        "order_id": str(updated_order.id),
        "status": updated_order.status
    }
