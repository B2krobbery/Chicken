from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Any
from sqlalchemy.orm import Session

from app.models.order import Order, OrderItem, OrderStatusHistory
from app.models.cart import Cart, CartItem
from app.models.buyer import Buyer, BuyerLocation
from app.models.supplier import Supplier, SupplierLocation
from app.models.inventory import Inventory
from app.core.exceptions import (
    AppException,
    InsufficientStockException,
    KYCPendingException,
    InvalidOrderStateTransitionException
)
from app.inventory.service import (
    reserve_stock,
    allocate_reserved_stock,
    dispatch_allocated_stock,
    deliver_dispatched_stock,
    release_order_stock
)
from app.notifications.service import dispatch_notification
from app.audit.service import log_audit_event

# Permitted state transition map
ALLOWED_TRANSITIONS = {
    "PENDING": ["CONFIRMED", "REJECTED", "CANCELLED"],
    "CONFIRMED": ["PROCESSING", "PACKED", "DISPATCHED", "CANCELLED"],
    "PROCESSING": ["PACKED", "DISPATCHED", "CANCELLED"],
    "PACKED": ["DISPATCHED", "CANCELLED"],
    "DISPATCHED": ["DELIVERED", "CANCELLED"],
    "DELIVERED": ["REFUNDED"],
    "REJECTED": [],
    "CANCELLED": [],
    "REFUNDED": []
}

def generate_order_number(db: Session) -> str:
    year = datetime.now().year
    count = db.query(Order).count() + 1
    return f"ORD-{year}-{count:05d}"

def create_order_from_cart(
    db: Session,
    buyer: Buyer,
    delivery_location_id: Any,
    delivery_slot_start: Optional[datetime] = None,
    delivery_slot_end: Optional[datetime] = None,
    payment_terms: str = "ADVANCE",
    notes: Optional[str] = None
) -> Order:
    # 1. Verify Buyer KYC
    if buyer.kyc_status != "APPROVED":
        raise KYCPendingException("Buyer KYC must be approved before placing orders")

    # 2. Verify Delivery Location
    del_loc = db.query(BuyerLocation).filter(
        BuyerLocation.id == delivery_location_id,
        BuyerLocation.buyer_id == buyer.id
    ).first()
    if not del_loc:
        raise AppException(status_code=404, code="LOCATION_NOT_FOUND", message="Selected delivery location not found")

    cart = db.query(Cart).filter(Cart.buyer_id == buyer.id).first()
    if not cart or not cart.items:
        raise AppException(status_code=400, code="EMPTY_CART", message="Cannot checkout an empty cart")

    # Check that cart items belong to a single supplier (B2B orders are fulfilled per supplier)
    supplier_ids = list({item.supplier_product.supplier_id for item in cart.items})
    if len(supplier_ids) > 1:
        raise AppException(
            status_code=400,
            code="MULTI_SUPPLIER_CART",
            message="B2B orders must be placed per supplier. Please checkout items for one supplier at a time."
        )

    supplier_id = supplier_ids[0]
    supplier_loc_id = cart.items[0].supplier_location_id
    supplier = cart.items[0].supplier_product.supplier

    if supplier.kyc_status != "APPROVED":
        raise KYCPendingException(f"Supplier '{supplier.business_name}' is not currently approved for commercial sale")

    order_num = generate_order_number(db)
    
    subtotal = Decimal("0.00")
    total_tax = Decimal("0.00")
    order_items_to_create = []

    # Calculate financial totals
    for item in cart.items:
        sp = item.supplier_product
        qty = item.quantity_kg

        # Check MOQ
        if qty < sp.moq_kg:
            raise AppException(
                status_code=400,
                code="MOQ_NOT_MET",
                message=f"Order quantity {qty}kg does not meet minimum order quantity ({sp.moq_kg}kg) for {sp.product.name}"
            )

        unit_price = sp.base_price_per_kg
        line_subtotal = qty * unit_price
        tax_rate = Decimal("5.00")
        line_tax = round(line_subtotal * (tax_rate / Decimal("100.00")), 2)
        line_total = line_subtotal + line_tax

        subtotal += line_subtotal
        total_tax += line_tax

        order_items_to_create.append({
            "product_id": sp.product_id,
            "supplier_product_id": sp.id,
            "quantity_kg": qty,
            "unit_price_per_kg": unit_price,
            "tax_rate_percent": tax_rate,
            "tax_amount": line_tax,
            "total_price": line_total
        })

    delivery_fee = Decimal("150.00")
    total_amount = subtotal + total_tax + delivery_fee

    order = Order(
        order_number=order_num,
        buyer_id=buyer.id,
        supplier_id=supplier_id,
        supplier_location_id=supplier_loc_id,
        delivery_location_id=del_loc.id,
        status="PENDING",
        subtotal_amount=subtotal,
        tax_amount=total_tax,
        delivery_fee=delivery_fee,
        total_amount=total_amount,
        delivery_slot_start=delivery_slot_start,
        delivery_slot_end=delivery_slot_end,
        payment_terms=payment_terms,
        notes=notes
    )
    db.add(order)
    db.flush()

    # Reserve stock and create line items
    for item_data in order_items_to_create:
        # Pessimistic row locking reservation
        reserve_stock(
            db=db,
            supplier_id=supplier_id,
            location_id=supplier_loc_id,
            product_id=item_data["product_id"],
            requested_kg=item_data["quantity_kg"],
            order_id=order.id,
            actor_id=buyer.user_id
        )

        order_item = OrderItem(
            order_id=order.id,
            product_id=item_data["product_id"],
            supplier_product_id=item_data["supplier_product_id"],
            quantity_kg=item_data["quantity_kg"],
            unit_price_per_kg=item_data["unit_price_per_kg"],
            tax_rate_percent=item_data["tax_rate_percent"],
            tax_amount=item_data["tax_amount"],
            total_price=item_data["total_price"]
        )
        db.add(order_item)

    # Initial status history
    history = OrderStatusHistory(
        order_id=order.id,
        previous_status=None,
        new_status="PENDING",
        changed_by_user_id=buyer.user_id,
        reason="Order placed by buyer"
    )
    db.add(history)

    # Clear buyer's cart
    db.query(CartItem).filter(CartItem.cart_id == cart.id).delete()

    # Audit log
    log_audit_event(
        db=db,
        action="ORDER_CREATE",
        entity_type="ORDER",
        entity_id=str(order.id),
        actor_id=buyer.user_id,
        new_values={
            "order_number": order.order_number,
            "total_amount": float(order.total_amount),
            "items_count": len(order_items_to_create)
        }
    )

    # Notification
    dispatch_notification(
        db=db,
        user_id=supplier.user_id,
        event="ORDER_CONFIRMATION",
        subject=f"New Order Received: {order.order_number}",
        message=f"Buyer {buyer.business_name} placed order {order.order_number} for ₹{order.total_amount}."
    )

    db.commit()
    db.refresh(order)
    return order

def transition_order_status(
    db: Session,
    order: Order,
    new_status: str,
    user_id: Any,
    reason: Optional[str] = None
) -> Order:
    new_status = new_status.upper()
    current_status = order.status

    # Validate transition
    allowed = ALLOWED_TRANSITIONS.get(current_status, [])
    if new_status not in allowed:
        raise InvalidOrderStateTransitionException(
            f"Cannot transition order from '{current_status}' to '{new_status}'. Allowed transitions: {allowed}"
        )

    # Business logic triggers per transition
    if new_status == "CONFIRMED":
        allocate_reserved_stock(db, order.id, actor_id=user_id)
    elif new_status == "DISPATCHED":
        dispatch_allocated_stock(db, order.id, actor_id=user_id)
    elif new_status in ["REJECTED", "CANCELLED"]:
        release_order_stock(db, order.id, actor_id=user_id, reason=reason or f"Order {new_status.lower()}")

    order.status = new_status

    history = OrderStatusHistory(
        order_id=order.id,
        previous_status=current_status,
        new_status=new_status,
        changed_by_user_id=user_id,
        reason=reason
    )
    db.add(history)

    log_audit_event(
        db=db,
        action="ORDER_STATUS_UPDATE",
        entity_type="ORDER",
        entity_id=str(order.id),
        actor_id=user_id,
        old_values={"status": current_status},
        new_values={"status": new_status, "reason": reason}
    )

    dispatch_notification(
        db=db,
        user_id=order.buyer.user_id,
        event=f"ORDER_{new_status}",
        subject=f"Order {order.order_number} is now {new_status}",
        message=f"Status updated from {current_status} to {new_status}. {reason or ''}"
    )

    db.commit()
    db.refresh(order)
    return order

def supplier_accept_order(
    db: Session,
    order: Order,
    supplier_user_id: Any,
    accepted_items: Optional[List[dict]] = None
) -> Order:
    """
    Accepts full or partial order.
    If partial, accepted_items contains [{'item_id': str, 'accepted_quantity_kg': float}]
    """
    if order.status != "PENDING":
        raise InvalidOrderStateTransitionException(f"Order must be in PENDING status to accept. Current: {order.status}")

    if accepted_items:
        # Partial acceptance recalculation
        subtotal = Decimal("0.00")
        total_tax = Decimal("0.00")
        
        for acc in accepted_items:
            item_id = acc["item_id"]
            new_qty = Decimal(str(acc["accepted_quantity_kg"]))
            item = db.query(OrderItem).filter(OrderItem.id == item_id, OrderItem.order_id == order.id).first()
            if not item:
                continue

            if new_qty < item.quantity_kg:
                # Release the difference back to available stock
                diff = item.quantity_kg - new_qty
                # release difference
                inv = db.query(Inventory).filter(
                    Inventory.supplier_id == order.supplier_id,
                    Inventory.product_id == item.product_id
                ).with_for_update().first()
                if inv:
                    inv.quantity_reserved_kg -= diff
                    inv.quantity_available_kg += diff
                item.quantity_kg = new_qty
                item.tax_amount = round(new_qty * item.unit_price_per_kg * (item.tax_rate_percent / Decimal("100.00")), 2)
                item.total_price = (new_qty * item.unit_price_per_kg) + item.tax_amount

            subtotal += (item.quantity_kg * item.unit_price_per_kg)
            total_tax += item.tax_amount

        order.subtotal_amount = subtotal
        order.tax_amount = total_tax
        order.total_amount = subtotal + total_tax + order.delivery_fee

    return transition_order_status(
        db=db,
        order=order,
        new_status="CONFIRMED",
        user_id=supplier_user_id,
        reason="Order accepted by supplier"
    )
